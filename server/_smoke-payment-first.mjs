import mongoose from "mongoose";
import crypto from "crypto";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import * as restaurantReviewService from "./src/services/restaurantReview.service.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "src", ".env") });

const BASE = "http://localhost:5999/api/v1";
const MONGO_URI = "mongodb://localhost:27017/TableSpot";
const PASSWORD = "Test@1234";
const CUSTOMER_EMAIL = "pwcust1@gmail.com";
const OWNER_EMAIL = "pwowner1@gmail.com";

const results = [];
const check = (name, cond, extra = "") => {
  results.push({ name, pass: !!cond });
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? `  (${extra})` : ""}`);
};

const api = async (method, pathname, { token, body } = {}) => {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${pathname}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* no body */
  }
  return { status: res.status, json };
};

const signRzp = (orderId, paymentId) =>
  crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

const resolveFoodPrice = (food) => {
  const v = (food?.variants && food.variants[0]) || {};
  const offer = Number(v.offerPrice || 0);
  return offer > 0 ? offer : Number(v.price || food?.price || 0);
};

(async () => {
  let bookingId = null;
  let billId = null;
  let paymentId = null;
  let tableSnapshots = [];
  let restaurantId = null;
  let restaurantSnapshots = {};
  let ownerId = null;
  let ownerStatusSnapshot = null;
  let custId = null;

  try {
    await mongoose.connect(MONGO_URI);
    const db = mongoose.connection.db;
    const oid = (id) => new mongoose.Types.ObjectId(String(id));

    const login = await api("POST", "/auth/login", {
      body: { email: CUSTOMER_EMAIL, password: PASSWORD },
    });
    const loginOwner = await api("POST", "/auth/login", {
      body: { email: OWNER_EMAIL, password: PASSWORD },
    });
    check(
      "login customer + owner",
      login.status === 200 && loginOwner.status === 200
    );
    const custToken = login.json?.data?.accessToken || login.json?.accessToken;
    const ownerToken =
      loginOwner.json?.data?.accessToken || loginOwner.json?.accessToken;
    if (!custToken || !ownerToken) {
      console.log("SKIP: could not obtain tokens", JSON.stringify(login.json));
      return;
    }

    const customer = await db.collection("users").findOne({ email: CUSTOMER_EMAIL });
    if (!customer) {
      console.log("SKIP: demo customer not found. Run seed-demo.cjs first.");
      return;
    }
    custId = customer._id;

    const restaurant = await db
      .collection("restaurants")
      .findOne({ restaurantCode: "RST100001" });
    if (!restaurant) {
      console.log("SKIP: RST100001 not found.");
      return;
    }
    restaurantId = restaurant._id;
    ownerId = restaurant.ownerId;

    // Snapshot & force a PAY_TO_BOOK policy (FIXED_AMOUNT 150) so the test is
    // deterministic regardless of the seeded policy.
    restaurantSnapshots = {
      bookingPaymentPolicy: JSON.parse(
        JSON.stringify(restaurant.bookingPaymentPolicy || {})
      ),
      verificationStatus: restaurant.verificationStatus,
      isActive: restaurant.isActive,
    };
    await db.collection("restaurants").updateOne(
      { _id: restaurantId },
      {
        $set: {
          bookingPaymentPolicy: {
            type: "PAY_TO_BOOK",
            paymentType: "FIXED_AMOUNT",
            fixedAmount: 150,
            percentage: 0,
            maximumAmount: 200,
          },
          verificationStatus: "Verified",
          isActive: true,
        },
      }
    );

    const owner = await db.collection("users").findOne({ _id: ownerId });
    ownerStatusSnapshot = owner?.bookingStatus || "ACTIVE";
    if (ownerStatusSnapshot === "BOOKING_RESTRICTED") {
      await db
        .collection("users")
        .updateOne({ _id: ownerId }, { $set: { bookingStatus: "ACTIVE" } });
    }

    // Pick two non-conflicting tables (capacity >= 4) for the test window.
    const WINDOW = new Date();
    WINDOW.setDate(WINDOW.getDate() + 2);
    WINDOW.setHours(19, 0, 0, 0);
    const conflictStart = new Date(WINDOW.getTime() - 5 * 3600 * 1000);
    const conflictEnd = new Date(WINDOW.getTime() + 5 * 3600 * 1000);
    const conflictBookings = await db.collection("bookings")
      .find({
        restaurantId,
        isDeleted: false,
        bookingDateTime: { $gte: conflictStart, $lte: conflictEnd },
        bookingStatus: { $in: ["Pending", "Confirmed", "Checked In"] },
      })
      .toArray();
    const usedTableIds = new Set();
    for (const b of conflictBookings) {
      if (Array.isArray(b.tables)) {
        for (const t of b.tables) usedTableIds.add(String(t.tableId));
      }
      if (b.tableId) usedTableIds.add(String(b.tableId));
    }
    const allTables = await db.collection("restauranttables")
      .find({ restaurantId, capacity: { $gte: 4 } })
      .toArray();
    const freeTables = allTables.filter(
      (t) =>
        !usedTableIds.has(String(t._id)) &&
        t.status === "Available" &&
        t.isReservable !== false
    );
    const candidates = freeTables.length >= 2 ? freeTables : allTables.filter((t) => !usedTableIds.has(String(t._id)));
    const chosen = candidates.slice(0, 2);
    if (chosen.length < 2) {
      console.log("SKIP: fewer than 2 usable tables in test window.");
      return;
    }
    for (const t of chosen) {
      tableSnapshots.push({ _id: t._id, status: t.status, isReservable: t.isReservable });
      await db.collection("restauranttables").updateOne(
        { _id: t._id },
        { $set: { status: "Available", isReservable: true } }
      );
    }

    const foods = await db.collection("foods")
      .find({ restaurantId, isDeleted: { $ne: true }, isAvailable: { $ne: false } })
      .toArray();
    if (foods.length < 2) {
      console.log("SKIP: fewer than 2 foods for RST100001.");
      return;
    }
    const [foodA, foodB] = foods.slice(0, 2);
    const preOrderedFoods = [
      { foodId: String(foodA._id), variantName: "Regular", quantity: 1, price: 0 },
      { foodId: String(foodB._id), variantName: "Regular", quantity: 2, price: 0 },
    ];
    const expectedSubTotal = resolveFoodPrice(foodA) + resolveFoodPrice(foodB) * 2;

    const tablesPayload = chosen.map((t) => ({ tableId: String(t._id), seatIds: [] }));
    const bookingData = {
      restaurantId: String(restaurantId),
      tables: tablesPayload,
      bookingDateTime: WINDOW.toISOString(),
      expectedDuration: 120,
      numberOfGuests: 4,
      specialRequest: "__SMOKE_PAYMENT_FIRST__",
      preOrderedFoods,
    };

    // ============ 1. Direct booking blocked for PAY_TO_BOOK ============
    const directBooking = await api("POST", "/bookings", {
      token: custToken,
      body: {
        restaurantId: String(restaurantId),
        tables: tablesPayload,
        bookingDateTime: WINDOW.toISOString(),
        expectedDuration: 120,
        numberOfGuests: 4,
        bookingType: "Online",
        preOrderedFoods,
      },
    });
    check(
      "customer direct booking for PAY_TO_BOOK -> 409",
      directBooking.status === 409,
      `got ${directBooking.status}`
    );

    // ============ 2. Payment-first order creation ============
    const key = `pf-smoke-${Date.now()}`;
    const orderRes = await api("POST", "/payments/create-order", {
      token: custToken,
      body: { idempotencyKey: key, purpose: "BOOKING_ADVANCE", bookingData },
    });
    const orderData = orderRes.json?.data;
    check(
      "create-order returns order + key id",
      orderRes.status === 200 &&
        !!orderData?.order?.id &&
        !!orderData?.razorpayKeyId,
      `got ${orderRes.status}`
    );
    paymentId = orderData?.paymentId || null;
    check(
      "advance amount is server-computed (FIXED 150 = 15000 paise)",
      Number(orderData?.order?.amount) === 15000,
      `got ${orderData?.order?.amount}`
    );
    const payDoc = paymentId
      ? await db.collection("payments").findOne({ _id: oid(paymentId) })
      : null;
    check(
      "payment stored Pending with bookingId null",
      payDoc && payDoc.paymentStatus === "Pending" && !payDoc.bookingId,
      `got ${payDoc?.paymentStatus}`
    );
    check(
      "payment carries bookingData snapshot (2 pre-order foods)",
      payDoc &&
        !!payDoc.bookingData &&
        Array.isArray(payDoc.bookingData.preOrderedFoods) &&
        payDoc.bookingData.preOrderedFoods.length === 2 &&
        String(payDoc.bookingData.restaurantId) === String(restaurantId)
    );
    const bookingBeforePayment = await db.collection("bookings").countDocuments({
      specialRequest: "__SMOKE_PAYMENT_FIRST__",
    });
    check(
      "zero bookings created before payment capture",
      bookingBeforePayment === 0,
      `got ${bookingBeforePayment}`
    );

    // ============ 3. Idempotency ============
    const orderAgain = await api("POST", "/payments/create-order", {
      token: custToken,
      body: { idempotencyKey: key, purpose: "BOOKING_ADVANCE", bookingData },
    });
    check(
      "idempotent create-order reuses same order",
      orderAgain.status === 200 &&
        orderAgain.json?.data?.order?.id === orderData?.order?.id,
      `got ${orderAgain.status}`
    );

    // ============ 4. Verify (valid HMAC signature) ============
    const rzpPayId = `pay_smoke_${Date.now()}`;
    const sig = signRzp(orderData.order.id, rzpPayId);
    const verifyRes = await api("POST", "/payments/verify", {
      token: custToken,
      body: {
        razorpay_order_id: orderData.order.id,
        razorpay_payment_id: rzpPayId,
        razorpay_signature: sig,
      },
    });
    const verifyData = verifyRes.json?.data;
    check(
      "verify returns created bookingId (no bookingId input)",
      verifyRes.status === 200 && !!verifyData?.bookingId,
      `got ${verifyRes.status}/${verifyData?.bookingId}`
    );
    bookingId = verifyData?.bookingId || null;

    const booking = bookingId
      ? await db.collection("bookings").findOne({ _id: oid(bookingId) })
      : null;
    check(
      "booking created CONFIRMED via captured payment",
      booking && booking.bookingStatus === "Confirmed",
      `got ${booking?.bookingStatus}`
    );
    check(
      "booking linked to sourcePaymentId",
      booking && String(booking.sourcePaymentId) === String(paymentId)
    );
    check(
      "advanceAmount == 150 (captured amount)",
      Number(booking?.advanceAmount) === 150,
      `got ${booking?.advanceAmount}`
    );
    check(
      "totalAmount == server-resolved pre-order total",
      Math.abs(Number(booking?.totalAmount) - expectedSubTotal) < 0.01,
      `got ${booking?.totalAmount} vs ${expectedSubTotal}`
    );
    check(
      "paymentStatus Partially Paid (150 < total)",
      booking?.paymentStatus === "Partially Paid",
      `got ${booking?.paymentStatus}`
    );
    const payAfter = paymentId
      ? await db.collection("payments").findOne({ _id: oid(paymentId) })
      : null;
    check(
      "payment now CAPTURED and linked to booking",
      payAfter &&
        payAfter.paymentStatus === "Captured" &&
        String(payAfter.bookingId) === String(bookingId)
    );

    // ============ 5. Re-verify idempotency ============
    const reVerify = await api("POST", "/payments/verify", {
      token: custToken,
      body: {
        razorpay_order_id: orderData.order.id,
        razorpay_payment_id: rzpPayId,
        razorpay_signature: sig,
      },
    });
    check(
      "re-verify is idempotent (already verified)",
      reVerify.status === 200 &&
        (reVerify.json?.message || "").toLowerCase().includes("already"),
      `got ${reVerify.status}/${reVerify.json?.message}`
    );

    // ============ 6. Owner converts booking to bill ============
    const convertRes = await api("POST", `/bills/${bookingId}/convert-to-bill`, {
      token: ownerToken,
      body: { notes: "__SMOKE_PAYMENT_FIRST__" },
    });
    const bill = convertRes.json?.data?.bill || convertRes.json?.data;
    billId = bill?._id || null;
    check(
      "convert-to-bill returns Generated bill",
      convertRes.status === 201 && bill?.billStatus === "Generated",
      `got ${convertRes.status}/${bill?.billStatus}`
    );
    check(
      "bill seeded with 2 pre-order items",
      Array.isArray(bill?.orderedItems) && bill.orderedItems.length === 2,
      `got ${bill?.orderedItems?.length}`
    );
    check(
      "bill ledger carries the 150 advance",
      Array.isArray(bill?.payment?.payments) &&
        bill.payment.payments.some(
          (p) => Number(p.amount) === 150 && /advance/i.test(p.notes || "")
        ),
      JSON.stringify(bill?.payment?.payments)
    );
    const balanceDue = Number(bill?.payment?.balanceDue);
    check("bill has an outstanding balance after advance", balanceDue > 0, `got ${balanceDue}`);

    // ============ 7. COMPLETED-only review gate ============
    const eligWhileConfirmed = await restaurantReviewService.getEligibility({
      userId: custId,
      restaurantId,
    });
    check(
      "no review eligibility while booking Confirmed (COMPLETED-only)",
      eligWhileConfirmed.canReview === false,
      `canReview=${eligWhileConfirmed.canReview}`
    );

    // ============ 8. Spot payment settles the bill ============
    const payBillRes = await api("POST", `/bills/${billId}/payments`, {
      token: ownerToken,
      body: { paymentMethod: "UPI", amount: balanceDue, notes: "Spot payment" },
    });
    const billPaid = payBillRes.json?.data?.bill || payBillRes.json?.data;
    check(
      "spot payment settles bill to PAID",
      payBillRes.status === 200 && billPaid?.billStatus === "Paid",
      `got ${payBillRes.status}/${billPaid?.billStatus}`
    );
    check(
      "bill balanceDue now 0",
      Number(billPaid?.payment?.balanceDue) === 0,
      `got ${billPaid?.payment?.balanceDue}`
    );
    const bookingAfterPay = await db.collection("bookings").findOne({ _id: oid(bookingId) });
    check(
      "booking paymentStatus becomes Paid",
      bookingAfterPay?.paymentStatus === "Paid",
      `got ${bookingAfterPay?.paymentStatus}`
    );

    // ============ 9. Complete booking -> review unlocks ============
    const completeRes = await api("PATCH", `/bookings/${bookingId}/status`, {
      token: ownerToken,
      body: { bookingStatus: "Completed" },
    });
    check(
      "owner marks booking Completed",
      completeRes.status === 200,
      `got ${completeRes.status}`
    );
    const eligCompleted = await restaurantReviewService.getEligibility({
      userId: custId,
      restaurantId,
    });
    check(
      "review eligible after COMPLETED + PAID bill",
      eligCompleted.canReview === true,
      `canReview=${eligCompleted.canReview}`
    );
  } catch (e) {
    console.error("SMOKE ERROR:", e);
  } finally {
    if (mongoose.connection.readyState === 1) {
      try {
        const db = mongoose.connection.db;
        const oid = (id) => new mongoose.Types.ObjectId(String(id));
        if (bookingId) {
          await db.collection("bookings").deleteOne({ _id: oid(bookingId) });
          await db.collection("bookings").deleteMany({ specialRequest: "__SMOKE_PAYMENT_FIRST__" });
          await db.collection("refunds").deleteMany({ bookingId: oid(bookingId) });
          await db.collection("payments").deleteMany({ bookingId: oid(bookingId) });
        }
        if (billId) {
          await db.collection("bills").deleteOne({ _id: oid(billId) });
          await db.collection("refunds").deleteMany({ billId: oid(billId) });
        }
        if (paymentId) {
          await db.collection("payments").deleteOne({ _id: oid(paymentId) });
        }
        for (const s of tableSnapshots) {
          await db.collection("restauranttables").updateOne(
            { _id: oid(s._id) },
            { $set: { status: s.status, isReservable: s.isReservable } }
          );
        }
        if (restaurantId) {
          await db.collection("restaurants").updateOne(
            { _id: restaurantId },
            {
              $set: {
                bookingPaymentPolicy: restaurantSnapshots.bookingPaymentPolicy,
                verificationStatus: restaurantSnapshots.verificationStatus,
                isActive: restaurantSnapshots.isActive,
              },
            }
          );
        }
        if (ownerId && ownerStatusSnapshot) {
          await db
            .collection("users")
            .updateOne({ _id: ownerId }, { $set: { bookingStatus: ownerStatusSnapshot } });
        }
      } catch (e) {
        console.error("CLEANUP ERROR:", e);
      }
    }
    await mongoose.disconnect();
  }

  const fails = results.filter((r) => !r.pass);
  console.log(`\n${results.length - fails.length}/${results.length} checks passed`);
  process.exit(fails.length ? 1 : 0);
})();

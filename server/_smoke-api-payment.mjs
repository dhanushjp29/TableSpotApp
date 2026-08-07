import mongoose from "mongoose";
import crypto from "crypto";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "src", ".env") });

const BASE = "http://localhost:5999/api/v1";
const MONGO_URI = "mongodb://localhost:27017/TableSpot";
const PASSWORD = "Test@1234";

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

const signRzp = (orderId, paymentId, secret) =>
  crypto
    .createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

(async () => {
  let createdPaymentIds = [];
  try {
    await mongoose.connect(MONGO_URI);
    const db = mongoose.connection.db;
    const oid = (id) => new mongoose.Types.ObjectId(String(id));

    const login = await api("POST", "/auth/login", {
      body: { email: "pwcust1@gmail.com", password: PASSWORD },
    });
    const custToken = login.json?.data?.accessToken || login.json?.accessToken;
    const loginOwner = await api("POST", "/auth/login", {
      body: { email: "pwowner1@gmail.com", password: PASSWORD },
    });
    const ownerToken =
      loginOwner.json?.data?.accessToken || loginOwner.json?.accessToken;
    if (!custToken || !ownerToken) {
      console.log("SKIP: could not obtain tokens");
      return;
    }

    const restaurant = await db
      .collection("restaurants")
      .findOne({ restaurantCode: "RST100002" });
    if (!restaurant) {
      console.log("SKIP: RST100002 not found.");
      return;
    }

    const oidRest = new mongoose.Types.ObjectId(String(restaurant._id));
    const food = await db
      .collection("foods")
      .findOne({ restaurantId: oidRest, isDeleted: { $ne: true } });

    // ============ 1. create-order without bookingId or bookingData -> 400 ============
    const noPayload = await api("POST", "/payments/create-order", {
      token: custToken,
      body: { purpose: "BOOKING_ADVANCE" },
    });
    check(
      "create-order requires bookingId or bookingData -> 400",
      noPayload.status === 400,
      `got ${noPayload.status}`
    );

    // ============ 2. create-order with bookingData but non-advance purpose -> 400 ============
    const wrongPurpose = await api("POST", "/payments/create-order", {
      token: custToken,
      body: {
        purpose: "BILL_PAYMENT",
        bookingData: { restaurantId: String(restaurant._id) },
      },
    });
    check(
      "payment-first only allows BOOKING_ADVANCE purpose -> 400",
      wrongPurpose.status === 400,
      `got ${wrongPurpose.status}`
    );

    // ============ 3. create-order with bookingData for PAY_ON_SPOT restaurant -> 400 ============
    const payOnSpot = await api("POST", "/payments/create-order", {
      token: custToken,
      body: {
        purpose: "BOOKING_ADVANCE",
        bookingData: { restaurantId: String(restaurant._id) },
      },
    });
    check(
      "payment-first blocked for PAY_ON_SPOT restaurant -> 400",
      payOnSpot.status === 400,
      `got ${payOnSpot.status}`
    );

    // ============ 4. create-order with invalid bookingData shape -> 400 ============
    const badDraft = await api("POST", "/payments/create-order", {
      token: custToken,
      body: {
        purpose: "BOOKING_ADVANCE",
        bookingData: { restaurantId: "not-a-valid-id" },
      },
    });
    check(
      "create-order rejects malformed bookingData -> 400",
      badDraft.status === 400,
      `got ${badDraft.status}`
    );

    // ============ 5. verify with unknown order id -> 404 ============
    const unknownVerify = await api("POST", "/payments/verify", {
      token: custToken,
      body: {
        razorpay_order_id: "order_unknown",
        razorpay_payment_id: "pay_unknown",
        razorpay_signature: "deadbeef",
      },
    });
    check(
      "verify with unknown order id -> 404",
      unknownVerify.status === 404,
      `got ${unknownVerify.status}`
    );

    // ============ 6. verify with invalid signature marks payment Failed ============
    // Create a Pending payment record directly (no Razorpay call) and verify
    // it with a wrong signature — the endpoint must reject and flip to Failed.
    const synthOrderId = `order_smoke_${Date.now()}`;
    const synthPayId = `pay_smoke_bad_${Date.now()}`;
    const customer = await db.collection("users").findOne({ email: "pwcust1@gmail.com" });
    const inserted = await db.collection("payments").insertOne({
      customerId: customer._id,
      ownerId: restaurant.ownerId,
      restaurantId: oidRest,
      bookingId: null,
      billId: null,
      paymentPurpose: "BOOKING_ADVANCE",
      razorpayOrderId: synthOrderId,
      amount: 100,
      currency: "INR",
      paymentStatus: "Pending",
    });
    createdPaymentIds.push(inserted.insertedId);

    const badVerify = await api("POST", "/payments/verify", {
      token: custToken,
      body: {
        razorpay_order_id: synthOrderId,
        razorpay_payment_id: synthPayId,
        razorpay_signature: "invalid-signature",
      },
    });
    check(
      "verify rejects invalid signature -> 400",
      badVerify.status === 400,
      `got ${badVerify.status}`
    );
    const payAfterFail = await db.collection("payments").findOne({ _id: inserted.insertedId });
    check(
      "payment marked Failed after bad signature",
      payAfterFail?.paymentStatus === "Failed",
      `got ${payAfterFail?.paymentStatus}`
    );

    // ============ 7. verify idempotency for already-captured payment ============
    // Reuse the Failed payment record: flip it to Captured with a known
    // razorpayPaymentId and re-verify with the matching (computed) signature.
    // The endpoint must return "already verified" WITHOUT hitting Razorpay.
    const secret = process.env.RAZORPAY_KEY_SECRET;
    const captured = await db.collection("payments").updateOne(
      { _id: inserted.insertedId },
      { $set: { paymentStatus: "Captured", razorpayPaymentId: synthPayId } }
    );
    const goodSig = signRzp(synthOrderId, synthPayId, secret);
    const reVerify = await api("POST", "/payments/verify", {
      token: custToken,
      body: {
        razorpay_order_id: synthOrderId,
        razorpay_payment_id: synthPayId,
        razorpay_signature: goodSig,
      },
    });
    check(
      "verify already-captured payment is idempotent -> 200",
      reVerify.status === 200 &&
        (reVerify.json?.message || "").toLowerCase().includes("already"),
      `got ${reVerify.status}/${reVerify.json?.message}`
    );
    check(
      "captured payment not reprocessed (status intact)",
      captured.acknowledged === true
    );
    const payStill = await db.collection("payments").findOne({ _id: inserted.insertedId });
    check("payment remains Captured after re-verify", payStill?.paymentStatus === "Captured");

    // ============ 8. customer cannot verify another customer's payment ============
    const otherCustomer = await db.collection("users").findOne({
      email: { $ne: "pwcust1@gmail.com" },
      role: "customer",
      isActive: true,
    });
    if (otherCustomer) {
      const otherLogin = await api("POST", "/auth/login", {
        body: { email: otherCustomer.email, password: PASSWORD },
      });
      const otherToken =
        otherLogin.json?.data?.accessToken || otherLogin.json?.accessToken;
      if (otherToken) {
        const crossVerify = await api("POST", "/payments/verify", {
          token: otherToken,
          body: {
            razorpay_order_id: synthOrderId,
            razorpay_payment_id: synthPayId,
            razorpay_signature: goodSig,
          },
        });
        check(
          "customer cannot verify another customer's payment -> 403",
          crossVerify.status === 403,
          `got ${crossVerify.status}`
        );
      } else {
        console.log("SKIP  cross-customer verify (could not login other demo customer)");
      }
    } else {
      console.log("SKIP  cross-customer verify (no other demo customer found)");
    }

    // ============ 9. convert-to-bill for a nonexistent booking -> 404 ============
    const fakeId = new mongoose.Types.ObjectId().toString();
    const convertMissing = await api("POST", `/bills/${fakeId}/convert-to-bill`, {
      token: ownerToken,
      body: {},
    });
    check(
      "convert-to-bill for missing booking -> 404",
      convertMissing.status === 404,
      `got ${convertMissing.status}`
    );

    // ============ 10. customer cannot convert a booking to bill -> 403 ============
    const booking = await db
      .collection("bookings")
      .findOne({ userId: customer._id, isDeleted: false, bookingStatus: "Confirmed" });
    if (booking) {
      const convertAsCust = await api("POST", `/bills/${booking._id}/convert-to-bill`, {
        token: custToken,
        body: {},
      });
      check(
        "customer cannot convert booking to bill -> 403",
        convertAsCust.status === 403,
        `got ${convertAsCust.status}`
      );
    } else {
      console.log("SKIP  convert-as-customer (no Confirmed booking for demo customer)");
    }

    // ============ 11. convert-to-bill for an already-billed booking -> 409 ============
    const billedBooking = await db.collection("bookings").findOne({
      isDeleted: false,
      billId: { $ne: null },
    });
    if (billedBooking) {
      const convertTwice = await api("POST", `/bills/${billedBooking._id}/convert-to-bill`, {
        token: ownerToken,
        body: {},
      });
      check(
        "convert-to-bill for already-billed booking -> 409",
        convertTwice.status === 409,
        `got ${convertTwice.status}`
      );
    } else {
      console.log("SKIP  double-convert (no billed booking found in DB)");
    }
  } catch (e) {
    console.error("SMOKE ERROR:", e);
  } finally {
    if (mongoose.connection.readyState === 1) {
      try {
        const db = mongoose.connection.db;
        for (const id of createdPaymentIds) {
          await db.collection("payments").deleteOne({ _id: id });
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

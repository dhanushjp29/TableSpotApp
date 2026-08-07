import mongoose from "mongoose";
import "./src/models/Bill.js";

const BASE = "http://localhost:5999/api/v1";
const MONGO_URI = "mongodb://localhost:27017/TableSpot";
const PASSWORD = "Test@1234";

const results = [];
const check = (name, cond, extra = "") => {
  results.push({ name, pass: !!cond });
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? `  (${extra})` : ""}`);
};

const api = async (method, path, { token, body } = {}) => {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
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

(async () => {
  let createdBookingIds = [];
  let createdBillId = null;
  let tableSnapshots = [];
  let restoreTables = async () => {};
  try {
    await mongoose.connect(MONGO_URI);
    const db = mongoose.connection.db;

    const login = await api("POST", "/auth/login", {
      body: { email: "pwcust1@gmail.com", password: PASSWORD },
    });
    const loginOwner = await api("POST", "/auth/login", {
      body: { email: "pwowner1@gmail.com", password: PASSWORD },
    });
    check("login customer + owner", login.status === 200 && loginOwner.status === 200);
    const custToken = login.json?.data?.accessToken || login.json?.accessToken;
    const ownerToken = loginOwner.json?.data?.accessToken || loginOwner.json?.accessToken;
    if (!custToken || !ownerToken) {
      console.log("SKIP: could not obtain tokens", JSON.stringify(login.json));
      return;
    }

    const restaurant = await db.collection("restaurants").findOne({ restaurantCode: "RST100001" });
    const toId = (id) => new mongoose.Types.ObjectId(String(id));
    const loadTable = async (num) =>
      db.collection("restauranttables").findOne({ restaurantId: restaurant._id, tableNumber: num });

    // Reserve two tables for the test window (t2 and t5), snapshot first
    const WINDOW = new Date();
    WINDOW.setDate(WINDOW.getDate() + 2);
    WINDOW.setHours(18, 0, 0, 0);
    const WINDOW2 = new Date(WINDOW.getTime() + 150 * 60 * 1000);

    const t2 = await loadTable(2);
    const t5 = await loadTable(5);
    if (!t2 || !t5) {
      console.log("SKIP: tables 2/5 missing");
      return;
    }
    for (const t of [t2, t5]) {
      tableSnapshots.push({ _id: toId(t._id), status: t.status, isReservable: t.isReservable });
      await db.collection("restauranttables").updateOne(
        { _id: toId(t._id) },
        { $set: { status: "Available", isReservable: true } }
      );
    }

    const restoreTablesLocal = async () => {
      for (const s of tableSnapshots) {
        await db.collection("restauranttables").updateOne(
          { _id: s._id },
          { $set: { status: s.status, isReservable: s.isReservable } }
        );
      }
    };
    restoreTables = restoreTablesLocal;

    // ============ FIX 1: Bill write authorization (customer -> 403) ============
    const bkg1 = await db.collection("bookings").findOne({ bookingCode: "BKG400001" });
    const food1 = await db.collection("foods").findOne({ restaurantId: restaurant._id, foodCode: "FOD300001" });
    const createBillAsCust = await api("POST", "/bills", {
      token: custToken,
      body: { bookingId: String(bkg1._id), orderedItems: [{ foodId: String(food1._id), foodName: "Paneer Tikka", quantity: 1 }] },
    });
    check("FIX1 customer cannot create a bill", createBillAsCust.status === 403, `got ${createBillAsCust.status}`);
    const patchBillAsCust = await api("PATCH", "/bills/BIL_TEST1", {
      token: custToken,
      body: { notes: "hax" },
    });
    check("FIX1 customer cannot update a bill", patchBillAsCust.status === 403, `got ${patchBillAsCust.status}`);
    const payBillAsCust = await api("POST", "/bills/BIL_TEST1/payments", {
      token: custToken,
      body: { amount: 10, paymentMethod: "Cash" },
    });
    check("FIX1 customer cannot add bill payment", payBillAsCust.status === 403, `got ${payBillAsCust.status}`);
    const statusBillAsCust = await api("PATCH", "/bills/BIL_TEST1/status", {
      token: custToken,
      body: { billStatus: "Paid" },
    });
    check("FIX1 customer cannot mark bill status", statusBillAsCust.status === 403, `got ${statusBillAsCust.status}`);

    // ============ FIX 2: Booking PATCH hardening (customer -> 400) ============
    const updStatus = await api("PATCH", `/bookings/${bkg1._id}`, {
      token: custToken,
      body: { bookingStatus: "Completed" },
    });
    check("FIX2 bookingStatus not settable via PATCH", updStatus.status === 400, `got ${updStatus.status}`);
    const updTotal = await api("PATCH", `/bookings/${bkg1._id}`, {
      token: custToken,
      body: { totalAmount: 1 },
    });
    check("FIX2 totalAmount not settable via PATCH", updTotal.status === 400, `got ${updTotal.status}`);
    const updPay = await api("PATCH", `/bookings/${bkg1._id}`, {
      token: custToken,
      body: { paymentStatus: "Paid" },
    });
    check("FIX2 paymentStatus not settable via PATCH", updPay.status === 400, `got ${updPay.status}`);
    const updValid = await api("PATCH", `/bookings/${bkg1._id}`, {
      token: custToken,
      body: { numberOfGuests: 3 },
    });
    const bkg1After = await db.collection("bookings").findOne({ bookingCode: "BKG400001" });
    check("FIX2 legit scheduling PATCH still works", updValid.status === 200 && bkg1After.numberOfGuests === 3, `got ${updValid.status}`);
    await db.collection("bookings").updateOne({ bookingCode: "BKG400001" }, { $set: { numberOfGuests: 2 } });

    // ============ FIX 2b/7: Create hardening (customer payload ignored) ============
    const fakeId = new mongoose.Types.ObjectId().toString();
    const custCreate = await api("POST", "/bookings", {
      token: custToken,
      body: {
        restaurantId: String(restaurant._id),
        tableId: String(t2._id),
        bookingDateTime: WINDOW.toISOString(),
        expectedDuration: 120,
        numberOfGuests: 2,
        specialRequest: "__SMOKE_API__",
        bookingStatus: "Completed",
        bookingType: "Walk-In",
        paymentStatus: "Paid",
        paymentMethod: "Card",
        totalAmount: 999999,
        advanceAmount: 5000,
        billId: fakeId,
      },
    });
    const custBooking = custCreate.json?.data?.booking;
    if (custBooking?._id) createdBookingIds.push(custBooking._id);
    check("FIX7 customer create does NOT get Completed", custCreate.status === 201 && custBooking?.bookingStatus === "Confirmed", `got ${custCreate.status}/${custBooking?.bookingStatus}`);
    check("FIX7 customer create forced to Online", custBooking?.bookingType === "Online");
    check("FIX7 server derives totalAmount (0)", custBooking?.totalAmount === 0, `got ${custBooking?.totalAmount}`);
    check("FIX7 payment forced Pending/Cash", custBooking?.paymentStatus === "Pending" && custBooking?.paymentMethod === "Cash");
    check("FIX7 billId forced null", custBooking?.billId === null || custBooking?.billId === undefined);

    // ============ FIX 3: State machine (owner) ============
    const walkIn = await api("POST", "/bookings/walk-in", {
      token: ownerToken,
      body: {
        restaurantId: String(restaurant._id),
        tableId: String(t2._id),
        bookingDateTime: WINDOW2.toISOString(),
        expectedDuration: 120,
        numberOfGuests: 2,
        specialRequest: "__SMOKE_API__",
        bookingStatus: "Confirmed",
      },
    });
    const walkBooking = walkIn.json?.data?.booking;
    if (walkBooking?._id) createdBookingIds.push(walkBooking._id);
    check("FIX3 owner walk-in created Confirmed", walkIn.status === 201 && walkBooking?.bookingStatus === "Confirmed", `got ${walkIn.status}/${walkBooking?.bookingStatus}`);

    const sameStatus = await api("PATCH", `/bookings/${walkBooking._id}/status`, {
      token: ownerToken,
      body: { bookingStatus: "Confirmed" },
    });
    check("FIX3 same-status transition tolerated", sameStatus.status === 200, `got ${sameStatus.status}`);

    const toCompleted = await api("PATCH", `/bookings/${walkBooking._id}/status`, {
      token: ownerToken,
      body: { bookingStatus: "Completed" },
    });
    check("FIX3 CONFIRMED -> COMPLETED allowed", toCompleted.status === 200, `got ${toCompleted.status}`);

    const resurrect = await api("PATCH", `/bookings/${walkBooking._id}/status`, {
      token: ownerToken,
      body: { bookingStatus: "Confirmed" },
    });
    check("FIX3 terminal COMPLETED cannot resurrect", resurrect.status === 409, `got ${resurrect.status}`);

    const toNoShow = await api("PATCH", `/bookings/${walkBooking._id}/status`, {
      token: ownerToken,
      body: { bookingStatus: "No Show" },
    });
    check("FIX3 COMPLETED -> NO_SHOW blocked", toNoShow.status === 409, `got ${toNoShow.status}`);

    // ============ FIX 10: Bill status reconciliation (owner) ============
    const createBill = await api("POST", "/bills", {
      token: ownerToken,
      body: {
        bookingId: String(walkBooking._id),
        orderedItems: [{ foodId: String(food1._id), foodName: "Paneer Tikka", quantity: 2, unitPrice: 280, totalPrice: 560 }],
      },
    });
    const billData = createBill.json?.data?.bill || createBill.json?.data;
    createdBillId = billData?._id || null;
    check("FIX10 owner creates bill for completed booking", createBill.status === 201 && billData?.billStatus === "Generated", `got ${createBill.status}/${billData?.billStatus}`);

    const markPaid = await api("PATCH", `/bills/${billData._id}/status`, {
      token: ownerToken,
      body: { billStatus: "Paid" },
    });
    check("FIX10 GENERATED->PAID without payments -> 409", markPaid.status === 409, `got ${markPaid.status}`);

    const markCancel = await api("PATCH", `/bills/${billData._id}/status`, {
      token: ownerToken,
      body: { billStatus: "Cancelled" },
    });
    check("FIX10 GENERATED->CANCELLED allowed", markCancel.status === 200, `got ${markCancel.status}`);

    const cancelToPaid = await api("PATCH", `/bills/${billData._id}/status`, {
      token: ownerToken,
      body: { billStatus: "Paid" },
    });
    check("FIX10 CANCELLED is terminal (-> Paid 409)", cancelToPaid.status === 409, `got ${cancelToPaid.status}`);

    // createBill gate: bill for a PENDING booking must be rejected
    const billForPending = await api("POST", "/bills", {
      token: ownerToken,
      body: { bookingId: String(bkg1._id), orderedItems: [{ foodId: String(food1._id), foodName: "Paneer Tikka", quantity: 1 }] },
    });
    check("FIX10 bill for PENDING booking -> 409", billForPending.status === 409, `got ${billForPending.status}`);
  } catch (e) {
    console.error("SMOKE ERROR:", e);
  } finally {
    if (mongoose.connection.readyState === 1) {
      try {
        await db_collection_delete(createdBookingIds);
        if (createdBillId) await mongoose.connection.db.collection("bills").deleteOne({ _id: new mongoose.Types.ObjectId(String(createdBillId)) });
        await restoreTables();
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

async function db_collection_delete(ids) {
  if (!ids || !ids.length) return;
  const oids = ids.map((id) => new mongoose.Types.ObjectId(String(id)));
  await mongoose.connection.db.collection("bookings").deleteMany({ _id: { $in: oids } });
  await mongoose.connection.db.collection("bookings").deleteMany({ specialRequest: "__SMOKE_API__" });
}

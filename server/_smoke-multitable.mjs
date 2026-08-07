import mongoose from "mongoose";
import { createBooking } from "./src/services/booking.service.js";
import { backfillTableSeats } from "./src/services/table.service.js";
import { SEAT_SELECTION_MODE } from "./src/utils/constants.js";
import "./src/models/Bill.js";

const MONGO_URI = "mongodb://localhost:27017/TableSpot";
const WINDOW = new Date();
WINDOW.setDate(WINDOW.getDate() + 1);
WINDOW.setHours(20, 0, 0, 0);

const results = [];
const check = (name, cond, extra = "") => {
  results.push({ name, pass: !!cond });
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? `  (${extra})` : ""}`);
};

const restoreSnapshot = async (snapshot) => {
  for (const t of snapshot.tables) {
    await mongoose.connection.db.collection("restauranttables").updateOne(
      { _id: t._id },
      { $set: { status: t.status, isReservable: t.isReservable, totalBookings: t.totalBookings } }
    );
  }
  if (snapshot.restaurantTotalBookings !== undefined) {
    await mongoose.connection.db.collection("restaurants").updateOne(
      { _id: snapshot.restaurantId },
      { $set: { totalBookings: snapshot.restaurantTotalBookings } }
    );
  }
};

(async () => {
  let snapshot = null;
  try {
    await mongoose.connect(MONGO_URI);
    const db = mongoose.connection.db;

    await backfillTableSeats();

    const restaurant = await db.collection("restaurants").findOne({ restaurantCode: "RST100001" });
    if (!restaurant) {
      console.log("SKIP: demo restaurant RST100001 not found. Run `node seed-demo.cjs` first.");
      return;
    }
    const customer = await db.collection("users").findOne({ email: "pwcust1@gmail.com" });
    if (!customer) {
      console.log("SKIP: demo customer pwcust1@gmail.com not found.");
      return;
    }

    const tables = await db.collection("restauranttables")
      .find({ restaurantId: restaurant._id })
      .toArray();
    const byNumber = Object.fromEntries(tables.map((t) => [t.tableNumber, t]));

    const A = byNumber[2];
    const B = byNumber[4];
    const C = byNumber[5];
    if (!A || !B || !C) {
      console.log("SKIP: required tables (2, 4, 5) missing for Spice Garden.");
      return;
    }

    const toObjectId = (id) => new mongoose.Types.ObjectId(String(id));
    const allTableIds = [A._id, B._id, C._id].map((id) => toObjectId(id));

    snapshot = {
      restaurantId: restaurant._id,
      restaurantTotalBookings: restaurant.totalBookings || 0,
      tables: [],
    };
    for (const t of [A, B, C]) {
      snapshot.tables.push({
        _id: toObjectId(t._id),
        status: t.status,
        isReservable: t.isReservable,
        totalBookings: t.totalBookings || 0,
      });
    }

    await db.collection("restauranttables").updateMany(
      { _id: { $in: allTableIds } },
      { $set: { status: "Available", isReservable: true } }
    );

    await db.collection("restauranttables").updateOne(
      { _id: toObjectId(A._id) },
      { $set: { seatSelectionMode: SEAT_SELECTION_MODE.INDIVIDUAL_SEATS } }
    );
    await db.collection("restauranttables").updateOne(
      { _id: toObjectId(B._id) },
      { $set: { seatSelectionMode: SEAT_SELECTION_MODE.INDIVIDUAL_SEATS } }
    );
    await db.collection("restauranttables").updateOne(
      { _id: toObjectId(C._id) },
      { $set: { seatSelectionMode: SEAT_SELECTION_MODE.FULL_TABLE } }
    );

    const seatIds = (table) =>
      (table.seats || []).map((s) => String(s._id));

    const load = async (id) =>
      db.collection("restauranttables").findOne({ _id: toObjectId(id) });

    const A2 = await load(A._id);
    const B2 = await load(B._id);
    const aSeats = seatIds(A2);
    const bSeats = seatIds(B2);

    const baseBooking = (extra = {}) => ({
      userId: customer._id,
      restaurantId: restaurant._id,
      bookingDateTime: WINDOW,
      expectedDuration: 120,
      numberOfGuests: 3,
      specialRequest: "__SMOKE__",
      ...extra,
    });

    // S1: 2 seats on table A + 1 seat on table B (multi-table, seat-wise)
    const s1 = await createBooking(
      baseBooking({
        numberOfGuests: 3,
        tables: [
          { tableId: toObjectId(A._id), seatIds: [toObjectId(aSeats[0]), toObjectId(aSeats[1])] },
          { tableId: toObjectId(B._id), seatIds: [toObjectId(bSeats[0])] },
        ],
      })
    );
    const s1Doc = await db.collection("bookings").findOne({ _id: s1.booking._id });
    check(
      "S1 multi seat-wise across 2 tables created",
      !!s1Doc && s1Doc.tableIds?.length === 2 && s1Doc.tables?.length === 2
    );
    check("S1 total selected seats = 3", s1Doc?.seatIds?.length === 3);
    check("S1 bookingMode is Individual Seats", s1Doc?.bookingMode === SEAT_SELECTION_MODE.INDIVIDUAL_SEATS);
    check(
      "S1 primary tableId matches first selection",
      String(s1Doc?.tableId) === String(A._id) &&
        String(s1Doc?.tables?.[1]?.tableId) === String(B._id) &&
        String(s1Doc?.tables?.[1]?.seatIds?.[0]) === String(bSeats[0])
    );

    // S2: whole table C (8) + 2 seats on table A = 10 reserved for 6 guests
    const s2 = await createBooking(
      baseBooking({
        numberOfGuests: 6,
        tables: [
          { tableId: toObjectId(C._id), seatIds: [] },
          { tableId: toObjectId(A._id), seatIds: [toObjectId(aSeats[2]), toObjectId(aSeats[3])] },
        ],
      })
    );
    const s2Doc = await db.collection("bookings").findOne({ _id: s2.booking._id });
    check("S2 whole table + seat-wise created", !!s2Doc && s2Doc.tableIds?.length === 2);
    check("S2 whole table entry has no seats", s2Doc?.tables?.[0]?.seatIds?.length === 0);
    check("S2 combined seatIds only from seat table", s2Doc?.seatIds?.length === 2);

    // S3: overlapping window claiming the same seats -> 409 conflict, no booking
    const beforeCount = await db.collection("bookings").countDocuments({ specialRequest: "__SMOKE__" });
    let s3Error = null;
    try {
      await createBooking(
        baseBooking({
          numberOfGuests: 2,
          tables: [
            { tableId: toObjectId(A._id), seatIds: [toObjectId(aSeats[0]), toObjectId(aSeats[1])] },
          ],
        })
      );
    } catch (e) {
      s3Error = e;
    }
    const afterCount = await db.collection("bookings").countDocuments({ specialRequest: "__SMOKE__" });
    check("S3 seat conflict throws 409", s3Error?.statusCode === 409);
    check("S3 no booking persisted on conflict", afterCount === beforeCount);

    // S4: selecting 3 seats for 2 guests -> guest rule violation
    let s4Error = null;
    try {
      await createBooking(
        baseBooking({
          numberOfGuests: 2,
          tables: [
            { tableId: toObjectId(A._id), seatIds: [toObjectId(aSeats[0]), toObjectId(aSeats[1]), toObjectId(aSeats[2])] },
          ],
        })
      );
    } catch (e) {
      s4Error = e;
    }
    check("S4 too many selected seats rejected", s4Error?.statusCode === 400);

    // S5: 5 guests but only 1 seat reserved -> not enough seats
    let s5Error = null;
    try {
      await createBooking(
        baseBooking({
          numberOfGuests: 5,
          tables: [
            { tableId: toObjectId(A._id), seatIds: [toObjectId(aSeats[0])] },
          ],
        })
      );
    } catch (e) {
      s5Error = e;
    }
    check("S5 insufficient reserved seats rejected", s5Error?.statusCode === 400);
  } catch (e) {
    console.error("SMOKE ERROR:", e);
  } finally {
    if (mongoose.connection.readyState === 1 && snapshot) {
      try {
        await mongoose.connection.db.collection("bookings").deleteMany({ specialRequest: "__SMOKE__" });
        await restoreSnapshot(snapshot);
        await mongoose.connection.db.collection("restauranttables").updateMany(
          { _id: { $in: snapshot.tables.map((t) => t._id) } },
          { $set: { seatSelectionMode: SEAT_SELECTION_MODE.FULL_TABLE } }
        );
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

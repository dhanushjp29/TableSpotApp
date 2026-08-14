import assert from "node:assert/strict";
import mongoose from "mongoose";

import RestaurantTable from "../src/models/RestaurantTable.js";
import {
  acquireBookingHolds,
} from "../src/services/bookingHold.service.js";
import {
  SEAT_SELECTION_MODE,
} from "../src/utils/constants.js";

const TEST_MONGODB_URI =
  process.env.TEST_MONGODB_URI ||
  "mongodb://127.0.0.1:27017/tablespot_booking_hold_test";
if (!/^(mongodb:\/\/)(localhost|127\.0\.0\.1)(?::\d+)?\//i.test(TEST_MONGODB_URI)) {
  throw new Error("Booking-hold runtime tests require a localhost MongoDB URI before destructive test setup.");
}

const restaurantId = new mongoose.Types.ObjectId();
const start = new Date("2035-01-01T10:00:00.000Z");
const end = new Date("2035-01-01T11:00:00.000Z");

const newSeats = (count) =>
  Array.from({ length: count }, (_, index) => ({
    seatIndex: index + 1,
    seatLabel: `S${index + 1}`,
    position: { x: index * 10, y: 0 },
  }));

const createTable = async ({
  mode = SEAT_SELECTION_MODE.INDIVIDUAL_SEATS,
  capacity = 6,
  bookingHolds = [],
}) => {
  const table = await RestaurantTable.create({
    tableCode: `TEST_${new mongoose.Types.ObjectId()}`,
    restaurantId,
    tableNumber: Math.floor(Math.random() * 1_000_000),
    seatSelectionMode: mode,
    seats: newSeats(capacity),
    capacity,
    bookingHolds,
  });
  return table;
};

const hold = ({
  table,
  seatIds = [],
  mode = table.seatSelectionMode,
  bookingAt = start,
  bookingEnd = end,
}) =>
  acquireBookingHolds({
    restaurantId,
    tables: [
      {
        tableId: table._id,
        seatSelectionMode: mode,
        seatIds,
      },
    ],
    bookingAt,
    bookingEnd,
    ttlMinutes: 5,
    holdToken: `test_${new mongoose.Types.ObjectId()}`,
  });

const expectConflict = async (label, operation) => {
  await assert.rejects(operation, (error) => error?.statusCode === 409);
  console.log(`[PASS] ${label}`);
};

const expectSuccess = async (label, operation) => {
  await operation();
  console.log(`[PASS] ${label}`);
};

const run = async () => {
  await mongoose.connect(TEST_MONGODB_URI);
  await mongoose.connection.dropDatabase();

  const individual = await createTable({});
  const seats = individual.seats.map((seat) => seat._id);
  await expectSuccess("A1 individual hold of 2 seats", () =>
    hold({ table: individual, seatIds: seats.slice(0, 2) })
  );
  await expectSuccess("A2 additional individual hold of 3 seats", () =>
    hold({ table: individual, seatIds: seats.slice(2, 5) })
  );
  await expectConflict("A3 additional 2 seats exceed capacity / overlap", () =>
    hold({ table: individual, seatIds: seats.slice(4, 6) })
  );

  const capacityBoundary = await createTable({});
  const boundarySeats = capacityBoundary.seats.map((seat) => seat._id);
  await hold({ table: capacityBoundary, seatIds: boundarySeats.slice(0, 2) });
  await expectSuccess("A4 2 existing + 4 requested reaches capacity", () =>
    hold({ table: capacityBoundary, seatIds: boundarySeats.slice(2, 6) })
  );

  const individualToFull = await createTable({});
  const individualToFullSeats = individualToFull.seats.map((seat) => seat._id);
  await hold({ table: individualToFull, seatIds: individualToFullSeats.slice(0, 2) });
  await expectConflict("B individual hold blocks full-table hold", () =>
    hold({
      table: individualToFull,
      mode: SEAT_SELECTION_MODE.FULL_TABLE,
      seatIds: [],
      bookingAt: start,
      bookingEnd: end,
    })
  );

  const fullToIndividual = await createTable({ mode: SEAT_SELECTION_MODE.FULL_TABLE });
  await hold({ table: fullToIndividual, seatIds: [] });
  const fullToIndividualSeats = fullToIndividual.seats.map((seat) => seat._id);
  await expectConflict("C full-table hold blocks individual hold", () =>
    hold({
      table: fullToIndividual,
      mode: SEAT_SELECTION_MODE.INDIVIDUAL_SEATS,
      seatIds: fullToIndividualSeats.slice(0, 1),
    })
  );

  const fullToFull = await createTable({ mode: SEAT_SELECTION_MODE.FULL_TABLE });
  await hold({ table: fullToFull, seatIds: [] });
  await expectConflict("D full-table hold blocks another full-table hold", () =>
    hold({ table: fullToFull, seatIds: [] })
  );

  const expired = await createTable({
    bookingHolds: [
      {
        holdToken: "expired_hold",
        bookingDateTime: start,
        bookingEndTime: end,
        seatSelectionMode: SEAT_SELECTION_MODE.INDIVIDUAL_SEATS,
        seatIds: [],
        fullTable: true,
        expiresAt: new Date("2020-01-01T00:00:00.000Z"),
      },
    ],
  });
  const expiredSeats = expired.seats.map((seat) => seat._id);
  await expectSuccess("E expired hold does not block new hold", () =>
    hold({ table: expired, seatIds: expiredSeats.slice(0, 1) })
  );

  const nonOverlap = await createTable({});
  const nonOverlapSeats = nonOverlap.seats.map((seat) => seat._id);
  await hold({ table: nonOverlap, seatIds: nonOverlapSeats.slice(0, 1) });
  await expectSuccess("F non-overlapping time succeeds", () =>
    hold({
      table: nonOverlap,
      seatIds: nonOverlapSeats.slice(0, 1),
      bookingAt: new Date("2035-01-01T11:00:00.000Z"),
      bookingEnd: new Date("2035-01-01T12:00:00.000Z"),
    })
  );

  const overlap = await createTable({});
  const overlapSeats = overlap.seats.map((seat) => seat._id);
  await hold({ table: overlap, seatIds: overlapSeats.slice(0, 1) });
  await expectConflict("G overlapping seat/time conflicts", () =>
    hold({ table: overlap, seatIds: overlapSeats.slice(0, 1) })
  );

  const concurrent = await createTable({});
  const concurrentSeats = concurrent.seats.map((seat) => seat._id);
  await hold({ table: concurrent, seatIds: concurrentSeats.slice(0, 4) });
  const concurrentResults = await Promise.allSettled([
    hold({ table: concurrent, seatIds: concurrentSeats.slice(4, 6) }),
    hold({ table: concurrent, seatIds: concurrentSeats.slice(4, 6) }),
  ]);
  assert.equal(
    concurrentResults.filter((result) => result.status === "fulfilled").length,
    1
  );
  assert.equal(
    concurrentResults.filter((result) => result.status === "rejected").length,
    1
  );
  console.log("[PASS] H concurrent requests accept only one remaining-capacity hold");
};

try {
  await run();
} finally {
  await mongoose.connection.dropDatabase().catch(() => {});
  await mongoose.disconnect();
}

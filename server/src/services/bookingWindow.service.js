import Booking from "../models/Booking.js";
import RestaurantTable from "../models/RestaurantTable.js";
import { emitTableUpdated } from "./table.service.js";

import {
  BOOKING_STATUS,
  SEAT_SELECTION_MODE,
  TABLE_STATUS,
} from "../utils/constants.js";

const ACTIVE_BOOKING_STATUSES = [
  BOOKING_STATUS.PENDING,
  BOOKING_STATUS.CONFIRMED,
];

const DEFAULT_DURATION_MINUTES = 120;

const bookingWindowEnd = (booking) => {
  const duration = Number(booking.expectedDuration || DEFAULT_DURATION_MINUTES);
  return new Date(
    new Date(booking.bookingDateTime).getTime() + duration * 60 * 1000
  );
};

/**
 * Whether a booking reserves the entire `tableId`. Only whole-table bookings
 * drive the table-level status; individual-seat bookings never touch it.
 */
const isWholeTableBookingFor = (booking, tableId) => {
  const id = String(tableId);

  const entry = (booking.tables || []).find(
    (item) => String(item.tableId) === id
  );

  if (entry) {
    return entry.seatSelectionMode === SEAT_SELECTION_MODE.FULL_TABLE;
  }

  return (
    booking.bookingMode === SEAT_SELECTION_MODE.FULL_TABLE &&
    String(booking.tableId) === id
  );
};

/**
 * Whole-table bookings whose window `[bookingDateTime, bookingDateTime +
 * expectedDuration)` contains `now`. Mirrors findOverlappingBookings so the
 * scheduler and lifecycle paths agree on what counts as "reserved".
 */
const getActiveWholeTableBookings = async ({ restaurantId, tableId, now }) => {
  const start = now instanceof Date ? now : new Date(now || Date.now());
  const id = String(tableId);

  const bookings = await Booking.find({
    restaurantId,
    bookingStatus: { $in: ACTIVE_BOOKING_STATUSES },
    bookingDateTime: { $lte: start },
    $or: [{ tableId: id }, { tableIds: id }],
    $expr: {
      $gt: [
        {
          $add: [
            "$bookingDateTime",
            { $multiply: [{ $ifNull: ["$expectedDuration", 120] }, 60000] },
          ],
        },
        start,
      ],
    },
  })
    .select(
      "_id tableId tableIds tables bookingMode bookingDateTime expectedDuration"
    )
    .lean();

  return bookings.filter((booking) => isWholeTableBookingFor(booking, id));
};

/**
 * Recompute a table's derived status from its active whole-table booking
 * windows:
 * - An active window => Reserved.
 * - No active window and the status is booking-sourced => Available.
 * - A manual (owner-set) status is never overridden; it keeps its source.
 * Emits `table:updated` only when the status actually changes.
 */
export const recomputeBookingTableStatus = async ({
  restaurantId,
  tableId,
  now = new Date(),
}) => {
  const table = await RestaurantTable.findById(tableId);

  if (!table) {
    return null;
  }

  // Individual-seats tables derive per-seat occupancy from bookings; the
  // table-level status stays as-is.
  if (table.seatSelectionMode === SEAT_SELECTION_MODE.INDIVIDUAL_SEATS) {
    return table;
  }

  const active = await getActiveWholeTableBookings({
    restaurantId: table.restaurantId,
    tableId: table._id,
    now,
  });

  if (active.length > 0) {
    if (table.statusSource !== "booking") {
      return table;
    }

    if (table.status !== TABLE_STATUS.RESERVED) {
      table.status = TABLE_STATUS.RESERVED;
      table.statusScheduledUntil = null;
      await table.save();
      await emitTableUpdated(table);
    }
    return table;
  }

  if (
    table.statusSource === "booking" &&
    table.status === TABLE_STATUS.RESERVED
  ) {
    table.status = TABLE_STATUS.AVAILABLE;
    table.statusScheduledUntil = null;
    await table.save();
    await emitTableUpdated(table);
  }

  return table;
};

/**
 * Background sweep that keeps booking-derived statuses aligned with the
 * current time. Examines every active booking window that has started (plus a
 * short tail after it ends so boundary flips are not missed between ticks) and
 * recomputes each affected whole-table table. Idempotent and safe to run on
 * every scheduler tick.
 */
export const runBookingWindowTasks = async ({ log = console } = {}) => {
  const now = new Date();
  const endTailMs = 2 * 60 * 1000;

  const relevant = await Booking.find({
    bookingStatus: { $in: ACTIVE_BOOKING_STATUSES },
    bookingDateTime: { $lte: now },
    $expr: {
      $gt: [
        {
          $add: [
            "$bookingDateTime",
            { $multiply: [{ $ifNull: ["$expectedDuration", 120] }, 60000] },
          ],
        },
        new Date(now.getTime() - endTailMs),
      ],
    },
  })
    .select(
      "_id tableId tableIds tables bookingMode bookingDateTime expectedDuration"
    )
    .lean();

  const tableIds = new Set();

  for (const booking of relevant) {
    for (const entry of booking.tables || []) {
      if (entry.seatSelectionMode === SEAT_SELECTION_MODE.FULL_TABLE) {
        tableIds.add(String(entry.tableId));
      }
    }

    if (
      !(booking.tables || []).length &&
      booking.bookingMode === SEAT_SELECTION_MODE.FULL_TABLE
    ) {
      tableIds.add(String(booking.tableId));
    }
  }

  const errors = [];

  for (const tableId of tableIds) {
    try {
      const table = await RestaurantTable.findById(tableId);
      if (!table) continue;

      await recomputeBookingTableStatus({
        restaurantId: table.restaurantId,
        tableId,
        now,
      });
    } catch (error) {
      errors.push(error.message);
      log.error?.(
        `[booking-window] Recompute failed for ${tableId}:`,
        error.message
      );
    }
  }

  return { checked: tableIds.size, errors };
};

export { bookingWindowEnd, isWholeTableBookingFor };

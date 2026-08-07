import Booking from "../models/Booking.js";
import Food from "../models/food.js";
import Restaurant from "../models/Restaurant.js";
import RestaurantTable from "../models/RestaurantTable.js";
import User from "../models/User.js";

import ApiError from "../utils/ApiError.js";
import generateCode from "../utils/generateCode.js";
import { getIO } from "../sockets/socket.handler.js";
import { createNotification } from "./notification.service.js";
import {
  calculateCancellationCutoffAt,
  calculateRequiredBookingPayment,
} from "./bookingPayment.service.js";
import {
  calculateRefundEligibility,
  createRefund,
} from "./refund.service.js";
import { createAuditLog } from "./auditLog.service.js";
import { recomputeBookingTableStatus } from "./bookingWindow.service.js";

import {
  BOOKING_STATUS,
  CODE_PREFIX,
  DEFAULT_CUSTOMER_WAITING_PERIOD_MINUTES,
  MAX_REMARKS_LENGTH,
  MIN_REMARKS_LENGTH,
  OWNER_BOOKING_STATUS,
  PAYMENT_METHOD,
  PAYMENT_STATUS,
  REFUND_REASON,
  REFUND_STATUS,
  SEAT_SELECTION_MODE,
  SEAT_STATUS,
  TABLE_STATUS,
  USER_ROLE,
} from "../utils/constants.js";

const BOOKED_STATUSES = [
  BOOKING_STATUS.PENDING,
  BOOKING_STATUS.CONFIRMED,
];

const roundAmount = (value) => Math.round(Number(value || 0) * 100) / 100;

// Allowed booking status transitions. Anything not listed here is rejected,
// so a booking can never be resurrected from a terminal state or skip ahead.
const BOOKING_TRANSITIONS = {
  [BOOKING_STATUS.PENDING]: [
    BOOKING_STATUS.CONFIRMED,
    BOOKING_STATUS.COMPLETED,
    BOOKING_STATUS.CANCELLED,
    BOOKING_STATUS.NO_SHOW,
  ],
  [BOOKING_STATUS.CONFIRMED]: [
    BOOKING_STATUS.COMPLETED,
    BOOKING_STATUS.CANCELLED,
    BOOKING_STATUS.NO_SHOW,
  ],
  [BOOKING_STATUS.COMPLETED]: [],
  [BOOKING_STATUS.CANCELLED]: [],
  [BOOKING_STATUS.NO_SHOW]: [],
};

const validateBookingTransition = ({ current, next }) => {
  if (current === next) {
    return; // writing the same status back is a tolerated no-op
  }

  const allowed = BOOKING_TRANSITIONS[current] || [];

  if (!allowed.includes(next)) {
    throw new ApiError(
      409,
      `Booking cannot transition from "${current}" to "${next}".`
    );
  }
};

const findOverlappingBookings = async ({
  restaurantId,
  tableIds,
  start,
  end,
}) => {
  const ids = (tableIds || []).map((id) => String(id));

  if (!ids.length) return [];

  return Booking.find({
    restaurantId,
    bookingStatus: { $in: BOOKED_STATUSES },
    bookingDateTime: { $lt: end },
    $or: [{ tableId: { $in: ids } }, { tableIds: { $in: ids } }],
    $expr: {
      $gt: [
        {
          $add: [
            "$bookingDateTime",
            {
              $multiply: [
                { $ifNull: ["$expectedDuration", 120] },
                60000,
              ],
            },
          ],
        },
        start,
      ],
    },
  })
    .select("_id tableId tableIds seatIds bookingDateTime expectedDuration")
    .lean();
};

const groupBookingsByTable = (overlappingBookings = []) => {
  const byTable = new Map();

  overlappingBookings.forEach((booking) => {
    const covered = new Set([
      String(booking.tableId),
      ...(booking.tableIds || []).map((id) => String(id)),
    ]);

    covered.forEach((tableId) => {
      if (!byTable.has(tableId)) byTable.set(tableId, []);
      byTable.get(tableId).push(booking);
    });
  });

  return byTable;
};

const hasSeatConflict = ({
  table,
  requestedSeatIds = [],
  overlappingBookings = [],
  excludeBookingId = null,
}) => {
  if (!overlappingBookings.length) return false;

  const relevant = overlappingBookings.filter(
    (booking) =>
      !excludeBookingId ||
      String(booking._id) !== String(excludeBookingId)
  );

  if (!relevant.length) return false;

  if (table.seatSelectionMode === SEAT_SELECTION_MODE.FULL_TABLE) {
    return true;
  }

  const requested = new Set(requestedSeatIds.map((id) => String(id)));
  const booked = new Set();

  relevant.forEach((booking) => {
    (booking.seatIds || []).forEach((id) => booked.add(String(id)));
  });

  for (const id of requested) {
    if (booked.has(id)) return true;
  }

  return false;
};

/**
 * Validate a multi-table selection and resolve it into per-table assignments.
 *
 * A booking can combine individual seats on some tables with whole-table
 * reservations on others. The general guest rule is:
 *   selectedSeatCount <= numberOfGuests <= reservedSeatCount
 * where reservedSeatCount = selected seats + sum of capacities of all
 * whole-table reservations. Pure seat-mode bookings therefore require an
 * exact match, pure whole-table bookings only a capacity ceiling, and mixed
 * bookings anything in between.
 */
const resolveTableSelections = async ({
  restaurantId,
  tables = [],
  numberOfGuests,
}) => {
  if (!Array.isArray(tables) || tables.length === 0) {
    throw new ApiError(400, "Please select at least one table.");
  }

  const requestedIds = tables.map((entry) => entry.tableId);
  const tableDocs = await RestaurantTable.find({
    _id: { $in: requestedIds },
    isActive: true,
  });

  if (tableDocs.length !== requestedIds.length) {
    throw new ApiError(400, "One or more selected tables are not available.");
  }

  // A manual status timer that already elapsed no longer blocks booking;
  // the scheduler persists the revert, we just stop honoring it here.
  const now = Date.now();
  for (const doc of tableDocs) {
    if (
      doc.statusScheduledUntil &&
      doc.status !== TABLE_STATUS.AVAILABLE &&
      new Date(doc.statusScheduledUntil).getTime() <= now
    ) {
      doc.status = TABLE_STATUS.AVAILABLE;
      doc.isReservable = true;
      doc.statusScheduledUntil = null;
    }

    // Same for seat-level manual status timers.
    (doc.seats || []).forEach((seat) => {
      if (
        seat.status &&
        seat.status !== SEAT_STATUS.AVAILABLE &&
        seat.statusScheduledUntil &&
        new Date(seat.statusScheduledUntil).getTime() <= now
      ) {
        seat.status = SEAT_STATUS.AVAILABLE;
        seat.statusScheduledUntil = null;
      }
    });
  }

  const tableDocMap = new Map(tableDocs.map((t) => [String(t._id), t]));

  for (const doc of tableDocs) {
    if (String(doc.restaurantId) !== String(restaurantId)) {
      throw new ApiError(
        400,
        "One or more selected tables do not belong to this restaurant."
      );
    }
  }

  const resolved = [];
  let selectedSeatCount = 0;
  let reservedSeatCount = 0;
  const seenSeatIds = new Set();

  for (const entry of tables) {
    const table = tableDocMap.get(String(entry.tableId));

    if (!table) {
      throw new ApiError(400, "One or more selected tables are not available.");
    }

    const isSeatMode =
      table.seatSelectionMode === SEAT_SELECTION_MODE.INDIVIDUAL_SEATS;

    if (
      !table.isReservable ||
      table.status === TABLE_STATUS.MAINTENANCE ||
      table.status === TABLE_STATUS.CLEANING
    ) {
      throw new ApiError(409, "One or more selected tables are not available.");
    }

    if (isSeatMode) {
      const seatIds = (entry.seatIds || []).map((id) => String(id));

      if (seatIds.length === 0) {
        throw new ApiError(
          400,
          "Please select at least one seat for this table."
        );
      }

      for (const id of seatIds) {
        if (seenSeatIds.has(id)) {
          throw new ApiError(400, "Duplicate seats cannot be selected.");
        }
        seenSeatIds.add(id);
      }

      const seatById = new Map(
        (table.seats || []).map((seat) => [String(seat._id), seat])
      );

      for (const id of seatIds) {
        const seat = seatById.get(id);

        if (!seat || seat.isActive === false) {
          throw new ApiError(
            400,
            "One or more selected seats do not belong to this table."
          );
        }

        if (seat.status && seat.status !== SEAT_STATUS.AVAILABLE) {
          throw new ApiError(
            409,
            "One or more selected seats are not available."
          );
        }
      }

      resolved.push({
        tableId: table._id,
        seatSelectionMode: table.seatSelectionMode,
        seatIds,
        seatLabels: seatIds.map((id) => seatById.get(id)?.seatLabel || ""),
      });

      selectedSeatCount += seatIds.length;
      reservedSeatCount += seatIds.length;
    } else {
      if (entry.seatIds && entry.seatIds.length > 0) {
        throw new ApiError(
          400,
          "This table is booked as a full table; individual seats cannot be selected."
        );
      }

      resolved.push({
        tableId: table._id,
        seatSelectionMode: table.seatSelectionMode,
        seatIds: [],
        seatLabels: [],
      });

      reservedSeatCount += Number(table.capacity) || 0;
    }
  }

  const guestCount = Number(numberOfGuests);

  if (selectedSeatCount > guestCount) {
    throw new ApiError(
      400,
      `You selected ${selectedSeatCount} seat(s) but have ${guestCount} guest(s). Remove extra seats.`
    );
  }

  if (guestCount > reservedSeatCount) {
    throw new ApiError(
      400,
      "The selected tables do not have enough seats for the number of guests."
    );
  }

  if (
    resolved.length === 1 &&
    resolved[0].seatSelectionMode === SEAT_SELECTION_MODE.FULL_TABLE
  ) {
    const single = tableDocMap.get(String(resolved[0].tableId));
    if (guestCount < (single.minimumCapacity || 1)) {
      throw new ApiError(
        400,
        "Number of guests is below the minimum capacity for this table."
      );
    }
  }

  return {
    primaryTableId: resolved[0].tableId,
    tableIds: resolved.map((entry) => entry.tableId),
    tables: resolved,
    seatIds: resolved.flatMap((entry) => entry.seatIds),
    seatLabels: resolved.flatMap((entry) => entry.seatLabels),
    bookingMode: resolved[0].seatSelectionMode,
  };
};

const assertNoSeatConflicts = async ({
  tableIds,
  tables,
  start,
  end,
  restaurantId,
  excludeBookingId = null,
}) => {
  const overlappingBookings = await findOverlappingBookings({
    restaurantId,
    tableIds,
    start,
    end,
  });

  const byTable = groupBookingsByTable(overlappingBookings);

  for (const entry of tables) {
    const table = await getTableOrThrow(entry.tableId);

    if (
      hasSeatConflict({
        table,
        requestedSeatIds: entry.seatIds,
        overlappingBookings: byTable.get(String(entry.tableId)) || [],
        excludeBookingId,
      })
    ) {
      throw new ApiError(
        409,
        "The selected table or seat(s) are already booked for this time."
      );
    }
  }
};

const calculateOrderedFoodsTotal = (foods = []) =>
  foods.reduce(
    (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0),
    0
  );

const getBookingOrThrow = async (bookingId) => {
  const booking = await Booking.findById(bookingId);

  if (!booking || booking.isDeleted) {
    throw new ApiError(404, "Booking not found.");
  }

  return booking;
};

const getTableOrThrow = async (tableId) => {
  const table = await RestaurantTable.findById(tableId);

  if (!table || !table.isActive) {
    throw new ApiError(404, "Table not found.");
  }

  return table;
};

const getRestaurantOrThrow = async (restaurantId) => {
  const restaurant = await Restaurant.findById(restaurantId);

  if (!restaurant || restaurant.isDeleted) {
    throw new ApiError(404, "Restaurant not found.");
  }

  return restaurant;
};

const setTableStateForBookingStatus = async ({
  tableId,
}) => {
  const table = await getTableOrThrow(tableId);

  if (table.seatSelectionMode === SEAT_SELECTION_MODE.INDIVIDUAL_SEATS) {
    // Seat occupancy is derived from bookings; table-level status stays as-is.
    return table;
  }

  // Table-level status is a convenience view only. `isReservable` is a manual
  // owner toggle and is NEVER auto-flipped by the booking lifecycle — that
  // previously left tables permanently unbookable for all future slots. Real
  // availability is determined by status + time-overlap of active bookings.
  //
  // The table becomes "booking"-sourced so the window recompute (and the
  // background scheduler) can flip it Reserved during the window and back to
  // Available once it ends. Confirming a future booking keeps the table
  // Available until the window actually starts.
  table.statusSource = "booking";
  table.statusScheduledUntil = null;
  await table.save();

  return recomputeBookingTableStatus({
    restaurantId: table.restaurantId,
    tableId: table._id,
  });
};

/**
 * Increment totalBookings, mark full-table bookings as booking-sourced, then
 * recompute each affected table's status from its active booking window and
 * push `table:updated` so owner table pages stay live. Individual-seat
 * bookings never flip the table-level status, so they are updated but not
 * recomputed.
 */
const markTablesReservedAndNotify = async (tables) => {
  const wholeTableEntries = [];

  await Promise.all(
    tables.map((entry) =>
      RestaurantTable.findByIdAndUpdate(
        entry.tableId,
        {
          $inc: { totalBookings: 1 },
          ...(entry.seatSelectionMode === SEAT_SELECTION_MODE.INDIVIDUAL_SEATS
            ? {}
            : {
                $set: {
                  statusSource: "booking",
                  statusScheduledUntil: null,
                },
              }),
        },
        { new: true }
      ).then((doc) => {
        if (doc?.seatSelectionMode !== SEAT_SELECTION_MODE.INDIVIDUAL_SEATS) {
          wholeTableEntries.push(doc);
        }
        return doc;
      })
    )
  );

  await Promise.all(
    wholeTableEntries.map((doc) =>
      recomputeBookingTableStatus({
        restaurantId: doc.restaurantId,
        tableId: doc._id,
      })
    )
  );
};

/**
 * Validate pre-ordered foods against the Food model and
 * use server-side prices (ignoring client-supplied prices).
 * Exported so the payment-first flow can compute the required advance from
 * the same trusted prices.
 */
export const validateAndResolveOrderedFoods = async ({
  foods = [],
  restaurantId,
}) => {
  if (foods.length === 0) return [];

  const foodIds = foods.map((item) => item.foodId);
  const validFoods = await Food.find({
    _id: { $in: foodIds },
    restaurantId,
    isDeleted: false,
    isAvailable: true,
  });

  if (validFoods.length !== foodIds.length) {
    throw new ApiError(
      400,
      "One or more pre-ordered food items are invalid or unavailable."
    );
  }

  const foodMap = new Map(validFoods.map((f) => [String(f._id), f]));

  return foods.map((item) => {
    const food = foodMap.get(String(item.foodId));
    const variantName = item.variantName?.trim() || "Regular";

    // Resolve price from the Food model (variant price or base price)
    let price = 0;
    if (food.hasVariants && food.variants?.length > 0) {
      const variant = food.variants.find(
        (v) => String(v.variantName).toLowerCase() === variantName.toLowerCase()
      );
      if (variant) {
        price = variant.offerPrice > 0 ? variant.offerPrice : variant.price;
      } else {
        throw new ApiError(
          400,
          `Variant "${variantName}" not found for food "${food.foodName}".`
        );
      }
    } else {
      price = food.variants?.[0]?.offerPrice > 0
        ? food.variants[0].offerPrice
        : food.variants?.[0]?.price || 0;
    }

    return {
      foodId: food._id,
      variantName,
      quantity: Number(item.quantity),
      price: Number(price),
    };
  });
};

export const createBooking = async ({
  userId,
  restaurantId,
  tableId,
  seatIds = [],
  tables = [],
  bookingDateTime,
  expectedDuration = 120,
  numberOfGuests,
  bookingStatus = null,
  bookingType = "Online",
  paymentStatus = "Pending",
  paymentMethod = "Cash",
  advanceAmount = 0,
  totalAmount = 0,
  specialRequest = "",
  preOrderedFoods = [],
  billId = null,
  applyBookingPaymentPolicy = true,
}) => {
  if (!userId) {
    throw new ApiError(400, "User is required.");
  }

  const user = await User.findById(userId).select("_id isActive isDeleted");

  if (!user || !user.isActive || user.isDeleted) {
    throw new ApiError(404, "User not found.");
  }

  const restaurant = await getRestaurantOrThrow(restaurantId);

  if (!restaurant.isActive) {
    throw new ApiError(400, "Restaurant is not active.");
  }

  if (restaurant.verificationStatus !== "Verified") {
    throw new ApiError(
      403,
      "This restaurant is not verified for bookings."
    );
  }

  if (bookingType === "Online" || bookingType === "Walk-In") {
    const owner = await User.findById(restaurant.ownerId).select(
      "bookingStatus"
    );

    if (owner?.bookingStatus === OWNER_BOOKING_STATUS.BOOKING_RESTRICTED) {
      throw new ApiError(
        409,
        "This restaurant is currently not accepting new bookings."
      );
    }
  }

  const bookingAt = new Date(bookingDateTime);
  if (Number.isNaN(bookingAt.getTime())) {
    throw new ApiError(400, "Valid booking date and time is required.");
  }

  if (bookingAt.getTime() < Date.now() - 5 * 60 * 1000) {
    throw new ApiError(400, "Booking time cannot be in the past.");
  }

  const selectionInput =
    Array.isArray(tables) && tables.length > 0
      ? tables
      : [{ tableId, seatIds }];

  if (!selectionInput.some((entry) => entry && entry.tableId)) {
    throw new ApiError(400, "Please select at least one table.");
  }

  const resolvedSeats = await resolveTableSelections({
    restaurantId: restaurant._id,
    tables: selectionInput,
    numberOfGuests,
  });

  const bookingEnd = new Date(
    bookingAt.getTime() + Number(expectedDuration) * 60 * 1000
  );

  await assertNoSeatConflicts({
    restaurantId: restaurant._id,
    tableIds: resolvedSeats.tableIds,
    tables: resolvedSeats.tables,
    start: bookingAt,
    end: bookingEnd,
  });

  // Validate pre-ordered foods and resolve server-side prices
  const orderedFoods = await validateAndResolveOrderedFoods({
    foods: preOrderedFoods,
    restaurantId: restaurant._id,
  });

  // totalAmount is ALWAYS derived server-side from the resolved food prices.
  // A client-supplied totalAmount is never trusted.
  totalAmount = calculateOrderedFoodsTotal(orderedFoods);

  // Advance is always computed server-side from the restaurant policy.
  // Client-supplied amounts are never trusted. Walk-ins are always
  // pay-at-spot and skip the policy gating.
  if (applyBookingPaymentPolicy) {
    advanceAmount = calculateRequiredBookingPayment({
      restaurant,
      totalAmount,
    });
  } else {
    advanceAmount = 0;
  }

  // The payment lifecycle is server-managed. A client can never create a
  // booking that is already Paid / Partially Paid, nor claim a payment method.
  paymentStatus = "Pending";
  paymentMethod = "Cash";

  // Billing linkage is created exclusively by the bill service — a client can
  // never attach an arbitrary bill to a fresh booking.
  billId = null;

  const cancellationCutoffAt = calculateCancellationCutoffAt({
    restaurant,
    bookingAt,
  });

  // Lifecycle gating:
  // - If an upfront payment is required (PAY_TO_BOOK), the booking stays
  //   Pending until the advance is captured (verify / webhook).
  // - If no upfront payment is required (PAY_ON_SPOT, or a zero advance),
  //   the booking auto-confirms.
  // - Only owner-initiated Walk-In bookings may specify their initial status.
  const requiresUpfrontPayment = advanceAmount > 0;
  const requestedStatus =
    bookingType === "Walk-In"
      ? bookingStatus || BOOKING_STATUS.CONFIRMED
      : BOOKING_STATUS.PENDING;

  const effectiveBookingStatus = requiresUpfrontPayment
    ? BOOKING_STATUS.PENDING
    : requestedStatus === BOOKING_STATUS.PENDING
      ? BOOKING_STATUS.CONFIRMED
      : requestedStatus;

  const bookingCode = await generateCode(
    Booking,
    "bookingCode",
    CODE_PREFIX.BOOKING
  );

  const booking = await Booking.create({
    bookingCode,
    userId,
    restaurantId: restaurant._id,
    tableId: resolvedSeats.primaryTableId,
    tableIds: resolvedSeats.tableIds,
    tables: resolvedSeats.tables,
    seatIds: resolvedSeats.seatIds,
    seatLabels: resolvedSeats.seatLabels,
    bookingMode: resolvedSeats.bookingMode,
    bookingDateTime: bookingAt,
    expectedDuration,
    numberOfGuests,
    bookingStatus: effectiveBookingStatus,
    bookingType,
    paymentStatus,
    paymentMethod,
    advanceAmount,
    totalAmount,
    specialRequest,
    preOrderedFoods: orderedFoods,
    billId,
    cancellationCutoffAt,
  });

  // Race-condition guard: re-check the window after insert. If another
  // booking claimed these seats between our check and insert, roll back.
  try {
    await assertNoSeatConflicts({
      restaurantId: restaurant._id,
      tableIds: resolvedSeats.tableIds,
      tables: resolvedSeats.tables,
      start: bookingAt,
      end: bookingEnd,
      excludeBookingId: booking._id,
    });
  } catch (error) {
    await Booking.deleteOne({ _id: booking._id });
    if (error?.statusCode === 409) {
      throw new ApiError(
        409,
        "The selected table or seat(s) were just taken. Please choose another seat."
      );
    }
    throw error;
  }

  await Restaurant.findByIdAndUpdate(restaurant._id, {
    $inc: { totalBookings: 1 },
  });
  await markTablesReservedAndNotify(resolvedSeats.tables);

  try {
    const io = getIO();
    io.to(`restaurant_${restaurant._id}`).emit("booking:created", {
      bookingId: booking._id,
      tableId: resolvedSeats.primaryTableId,
      bookingDateTime: bookingAt,
    });
    const populated = await Booking.findById(booking._id)
      .populate("userId", "userCode fullName email phoneNumber role profileImage")
      .populate("restaurantId", "restaurantCode restaurantName slug city state country coverImage averageRating")
      .populate("tableId", "tableCode tableNumber tableName tableLabel shape seatSelectionMode capacity minimumCapacity seats status tableType tableLocation floor")
      .populate("tables.tableId", "tableCode tableNumber tableName tableLabel shape seatSelectionMode capacity minimumCapacity seats status tableType tableLocation floor");
    io.to(`restaurant_${restaurant._id}`)
      .to(`user_${booking.userId}`)
      .emit("booking:updated", populated);
  } catch (error) {
    console.error("Socket error on booking creation:", error);
  }

  if (restaurant.ownerId) {
    try {
      await createNotification({
        userId: restaurant.ownerId,
        title: "New Booking Received",
        message: `A new booking request (${booking.bookingCode}) has been received for ${restaurant.restaurantName}.`,
        type: "Booking",
        linkId: booking._id,
        linkModel: "Booking",
      });
    } catch (error) {
      console.error("Notification error on booking creation:", error.message);
    }
  }

  try {
    await createAuditLog({
      eventType: "BOOKING_CREATED",
      eventAction: "booking_created",
      bookingId: booking._id,
      restaurantId: restaurant._id,
      userId: booking.userId,
      performedBy: booking.userId,
      performedByRole: booking.bookingType === "Walk-In" ? USER_ROLE.OWNER : USER_ROLE.CUSTOMER,
      amount: booking.advanceAmount || 0,
      status: booking.bookingStatus,
      metadata: {
        bookingCode: booking.bookingCode,
        bookingType: booking.bookingType,
        bookingDateTime: bookingAt,
        totalAmount: booking.totalAmount,
      },
    });
  } catch (error) {
    console.error("Audit log error on booking creation:", error.message);
  }

  return {
    booking: await Booking.findById(booking._id)
      .populate("userId", "userCode fullName email phoneNumber role profileImage")
      .populate("restaurantId", "restaurantCode restaurantName slug city state country coverImage averageRating")
      .populate("tableId", "tableCode tableNumber tableName tableLabel shape seatSelectionMode capacity minimumCapacity seats status tableType tableLocation floor")
      .populate("tables.tableId", "tableCode tableNumber tableName tableLabel shape seatSelectionMode capacity minimumCapacity seats status tableType tableLocation floor")
      .populate("billId"),
    message: "Booking created successfully.",
  };
};

export const updateBooking = async ({
  bookingId,
  updates = {},
}) => {
  const booking = await getBookingOrThrow(bookingId);

  // Defense-in-depth: booking status, payment state, amounts, billing linkage
  // and lifecycle timestamps are NEVER settable through the booking update
  // endpoint. They are managed exclusively by the dedicated status / cancel /
  // check-in / complete / no-show endpoints and the payment & bill services.
  const PROTECTED_UPDATE_KEYS = [
    "bookingStatus",
    "paymentStatus",
    "paymentMethod",
    "bookingType",
    "totalAmount",
    "advanceAmount",
    "billId",
    "isActive",
    "completedAt",
    "cancelledAt",
    "cancellationReason",
  ];

  for (const key of PROTECTED_UPDATE_KEYS) {
    delete updates[key];
  }

  if (updates.restaurantId && String(updates.restaurantId) !== String(booking.restaurantId)) {
    const restaurant = await getRestaurantOrThrow(updates.restaurantId);
    booking.restaurantId = restaurant._id;
  }

  const effectiveGuests =
    updates.numberOfGuests !== undefined
      ? Number(updates.numberOfGuests)
      : Number(booking.numberOfGuests);

  const previousTableIds = (
    booking.tableIds && booking.tableIds.length
      ? booking.tableIds
      : [booking.tableId]
  ).map(String);

  let resolvedSeats;

  if (
    updates.tables !== undefined ||
    updates.tableId !== undefined ||
    updates.seatIds !== undefined
  ) {
    const selectionInput =
      updates.tables && updates.tables.length > 0
        ? updates.tables
        : [
            {
              tableId: updates.tableId || booking.tableId,
              seatIds:
                updates.seatIds !== undefined
                  ? updates.seatIds
                  : booking.seatIds || [],
            },
          ];

    resolvedSeats = await resolveTableSelections({
      restaurantId: booking.restaurantId,
      tables: selectionInput,
      numberOfGuests: effectiveGuests,
    });
  } else {
    resolvedSeats = {
      primaryTableId: booking.tableId,
      tableIds:
        booking.tableIds && booking.tableIds.length
          ? booking.tableIds
          : [booking.tableId],
      tables:
        booking.tables && booking.tables.length
          ? booking.tables
          : [
              {
                tableId: booking.tableId,
                seatSelectionMode: booking.bookingMode,
                seatIds: booking.seatIds || [],
                seatLabels: booking.seatLabels || [],
              },
            ],
      seatIds: booking.seatIds || [],
      seatLabels: booking.seatLabels || [],
      bookingMode: booking.bookingMode,
    };
  }

  const effectiveStart = updates.bookingDateTime
    ? new Date(updates.bookingDateTime)
    : new Date(booking.bookingDateTime);

  const effectiveDuration =
    updates.expectedDuration !== undefined
      ? Number(updates.expectedDuration)
      : Number(booking.expectedDuration || 120);

  const effectiveEnd = new Date(
    effectiveStart.getTime() + effectiveDuration * 60 * 1000
  );

  await assertNoSeatConflicts({
    restaurantId: booking.restaurantId,
    tableIds: resolvedSeats.tableIds,
    tables: resolvedSeats.tables,
    start: effectiveStart,
    end: effectiveEnd,
    excludeBookingId: booking._id,
  });

  const nextTableIds = resolvedSeats.tableIds.map(String);
  const releasedTableIds = previousTableIds.filter(
    (id) => !nextTableIds.includes(id)
  );

  if (releasedTableIds.length > 0) {
    await Promise.all(
      releasedTableIds.map((tableId) =>
        recomputeBookingTableStatus({
          restaurantId: booking.restaurantId,
          tableId,
        })
      )
    );
  }

  const newlyReservedDocs = await Promise.all(
    resolvedSeats.tables
      .filter(
        (entry) =>
          entry.seatSelectionMode !== SEAT_SELECTION_MODE.INDIVIDUAL_SEATS
      )
      .map((entry) =>
        RestaurantTable.findByIdAndUpdate(
          entry.tableId,
          {
            $set: {
              statusSource: "booking",
              statusScheduledUntil: null,
            },
          },
          { new: true }
        )
      )
  );
  await Promise.all(
    newlyReservedDocs.map((doc) =>
      recomputeBookingTableStatus({
        restaurantId: booking.restaurantId,
        tableId: doc._id,
      })
    )
  );

  booking.tableId = resolvedSeats.primaryTableId;
  booking.tableIds = resolvedSeats.tableIds;
  booking.tables = resolvedSeats.tables;
  booking.seatIds = resolvedSeats.seatIds;
  booking.seatLabels = resolvedSeats.seatLabels;
  booking.bookingMode = resolvedSeats.bookingMode;

  const dateFields = ["bookingDateTime", "completedAt", "cancelledAt"];
  for (const field of dateFields) {
    if (updates[field] !== undefined) {
      booking[field] = updates[field] ? new Date(updates[field]) : updates[field];
    }
  }

  const numericFields = [
    "expectedDuration",
    "numberOfGuests",
    "totalAmount",
  ];

  for (const field of numericFields) {
    if (updates[field] !== undefined) {
      booking[field] = Number(updates[field]);
    }
  }

  const stringFields = ["specialRequest", "cancellationReason", "bookingType", "paymentStatus", "paymentMethod"];
  for (const field of stringFields) {
    if (updates[field] !== undefined) {
      booking[field] = String(updates[field]).trim();
    }
  }

  if (updates.preOrderedFoods !== undefined) {
    const orderedFoods = await validateAndResolveOrderedFoods({
      foods: updates.preOrderedFoods,
      restaurantId: booking.restaurantId,
    });
    booking.preOrderedFoods = orderedFoods;
    // totalAmount is always derived server-side from resolved food prices.
    booking.totalAmount = calculateOrderedFoodsTotal(orderedFoods);
  }

  const amountChanged =
    updates.preOrderedFoods !== undefined ||
    updates.bookingDateTime !== undefined;

  if (amountChanged) {
    const restaurant = await getRestaurantOrThrow(booking.restaurantId);
    booking.advanceAmount = calculateRequiredBookingPayment({
      restaurant,
      totalAmount: booking.totalAmount,
    });
    booking.cancellationCutoffAt = calculateCancellationCutoffAt({
      restaurant,
      bookingAt: booking.bookingDateTime,
    });
  }

  if (updates.billId !== undefined) {
    booking.billId = updates.billId;
  }

  if (updates.isActive !== undefined) {
    booking.isActive = Boolean(updates.isActive);
  }

  if (updates.bookingStatus !== undefined) {
    booking.bookingStatus = updates.bookingStatus;
  }

  await booking.save();

  return {
    booking: await Booking.findById(booking._id)
      .populate("userId", "userCode fullName email phoneNumber role profileImage")
      .populate("restaurantId", "restaurantCode restaurantName slug city state country coverImage averageRating")
      .populate("tableId", "tableCode tableNumber tableName tableLabel shape seatSelectionMode capacity minimumCapacity seats status tableType tableLocation floor")
      .populate("tables.tableId", "tableCode tableNumber tableName tableLabel shape seatSelectionMode capacity minimumCapacity seats status tableType tableLocation floor")
      .populate("billId"),
    message: "Booking updated successfully.",
  };
};

export const updateBookingStatus = async ({
  bookingId,
  bookingStatus,
  cancellationReason = "",
  performedBy = null,
  performedByRole = "",
}) => {
  const booking = await getBookingOrThrow(bookingId);

  const previousStatus = booking.bookingStatus;

  // Enforce the booking status state machine (no resurrecting terminal
  // bookings, no skipping lifecycle stages).
  validateBookingTransition({
    current: previousStatus,
    next: bookingStatus,
  });

  // A BOOKING_RESTRICTED owner cannot confirm new bookings.
  if (
    bookingStatus === BOOKING_STATUS.CONFIRMED &&
    previousStatus === BOOKING_STATUS.PENDING &&
    booking.bookingType === "Online" &&
    performedByRole === USER_ROLE.OWNER
  ) {
    const restaurant = await getRestaurantOrThrow(booking.restaurantId);
    const owner = await User.findById(restaurant.ownerId).select(
      "bookingStatus"
    );

    if (owner?.bookingStatus === OWNER_BOOKING_STATUS.BOOKING_RESTRICTED) {
      throw new ApiError(
        409,
        "You cannot confirm new bookings while refunds are pending."
      );
    }
  }

  booking.bookingStatus = bookingStatus;

  if (bookingStatus === BOOKING_STATUS.COMPLETED) {
    booking.completedAt = new Date();
    booking.isActive = false;
  }

  if (
    bookingStatus === BOOKING_STATUS.CANCELLED ||
    bookingStatus === BOOKING_STATUS.NO_SHOW
  ) {
    booking.cancelledAt = new Date();
    booking.cancellationReason = cancellationReason.trim();
    booking.isActive = false;
  }

  await booking.save();

  const bookingTableIds =
    booking.tableIds && booking.tableIds.length
      ? booking.tableIds
      : [booking.tableId];

  await Promise.all(
    bookingTableIds.map((tableId) =>
      setTableStateForBookingStatus({
        tableId,
        bookingStatus,
      })
    )
  );

  try {
    await createAuditLog({
      eventType: "BOOKING_STATUS_CHANGED",
      eventAction: `status_changed_${previousStatus}_to_${bookingStatus}`,
      bookingId: booking._id,
      restaurantId: booking.restaurantId,
      userId: booking.userId,
      performedBy: performedBy || booking.userId,
      performedByRole,
      amount: booking.advanceAmount || 0,
      status: bookingStatus,
      metadata: { previousStatus, bookingCode: booking.bookingCode },
    });
  } catch (error) {
    console.error("Audit log error on booking status update:", error.message);
  }

  const updatedBooking = await Booking.findById(booking._id)
    .populate("userId", "userCode fullName email phoneNumber role profileImage")
    .populate("restaurantId", "restaurantCode restaurantName slug city state country coverImage averageRating")
    .populate("tableId", "tableCode tableNumber tableName tableLabel shape seatSelectionMode capacity minimumCapacity seats status tableType tableLocation floor")
    .populate("tables.tableId", "tableCode tableNumber tableName tableLabel shape seatSelectionMode capacity minimumCapacity seats status tableType tableLocation floor")
    .populate("billId");

  try {
    const io = getIO();
    io.to(`restaurant_${booking.restaurantId}`)
      .to(`user_${booking.userId}`)
      .emit("booking:updated", updatedBooking);
    io.to(`restaurant_${booking.restaurantId}`).emit("booking:statusUpdated", {
      bookingId: booking._id,
      status: booking.bookingStatus
    });
  } catch (error) {
    console.error("Socket error on booking status update:", error);
  }

  try {
    await createNotification({
      userId: booking.userId,
      title: "Booking Update",
      message: `Your booking (${booking.bookingCode}) has been ${booking.bookingStatus.toLowerCase()}.`,
      type: "Booking",
      linkId: booking._id,
      linkModel: "Booking",
    });
  } catch (error) {
    console.error("Notification error on booking status update:", error.message);
  }

  return {
    booking: updatedBooking,
    message: "Booking status updated successfully.",
  };
};

export const cancelBooking = async ({
  bookingId,
  cancellationReason = "",
  cancelledBy = null,
  role = null,
}) => {
  const booking = await getBookingOrThrow(bookingId);

  if (booking.bookingStatus === BOOKING_STATUS.CANCELLED) {
    throw new ApiError(409, "Booking is already cancelled.");
  }

  // Customers cannot cancel after the cancellation cutoff window.
  if (role === USER_ROLE.CUSTOMER && booking.cancellationCutoffAt) {
    const cutoff = new Date(booking.cancellationCutoffAt).getTime();

    if (Date.now() > cutoff) {
      throw new ApiError(
        409,
        "The cancellation window for this booking has passed. Please contact the restaurant."
      );
    }
  }

  const restaurant = await getRestaurantOrThrow(booking.restaurantId);

  const eligibility = calculateRefundEligibility({
    booking,
    restaurant,
    cancelledAt: new Date(),
  });

  const result = await updateBookingStatus({
    bookingId,
    bookingStatus: BOOKING_STATUS.CANCELLED,
    cancellationReason,
    performedBy: cancelledBy,
    performedByRole: role,
  });

  if (eligibility.eligible && eligibility.refundAmount > 0) {
    const refund = await createRefund({
      booking,
      restaurant,
      amount: eligibility.refundAmount,
      reason: REFUND_REASON.CUSTOMER_CANCELLED,
      remarks: cancellationReason || "Cancelled by customer.",
      createdBy: cancelledBy || booking.userId,
    });

    booking.refundStatus = REFUND_STATUS.REFUND_PENDING;
    booking.refundId = refund._id;
    await booking.save();

    try {
      await createAuditLog({
        eventType: "REFUND_REQUESTED",
        eventAction: "refund_created_on_cancellation",
        bookingId: booking._id,
        restaurantId: booking.restaurantId,
        userId: booking.userId,
        refundId: refund._id,
        performedBy: cancelledBy || booking.userId,
        performedByRole: role,
        amount: refund.amount,
        status: REFUND_STATUS.REFUND_PENDING,
        metadata: { bookingCode: booking.bookingCode, refundCode: refund.refundCode },
      });
    } catch (error) {
      console.error("Audit log error on refund creation:", error.message);
    }
  }

  const freshBooking = await getBookingOrThrow(bookingId);

  return {
    booking: freshBooking,
    message: result.message,
  };
};

export const createWalkInBooking = async ({
  ownerId,
  restaurantId,
  tableId,
  seatIds = [],
  bookingDateTime,
  expectedDuration = 120,
  numberOfGuests,
  specialRequest = "",
  preOrderedFoods = [],
}) => {
  if (!ownerId) {
    throw new ApiError(400, "Owner is required.");
  }

  const restaurant = await getRestaurantOrThrow(restaurantId);

  if (String(restaurant.ownerId) !== String(ownerId)) {
    throw new ApiError(
      403,
      "You can only create walk-in bookings for your own restaurants."
    );
  }

  return createBooking({
    userId: ownerId,
    restaurantId,
    tableId,
    seatIds,
    bookingDateTime,
    expectedDuration,
    numberOfGuests,
    bookingType: "Walk-In",
    bookingStatus: BOOKING_STATUS.CONFIRMED,
    paymentStatus: "Pending",
    paymentMethod: "Cash",
    specialRequest,
    preOrderedFoods,
    applyBookingPaymentPolicy: false,
  });
};

/**
 * Validate a payment-first booking draft against live restaurant data:
 * table/seat availability for the requested window and food prices. This is
 * the same validation `createBooking` performs; it is separated so the
 * payment controller can pre-validate availability when creating the order
 * and so `createBookingFromPayment` can re-validate at capture time.
 */
export const validateBookingDraft = async ({
  restaurant,
  tables = [],
  numberOfGuests,
  bookingDateTime,
  expectedDuration = 120,
  preOrderedFoods = [],
}) => {
  const bookingAt = new Date(bookingDateTime);

  if (Number.isNaN(bookingAt.getTime())) {
    throw new ApiError(400, "Valid booking date and time is required.");
  }

  const selectionInput =
    Array.isArray(tables) && tables.length > 0
      ? tables
      : [];

  if (!selectionInput.some((entry) => entry && entry.tableId)) {
    throw new ApiError(400, "Please select at least one table.");
  }

  const resolvedSeats = await resolveTableSelections({
    restaurantId: restaurant._id,
    tables: selectionInput,
    numberOfGuests,
  });

  const bookingEnd = new Date(
    bookingAt.getTime() + Number(expectedDuration) * 60 * 1000
  );

  await assertNoSeatConflicts({
    restaurantId: restaurant._id,
    tableIds: resolvedSeats.tableIds,
    tables: resolvedSeats.tables,
    start: bookingAt,
    end: bookingEnd,
  });

  const orderedFoods = await validateAndResolveOrderedFoods({
    foods: preOrderedFoods,
    restaurantId: restaurant._id,
  });

  return {
    bookingAt,
    bookingEnd,
    resolvedSeats,
    orderedFoods,
  };
};

/**
 * Create the CONFIRMED booking from an already-captured payment-first
 * Payment record. This is the point where a paid booking actually comes into
 * existence — the booking never exists while the payment is still pending.
 *
 * Amounts are derived server-side: advanceAmount is the captured amount, and
 * totalAmount is the pre-order total resolved from current food prices.
 */
export const createBookingFromPayment = async ({ paymentRecord }) => {
  const bookingData = paymentRecord.bookingData;

  if (!bookingData) {
    throw new ApiError(400, "Payment has no booking snapshot to create a booking from.");
  }

  const userId = paymentRecord.customerId;

  const user = await User.findById(userId).select("_id isActive isDeleted");
  if (!user || !user.isActive || user.isDeleted) {
    throw new ApiError(404, "User not found.");
  }

  const restaurant = await getRestaurantOrThrow(bookingData.restaurantId);

  if (!restaurant.isActive) {
    throw new ApiError(400, "Restaurant is not active.");
  }

  const expectedDuration = Number(bookingData.expectedDuration) || 120;
  const numberOfGuests = Number(bookingData.numberOfGuests);

  const { bookingAt, bookingEnd, resolvedSeats, orderedFoods } =
    await validateBookingDraft({
      restaurant,
      tables: bookingData.tables,
      numberOfGuests,
      bookingDateTime: bookingData.bookingDateTime,
      expectedDuration,
      preOrderedFoods: bookingData.preOrderedFoods,
    });

  // The payment window may overlap the booking time slightly; only reject
  // clearly-past times (a booking time that is a few minutes old because the
  // gateway was slow is still a valid, payable booking).
  if (bookingAt.getTime() < Date.now() - 15 * 60 * 1000) {
    throw new ApiError(400, "Booking time has already passed.");
  }

  const totalAmount = calculateOrderedFoodsTotal(orderedFoods);
  const advanceAmount = roundAmount(paymentRecord.amount || 0);

  const paymentStatus =
    advanceAmount >= totalAmount
      ? PAYMENT_STATUS.PAID
      : PAYMENT_STATUS.PARTIALLY_PAID;

  const cancellationCutoffAt = calculateCancellationCutoffAt({
    restaurant,
    bookingAt,
  });

  const bookingCode = await generateCode(
    Booking,
    "bookingCode",
    CODE_PREFIX.BOOKING
  );

  const booking = await Booking.create({
    bookingCode,
    userId,
    restaurantId: restaurant._id,
    tableId: resolvedSeats.primaryTableId,
    tableIds: resolvedSeats.tableIds,
    tables: resolvedSeats.tables,
    seatIds: resolvedSeats.seatIds,
    seatLabels: resolvedSeats.seatLabels,
    bookingMode: resolvedSeats.bookingMode,
    bookingDateTime: bookingAt,
    expectedDuration,
    numberOfGuests,
    bookingStatus: BOOKING_STATUS.CONFIRMED,
    bookingType: "Online",
    paymentStatus,
    paymentMethod: paymentRecord.paymentMethod || PAYMENT_METHOD.CARD,
    advanceAmount,
    totalAmount,
    specialRequest: String(bookingData.specialRequest || "").trim(),
    preOrderedFoods: orderedFoods,
    billId: null,
    sourcePaymentId: paymentRecord._id,
    cancellationCutoffAt,
  });

  // Race-condition guard: re-check the window after insert. If another
  // booking claimed these seats between our check and insert, roll back.
  // NOTE: for a payment-first booking this leaves a captured payment with no
  // booking — the owner must reconcile (refund) it manually. The window here
  // is sub-second.
  try {
    await assertNoSeatConflicts({
      restaurantId: restaurant._id,
      tableIds: resolvedSeats.tableIds,
      tables: resolvedSeats.tables,
      start: bookingAt,
      end: bookingEnd,
      excludeBookingId: booking._id,
    });
  } catch (error) {
    await Booking.deleteOne({ _id: booking._id });
    if (error?.statusCode === 409) {
      throw new ApiError(
        409,
        "The selected table or seat(s) were just taken. Your payment will be refunded — please contact the restaurant."
      );
    }
    throw error;
  }

  await Restaurant.findByIdAndUpdate(restaurant._id, {
    $inc: { totalBookings: 1 },
  });
  await markTablesReservedAndNotify(resolvedSeats.tables);

  try {
    const io = getIO();
    io.to(`restaurant_${restaurant._id}`).emit("booking:created", {
      bookingId: booking._id,
      tableId: resolvedSeats.primaryTableId,
      bookingDateTime: bookingAt,
    });
    const populated = await Booking.findById(booking._id)
      .populate("userId", "userCode fullName email phoneNumber role profileImage")
      .populate("restaurantId", "restaurantCode restaurantName slug city state country coverImage averageRating")
      .populate("tableId", "tableCode tableNumber tableName tableLabel shape seatSelectionMode capacity minimumCapacity seats status tableType tableLocation floor")
      .populate("tables.tableId", "tableCode tableNumber tableName tableLabel shape seatSelectionMode capacity minimumCapacity seats status tableType tableLocation floor");
    io.to(`restaurant_${restaurant._id}`)
      .to(`user_${booking.userId}`)
      .emit("booking:updated", populated);
  } catch (error) {
    console.error("Socket error on payment-first booking creation:", error);
  }

  if (restaurant.ownerId) {
    try {
      await createNotification({
        userId: restaurant.ownerId,
        title: "New Booking Received",
        message: `A new paid booking (${booking.bookingCode}) has been received for ${restaurant.restaurantName}.`,
        type: "Booking",
        linkId: booking._id,
        linkModel: "Booking",
      });
    } catch (error) {
      console.error("Notification error on payment-first booking:", error.message);
    }
  }

  try {
    await createAuditLog({
      eventType: "BOOKING_CREATED",
      eventAction: "booking_created_from_payment",
      bookingId: booking._id,
      paymentId: paymentRecord._id,
      restaurantId: restaurant._id,
      userId: booking.userId,
      performedBy: booking.userId,
      performedByRole: USER_ROLE.CUSTOMER,
      amount: booking.advanceAmount || 0,
      status: booking.bookingStatus,
      metadata: {
        bookingCode: booking.bookingCode,
        bookingType: booking.bookingType,
        bookingDateTime: bookingAt,
        totalAmount: booking.totalAmount,
        razorpayOrderId: paymentRecord.razorpayOrderId,
      },
    });
  } catch (error) {
    console.error("Audit log error on payment-first booking creation:", error.message);
  }

  return {
    booking,
    bookingEnd,
    restaurant,
  };
};

/**
 * Mark a booking as No Show. Only allowed once the customer grace period
 * (bookingDateTime + customerWaitingPeriod, default 30 minutes) has elapsed.
 * Remarks are mandatory (minimum MIN_REMARKS_LENGTH chars). The table is
 * released, and a refund is issued only if the restaurant's
 * noShowRefundPercentage is > 0 (default: advance forfeited).
 */
export const markNoShowBooking = async ({
  bookingId,
  remarks = "",
  confirmedBy = null,
  confirmedByRole = "",
}) => {
  const normalizedRemarks = String(remarks || "").trim();

  if (normalizedRemarks.length < MIN_REMARKS_LENGTH) {
    throw new ApiError(
      400,
      `Remarks are required (minimum ${MIN_REMARKS_LENGTH} characters).`
    );
  }

  if (normalizedRemarks.length > MAX_REMARKS_LENGTH) {
    throw new ApiError(
      400,
      `Remarks cannot exceed ${MAX_REMARKS_LENGTH} characters.`
    );
  }

  const booking = await getBookingOrThrow(bookingId);

  if (![BOOKING_STATUS.PENDING, BOOKING_STATUS.CONFIRMED].includes(booking.bookingStatus)) {
    throw new ApiError(
      409,
      `Only ${BOOKING_STATUS.PENDING} or ${BOOKING_STATUS.CONFIRMED} bookings can be marked as no-show.`
    );
  }

  const restaurant = await getRestaurantOrThrow(booking.restaurantId);

  const waitingMinutes =
    Number(restaurant.customerWaitingPeriod) ||
    DEFAULT_CUSTOMER_WAITING_PERIOD_MINUTES;

  const graceEnd = new Date(
    new Date(booking.bookingDateTime).getTime() + waitingMinutes * 60 * 1000
  );

  if (Date.now() < graceEnd.getTime()) {
    throw new ApiError(
      409,
      `The customer can still arrive within the grace period (${waitingMinutes} minutes after the booking time).`
    );
  }

  const result = await updateBookingStatus({
    bookingId,
    bookingStatus: BOOKING_STATUS.NO_SHOW,
    cancellationReason: normalizedRemarks,
    performedBy: confirmedBy,
    performedByRole: confirmedByRole,
  });

  booking.noShowAt = new Date();
  booking.noShowConfirmedBy = confirmedBy;
  await booking.save();

  const eligibility = calculateRefundEligibility({
    booking,
    restaurant,
    cancelledAt: new Date(),
    scenario: "NO_SHOW",
  });

  if (eligibility.eligible && eligibility.refundAmount > 0) {
    const refund = await createRefund({
      booking,
      restaurant,
      amount: eligibility.refundAmount,
      reason: REFUND_REASON.CUSTOMER_NO_SHOW,
      remarks: normalizedRemarks,
      createdBy: confirmedBy || booking.userId,
    });

    booking.refundStatus = REFUND_STATUS.REFUND_PENDING;
    booking.refundId = refund._id;
    await booking.save();

    try {
      await createAuditLog({
        eventType: "REFUND_REQUESTED",
        eventAction: "refund_created_on_no_show",
        bookingId: booking._id,
        restaurantId: booking.restaurantId,
        userId: booking.userId,
        refundId: refund._id,
        performedBy: confirmedBy || booking.userId,
        performedByRole: confirmedByRole,
        amount: refund.amount,
        status: REFUND_STATUS.REFUND_PENDING,
        metadata: { bookingCode: booking.bookingCode, refundCode: refund.refundCode },
      });
    } catch (error) {
      console.error("Audit log error on no-show refund creation:", error.message);
    }
  }

  const freshBooking = await getBookingOrThrow(bookingId);

  return {
    booking: freshBooking,
    message: result.message,
  };
};

export const getBookingById = async ({
  bookingId,
}) => {
  const booking = await Booking.findById(bookingId)
    .populate("userId", "userCode fullName email phoneNumber role profileImage")
    .populate("restaurantId", "restaurantCode restaurantName slug city state country coverImage averageRating")
    .populate("tableId", "tableCode tableNumber tableName tableLabel shape seatSelectionMode capacity minimumCapacity seats status tableType tableLocation floor")
    .populate("tables.tableId", "tableCode tableNumber tableName tableLabel shape seatSelectionMode capacity minimumCapacity seats status tableType tableLocation floor")
    .populate("preOrderedFoods.foodId", "foodCode foodName coverImage")
    .populate("refundId", "refundCode refundStatus refundMethod amount")
    .populate("billId");

  if (!booking || booking.isDeleted) {
    throw new ApiError(404, "Booking not found.");
  }

  return {
    booking,
  };
};

export const getBookings = async ({
  page = 1,
  limit = 10,
  userId = null,
  restaurantId = null,
  tableId = null,
  bookingStatus = null,
  bookingType = null,
  paymentStatus = null,
  from = null,
  sort = null,
}) => {
  const query = { isDeleted: false };

  if (userId) {
    query.userId = userId;
  }

  if (restaurantId) {
    query.restaurantId = restaurantId;
  }

  // Match the table whether it is the primary table or a secondary table of a
  // multi-table booking.
  if (tableId) {
    query.$or = [{ tableId }, { tableIds: tableId }];
  }

  if (bookingStatus) {
    query.bookingStatus = bookingStatus;
  }

  if (bookingType) {
    query.bookingType = bookingType;
  }

  if (paymentStatus) {
    query.paymentStatus = paymentStatus;
  }

  if (from) {
    query.bookingDateTime = { $gte: new Date(from) };
  }

  const pageNumber = Math.max(Number(page) || 1, 1);
  const pageSize = Math.min(Math.max(Number(limit) || 10, 1), 100);
  const skip = (pageNumber - 1) * pageSize;

  const orderBy =
    sort === "bookingDateTime" ? { bookingDateTime: 1 } : { createdAt: -1 };

  const [bookings, total] = await Promise.all([
    Booking.find(query)
      .sort(orderBy)
      .skip(skip)
      .limit(pageSize)
      .populate("userId", "userCode fullName email phoneNumber role profileImage")
      .populate("restaurantId", "restaurantCode restaurantName slug city state country coverImage averageRating")
      .populate("tableId", "tableCode tableNumber tableName tableLabel shape seatSelectionMode capacity minimumCapacity seats status tableType tableLocation floor")
      .populate("tables.tableId", "tableCode tableNumber tableName tableLabel shape seatSelectionMode capacity minimumCapacity seats status tableType tableLocation floor")
      .populate("preOrderedFoods.foodId", "foodCode foodName coverImage")
      .populate("refundId", "refundCode refundStatus refundMethod amount")
      .populate("billId"),
    Booking.countDocuments(query),
  ]);

  return {
    bookings,
    meta: {
      page: pageNumber,
      limit: pageSize,
      total,
      totalPages: Math.ceil(total / pageSize) || 1,
    },
  };
};

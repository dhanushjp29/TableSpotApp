import Booking from "../models/Booking.js";
import Restaurant from "../models/Restaurant.js";
import RestaurantTable from "../models/RestaurantTable.js";

import ApiError from "../utils/ApiError.js";
import generateCode from "../utils/generateCode.js";
import {
    buildSeatLabel,
    deriveTableLabel,
    generateSeats,
    getMaxSeatsForShape,
    getPositionsForShape,
} from "../utils/seatLayout.js";

import {
    BOOKING_STATUS,
    CODE_PREFIX,
    SEAT_SELECTION_MODE,
    SEAT_STATUS,
    TABLE_LOCATION_VALUES,
    TABLE_SHAPE,
    TABLE_STATUS,
    TABLE_STATUS_VALUES,
    TABLE_TYPE_VALUES,
} from "../utils/constants.js";

const getRestaurantOrThrow = async (restaurantId) => {
    const restaurant = await Restaurant.findById(restaurantId);

    if (!restaurant || restaurant.isDeleted) {
        throw new ApiError(404, "Restaurant not found.");
    }

    return restaurant;
};

const TABLE_ENUM_DEFAULTS = {
    tableType: TABLE_TYPE_VALUES[0],
    tableLocation: TABLE_LOCATION_VALUES[0],
    status: TABLE_STATUS.AVAILABLE,
};

const TABLE_ENUM_VALUES = {
    tableType: TABLE_TYPE_VALUES,
    tableLocation: TABLE_LOCATION_VALUES,
    status: TABLE_STATUS_VALUES,
};

const sanitizeEnumFields = (table) => {
    for (const field of Object.keys(TABLE_ENUM_VALUES)) {
        const allowed = TABLE_ENUM_VALUES[field];

        if (!allowed.includes(table[field])) {
            table[field] = TABLE_ENUM_DEFAULTS[field];
        }
    }
};

const getTableOrThrow = async (tableId) => {
    const table = await RestaurantTable.findById(tableId);

    if (!table) {
        throw new ApiError(404, "Table not found.");
    }

    return table;
};

const BOOKED_STATUSES = [
    BOOKING_STATUS.PENDING,
    BOOKING_STATUS.CONFIRMED,
];

const preserveSeatIds = (submittedSeats, existingSeats) => {
    const existingById = new Map();

    (existingSeats || []).forEach((seat) => {
        if (seat._id) {
            existingById.set(String(seat._id), seat);
        }
    });

    return submittedSeats.map((seat) => {
        const existing = existingById.get(String(seat._id));
        const _id = existing ? existing._id : undefined;

        return {
            ...(_id ? { _id } : {}),
            seatIndex: Number(seat.seatIndex),
            seatLabel: String(seat.seatLabel).trim().slice(0, 10),
            position: {
                x: Number(seat.position.x),
                y: Number(seat.position.y),
            },
            isActive: seat.isActive !== false,
            status: seat.status || existing?.status || SEAT_STATUS.AVAILABLE,
            statusScheduledUntil:
                seat.statusScheduledUntil ??
                existing?.statusScheduledUntil ??
                null,
        };
    });
};

const regenerateSeatsPreservingIds = ({ table, shape, tableLabel, count }) => {
    const existingSeats = table.seats || [];
    const layout = getPositionsForShape(shape, count);

    return layout.map((item, index) => {
        const existing = existingSeats[index];

        return {
            ...(existing && existing._id ? { _id: existing._id } : {}),
            seatIndex: index + 1,
            seatLabel: buildSeatLabel(tableLabel, index + 1),
            position: item.position,
            isActive: true,
            status: existing?.status || SEAT_STATUS.AVAILABLE,
            statusScheduledUntil: existing?.statusScheduledUntil ?? null,
        };
    });
};

const plainSeats = (seats = []) =>
    seats.map((seat) => ({
        _id: seat._id,
        seatIndex: seat.seatIndex,
        seatLabel: seat.seatLabel,
        position: { x: seat.position.x, y: seat.position.y },
        isActive: seat.isActive,
        status: seat.status || SEAT_STATUS.AVAILABLE,
        statusScheduledUntil: seat.statusScheduledUntil ?? null,
    }));

const assertUniqueSeatLabels = (seats) => {
    const activeLabels = seats
        .filter((seat) => seat.isActive !== false)
        .map((seat) => String(seat.seatLabel).toUpperCase());

    if (new Set(activeLabels).size !== activeLabels.length) {
        throw new ApiError(400, "Seat labels must be unique within a table.");
    }
};

const ensureNoBookedSeatsRemoved = async (tableId, newActiveSeatIds) => {
    const futureBookings = await Booking.find({
        tableId,
        bookingStatus: { $in: BOOKED_STATUSES },
        bookingDateTime: { $gte: new Date() },
        seatIds: { $exists: true, $ne: [] },
    }).select("seatIds");

    const bookedIds = new Set();

    futureBookings.forEach((booking) => {
        booking.seatIds.forEach((id) => bookedIds.add(String(id)));
    });

    if (bookedIds.size === 0) return;

    const activeSet = new Set(
        (newActiveSeatIds || []).map((id) => String(id))
    );

    for (const bookedId of bookedIds) {
        if (!activeSet.has(bookedId)) {
            throw new ApiError(
                409,
                "Cannot remove or deactivate a seat that has upcoming bookings."
            );
        }
    }
};

export const createTable = async ({
    restaurantId,
    tableNumber,
    tableName = "",
    tableLabel = "",
    shape = TABLE_SHAPE.SQUARE,
    seatSelectionMode = SEAT_SELECTION_MODE.FULL_TABLE,
    seats = [],
    capacity,
    minimumCapacity = 1,
    tableType = "Normal",
    otherTableType = "",
    tableLocation = "Indoor",
    otherTableLocation = "",
    floor = "",
    status = TABLE_STATUS.AVAILABLE,
    isReservable = true,
    isActive = true,
    displayOrder = 1,
    description = "",
}) => {
    const restaurant = await getRestaurantOrThrow(restaurantId);

    const existingTable = await RestaurantTable.findOne({
        restaurantId: restaurant._id,
        tableNumber,
    });

    if (existingTable) {
        throw new ApiError(
            409,
            `Table number ${tableNumber} already exists in this restaurant.`
        );
    }

    const maxSeats = getMaxSeatsForShape(shape);

    if (Number(capacity) > maxSeats) {
        throw new ApiError(
            400,
            `Shape "${shape}" supports a maximum of ${maxSeats} seats.`
        );
    }

    const resolvedLabel = deriveTableLabel({
        tableLabel,
        tableName,
        tableNumber,
    });

    const resolvedSeats =
        Array.isArray(seats) && seats.length > 0
            ? preserveSeatIds(seats, [])
            : generateSeats({ label: resolvedLabel, count: capacity, shape });

    assertUniqueSeatLabels(resolvedSeats);

    const resolvedCapacity = resolvedSeats.length;

    if (Number(minimumCapacity) > resolvedCapacity) {
        throw new ApiError(
            400,
            "Minimum capacity cannot exceed the table capacity."
        );
    }

    const tableCode = await generateCode(
        RestaurantTable,
        "tableCode",
        CODE_PREFIX.TABLE
    );

    const table = await RestaurantTable.create({
        tableCode,
        restaurantId: restaurant._id,
        tableNumber,
        tableName: tableName.trim(),
        tableLabel: resolvedLabel,
        shape,
        seatSelectionMode,
        seats: resolvedSeats,
        capacity: resolvedCapacity,
        minimumCapacity,
        tableType,
        otherTableType: otherTableType.trim(),
        tableLocation,
        otherTableLocation: otherTableLocation.trim(),
        floor: floor.trim(),
        status,
        isReservable,
        isActive,
        displayOrder,
        description: description.trim(),
    });

    return {
        table,
        message: "Table created successfully.",
    };
};

export const updateTable = async ({
    tableId,
    updates = {},
}) => {
    const table = await getTableOrThrow(tableId);

    if (
        updates.tableNumber !== undefined &&
        updates.tableNumber !== table.tableNumber
    ) {
        const duplicate = await RestaurantTable.findOne({
            restaurantId: table.restaurantId,
            tableNumber: updates.tableNumber,
            _id: { $ne: table._id },
        });

        if (duplicate) {
            throw new ApiError(
                409,
                `Table number ${updates.tableNumber} already exists in this restaurant.`
            );
        }

        table.tableNumber = updates.tableNumber;
    }

    // --- Seats-aware fields (shape, label, mode, capacity, seats) ---
    const shape =
        updates.shape !== undefined ? updates.shape : table.shape;
    const tableLabel =
        updates.tableLabel !== undefined
            ? deriveTableLabel({
                  tableLabel: updates.tableLabel,
                  tableName: table.tableName,
                  tableNumber: table.tableNumber,
              })
            : table.tableLabel;
    const seatSelectionMode =
        updates.seatSelectionMode !== undefined
            ? updates.seatSelectionMode
            : table.seatSelectionMode;

    let resolvedSeats;

    if (Array.isArray(updates.seats) && updates.seats.length > 0) {
        resolvedSeats = preserveSeatIds(updates.seats, table.seats || []);
    } else {
        const capacityRequested =
            updates.capacity !== undefined
                ? Number(updates.capacity)
                : table.capacity;

        const shapeChanged = shape !== table.shape;
        const labelChanged = tableLabel !== table.tableLabel;
        const capacityChanged = capacityRequested !== table.capacity;

        if (shapeChanged || labelChanged || capacityChanged) {
            const maxSeats = getMaxSeatsForShape(shape);

            if (capacityRequested > maxSeats) {
                throw new ApiError(
                    400,
                    `Shape "${shape}" supports a maximum of ${maxSeats} seats.`
                );
            }

            resolvedSeats = regenerateSeatsPreservingIds({
                table,
                shape,
                tableLabel,
                count: capacityRequested,
            });
        } else {
            resolvedSeats = plainSeats(table.seats || []);
        }
    }

    assertUniqueSeatLabels(resolvedSeats);

    const activeSeatIds = resolvedSeats
        .filter((seat) => seat.isActive !== false)
        .map((seat) => seat._id || seat.seatIndex);

    await ensureNoBookedSeatsRemoved(table._id, activeSeatIds);

    const resolvedCapacity = resolvedSeats.length;

    if (
        updates.minimumCapacity !== undefined &&
        Number(updates.minimumCapacity) > resolvedCapacity
    ) {
        throw new ApiError(
            400,
            "Minimum capacity cannot exceed the table capacity."
        );
    }

    table.shape = shape;
    table.tableLabel = tableLabel;
    table.seatSelectionMode = seatSelectionMode;
    table.seats = resolvedSeats;
    table.capacity = resolvedCapacity;

    const stringFields = [
        "tableName",
        "otherTableType",
        "otherTableLocation",
        "floor",
        "description",
    ];

    for (const field of stringFields) {
        if (updates[field] !== undefined) {
            table[field] = String(updates[field]).trim();
        }
    }

    const numericFields = ["minimumCapacity", "displayOrder"];

    for (const field of numericFields) {
        if (updates[field] !== undefined) {
            table[field] = Number(updates[field]);
        }
    }

    const enumFields = ["tableType", "tableLocation", "status"];

    for (const field of enumFields) {
        if (updates[field] !== undefined) {
            table[field] = updates[field];
        }
    }

    const booleanFields = ["isReservable", "isActive"];

    for (const field of booleanFields) {
        if (updates[field] !== undefined) {
            table[field] = Boolean(updates[field]);
        }
    }

    sanitizeEnumFields(table);

    // A full-edit status change supersedes any manual revert timer and marks
    // the status as owner-set so the booking-window scheduler never overrides it.
    if (updates.status !== undefined) {
        table.statusScheduledUntil = null;
        table.statusSource = "manual";
    }

    await table.save();
    await emitTableUpdated(table);

    return {
        table,
        message: "Table updated successfully.",
    };
};

import { getIO } from "../sockets/socket.handler.js";

const RESTAURANT_POPULATE = "restaurantCode restaurantName slug city state";

/**
 * Push the full (restaurant-populated) table to the restaurant room so
 * owner dashboards can update live without refetching.
 */
export const emitTableUpdated = async (table) => {
    try {
        const populated = await RestaurantTable.findById(table._id)
            .populate("restaurantId", RESTAURANT_POPULATE)
            .lean();

        const io = getIO();
        io.to(`restaurant_${table.restaurantId}`).emit("table:updated", populated);
    } catch (error) {
        console.error("Socket error on table update:", error);
    }
};

/**
 * If a manual status timer has elapsed, revert the table to Available in
 * memory + DB and broadcast the change. Returns true when reverted.
 */
const applyExpiredManualBlock = async (table) => {
    if (
        table.statusScheduledUntil &&
        table.status !== TABLE_STATUS.AVAILABLE &&
        new Date(table.statusScheduledUntil).getTime() <= Date.now()
    ) {
        table.status = TABLE_STATUS.AVAILABLE;
        table.isReservable = true;
        table.statusScheduledUntil = null;
        await table.save();
        await emitTableUpdated(table);
        return true;
    }
    return false;
};

/**
 * Revert any seat whose manual status timer has elapsed back to Available
 * in memory. Returns true when at least one seat changed.
 */
export const applyExpiredSeatBlocks = (table) => {
    const now = Date.now();
    let changed = false;

    (table.seats || []).forEach((seat) => {
        if (
            seat.status &&
            seat.status !== SEAT_STATUS.AVAILABLE &&
            seat.statusScheduledUntil &&
            new Date(seat.statusScheduledUntil).getTime() <= now
        ) {
            seat.status = SEAT_STATUS.AVAILABLE;
            seat.statusScheduledUntil = null;
            changed = true;
        }
    });

    return changed;
};

const applyExpiredSeatBlocksAndSave = async (table) => {
    const changed = applyExpiredSeatBlocks(table);

    if (changed) {
        await table.save();
        await emitTableUpdated(table);
    }

    return changed;
};

export const updateTableStatus = async ({
    tableId,
    status,
    revertAfterMinutes = null,
}) => {
    const table = await getTableOrThrow(tableId);

    table.status = status;
    table.statusSource = "manual";

    if (status === TABLE_STATUS.AVAILABLE) {
        table.isReservable = true;
        table.statusScheduledUntil = null;
    } else {
        // Any non-Available manual status blocks new bookings until the owner
        // releases it (or the optional timer elapses).
        table.isReservable = false;

        if (Number(revertAfterMinutes) > 0) {
            table.statusScheduledUntil = new Date(
                Date.now() + Number(revertAfterMinutes) * 60 * 1000
            );
        } else {
            table.statusScheduledUntil = null;
        }
    }

    await table.save();
    await emitTableUpdated(table);

    return {
        table,
        message: "Table status updated successfully.",
    };
};

export const updateSeatsStatus = async ({
    tableId,
    seatIds = [],
    status,
    revertAfterMinutes = null,
}) => {
    const table = await getTableOrThrow(tableId);

    if (!Array.isArray(seatIds) || seatIds.length === 0) {
        throw new ApiError(400, "Select at least one seat.");
    }

    const requested = new Set(seatIds.map((id) => String(id)));
    let updated = 0;

    (table.seats || []).forEach((seat) => {
        if (!requested.has(String(seat._id))) return;

        seat.status = status;

        if (status === SEAT_STATUS.AVAILABLE) {
            seat.statusScheduledUntil = null;
        } else if (Number(revertAfterMinutes) > 0) {
            seat.statusScheduledUntil = new Date(
                Date.now() + Number(revertAfterMinutes) * 60 * 1000
            );
        } else {
            seat.statusScheduledUntil = null;
        }

        updated += 1;
    });

    if (requested.size !== updated) {
        throw new ApiError(
            400,
            "One or more selected seats do not belong to this table."
        );
    }

    await table.save();
    await emitTableUpdated(table);

    return {
        table,
        message:
            updated === 1
                ? "Seat status updated successfully."
                : `${updated} seats updated successfully.`,
    };
};

export const deleteTable = async ({ tableId }) => {
    const table = await getTableOrThrow(tableId);

    table.isActive = false;
    table.isReservable = false;

    await table.save();
    await emitTableUpdated(table);

    return {
        table,
        message: "Table deactivated successfully.",
    };
};

export const getTableById = async ({ tableId }) => {
    const table = await RestaurantTable.findById(tableId).populate(
        "restaurantId",
        "restaurantCode restaurantName slug city"
    );

    if (!table) {
        throw new ApiError(404, "Table not found.");
    }

    await applyExpiredManualBlock(table);
    await applyExpiredSeatBlocksAndSave(table);

    return { table };
};

export const getTablesByRestaurant = async ({
    restaurantId,
    status = "",
    tableType = "",
    isActive = true,
}) => {
    const query = { restaurantId, isActive };

    if (status) {
        query.status = status;
    }

    if (tableType) {
        query.tableType = tableType;
    }

    const tables = await RestaurantTable.find(query).sort({
        displayOrder: 1,
        tableNumber: 1,
    });

    await Promise.all(
        tables.map(async (table) => {
            await applyExpiredManualBlock(table);
            await applyExpiredSeatBlocksAndSave(table);
        })
    );

    return { tables };
};

export const getTables = async ({
    page = 1,
    limit = 50,
    status = "",
    tableType = "",
    isActive = true,
    restaurantId = null,
    ownerId = null,
}) => {
    const query = { isActive };

    if (restaurantId) {
        query.restaurantId = restaurantId;
    }

    if (ownerId) {
        const ownedRestaurants = await Restaurant.find({ ownerId }).select("_id");
        const ownedRestaurantIds = ownedRestaurants.map((r) => r._id);
        query.restaurantId = { $in: ownedRestaurantIds };
    }

    if (status) {
        query.status = status;
    }

    if (tableType) {
        query.tableType = tableType;
    }

    const pageNumber = Math.max(Number(page) || 1, 1);
    const pageSize = Math.min(Math.max(Number(limit) || 50, 1), 100);
    const skip = (pageNumber - 1) * pageSize;

    const [tables, total] = await Promise.all([
        RestaurantTable.find(query)
            .sort({ displayOrder: 1, tableNumber: 1 })
            .skip(skip)
            .limit(pageSize)
            .populate("restaurantId", "restaurantCode restaurantName slug city state"),
        RestaurantTable.countDocuments(query),
    ]);

    await Promise.all(
        tables.map(async (table) => {
            await applyExpiredManualBlock(table);
            await applyExpiredSeatBlocksAndSave(table);
        })
    );

    return {
        tables,
        meta: {
            page: pageNumber,
            limit: pageSize,
            total,
            totalPages: Math.ceil(total / pageSize) || 1,
        },
    };
};

export const backfillTableSeats = async () => {
    const tables = await RestaurantTable.find({
        $expr: {
            $ne: [
                { $size: { $ifNull: ["$seats", []] } },
                "$capacity",
            ],
        },
    });

    let updated = 0;

    for (const table of tables) {
        const shape = table.shape || TABLE_SHAPE.SQUARE;
        const tableLabel = deriveTableLabel({
            tableLabel: table.tableLabel,
            tableName: table.tableName,
            tableNumber: table.tableNumber,
        });

        table.shape = shape;
        table.tableLabel = tableLabel;
        table.seatSelectionMode =
            table.seatSelectionMode || SEAT_SELECTION_MODE.FULL_TABLE;
        table.seats = generateSeats({
            label: tableLabel,
            count: table.capacity,
            shape,
        });

        sanitizeEnumFields(table);

        await table.save();
        updated += 1;
    }

    return { updated };
};

const parseAvailabilityStart = ({ datetime, date, time }) => {
    if (datetime) {
        const parsed = new Date(datetime);
        if (!Number.isNaN(parsed.getTime())) return parsed;
    }

    if (date && time) {
        const parsed = new Date(`${date}T${time}`);
        if (!Number.isNaN(parsed.getTime())) return parsed;
    }

    throw new ApiError(400, "A valid date and time are required.");
};

export const getTablesWithAvailability = async ({
    restaurantId,
    date,
    time,
    datetime = "",
    duration = 120,
    guests = 0,
}) => {
    const restaurant = await getRestaurantOrThrow(restaurantId);

    const start = parseAvailabilityStart({ datetime, date, time });
    const end = new Date(start.getTime() + Number(duration) * 60 * 1000);

    const [tables, overlappingBookings] = await Promise.all([
        RestaurantTable.find({
            restaurantId: restaurant._id,
            isActive: true,
        }).sort({ displayOrder: 1, tableNumber: 1 }),
        Booking.find({
            restaurantId: restaurant._id,
            bookingStatus: { $in: BOOKED_STATUSES },
            bookingDateTime: { $lt: end },
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
            .lean(),
    ]);

    await Promise.all(
        tables.map(async (table) => {
            await applyExpiredManualBlock(table);
            await applyExpiredSeatBlocksAndSave(table);
        })
    );

    const bookingsByTable = new Map();

    overlappingBookings.forEach((booking) => {
        const covered = new Set([
            String(booking.tableId),
            ...(booking.tableIds || []).map((id) => String(id)),
        ]);
        covered.forEach((tableId) => {
            if (!bookingsByTable.has(tableId)) {
                bookingsByTable.set(tableId, []);
            }
            bookingsByTable.get(tableId).push(booking);
        });
    });

    const BLOCKED_STATUSES = [
        TABLE_STATUS.MAINTENANCE,
        TABLE_STATUS.CLEANING,
        TABLE_STATUS.RESERVED,
        TABLE_STATUS.OCCUPIED,
    ];

    const serializeTable = (table) => ({
        _id: table._id,
        tableCode: table.tableCode,
        tableNumber: table.tableNumber,
        tableName: table.tableName,
        tableLabel: table.tableLabel,
        shape: table.shape,
        seatSelectionMode: table.seatSelectionMode,
        capacity: table.capacity,
        minimumCapacity: table.minimumCapacity,
        tableType: table.tableType,
        tableLocation: table.tableLocation,
        floor: table.floor,
        status: table.status,
        isReservable: table.isReservable,
        seats: table.seats,
    });

    const availableTables = tables.map((table) => {
        const isManuallyBlocked =
            !table.isReservable ||
            table.status === TABLE_STATUS.MAINTENANCE ||
            table.status === TABLE_STATUS.CLEANING;

        if (isManuallyBlocked) {
            // Owner-marked tables (manual status / not reservable) are shown
            // to customers as unavailable, with the reason surfaced in the UI.
            const activeSeats = (table.seats || []).filter(
                (seat) => seat.isActive !== false
            );

            return {
                table: serializeTable(table),
                available: false,
                fullyAvailable: false,
                blocked: true,
                blockReason: BLOCKED_STATUSES.includes(table.status)
                    ? table.status
                    : "Unavailable",
                freeSeatIds: [],
                freeSeatCount: 0,
                occupiedSeatCount: activeSeats.length,
            };
        }

        const tableBookings = bookingsByTable.get(String(table._id)) || [];
        const now = new Date();
        const activeHolds = (table.bookingHolds || []).filter(
            (hold) =>
                hold.expiresAt > now &&
                hold.bookingDateTime < end &&
                hold.bookingEndTime > start
        );
        const hasFullTableHold = activeHolds.some((hold) => hold.fullTable === true);
        const isSeatMode =
            table.seatSelectionMode === SEAT_SELECTION_MODE.INDIVIDUAL_SEATS;

        const occupiedSeatIds = new Set();
        tableBookings.forEach((booking) => {
            (booking.seatIds || []).forEach((id) =>
                occupiedSeatIds.add(String(id))
            );
        });
        activeHolds.forEach((hold) => {
            if (hold.fullTable) {
                return;
            }
            (hold.seatIds || []).forEach((id) =>
                occupiedSeatIds.add(String(id))
            );
        });

        const activeSeats = (table.seats || []).filter(
            (seat) => seat.isActive !== false
        );

        // Seats the owner manually marked non-Available (via the Status modal)
        // are excluded from new bookings until released or the timer expires.
        const manualBlockedSeatIds = activeSeats
            .filter(
                (seat) =>
                    seat.status && seat.status !== SEAT_STATUS.AVAILABLE
            )
            .map((seat) => String(seat._id));

        const unavailableSeatCount = new Set([
            ...occupiedSeatIds,
            ...manualBlockedSeatIds,
        ]).size;

        let freeSeatIds = [];
        let available = false;

        if (isSeatMode) {
            freeSeatIds = hasFullTableHold
                ? []
                : activeSeats
                    .filter((seat) => !occupiedSeatIds.has(String(seat._id)))
                    .filter(
                        (seat) =>
                            !seat.status ||
                            seat.status === SEAT_STATUS.AVAILABLE
                    )
                    .map((seat) => String(seat._id));

            // Any free seat is selectable: multiple tables can be combined to
            // reach the requested guest count.
            available = freeSeatIds.length > 0;
        } else {
            // Whole tables stay selectable regardless of capacity so a party
            // can reserve several tables to reach the requested guest count.
            available = tableBookings.length === 0 && !hasFullTableHold;
        }

        return {
            table: serializeTable(table),
            available,
            fullyAvailable: tableBookings.length === 0 && !hasFullTableHold,
            freeSeatIds,
            freeSeatCount: freeSeatIds.length,
            occupiedSeatCount: unavailableSeatCount,
            manualBlockedSeatCount: manualBlockedSeatIds.length,
        };
    });

    return {
        tables: availableTables,
        meta: {
            start: start.toISOString(),
            end: end.toISOString(),
            durationMinutes: Number(duration),
        },
    };
};

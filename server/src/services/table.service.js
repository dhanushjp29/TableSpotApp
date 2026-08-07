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
    BOOKING_STATUS.CHECKED_IN,
];

const preserveSeatIds = (submittedSeats, existingSeats) => {
    const existingById = new Map();

    (existingSeats || []).forEach((seat) => {
        if (seat._id) {
            existingById.set(String(seat._id), seat);
        }
    });

    return submittedSeats.map((seat) => {
        let _id;

        if (seat._id) {
            const existing = existingById.get(String(seat._id));
            _id = existing ? existing._id : undefined;
        }

        return {
            ...(_id ? { _id } : {}),
            seatIndex: Number(seat.seatIndex),
            seatLabel: String(seat.seatLabel).trim().slice(0, 10),
            position: {
                x: Number(seat.position.x),
                y: Number(seat.position.y),
            },
            isActive: seat.isActive !== false,
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

    await table.save();

    return {
        table,
        message: "Table updated successfully.",
    };
};

import { getIO } from "../sockets/socket.handler.js";

export const updateTableStatus = async ({
    tableId,
    status,
}) => {
    const table = await getTableOrThrow(tableId);

    table.status = status;

    if (
        status === TABLE_STATUS.AVAILABLE
    ) {
        table.isReservable = true;
    } else if (
        status === TABLE_STATUS.RESERVED ||
        status === TABLE_STATUS.OCCUPIED
    ) {
        table.isReservable = false;
    }

    await table.save();

    try {
        const io = getIO();
        io.to(`restaurant_${table.restaurantId}`).emit("table:statusUpdated", {
            tableId: table._id,
            status: table.status,
            isReservable: table.isReservable
        });
    } catch (error) {
        console.error("Socket error on table status update:", error);
    }

    return {
        table,
        message: "Table status updated successfully.",
    };
};

export const deleteTable = async ({ tableId }) => {
    const table = await getTableOrThrow(tableId);

    table.isActive = false;
    table.isReservable = false;

    await table.save();

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
            isReservable: true,
            status: {
                $nin: [TABLE_STATUS.MAINTENANCE, TABLE_STATUS.CLEANING],
            },
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

    const availableTables = tables.map((table) => {
        const tableBookings = bookingsByTable.get(String(table._id)) || [];
        const isSeatMode =
            table.seatSelectionMode === SEAT_SELECTION_MODE.INDIVIDUAL_SEATS;

        const occupiedSeatIds = new Set();
        tableBookings.forEach((booking) => {
            (booking.seatIds || []).forEach((id) =>
                occupiedSeatIds.add(String(id))
            );
        });

        const activeSeats = (table.seats || []).filter(
            (seat) => seat.isActive !== false
        );

        let freeSeatIds = [];
        let available = false;

        if (isSeatMode) {
            freeSeatIds = activeSeats
                .filter((seat) => !occupiedSeatIds.has(String(seat._id)))
                .map((seat) => String(seat._id));

            // Any free seat is selectable: multiple tables can be combined to
            // reach the requested guest count.
            available = freeSeatIds.length > 0;
        } else {
            // Whole tables stay selectable regardless of capacity so a party
            // can reserve several tables to reach the requested guest count.
            available = tableBookings.length === 0;
        }

        return {
            table: {
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
            },
            available,
            fullyAvailable: tableBookings.length === 0,
            freeSeatIds,
            freeSeatCount: freeSeatIds.length,
            occupiedSeatCount: occupiedSeatIds.size,
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

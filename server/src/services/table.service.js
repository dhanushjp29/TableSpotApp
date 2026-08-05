import Restaurant from "../models/Restaurant.js";
import RestaurantTable from "../models/RestaurantTable.js";

import ApiError from "../utils/ApiError.js";
import generateCode from "../utils/generateCode.js";

import {
    CODE_PREFIX,
    TABLE_STATUS,
} from "../utils/constants.js";

const getRestaurantOrThrow = async (restaurantId) => {
    const restaurant = await Restaurant.findById(restaurantId);

    if (!restaurant || restaurant.isDeleted) {
        throw new ApiError(404, "Restaurant not found.");
    }

    return restaurant;
};

const getTableOrThrow = async (tableId) => {
    const table = await RestaurantTable.findById(tableId);

    if (!table) {
        throw new ApiError(404, "Table not found.");
    }

    return table;
};

export const createTable = async ({
    restaurantId,
    tableNumber,
    tableName = "",
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
        capacity,
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

    const numericFields = ["capacity", "minimumCapacity", "displayOrder"];

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

import * as tableService from "../services/table.service.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import { USER_ROLE } from "../utils/constants.js";
import Restaurant from "../models/Restaurant.js";

const verifyRestaurantOwnership = async (req, restaurantId) => {
    if (req.user.role === USER_ROLE.ADMIN) return true;

    const restaurant = await Restaurant.findById(restaurantId).select("ownerId");
    if (!restaurant || String(restaurant.ownerId) !== String(req.user._id)) {
        throw new ApiError(403, "You do not have permission for this restaurant's tables.");
    }
};

export const create = async (req, res) => {
    await verifyRestaurantOwnership(req, req.validatedData.restaurantId);
    const result = await tableService.createTable(req.validatedData);
    res.status(201).json(new ApiResponse(201, result.message, result));
};

export const update = async (req, res) => {
    const { tableId } = req.params;
    const { table } = await tableService.getTableById({ tableId });
    await verifyRestaurantOwnership(req, table.restaurantId._id);

    const result = await tableService.updateTable({
        tableId,
        updates: req.validatedData,
    });
    res.status(200).json(new ApiResponse(200, result.message, result));
};

export const updateStatus = async (req, res) => {
    const { tableId } = req.params;
    const { table } = await tableService.getTableById({ tableId });
    await verifyRestaurantOwnership(req, table.restaurantId._id);

    const result = await tableService.updateTableStatus({
        tableId,
        status: req.validatedData.status,
    });
    res.status(200).json(new ApiResponse(200, result.message, result));
};

export const deleteTable = async (req, res) => {
    const { tableId } = req.params;
    const { table } = await tableService.getTableById({ tableId });
    await verifyRestaurantOwnership(req, table.restaurantId._id);

    const result = await tableService.deleteTable({ tableId });
    res.status(200).json(new ApiResponse(200, result.message, result));
};

export const getById = async (req, res) => {
    const { tableId } = req.params;
    const result = await tableService.getTableById({ tableId });
    res.status(200).json(new ApiResponse(200, "Table retrieved successfully.", result));
};

export const getByRestaurant = async (req, res) => {
    const { restaurantId } = req.params;
    const result = await tableService.getTablesByRestaurant({
        restaurantId,
        ...req.query,
    });
    res.status(200).json(new ApiResponse(200, "Tables retrieved successfully.", result));
};

export const getAll = async (req, res) => {
    const params = { ...req.query };

    // Owners should only ever see tables belonging to their own restaurants
    if (req.user.role === USER_ROLE.OWNER) {
        params.ownerId = req.user._id;
    }

    const result = await tableService.getTables(params);
    res.status(200).json(new ApiResponse(200, "Tables retrieved successfully.", result));
};

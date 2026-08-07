import * as tableService from "../services/table.service.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import { USER_ROLE } from "../utils/constants.js";
import { OWNER_BOOKING_STATUS, TABLE_STATUS } from "../utils/constants.js";
import { getOwnerBookingStatus } from "../services/ownerRestriction.service.js";
import Restaurant from "../models/Restaurant.js";

const verifyRestaurantOwnership = async (req, restaurantId) => {
    if (req.user.role === USER_ROLE.ADMIN) return true;

    const restaurant = await Restaurant.findById(restaurantId).select("ownerId");
    if (!restaurant || String(restaurant.ownerId) !== String(req.user._id)) {
        throw new ApiError(403, "You do not have permission for this restaurant's tables.");
    }
};

/**
 * A BOOKING_RESTRICTED owner may not change availability in a way that
 * enables new bookings (e.g. setting a table to AVAILABLE / reservable).
 * Admins can always override.
 */
const assertAvailabilityChangeAllowed = async (req, restaurantId, willEnableBookings) => {
    if (req.user.role !== USER_ROLE.OWNER || !willEnableBookings) return;

    const restaurant = await Restaurant.findById(restaurantId).select("ownerId");
    const status = await getOwnerBookingStatus(restaurant?.ownerId);

    if (status === OWNER_BOOKING_STATUS.BOOKING_RESTRICTED) {
        throw new ApiError(
            409,
            "You cannot make tables available for new bookings while refunds are pending."
        );
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

    const willEnableBookings =
        req.validatedData.status === TABLE_STATUS.AVAILABLE ||
        req.validatedData.isReservable === true;

    await assertAvailabilityChangeAllowed(
        req,
        table.restaurantId._id,
        willEnableBookings
    );

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

    await assertAvailabilityChangeAllowed(
        req,
        table.restaurantId._id,
        req.validatedData.status === TABLE_STATUS.AVAILABLE
    );

    const result = await tableService.updateTableStatus({
        tableId,
        status: req.validatedData.status,
        revertAfterMinutes: req.validatedData.revertAfterMinutes,
    });
    res.status(200).json(new ApiResponse(200, result.message, result));
};

export const updateSeatsStatus = async (req, res) => {
    const { tableId } = req.params;
    const { table } = await tableService.getTableById({ tableId });
    await verifyRestaurantOwnership(req, table.restaurantId._id);

    await assertAvailabilityChangeAllowed(
        req,
        table.restaurantId._id,
        req.validatedData.status === TABLE_STATUS.AVAILABLE
    );

    const result = await tableService.updateSeatsStatus({
        tableId,
        seatIds: req.validatedData.seatIds,
        status: req.validatedData.status,
        revertAfterMinutes: req.validatedData.revertAfterMinutes,
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

export const getAvailability = async (req, res) => {
    const { restaurantId } = req.params;
    const result = await tableService.getTablesWithAvailability({
        restaurantId,
        ...req.query,
    });
    res.status(200).json(new ApiResponse(200, "Availability retrieved successfully.", result));
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

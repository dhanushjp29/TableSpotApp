import * as restaurantService from "../services/restaurant.service.js";
import ApiResponse from "../utils/ApiResponse.js";
import { USER_ROLE } from "../utils/constants.js";
import ApiError from "../utils/ApiError.js";

export const create = async (req, res) => {
    const result = await restaurantService.createRestaurant({
        ...req.validatedData,
        ownerId: req.user._id,
        requirePaymentAccount: req.user.role !== USER_ROLE.ADMIN,
    });
    res.status(201).json(new ApiResponse(201, result.message, result));
};

export const update = async (req, res) => {
    const { restaurantId } = req.params;

    // Basic ownership check
    if (req.user.role !== USER_ROLE.ADMIN) {
        const { restaurant } = await restaurantService.getRestaurantById({ restaurantId });
        if (String(restaurant.ownerId._id) !== String(req.user._id)) {
            throw new ApiError(403, "You do not have permission to update this restaurant.");
        }
    }

    const result = await restaurantService.updateRestaurant({
        restaurantId,
        updates: req.validatedData,
    });
    res.status(200).json(new ApiResponse(200, result.message, result));
};

export const verify = async (req, res) => {
    const { restaurantId } = req.params;
    const result = await restaurantService.verifyRestaurant({
        restaurantId,
        ...req.validatedData,
        verifiedBy: req.user._id,
    });
    res.status(200).json(new ApiResponse(200, result.message, result));
};

export const deleteRestaurant = async (req, res) => {
    const { restaurantId } = req.params;

    if (req.user.role !== USER_ROLE.ADMIN) {
        const { restaurant } = await restaurantService.getRestaurantById({ restaurantId });
        if (String(restaurant.ownerId._id) !== String(req.user._id)) {
            throw new ApiError(403, "You do not have permission to delete this restaurant.");
        }
    }

    const result = await restaurantService.deleteRestaurant({ restaurantId });
    res.status(200).json(new ApiResponse(200, result.message, result));
};

export const getById = async (req, res) => {
    const { restaurantId } = req.params;
    const result = await restaurantService.getRestaurantById({ restaurantId });
    res.status(200).json(new ApiResponse(200, "Restaurant retrieved successfully.", result));
};

export const getBySlug = async (req, res) => {
    const { slug } = req.params;
    const result = await restaurantService.getRestaurantBySlug({ slug });
    res.status(200).json(new ApiResponse(200, "Restaurant retrieved successfully.", result));
};

export const getAll = async (req, res) => {
    const result = await restaurantService.getRestaurants(req.query);
    res.status(200).json(new ApiResponse(200, "Restaurants retrieved successfully.", result));
};

export const getCities = async (req, res) => {
    const result = await restaurantService.getRestaurantCities();
    res.status(200).json(new ApiResponse(200, "Cities retrieved successfully.", result));
};

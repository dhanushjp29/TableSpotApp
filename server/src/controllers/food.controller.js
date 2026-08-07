import * as foodService from "../services/food.service.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import { USER_ROLE } from "../utils/constants.js";
import Restaurant from "../models/Restaurant.js";

const verifyRestaurantOwnership = async (req, restaurantId) => {
    if (req.user.role === USER_ROLE.ADMIN) return true;

    const restaurant = await Restaurant.findById(restaurantId).select("ownerId");
    if (!restaurant || String(restaurant.ownerId) !== String(req.user._id)) {
        throw new ApiError(403, "You do not have permission for this restaurant's menu.");
    }
};

export const create = async (req, res) => {
    await verifyRestaurantOwnership(req, req.validatedData.restaurantId);
    const result = await foodService.createFood(req.validatedData);
    res.status(201).json(new ApiResponse(201, result.message, result));
};

export const update = async (req, res) => {
    const { foodId } = req.params;
    const { food } = await foodService.getFoodById({ foodId });
    await verifyRestaurantOwnership(req, food.restaurantId._id);

    const result = await foodService.updateFood({
        foodId,
        updates: req.validatedData,
    });
    res.status(200).json(new ApiResponse(200, result.message, result));
};

export const deleteFood = async (req, res) => {
    const { foodId } = req.params;
    const { food } = await foodService.getFoodById({ foodId });
    await verifyRestaurantOwnership(req, food.restaurantId._id);

    const result = await foodService.deleteFood({ foodId });
    res.status(200).json(new ApiResponse(200, result.message, result));
};

export const getById = async (req, res) => {
    const { foodId } = req.params;
    const result = await foodService.getFoodById({ foodId });
    res.status(200).json(new ApiResponse(200, "Food item retrieved successfully.", result));
};

export const getByRestaurant = async (req, res) => {
    const { restaurantId } = req.params;
    const result = await foodService.getFoodsByRestaurant({
        restaurantId,
        ...req.query,
    });
    res.status(200).json(new ApiResponse(200, "Food items retrieved successfully.", result));
};

export const getAll = async (req, res) => {
    const params = { ...req.query };

    // Owners should only ever see food belonging to their own restaurants.
    // Public (unauthenticated) and admin requests skip this scoping.
    if (req.user && req.user.role === USER_ROLE.OWNER) {
        params.ownerId = req.user._id;
    }

    const result = await foodService.getFoods(params);
    res.status(200).json(new ApiResponse(200, "Food items retrieved successfully.", result));
};

import Food from "../models/food.js";
import Restaurant from "../models/Restaurant.js";

import ApiError from "../utils/ApiError.js";
import generateCode from "../utils/generateCode.js";

import { CODE_PREFIX } from "../utils/constants.js";

const getRestaurantOrThrow = async (restaurantId) => {
    const restaurant = await Restaurant.findById(restaurantId);

    if (!restaurant || restaurant.isDeleted) {
        throw new ApiError(404, "Restaurant not found.");
    }

    return restaurant;
};

const getFoodOrThrow = async (foodId) => {
    const food = await Food.findById(foodId);

    if (!food || food.isDeleted) {
        throw new ApiError(404, "Food item not found.");
    }

    return food;
};

const normalizeStringArray = (values = []) =>
    values.map((v) => String(v).trim()).filter(Boolean);

export const createFood = async ({
    restaurantId,
    foodName,
    description = "",
    category,
    otherCategory = "",
    foodType,
    spiceLevel = "Medium",
    hasVariants = false,
    variants = [],
    preparationTime = 0,
    coverImage,
    galleryImages = [],
    availability,
    specialSchedule,
    isAvailable = true,
    isRecommended = false,
    isPopular = false,
    displayOrder = 1,
    isActive = true,
}) => {
    const restaurant = await getRestaurantOrThrow(restaurantId);

    const existingFood = await Food.findOne({
        restaurantId: restaurant._id,
        foodName: foodName.trim(),
        isDeleted: false,
    });

    if (existingFood) {
        throw new ApiError(
            409,
            `A food item named "${foodName}" already exists in this restaurant.`
        );
    }

    const foodCode = await generateCode(Food, "foodCode", CODE_PREFIX.FOOD);

    const food = await Food.create({
        foodCode,
        restaurantId: restaurant._id,
        foodName: foodName.trim(),
        description: description.trim(),
        category,
        otherCategory: otherCategory.trim(),
        foodType,
        spiceLevel,
        hasVariants,
        variants,
        preparationTime,
        coverImage: coverImage.trim(),
        galleryImages: normalizeStringArray(galleryImages),
        availability,
        specialSchedule,
        isAvailable,
        isRecommended,
        isPopular,
        displayOrder,
        isActive,
    });

    return {
        food,
        message: "Food item created successfully.",
    };
};

export const updateFood = async ({
    foodId,
    updates = {},
}) => {
    const food = await getFoodOrThrow(foodId);

    if (
        updates.foodName !== undefined &&
        updates.foodName.trim() !== food.foodName
    ) {
        const duplicate = await Food.findOne({
            restaurantId: food.restaurantId,
            foodName: updates.foodName.trim(),
            _id: { $ne: food._id },
            isDeleted: false,
        });

        if (duplicate) {
            throw new ApiError(
                409,
                `A food item named "${updates.foodName}" already exists in this restaurant.`
            );
        }

        food.foodName = updates.foodName.trim();
    }

    const stringFields = [
        "description",
        "otherCategory",
        "coverImage",
    ];

    for (const field of stringFields) {
        if (updates[field] !== undefined) {
            food[field] = String(updates[field]).trim();
        }
    }

    const enumFields = ["category", "foodType", "spiceLevel"];

    for (const field of enumFields) {
        if (updates[field] !== undefined) {
            food[field] = updates[field];
        }
    }

    const booleanFields = [
        "hasVariants",
        "isAvailable",
        "isRecommended",
        "isPopular",
        "isActive",
    ];

    for (const field of booleanFields) {
        if (updates[field] !== undefined) {
            food[field] = Boolean(updates[field]);
        }
    }

    const numericFields = ["preparationTime", "displayOrder"];

    for (const field of numericFields) {
        if (updates[field] !== undefined) {
            food[field] = Number(updates[field]);
        }
    }

    if (updates.variants !== undefined) {
        food.variants = updates.variants;
    }

    if (updates.galleryImages !== undefined) {
        food.galleryImages = normalizeStringArray(updates.galleryImages);
    }

    if (updates.availability !== undefined) {
        food.availability = updates.availability;
    }

    if (updates.specialSchedule !== undefined) {
        food.specialSchedule = updates.specialSchedule;
    }

    await food.save();

    return {
        food,
        message: "Food item updated successfully.",
    };
};

export const deleteFood = async ({ foodId }) => {
    const food = await getFoodOrThrow(foodId);

    food.isActive = false;
    food.isDeleted = true;
    food.deletedAt = new Date();

    await food.save();

    return {
        food,
        message: "Food item deleted successfully.",
    };
};

export const getFoodById = async ({ foodId }) => {
    const food = await Food.findById(foodId).populate(
        "restaurantId",
        "restaurantCode restaurantName slug city"
    );

    if (!food || food.isDeleted) {
        throw new ApiError(404, "Food item not found.");
    }

    return { food };
};

export const getFoodsByRestaurant = async ({
    restaurantId,
    page = 1,
    limit = 50,
    category = "",
    foodType = "",
    search = "",
    isAvailable,
}) => {
    const query = { restaurantId, isDeleted: false };

    if (category) {
        query.category = category;
    }

    if (foodType) {
        query.foodType = foodType;
    }

    if (isAvailable !== undefined) {
        query.isAvailable = isAvailable;
    }

    if (search) {
        query.foodName = new RegExp(search.trim(), "i");
    }

    const pageNumber = Math.max(Number(page) || 1, 1);
    const pageSize = Math.min(Math.max(Number(limit) || 50, 1), 100);
    const skip = (pageNumber - 1) * pageSize;

    const [foods, total] = await Promise.all([
        Food.find(query)
            .sort({ displayOrder: 1, createdAt: -1 })
            .skip(skip)
            .limit(pageSize),
        Food.countDocuments(query),
    ]);

    return {
        foods,
        meta: {
            page: pageNumber,
            limit: pageSize,
            total,
            totalPages: Math.ceil(total / pageSize) || 1,
        },
    };
};

import Food from "../models/food.js";
import User from "../models/User.js";
import Restaurant from "../models/Restaurant.js";
import Booking from "../models/Booking.js";

import ApiError from "../utils/ApiError.js";
import {
  OWNER_BOOKING_STATUS,
  USER_ROLE,
} from "../utils/constants.js";
import buildUserResponse from "../utils/buildUserResponse.js";

const isLastActiveAdmin = async (userId) => {
  const user = await User.findById(userId).select("role");

  if (user?.role !== USER_ROLE.ADMIN) {
    return false;
  }

  const activeAdmins = await User.countDocuments({
    role: USER_ROLE.ADMIN,
    isActive: true,
    isDeleted: false,
  });

  return activeAdmins <= 1;
};

export const getUserById = async ({ userId }) => {
    const user = await User.findById(userId).select("-password");

    if (!user || user.isDeleted) {
        throw new ApiError(404, "User not found.");
    }

    return { user };
};

export const updateUserProfile = async ({
    userId,
    updates = {},
}) => {
    const user = await User.findById(userId);

    if (!user || user.isDeleted) {
        throw new ApiError(404, "User not found.");
    }

    const allowedFields = [
        "fullName",
        "phoneNumber",
        "profileImage",
        "favoriteCuisines",
    ];

    for (const field of allowedFields) {
        if (updates[field] !== undefined) {
            if (field === "favoriteCuisines") {
                user[field] = Array.isArray(updates[field])
                    ? updates[field].map((v) => String(v).trim()).filter(Boolean)
                    : user[field];
            } else {
                user[field] = String(updates[field]).trim();
            }
        }
    }

    await user.save();

    return {
        user: buildUserResponse(user),
        message: "Profile updated successfully.",
    };
};

export const getUsers = async ({
    page = 1,
    limit = 10,
    role = "",
    search = "",
    isActive,
    includeDeleted = false,
}) => {
    const query = {};

    if (!includeDeleted) {
        query.isDeleted = false;
    }

    if (role) {
        query.role = role;
    }

    if (isActive !== undefined) {
        query.isActive = isActive;
    }

    if (search) {
        const searchRegex = new RegExp(search.trim(), "i");
        query.$or = [
            { fullName: searchRegex },
            { email: searchRegex },
            { userCode: searchRegex },
        ];
    }

    const pageNumber = Math.max(Number(page) || 1, 1);
    const pageSize = Math.min(Math.max(Number(limit) || 10, 1), 100);
    const skip = (pageNumber - 1) * pageSize;

    const [users, total] = await Promise.all([
        User.find(query)
            .select("-password")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(pageSize),
        User.countDocuments(query),
    ]);

    return {
        users,
        meta: {
            page: pageNumber,
            limit: pageSize,
            total,
            totalPages: Math.ceil(total / pageSize) || 1,
        },
    };
};

// Owner-scoped customer search: only customers who have booked at the owner's
// own restaurants. Used by the offer builder for SELECTED targeting.
export const getOwnerCustomers = async ({
    ownerId,
    restaurantId = null,
    search = "",
    page = 1,
    limit = 10,
}) => {
    const restaurantQuery = { ownerId, isDeleted: false };
    if (restaurantId) restaurantQuery._id = restaurantId;

    const restaurants = await Restaurant.find(restaurantQuery).select("_id");

    if (restaurantId && restaurants.length === 0) {
        throw new ApiError(403, "This restaurant does not belong to you.");
    }

    const pageNumber = Math.max(Number(page) || 1, 1);
    const pageSize = Math.min(Math.max(Number(limit) || 10, 1), 100);
    const skip = (pageNumber - 1) * pageSize;

    if (restaurants.length === 0) {
        return {
            users: [],
            meta: { page: pageNumber, limit: pageSize, total: 0, totalPages: 1 },
        };
    }

    const restaurantIds = restaurants.map((r) => r._id);

    const customerUserIds = await Booking.distinct("userId", {
        restaurantId: { $in: restaurantIds },
        isDeleted: false,
    });

    const query = {
        _id: { $in: customerUserIds },
        role: USER_ROLE.CUSTOMER,
        isActive: true,
        isDeleted: false,
    };

    if (search) {
        const searchRegex = new RegExp(search.trim(), "i");
        query.$or = [
            { fullName: searchRegex },
            { email: searchRegex },
            { phoneNumber: searchRegex },
        ];
    }

    const [users, total] = await Promise.all([
        User.find(query)
            .select(
                "_id userCode fullName email phoneNumber profileImage isEmailVerified totalBookings lastBookingAt"
            )
            .sort({ lastBookingAt: -1 })
            .skip(skip)
            .limit(pageSize),
        User.countDocuments(query),
    ]);

    return {
        users,
        meta: {
            page: pageNumber,
            limit: pageSize,
            total,
            totalPages: Math.ceil(total / pageSize) || 1,
        },
    };
};

export const toggleUserActive = async ({
    userId,
    isActive,
    actorId = null,
}) => {
    const user = await User.findById(userId);

    if (!user || user.isDeleted) {
        throw new ApiError(404, "User not found.");
    }

    const nextState =
        isActive === undefined ? !user.isActive : Boolean(isActive);

    if (actorId && String(user._id) === String(actorId)) {
        throw new ApiError(400, "You cannot deactivate your own account.");
    }

    if (nextState === false && (await isLastActiveAdmin(user._id))) {
        throw new ApiError(
            400,
            "Cannot deactivate the last active admin account."
        );
    }

    user.isActive = nextState;
    await user.save();

    return {
        user: buildUserResponse(user),
        message: nextState
            ? "User activated successfully."
            : "User deactivated successfully.",
    };
};

export const softDeleteUser = async ({ userId, actorId = null }) => {
    const user = await User.findById(userId);

    if (!user || user.isDeleted) {
        throw new ApiError(404, "User not found.");
    }

    if (actorId && String(user._id) === String(actorId)) {
        throw new ApiError(400, "You cannot delete your own account.");
    }

    if (await isLastActiveAdmin(user._id)) {
        throw new ApiError(
            400,
            "Cannot delete the last active admin account."
        );
    }

    user.isActive = false;
    user.isDeleted = true;
    user.deletedAt = new Date();

    await user.save();

    return {
        user: buildUserResponse(user),
        message: "User deleted successfully.",
    };
};

export const updateBookingRestriction = async ({
  userId,
  bookingStatus,
  actorId = null,
}) => {
  const user = await User.findById(userId);

  if (!user || user.isDeleted) {
    throw new ApiError(404, "User not found.");
  }

  if (user.role !== USER_ROLE.OWNER) {
    throw new ApiError(
      400,
      "Booking restriction can only be applied to restaurant owners."
    );
  }

  const nextStatus =
    bookingStatus === OWNER_BOOKING_STATUS.BOOKING_RESTRICTED
      ? OWNER_BOOKING_STATUS.BOOKING_RESTRICTED
      : OWNER_BOOKING_STATUS.ACTIVE;

  user.bookingStatus = nextStatus;

  if (nextStatus === OWNER_BOOKING_STATUS.BOOKING_RESTRICTED) {
    user.bookingRestrictedAt = new Date();
    user.bookingRestrictedBy = actorId || null;
  } else {
    user.bookingRestrictedAt = null;
    user.bookingRestrictedBy = null;
  }

  await user.save();

  return {
    user: buildUserResponse(user),
    message:
      nextStatus === OWNER_BOOKING_STATUS.BOOKING_RESTRICTED
        ? "Owner booking restricted successfully."
        : "Owner booking unlocked successfully.",
  };
};

export const toggleFavoriteRestaurant = async ({ userId, restaurantId }) => {
    if (!restaurantId) {
        throw new ApiError(400, "Restaurant ID is required.");
    }

    const [user, restaurant] = await Promise.all([
        User.findById(userId),
        Restaurant.findById(restaurantId),
    ]);

    if (!user || user.isDeleted) {
        throw new ApiError(404, "User not found.");
    }

    if (!restaurant || restaurant.isDeleted) {
        throw new ApiError(404, "Restaurant not found.");
    }

    const index = user.favoriteRestaurantIds.findIndex(
        (id) => String(id) === String(restaurantId)
    );

    let isFavorite;
    if (index >= 0) {
        user.favoriteRestaurantIds.splice(index, 1);
        isFavorite = false;
    } else {
        user.favoriteRestaurantIds.push(restaurant._id);
        isFavorite = true;
    }

    await user.save();

    return {
        isFavorite,
        favoriteRestaurantIds: user.favoriteRestaurantIds,
        message: isFavorite
            ? "Restaurant added to favorites."
            : "Restaurant removed from favorites.",
    };
};

export const getFavoriteRestaurants = async ({ userId }) => {
    const user = await User.findById(userId).select("favoriteRestaurantIds");

    if (!user || user.isDeleted) {
        throw new ApiError(404, "User not found.");
    }

    const favoriteRestaurantIds = user.favoriteRestaurantIds || [];
    const restaurants = await Restaurant.find({
        _id: { $in: favoriteRestaurantIds },
        isDeleted: false,
    });

    return { restaurants, favoriteRestaurantIds };
};

export const toggleFavoriteFood = async ({ userId, foodId }) => {
    if (!foodId) {
        throw new ApiError(400, "Food ID is required.");
    }

    const [user, food] = await Promise.all([
        User.findById(userId),
        Food.findById(foodId),
    ]);

    if (!user || user.isDeleted) {
        throw new ApiError(404, "User not found.");
    }

    if (!food || food.isDeleted) {
        throw new ApiError(404, "Food item not found.");
    }

    const index = user.favoriteFoodIds.findIndex(
        (id) => String(id) === String(foodId)
    );

    let isFavorite;
    if (index >= 0) {
        user.favoriteFoodIds.splice(index, 1);
        isFavorite = false;
    } else {
        user.favoriteFoodIds.push(food._id);
        isFavorite = true;
    }

    await user.save();

    return {
        isFavorite,
        favoriteFoodIds: user.favoriteFoodIds,
        message: isFavorite
            ? "Food item added to favorites."
            : "Food item removed from favorites.",
    };
};

export const getFavoriteFoods = async ({ userId }) => {
    const user = await User.findById(userId).select("favoriteFoodIds");

    if (!user || user.isDeleted) {
        throw new ApiError(404, "User not found.");
    }

    const favoriteFoodIds = user.favoriteFoodIds || [];
    const foods = await Food.find({
        _id: { $in: favoriteFoodIds },
        isDeleted: false,
    }).populate(
        "restaurantId",
        "restaurantCode restaurantName city state"
    );

    return { foods, favoriteFoodIds };
};

import User from "../models/User.js";

import ApiError from "../utils/ApiError.js";
import buildUserResponse from "../utils/buildUserResponse.js";

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

export const toggleUserActive = async ({ userId, isActive }) => {
    const user = await User.findById(userId);

    if (!user || user.isDeleted) {
        throw new ApiError(404, "User not found.");
    }

    user.isActive = Boolean(isActive);
    await user.save();

    return {
        user: buildUserResponse(user),
        message: isActive
            ? "User activated successfully."
            : "User deactivated successfully.",
    };
};

export const softDeleteUser = async ({ userId }) => {
    const user = await User.findById(userId);

    if (!user || user.isDeleted) {
        throw new ApiError(404, "User not found.");
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

import * as userService from "../services/user.service.js";
import ApiResponse from "../utils/ApiResponse.js";

export const getProfile = async (req, res) => {
    const result = await userService.getUserById({ userId: req.user._id });
    res.status(200).json(new ApiResponse(200, "Profile retrieved.", result));
};

export const updateProfile = async (req, res) => {
    const result = await userService.updateUserProfile({
        userId: req.user._id,
        updates: req.validatedData || req.body,
    });
    res.status(200).json(new ApiResponse(200, result.message, result));
};

// Admin Endpoints
export const getAll = async (req, res) => {
    const result = await userService.getUsers(req.query);
    res.status(200).json(new ApiResponse(200, "Users retrieved.", result));
};

export const toggleActive = async (req, res) => {
    const { userId } = req.params;
    const { isActive } = req.body;
    const result = await userService.toggleUserActive({ userId, isActive });
    res.status(200).json(new ApiResponse(200, result.message, result));
};

export const deleteUser = async (req, res) => {
    const { userId } = req.params;
    const result = await userService.softDeleteUser({ userId });
    res.status(200).json(new ApiResponse(200, result.message, result));
};

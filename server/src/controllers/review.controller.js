import * as reviewService from "../services/review.service.js";
import ApiResponse from "../utils/ApiResponse.js";
import { USER_ROLE } from "../utils/constants.js";
import ApiError from "../utils/ApiError.js";

export const create = async (req, res) => {
    const result = await reviewService.createReview({
        ...req.validatedData,
        userId: req.user._id,
    });
    res.status(201).json(new ApiResponse(201, result.message, result));
};

export const update = async (req, res) => {
    const { reviewId } = req.params;

    if (req.user.role === USER_ROLE.CUSTOMER) {
        const { review } = await reviewService.getReviewById({ reviewId });
        if (String(review.userId._id) !== String(req.user._id)) {
            throw new ApiError(403, "You can only update your own reviews.");
        }
    }

    const result = await reviewService.updateReview({
        reviewId,
        updates: req.validatedData || req.body, // Depending if all fields validated
    });
    res.status(200).json(new ApiResponse(200, result.message, result));
};

export const deleteReview = async (req, res) => {
    const { reviewId } = req.params;

    if (req.user.role === USER_ROLE.CUSTOMER) {
        const { review } = await reviewService.getReviewById({ reviewId });
        if (String(review.userId._id) !== String(req.user._id)) {
            throw new ApiError(403, "You can only delete your own reviews.");
        }
    }

    const result = await reviewService.deleteReview({ reviewId });
    res.status(200).json(new ApiResponse(200, result.message, result));
};

export const getById = async (req, res) => {
    const { reviewId } = req.params;
    const result = await reviewService.getReviewById({ reviewId });
    res.status(200).json(new ApiResponse(200, "Review retrieved successfully.", result));
};

export const getByRestaurant = async (req, res) => {
    const { restaurantId } = req.params;
    const result = await reviewService.getReviewsByRestaurant({ restaurantId, ...req.query });
    res.status(200).json(new ApiResponse(200, "Reviews retrieved successfully.", result));
};

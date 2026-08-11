import * as foodReviewService from "../services/foodReview.service.js";
import ApiResponse from "../utils/ApiResponse.js";
import { USER_ROLE } from "../utils/constants.js";
import ApiError from "../utils/ApiError.js";
import Restaurant from "../models/Restaurant.js";

export const create = async (req, res) => {
    const result = await foodReviewService.createReview({
        ...req.validatedData,
        userId: req.user._id,
    });
    res.status(201).json(new ApiResponse(201, result.message, result));
};

export const update = async (req, res) => {
    const { reviewId } = req.params;
    const updates = req.validatedData || req.body;

    if (req.user.role === USER_ROLE.CUSTOMER) {
        const { review } = await foodReviewService.getReviewById({ reviewId });
        if (String(review.userId._id) !== String(req.user._id)) {
            throw new ApiError(403, "You can only update your own reviews.");
        }
        if (updates.ownerReply !== undefined) {
            throw new ApiError(403, "Only the restaurant owner can reply to a review.");
        }
    }

    if (req.user.role === USER_ROLE.OWNER) {
        const { review } = await foodReviewService.getReviewById({ reviewId });
        const owned = await Restaurant.exists({
            _id: review.restaurantId,
            ownerId: req.user._id,
            isDeleted: false,
        });
        if (!owned) {
            throw new ApiError(403, "You can only reply to reviews for your own restaurant.");
        }
        const allowedKeys = ["ownerReply"];
        const disallowed = Object.keys(updates || {}).filter(
            (key) => !allowedKeys.includes(key)
        );
        if (disallowed.length > 0) {
            throw new ApiError(403, "Owners can only update the reply on a review.");
        }
    }

    const result = await foodReviewService.updateReview({
        reviewId,
        updates,
    });
    res.status(200).json(new ApiResponse(200, result.message, result));
};

export const deleteReview = async (req, res) => {
    const { reviewId } = req.params;

    if (req.user.role === USER_ROLE.CUSTOMER) {
        const { review } = await foodReviewService.getReviewById({ reviewId });
        if (String(review.userId._id) !== String(req.user._id)) {
            throw new ApiError(403, "You can only delete your own reviews.");
        }
    }

    const result = await foodReviewService.deleteReview({ reviewId });
    res.status(200).json(new ApiResponse(200, result.message, result));
};

export const getById = async (req, res) => {
    const { reviewId } = req.params;
    const result = await foodReviewService.getReviewById({ reviewId });
    res.status(200).json(new ApiResponse(200, "Food review retrieved successfully.", result));
};

export const getMyBookingReviews = async (req, res) => {
    const { bookingId } = req.query;

    if (!bookingId) {
        throw new ApiError(400, "Booking is required.");
    }

    const result = await foodReviewService.getMyReviewsForBooking({
        userId: req.user._id,
        bookingId,
    });
    res.status(200).json(new ApiResponse(200, "Food reviews retrieved successfully.", result));
};

export const getByFood = async (req, res) => {
    const { foodId } = req.params;
    const result = await foodReviewService.getReviewsByFood({ foodId, ...req.query });
    res.status(200).json(new ApiResponse(200, "Food reviews retrieved successfully.", result));
};

export const getByRestaurant = async (req, res) => {
    const { restaurantId } = req.params;
    const result = await foodReviewService.getReviewsByRestaurant({ restaurantId, ...req.query });
    res.status(200).json(new ApiResponse(200, "Food reviews retrieved successfully.", result));
};

export const getAll = async (req, res) => {
    const result = await foodReviewService.getReviews({
        ...req.query,
    });
    res.status(200).json(new ApiResponse(200, "Food reviews retrieved successfully.", result));
};

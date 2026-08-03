import Review from "../models/Review.js";
import Restaurant from "../models/Restaurant.js";
import User from "../models/User.js";

import ApiError from "../utils/ApiError.js";
import generateCode from "../utils/generateCode.js";

import { CODE_PREFIX } from "../utils/constants.js";

const normalizeStringArray = (values = []) =>
    values.map((v) => String(v).trim()).filter(Boolean);

const getReviewOrThrow = async (reviewId) => {
    const review = await Review.findById(reviewId);

    if (!review || review.isDeleted) {
        throw new ApiError(404, "Review not found.");
    }

    return review;
};

const recalculateRestaurantRating = async (restaurantId) => {
    const result = await Review.aggregate([
        {
            $match: {
                restaurantId,
                isDeleted: false,
                status: "Published",
            },
        },
        {
            $group: {
                _id: null,
                averageRating: { $avg: "$rating" },
                totalReviews: { $sum: 1 },
            },
        },
    ]);

    const stats = result[0] || { averageRating: 0, totalReviews: 0 };

    await Restaurant.findByIdAndUpdate(restaurantId, {
        averageRating: Math.round(stats.averageRating * 10) / 10,
        totalReviews: stats.totalReviews,
    });
};

export const createReview = async ({
    userId,
    restaurantId,
    bookingId = null,
    rating,
    title = "",
    comment,
    images = [],
    status = "Pending",
}) => {
    const user = await User.findById(userId).select("_id isActive isDeleted");

    if (!user || !user.isActive || user.isDeleted) {
        throw new ApiError(404, "User not found.");
    }

    const restaurant = await Restaurant.findById(restaurantId);

    if (!restaurant || restaurant.isDeleted) {
        throw new ApiError(404, "Restaurant not found.");
    }

    const existingReview = await Review.findOne({
        userId,
        restaurantId,
        isDeleted: false,
    });

    if (existingReview) {
        throw new ApiError(
            409,
            "You have already reviewed this restaurant."
        );
    }

    const reviewCode = await generateCode(
        Review,
        "reviewCode",
        CODE_PREFIX.REVIEW
    );

    const review = await Review.create({
        reviewCode,
        userId,
        restaurantId,
        bookingId,
        rating,
        title: title.trim(),
        comment: comment.trim(),
        images: normalizeStringArray(images),
        status,
    });

    if (status === "Published") {
        await recalculateRestaurantRating(restaurant._id);
    }

    return {
        review: await Review.findById(review._id)
            .populate("userId", "userCode fullName email profileImage")
            .populate("restaurantId", "restaurantCode restaurantName slug"),
        message: "Review submitted successfully.",
    };
};

export const updateReview = async ({
    reviewId,
    updates = {},
}) => {
    const review = await getReviewOrThrow(reviewId);

    if (updates.rating !== undefined) {
        review.rating = updates.rating;
    }

    if (updates.title !== undefined) {
        review.title = String(updates.title).trim();
    }

    if (updates.comment !== undefined) {
        review.comment = String(updates.comment).trim();
    }

    if (updates.images !== undefined) {
        review.images = normalizeStringArray(updates.images);
    }

    if (updates.status !== undefined) {
        review.status = updates.status;
    }

    if (updates.isActive !== undefined) {
        review.isActive = Boolean(updates.isActive);
    }

    if (updates.ownerReply !== undefined) {
        review.ownerReply = String(updates.ownerReply).trim();
        review.ownerRepliedAt = updates.ownerReply ? new Date() : null;
    }

    await review.save();

    await recalculateRestaurantRating(review.restaurantId);

    return {
        review: await Review.findById(review._id)
            .populate("userId", "userCode fullName email profileImage")
            .populate("restaurantId", "restaurantCode restaurantName slug"),
        message: "Review updated successfully.",
    };
};

export const deleteReview = async ({ reviewId }) => {
    const review = await getReviewOrThrow(reviewId);

    review.isActive = false;
    review.isDeleted = true;
    review.deletedAt = new Date();

    await review.save();

    await recalculateRestaurantRating(review.restaurantId);

    return {
        review,
        message: "Review deleted successfully.",
    };
};

export const getReviewById = async ({ reviewId }) => {
    const review = await Review.findById(reviewId)
        .populate("userId", "userCode fullName email profileImage")
        .populate("restaurantId", "restaurantCode restaurantName slug")
        .populate("bookingId", "bookingCode bookingDateTime");

    if (!review || review.isDeleted) {
        throw new ApiError(404, "Review not found.");
    }

    return { review };
};

export const getReviewsByRestaurant = async ({
    restaurantId,
    page = 1,
    limit = 10,
    status = "",
    rating = null,
}) => {
    const query = { restaurantId, isDeleted: false };

    if (status) {
        query.status = status;
    }

    if (rating) {
        query.rating = Number(rating);
    }

    const pageNumber = Math.max(Number(page) || 1, 1);
    const pageSize = Math.min(Math.max(Number(limit) || 10, 1), 100);
    const skip = (pageNumber - 1) * pageSize;

    const [reviews, total] = await Promise.all([
        Review.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(pageSize)
            .populate("userId", "userCode fullName email profileImage")
            .populate("bookingId", "bookingCode bookingDateTime"),
        Review.countDocuments(query),
    ]);

    return {
        reviews,
        meta: {
            page: pageNumber,
            limit: pageSize,
            total,
            totalPages: Math.ceil(total / pageSize) || 1,
        },
    };
};

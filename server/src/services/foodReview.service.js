import FoodReview from "../models/FoodReview.js";
import Food from "../models/food.js";
import Restaurant from "../models/Restaurant.js";
import Booking from "../models/Booking.js";
import Bill from "../models/Bill.js";
import User from "../models/User.js";

import ApiError from "../utils/ApiError.js";
import generateCode from "../utils/generateCode.js";

import { BILL_STATUS, BOOKING_STATUS, CODE_PREFIX } from "../utils/constants.js";

import { createNotification } from "./notification.service.js";

const getReviewedFoodBookingIds = async (userId, foodId) => {
    const reviews = await FoodReview.find({
        userId,
        foodId,
        bookingId: { $ne: null },
        isDeleted: false,
    }).select("bookingId");

    return new Set(reviews.map((review) => String(review.bookingId)));
};

const findEligibleBooking = async (
    userId,
    restaurantId,
    bookingId = null,
    reviewedBookingIds = new Set()
) => {
    // A customer becomes eligible to review only once the restaurant has
    // collected payment and finalized (marked PAID) the bill for their own
    // booking. A merely GENERATED bill is not enough, and another customer's
    // bill can never unlock a review.
    const bookingQuery = {
        userId,
        restaurantId,
        bookingStatus: BOOKING_STATUS.COMPLETED,
        isDeleted: false,
    };

    if (bookingId) {
        bookingQuery._id = bookingId;
    }

    const bookings = (await Booking.find(bookingQuery)
        .sort({ bookingDateTime: -1 })
        .select("_id bookingCode bookingDateTime")
        .lean())
        // Skip bookings that already have a review for this food item, so a
        // customer can re-review the dish on each new paid visit.
        .filter((b) => !reviewedBookingIds.has(String(b._id)));

    if (bookings.length === 0) {
        return null;
    }

    // Only the customer's own bookings that have a PAID bill can unlock a
    // review. Pick the most recent such booking.
    const paidBills = await Bill.find({
        bookingId: { $in: bookings.map((b) => b._id) },
        billStatus: BILL_STATUS.PAID,
        isDeleted: false,
    })
        .sort({ updatedAt: -1 })
        .select("bookingId orderedItems")
        .lean();

    const paidBookingIds = new Set(paidBills.map((b) => String(b.bookingId)));

    const eligibleBooking = bookings.find((b) =>
        paidBookingIds.has(String(b._id))
    );

    if (!eligibleBooking) {
        return null;
    }

    const bill = paidBills.find(
        (b) => String(b.bookingId) === String(eligibleBooking._id)
    );

    return {
        ...eligibleBooking,
        billOrderedItems: bill?.orderedItems || [],
    };
};

const assertEligibleBooking = async (
    userId,
    restaurantId,
    bookingId = null,
    foodId = null
) => {
    const reviewedBookingIds = foodId
        ? await getReviewedFoodBookingIds(userId, foodId)
        : new Set();
    const booking = await findEligibleBooking(
        userId,
        restaurantId,
        bookingId,
        reviewedBookingIds
    );

    if (!booking) {
        throw new ApiError(
            403,
            "You can write a review only after the restaurant creates your bill for this booking."
        );
    }

    return booking;
};

const normalizeStringArray = (values = []) =>
    values.map((v) => String(v).trim()).filter(Boolean);

const getReviewOrThrow = async (reviewId) => {
    const review = await FoodReview.findById(reviewId);

    if (!review || review.isDeleted) {
        throw new ApiError(404, "Food review not found.");
    }

    return review;
};

const recalculateFoodRating = async (foodId) => {
    const result = await FoodReview.aggregate([
        {
            $match: {
                foodId,
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

    await Food.findByIdAndUpdate(foodId, {
        averageRating: Math.round(stats.averageRating * 10) / 10,
        totalReviews: stats.totalReviews,
    });
};

export const createReview = async ({
    userId,
    restaurantId,
    foodId,
    bookingId = null,
    rating,
    title = "",
    comment,
    images = [],
    status = "Published",
}) => {
    const user = await User.findById(userId).select("_id fullName isActive isDeleted");

    if (!user || !user.isActive || user.isDeleted) {
        throw new ApiError(404, "User not found.");
    }

    const food = await Food.findById(foodId);

    if (!food || food.isDeleted) {
        throw new ApiError(404, "Food item not found.");
    }

    if (String(food.restaurantId) !== String(restaurantId)) {
        throw new ApiError(
            400,
            "This food item does not belong to the given restaurant."
        );
    }

    const eligibleBooking = await assertEligibleBooking(
        userId,
        restaurantId,
        bookingId,
        foodId
    );

    const existingReview = await FoodReview.findOne({
        userId,
        foodId,
        bookingId: eligibleBooking._id,
        isDeleted: false,
    });

    if (existingReview) {
        throw new ApiError(
            409,
            "You have already reviewed this food item for this visit."
        );
    }

    // Only allow reviewing foods that were actually ordered on the user's
    // paid bill for this restaurant.
    const orderedFoodIds = (eligibleBooking.billOrderedItems || []).map(
        (item) => String(item.foodId)
    );

    if (!orderedFoodIds.includes(String(foodId))) {
        throw new ApiError(
            403,
            "You can only review food items that were part of your bill at this restaurant."
        );
    }

    const reviewCode = await generateCode(
        FoodReview,
        "reviewCode",
        CODE_PREFIX.REVIEW
    );

    const review = await FoodReview.create({
        reviewCode,
        userId,
        restaurantId,
        foodId,
        bookingId: eligibleBooking._id,
        rating,
        title: title.trim(),
        comment: comment.trim(),
        images: normalizeStringArray(images),
        status,
    });

    if (status === "Published") {
        await recalculateFoodRating(food._id);
    }

    const restaurant = await Restaurant.findById(food.restaurantId)
        .select("ownerId restaurantName")
        .lean();

    if (restaurant?.ownerId) {
        try {
            await createNotification({
                userId: restaurant.ownerId,
                title: "New Food Review",
                message: `${user.fullName} reviewed your food item ${food.foodName}.`,
                type: "Food Review",
                linkId: review._id,
                linkModel: "FoodReview",
            });
        } catch (error) {
            console.error("Notification error on food review creation:", error.message);
        }
    }

    return {
        review: await FoodReview.findById(review._id)
            .populate("userId", "userCode fullName email profileImage")
            .populate("restaurantId", "restaurantCode restaurantName slug")
            .populate("foodId", "foodCode foodName coverImage"),
        message: "Food review submitted successfully.",
    };
};

export const updateReview = async ({
    reviewId,
    updates = {},
}) => {
    const review = await getReviewOrThrow(reviewId);

    const previousOwnerReply = review.ownerReply || "";

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

    await recalculateFoodRating(review.foodId);

    if (
        review.ownerReply &&
        review.ownerReply !== previousOwnerReply &&
        review.userId
    ) {
        try {
            const [restaurant, food] = await Promise.all([
                Restaurant.findById(review.restaurantId)
                    .select("restaurantName")
                    .lean(),
                Food.findById(review.foodId)
                    .select("foodName")
                    .lean(),
            ]);
            await createNotification({
                userId: review.userId,
                title: "Restaurant Replied to Your Food Review",
                message: `${restaurant?.restaurantName || "The restaurant"} replied to your review of ${food?.foodName || "your food item"}.`,
                type: "Food Review",
                linkId: review._id,
                linkModel: "FoodReview",
            });
        } catch (error) {
            console.error("Notification error on food review reply:", error.message);
        }
    }

    return {
        review: await FoodReview.findById(review._id)
            .populate("userId", "userCode fullName email profileImage")
            .populate("restaurantId", "restaurantCode restaurantName slug")
            .populate("foodId", "foodCode foodName coverImage"),
        message: "Food review updated successfully.",
    };
};

export const deleteReview = async ({ reviewId }) => {
    const review = await getReviewOrThrow(reviewId);

    review.isActive = false;
    review.isDeleted = true;
    review.deletedAt = new Date();

    await review.save();

    await recalculateFoodRating(review.foodId);

    return {
        review,
        message: "Food review deleted successfully.",
    };
};

export const getReviewById = async ({ reviewId }) => {
    const review = await FoodReview.findById(reviewId)
        .populate("userId", "userCode fullName email profileImage")
        .populate("restaurantId", "restaurantCode restaurantName slug")
        .populate("foodId", "foodCode foodName coverImage")
        .populate("bookingId", "bookingCode bookingDateTime");

    if (!review || review.isDeleted) {
        throw new ApiError(404, "Food review not found.");
    }

    return { review };
};

export const getReviewsByFood = async ({
    foodId,
    page = 1,
    limit = 10,
    status = "",
    rating = null,
}) => {
    const query = { foodId, isDeleted: false };

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
        FoodReview.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(pageSize)
            .populate("userId", "userCode fullName email profileImage")
            .populate("foodId", "foodCode foodName coverImage")
            .populate("bookingId", "bookingCode bookingDateTime"),
        FoodReview.countDocuments(query),
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
        FoodReview.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(pageSize)
            .populate("userId", "userCode fullName email profileImage")
            .populate("foodId", "foodCode foodName coverImage")
            .populate("bookingId", "bookingCode bookingDateTime"),
        FoodReview.countDocuments(query),
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

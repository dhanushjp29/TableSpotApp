import RestaurantReview from "../models/RestaurantReview.js";
import Restaurant from "../models/Restaurant.js";
import Booking from "../models/Booking.js";
import Bill from "../models/Bill.js";
import User from "../models/User.js";

import ApiError from "../utils/ApiError.js";
import generateCode from "../utils/generateCode.js";

import { createNotification } from "./notification.service.js";

import { BILL_STATUS, BOOKING_STATUS, CODE_PREFIX } from "../utils/constants.js";

const getReviewedBookingIds = async (userId, restaurantId) => {
    const reviews = await RestaurantReview.find({
        userId,
        restaurantId,
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
        // Skip bookings that already have a restaurant review, so a customer
        // can review each new paid visit rather than being stuck forever on
        // the first one.
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

export const assertEligibleBooking = async (
    userId,
    restaurantId,
    bookingId = null
) => {
    const reviewedBookingIds = await getReviewedBookingIds(userId, restaurantId);
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
    const review = await RestaurantReview.findById(reviewId);

    if (!review || review.isDeleted) {
        throw new ApiError(404, "Restaurant review not found.");
    }

    return review;
};

const recalculateRestaurantRating = async (restaurantId) => {
    const result = await RestaurantReview.aggregate([
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
    status = "Published",
}) => {
    const user = await User.findById(userId).select("_id fullName isActive isDeleted");

    if (!user || !user.isActive || user.isDeleted) {
        throw new ApiError(404, "User not found.");
    }

    const restaurant = await Restaurant.findById(restaurantId);

    if (!restaurant || restaurant.isDeleted) {
        throw new ApiError(404, "Restaurant not found.");
    }

    const eligibleBooking = await assertEligibleBooking(
        userId,
        restaurantId,
        bookingId
    );

    const existingReview = await RestaurantReview.findOne({
        userId,
        restaurantId,
        bookingId: eligibleBooking._id,
        isDeleted: false,
    });

    if (existingReview) {
        throw new ApiError(
            409,
            "You have already reviewed this restaurant for this visit."
        );
    }

    const reviewCode = await generateCode(
        RestaurantReview,
        "reviewCode",
        CODE_PREFIX.REVIEW
    );

    const review = await RestaurantReview.create({
        reviewCode,
        userId,
        restaurantId,
        bookingId: eligibleBooking._id,
        rating,
        title: title.trim(),
        comment: comment.trim(),
        images: normalizeStringArray(images),
        status,
    });

    if (status === "Published") {
        await recalculateRestaurantRating(restaurant._id);
    }

    if (restaurant.ownerId) {
        try {
            await createNotification({
                userId: restaurant.ownerId,
                title: "New Restaurant Review",
                message: `${user.fullName} reviewed your restaurant ${restaurant.restaurantName}.`,
                type: "Restaurant Review",
                linkId: review._id,
                linkModel: "RestaurantReview",
            });
        } catch (error) {
            console.error("Notification error on restaurant review creation:", error.message);
        }
    }

    return {
        review: await RestaurantReview.findById(review._id)
            .populate("userId", "userCode fullName email profileImage")
            .populate("restaurantId", "restaurantCode restaurantName slug"),
        message: "Restaurant review submitted successfully.",
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

    await recalculateRestaurantRating(review.restaurantId);

    if (
        review.ownerReply &&
        review.ownerReply !== previousOwnerReply &&
        review.userId
    ) {
        try {
            const restaurant = await Restaurant.findById(review.restaurantId)
                .select("restaurantName")
                .lean();
            await createNotification({
                userId: review.userId,
                title: "Restaurant Owner Replied",
                message: `${restaurant?.restaurantName || "The restaurant"} replied to your restaurant review.`,
                type: "Restaurant Review",
                linkId: review._id,
                linkModel: "RestaurantReview",
            });
        } catch (error) {
            console.error("Notification error on restaurant review reply:", error.message);
        }
    }

    return {
        review: await RestaurantReview.findById(review._id)
            .populate("userId", "userCode fullName email profileImage")
            .populate("restaurantId", "restaurantCode restaurantName slug"),
        message: "Restaurant review updated successfully.",
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
        message: "Restaurant review deleted successfully.",
    };
};

export const getReviewById = async ({ reviewId }) => {
    const review = await RestaurantReview.findById(reviewId)
        .populate("userId", "userCode fullName email profileImage")
        .populate("restaurantId", "restaurantCode restaurantName slug")
        .populate("bookingId", "bookingCode bookingDateTime");

    if (!review || review.isDeleted) {
        throw new ApiError(404, "Restaurant review not found.");
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
        RestaurantReview.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(pageSize)
            .populate("userId", "userCode fullName email profileImage")
            .populate("bookingId", "bookingCode bookingDateTime"),
        RestaurantReview.countDocuments(query),
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

export const getReviews = async ({
    page = 1,
    limit = 10,
    status = "",
    rating = null,
    restaurantId = null,
    ownerId = null,
}) => {
    const query = { isDeleted: false };

    if (restaurantId) {
        query.restaurantId = restaurantId;
    }

    if (ownerId) {
        const ownedRestaurants = await Restaurant.find({ ownerId }).select("_id");
        const ownedRestaurantIds = ownedRestaurants.map((r) => r._id);
        query.restaurantId = { $in: ownedRestaurantIds };
    }

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
        RestaurantReview.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(pageSize)
            .populate("userId", "userCode fullName email profileImage")
            .populate("restaurantId", "restaurantCode restaurantName slug city state")
            .populate("bookingId", "bookingCode bookingDateTime"),
        RestaurantReview.countDocuments(query),
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

export const getEligibility = async ({ userId, restaurantId, bookingId = null }) => {
    const reviewedBookingIds = await getReviewedBookingIds(userId, restaurantId);
    const booking = await findEligibleBooking(
        userId,
        restaurantId,
        bookingId,
        reviewedBookingIds
    );

    return {
        canReview: Boolean(booking),
        booking: booking
            ? {
                  _id: booking._id,
                  bookingCode: booking.bookingCode,
                  bookingDateTime: booking.bookingDateTime,
              }
            : null,
        // Foods the user actually ordered on their paid bill — these are the
        // only items they are allowed to write food sub-reviews for.
        billOrderedItems: booking?.billOrderedItems || [],
    };
};

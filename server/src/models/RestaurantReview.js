import mongoose from "mongoose";

const restaurantReviewSchema = new mongoose.Schema(
    {
        reviewCode: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },

        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        restaurantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Restaurant",
            required: true,
        },

        bookingId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Booking",
            default: null,
        },

        rating: {
            type: Number,
            required: true,
            min: 1,
            max: 5,
        },

        title: {
            type: String,
            default: "",
            trim: true,
        },

        comment: {
            type: String,
            required: true,
            trim: true,
        },

        images: {
            type: [String],
            default: [],
        },

        status: {
            type: String,
            enum: ["Pending", "Published", "Hidden", "Rejected"],
            default: "Pending",
        },

        ownerReply: {
            type: String,
            default: "",
            trim: true,
        },

        ownerRepliedAt: {
            type: Date,
            default: null,
        },

        isActive: {
            type: Boolean,
            default: true,
        },

        isDeleted: {
            type: Boolean,
            default: false,
        },

        deletedAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

// One review per user per restaurant
restaurantReviewSchema.index(
    { userId: 1, restaurantId: 1 },
    { unique: true }
);

const RestaurantReview = mongoose.model("RestaurantReview", restaurantReviewSchema);

export default RestaurantReview;

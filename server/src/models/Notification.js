import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
    {
        notificationCode: {
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

        title: {
            type: String,
            required: true,
            trim: true,
        },

        message: {
            type: String,
            required: true,
            trim: true,
        },

        type: {
            type: String,
            enum: [
                "System",
                "Booking",
                "Offer",
                "Review",
                "Payment",
                "Alert",
            ],
            default: "System",
        },

        linkId: {
            type: mongoose.Schema.Types.ObjectId,
            default: null,
        },

        linkModel: {
            type: String,
            enum: ["Booking", "Bill", "Restaurant", "Review", ""],
            default: "",
        },

        isRead: {
            type: Boolean,
            default: false,
        },

        readAt: {
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

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;

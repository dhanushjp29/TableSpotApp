import mongoose from "mongoose";
import { PAYMENT_TRANSACTION_STATUS_VALUES, PAYMENT_TRANSACTION_STATUS } from "../utils/constants.js";

const paymentSchema = new mongoose.Schema(
    {
        bookingId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Booking",
            required: true,
        },

        customerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        ownerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        restaurantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Restaurant",
            required: true,
        },

        razorpayOrderId: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },

        razorpayPaymentId: {
            type: String,
            default: "",
            trim: true,
        },

        razorpaySignature: {
            type: String,
            default: "",
            trim: true,
        },

        amount: {
            type: Number,
            required: true,
            min: 0,
        },

        currency: {
            type: String,
            default: "INR",
        },

        paymentStatus: {
            type: String,
            enum: PAYMENT_TRANSACTION_STATUS_VALUES,
            default: PAYMENT_TRANSACTION_STATUS.PENDING,
        },

        paymentMethod: {
            type: String,
            default: "",
        },
    },
    {
        timestamps: true,
    }
);

const Payment = mongoose.model("Payment", paymentSchema);

export default Payment;

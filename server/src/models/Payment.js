import mongoose from "mongoose";

import {
  PAYMENT_PURPOSE,
  PAYMENT_PURPOSE_VALUES,
  PAYMENT_TRANSACTION_STATUS,
  PAYMENT_TRANSACTION_STATUS_VALUES,
} from "../utils/constants.js";

// Snapshot of the booking draft a customer paid for in the payment-first
// flow. Kept on the Payment so that a verified/captured payment can
// atomically create the CONFIRMED booking (the booking does not exist yet
// while the payment is still pending). `bookingId` stays null until capture.
const bookingDraftSchema = new mongoose.Schema(
    {
        restaurantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Restaurant",
            required: true,
        },

        tables: {
            type: [
                new mongoose.Schema(
                    {
                        tableId: {
                            type: mongoose.Schema.Types.ObjectId,
                            ref: "RestaurantTable",
                            required: true,
                        },
                        seatIds: {
                            type: [mongoose.Schema.Types.ObjectId],
                            ref: "RestaurantTable.seats",
                            default: [],
                        },
                    },
                    { _id: false }
                ),
            ],
            default: [],
        },

        bookingDateTime: {
            type: Date,
            required: true,
        },

        expectedDuration: {
            type: Number,
            default: 120,
        },

        numberOfGuests: {
            type: Number,
            required: true,
            min: 1,
        },

        specialRequest: {
            type: String,
            default: "",
            trim: true,
        },

        preOrderedFoods: {
            type: [
                new mongoose.Schema(
                    {
                        foodId: {
                            type: mongoose.Schema.Types.ObjectId,
                            ref: "Food",
                            required: true,
                        },
                        variantName: {
                            type: String,
                            default: "Regular",
                            trim: true,
                        },
                        quantity: {
                            type: Number,
                            required: true,
                            min: 1,
                        },
                        price: {
                            type: Number,
                            default: 0,
                        },
                    },
                    { _id: false }
                ),
            ],
            default: [],
        },
    },
    { _id: false }
);

const paymentSchema = new mongoose.Schema(
    {
        // Null until the payment is captured in the payment-first flow; set to
        // the created booking (or the pre-existing booking in the legacy flow).
        bookingId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Booking",
            default: null,
        },

        // Only populated for payment-first orders (no bookingId at creation).
        bookingData: {
            type: bookingDraftSchema,
            default: null,
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

        billId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Bill",
            default: null,
        },

        paymentPurpose: {
            type: String,
            enum: PAYMENT_PURPOSE_VALUES,
            default: PAYMENT_PURPOSE.BOOKING_ADVANCE,
        },

        idempotencyKey: {
            type: String,
            default: null,
            trim: true,
        },

        razorpayOrderId: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },

        razorpayPaymentId: {
            type: String,
            trim: true,
        },

        razorpaySignature: {
            type: String,
            default: "",
            trim: true,
        },

        gatewayRefundId: {
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

paymentSchema.index(
    { idempotencyKey: 1 },
    {
        unique: true,
        name: "payment_idempotency_unique_partial",
        partialFilterExpression: {
            idempotencyKey: { $type: "string" },
        },
    }
);

paymentSchema.index({ razorpayPaymentId: 1 }, { unique: true, sparse: true });

paymentSchema.index({ bookingId: 1, createdAt: -1 });

paymentSchema.index({ customerId: 1, createdAt: -1 });

paymentSchema.index({ ownerId: 1, createdAt: -1 });

paymentSchema.index({ restaurantId: 1, createdAt: -1 });

paymentSchema.index({ razorpayOrderId: 1, paymentStatus: 1 });

const Payment = mongoose.model("Payment", paymentSchema);

export default Payment;

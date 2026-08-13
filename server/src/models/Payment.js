import mongoose from "mongoose";

import {
  PAYMENT_PURPOSE,
  PAYMENT_PURPOSE_VALUES,
  PAYMENT_BOOKING_STATUS,
  PAYMENT_BOOKING_STATUS_VALUES,
  PAYMENT_ORDER_STATUS,
  PAYMENT_ORDER_STATUS_VALUES,
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

        // Offer claimed at booking time. Kept on the draft so the offer is not
        // lost when the booking is materialized after the payment captures.
        offerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Offer",
            default: null,
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

        reservationHoldToken: {
            type: String,
            default: null,
            trim: true,
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

        idempotencyFingerprint: {
            type: String,
            default: "",
            trim: true,
            maxlength: 64,
        },

        orderReceipt: {
            type: String,
            default: "",
            trim: true,
            maxlength: 40,
        },

        orderCreationStatus: {
            type: String,
            enum: PAYMENT_ORDER_STATUS_VALUES,
            default: PAYMENT_ORDER_STATUS.CREATED,
        },

        orderCreationAttemptId: {
            type: String,
            default: "",
            trim: true,
        },

        orderCreationStartedAt: {
            type: Date,
            default: null,
        },

        orderCreationError: {
            type: String,
            default: "",
            trim: true,
            maxlength: 1000,
        },

        razorpayOrderId: {
            type: String,
            default: null,
            sparse: true,
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

        refundedAmount: {
            type: Number,
            default: 0,
            min: 0,
        },

        refundProcessingAmount: {
            type: Number,
            default: 0,
            min: 0,
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

        // Payment-first booking materialization state. This stays separate
        // from paymentStatus because a captured gateway payment must never be
        // relabeled as failed when booking creation needs recovery.
        bookingCreationStatus: {
            type: String,
            enum: PAYMENT_BOOKING_STATUS_VALUES,
            default: null,
        },

        bookingFailureReason: {
            type: String,
            default: "",
            trim: true,
            maxlength: 1000,
        },

        bookingFailureAt: {
            type: Date,
            default: null,
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
    { customerId: 1, idempotencyKey: 1 },
    {
        unique: true,
        name: "payment_customer_idempotency_unique_partial",
        partialFilterExpression: {
            idempotencyKey: { $type: "string" },
        },
    }
);

paymentSchema.index({ razorpayPaymentId: 1 }, { unique: true, sparse: true });
paymentSchema.index(
    { razorpayOrderId: 1 },
    { unique: true, sparse: true, name: "payment_razorpay_order_unique" }
);

paymentSchema.index({ bookingId: 1, createdAt: -1 });

paymentSchema.index({ customerId: 1, createdAt: -1 });

paymentSchema.index({ ownerId: 1, createdAt: -1 });

paymentSchema.index({ restaurantId: 1, createdAt: -1 });

paymentSchema.index({ razorpayOrderId: 1, paymentStatus: 1 });
paymentSchema.index({ reservationHoldToken: 1 }, { sparse: true });
paymentSchema.index({ bookingCreationStatus: 1, paymentStatus: 1, bookingId: 1 });
paymentSchema.index({ orderReceipt: 1 }, { sparse: true });

const Payment = mongoose.model("Payment", paymentSchema);

export default Payment;

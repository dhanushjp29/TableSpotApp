import mongoose from "mongoose";

import {
  REFUND_METHOD_VALUES,
  REFUND_REASON_VALUES,
  REFUND_STATUS_VALUES,
} from "../utils/constants.js";

const refundSchema = new mongoose.Schema(
  {
    refundCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
    },

    billId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bill",
      default: null,
    },

    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
    },

    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    reason: {
      type: String,
      enum: REFUND_REASON_VALUES,
      required: true,
    },

    remarks: {
      type: String,
      default: "",
      trim: true,
    },

    refundMethod: {
      type: String,
      enum: REFUND_METHOD_VALUES,
      default: "RAZORPAY",
    },

    refundStatus: {
      type: String,
      enum: REFUND_STATUS_VALUES,
      default: "REFUND_PENDING",
    },

    gatewayRefundId: {
      type: String,
      default: "",
      trim: true,
    },

    transactionId: {
      type: String,
      default: "",
      trim: true,
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

    processingClaimToken: {
      type: String,
      default: "",
      trim: true,
    },

    processingAttempt: {
      type: Number,
      default: 0,
      min: 0,
    },

    reconciliationRequiredAt: {
      type: Date,
      default: null,
    },

    requestedAt: {
      type: Date,
      default: null,
    },

    deadlineAt: {
      type: Date,
      default: null,
    },

    processingAt: {
      type: Date,
      default: null,
    },

    completedAt: {
      type: Date,
      default: null,
    },

    failedAt: {
      type: Date,
      default: null,
    },

    overdueAt: {
      type: Date,
      default: null,
    },

    overdueReason: {
      type: String,
      default: "",
      trim: true,
    },

    failureReason: {
      type: String,
      default: "",
      trim: true,
    },

    customerConfirmationRequired: {
      type: Boolean,
      default: false,
    },

    customerConfirmationAt: {
      type: Date,
      default: null,
    },

    customerConfirmationBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    disputedAt: {
      type: Date,
      default: null,
    },

    disputeReason: {
      type: String,
      default: "",
      trim: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
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

refundSchema.index({ bookingId: 1, createdAt: -1 });

refundSchema.index({
  restaurantId: 1,
  refundStatus: 1,
});

refundSchema.index(
  { bookingId: 1, idempotencyKey: 1 },
  {
    unique: true,
    name: "refund_booking_idempotency_unique_partial",
    partialFilterExpression: {
      idempotencyKey: { $type: "string" },
    },
  }
);

refundSchema.index({ deadlineAt: 1 });

refundSchema.index({ bookingId: 1, reason: 1, isDeleted: 1 });

refundSchema.index({ ownerId: 1, refundStatus: 1, isDeleted: 1 });

refundSchema.index({ customerId: 1, createdAt: -1 });

const Refund = mongoose.model("Refund", refundSchema);

export default Refund;

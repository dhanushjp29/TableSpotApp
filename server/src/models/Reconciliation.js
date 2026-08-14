import mongoose from "mongoose";

import {
  RECONCILIATION_MANUAL_REASON_VALUES,
  RECONCILIATION_RESOLUTION_VALUES,
  RECONCILIATION_STATUS,
  RECONCILIATION_STATUS_VALUES,
} from "../utils/constants.js";

/**
 * Recovery tracker for a captured Payment whose booking materialization could
 * not be completed. The Payment record is the financial source of truth — this
 * document only drives the reconciliation worker and the admin manual-recovery
 * UI. States mirror the worker state machine in utils/constants.js.
 */
const reconciliationSchema = new mongoose.Schema(
  {
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      required: true,
      unique: true,
    },

    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      default: null,
    },

    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      default: null,
    },

    razorpayOrderId: {
      type: String,
      default: "",
      trim: true,
    },

    razorpayPaymentId: {
      type: String,
      default: "",
      trim: true,
    },

    status: {
      type: String,
      enum: RECONCILIATION_STATUS_VALUES,
      default: RECONCILIATION_STATUS.PENDING,
    },

    resolution: {
      type: String,
      enum: RECONCILIATION_RESOLUTION_VALUES,
      default: null,
    },

    resolutionReason: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
    },

    attempts: {
      type: Number,
      default: 0,
      min: 0,
    },

    lastAttemptAt: {
      type: Date,
      default: null,
    },

    nextAttemptAt: {
      type: Date,
      default: null,
    },

    claimedAt: {
      type: Date,
      default: null,
    },

    claimToken: {
      type: String,
      default: "",
      trim: true,
    },

    processingStartedAt: {
      type: Date,
      default: null,
    },

    lastError: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
    },

    resolvedAt: {
      type: Date,
      default: null,
    },

    source: {
      type: String,
      enum: ["worker", "admin"],
      default: "worker",
    },
  },
  {
    timestamps: true,
  }
);

// Worker candidate scan: PENDING, FAILED_RETRYABLE due for retry, or stale
// PROCESSING claims that can be reclaimed.
reconciliationSchema.index(
  { status: 1, nextAttemptAt: 1, processingStartedAt: 1 },
  { name: "reconciliation_worker_candidates" }
);

// Admin queue browsing.
reconciliationSchema.index({ status: 1, createdAt: -1 });
reconciliationSchema.index({ restaurantId: 1, createdAt: -1 });

const Reconciliation = mongoose.model("Reconciliation", reconciliationSchema);

export default Reconciliation;

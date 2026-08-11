import mongoose from "mongoose";

import {
  REPORT_CATEGORY_VALUES,
  REPORT_SEVERITY_VALUES,
  REPORT_STATUS,
  REPORT_STATUS_VALUES,
} from "../utils/constants.js";

const restaurantReportSchema = new mongoose.Schema(
  {
    reportCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    // Customer who filed the report.
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

    // The visit that triggered the report (must have a completed, non-cancelled
    // booking / bill at the restaurant).
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      default: null,
    },

    billId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bill",
      default: null,
    },

    category: {
      type: String,
      enum: REPORT_CATEGORY_VALUES,
      required: true,
    },

    severity: {
      type: String,
      enum: REPORT_SEVERITY_VALUES,
      default: "Medium",
    },

    title: {
      type: String,
      default: "",
      trim: true,
    },

    description: {
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
      enum: REPORT_STATUS_VALUES,
      default: REPORT_STATUS.PENDING,
    },

    // Admin who reviewed / resolved / rejected the report.
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    adminNotes: {
      type: String,
      default: "",
      trim: true,
    },

    statusChangedAt: {
      type: Date,
      default: null,
    },

    resolvedAt: {
      type: Date,
      default: null,
    },

    rejectedAt: {
      type: Date,
      default: null,
    },

    // Set when the report was closed by issuing a formal warning.
    warningId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RestaurantWarning",
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

// A customer cannot keep a second report open against the same restaurant
// while an earlier one is still pending review.
restaurantReportSchema.index(
  { userId: 1, restaurantId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: REPORT_STATUS.PENDING },
  }
);

restaurantReportSchema.index({ restaurantId: 1, status: 1, createdAt: -1 });
restaurantReportSchema.index({ status: 1, severity: 1, createdAt: -1 });
restaurantReportSchema.index({ userId: 1, createdAt: -1 });

const RestaurantReport = mongoose.model(
  "RestaurantReport",
  restaurantReportSchema
);

export default RestaurantReport;
import mongoose from "mongoose";

import {
  WARNING_LEVEL_VALUES,
  WARNING_STATUS,
  WARNING_STATUS_VALUES,
} from "../utils/constants.js";

const replySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    role: {
      type: String,
      enum: ["owner", "admin", "customer"],
      required: true,
    },

    fullName: {
      type: String,
      default: "",
      trim: true,
    },

    message: {
      type: String,
      required: true,
      trim: true,
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const restaurantWarningSchema = new mongoose.Schema(
  {
    warningCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
    },

    // Owner of the warned restaurant (snapshotted for lookups even if the
    // restaurant itself is later deleted).
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Customer who filed the linked report (snapshotted so the customer can be
    // scoped into the warning conversation even if the report is later changed).
    reporterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    level: {
      type: String,
      enum: WARNING_LEVEL_VALUES,
      required: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    reason: {
      type: String,
      required: true,
      trim: true,
    },

    // Admin who issued the warning.
    issuedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    issuedAt: {
      type: Date,
      default: Date.now,
    },

    expiresAt: {
      type: Date,
      required: true,
    },

    status: {
      type: String,
      enum: WARNING_STATUS_VALUES,
      default: WARNING_STATUS.ACTIVE,
    },

    // Set when an admin clears an active warning early.
    clearedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    clearedAt: {
      type: Date,
      default: null,
    },

    clearedReason: {
      type: String,
      default: "",
      trim: true,
    },

    expiredAt: {
      type: Date,
      default: null,
    },

    // Report that led to this warning (optional — warnings can also be
    // issued manually from the admin restaurants page).
    relatedReportId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RestaurantReport",
      default: null,
    },

    // Admin / owner / customer conversation thread about this warning.
    replies: {
      type: [replySchema],
      default: [],
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

restaurantWarningSchema.index({ restaurantId: 1, status: 1, createdAt: -1 });
restaurantWarningSchema.index({ ownerId: 1, status: 1, createdAt: -1 });
restaurantWarningSchema.index({ status: 1, expiresAt: 1 });

const RestaurantWarning = mongoose.model(
  "RestaurantWarning",
  restaurantWarningSchema
);

export default RestaurantWarning;
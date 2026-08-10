import mongoose from "mongoose";

import {
  OFFER_RECIPIENT_STATUS_VALUES,
  OFFER_USAGE_SOURCE_VALUES,
} from "../utils/constants.js";

// One row per claim/usage of an offer by a customer (or a walk-in customer
// identified only by email, or fully anonymous for public code-only usage).
const offerRecipientSchema = new mongoose.Schema(
  {
    offerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Offer",
      required: true,
    },

    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
    },

    // null for anonymous walk-in code-only redemptions. Walk-ins that provide
    // an email are always linked to the real existing account (never a fake).
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // Snapshot of the identifying email (walk-in) for reporting.
    email: {
      type: String,
      default: "",
      lowercase: true,
      trim: true,
    },

    status: {
      type: String,
      enum: OFFER_RECIPIENT_STATUS_VALUES,
      default: "AVAILABLE",
    },

    claimedAt: {
      type: Date,
      default: null,
    },

    usedAt: {
      type: Date,
      default: null,
    },

    // Set when an active recipient is moved to EXPIRED because the offer
    // validity window passed before the customer redeemed it.
    expiredAt: {
      type: Date,
      default: null,
    },

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

    // Actual discount applied when the recipient was marked USED.
    discountAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    usageSource: {
      type: String,
      enum: OFFER_USAGE_SOURCE_VALUES,
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

// A customer can never hold more than one active recipient per offer.
// USED/EXPIRED rows are excluded so reuse is governed by the redemption limit.
offerRecipientSchema.index(
  { offerId: 1, userId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      userId: { $type: "objectId" },
      status: { $in: ["AVAILABLE", "CLAIMED", "RESERVED"] },
    },
  }
);

// Same rule for email-identified walk-in redemptions.
offerRecipientSchema.index(
  { offerId: 1, email: 1 },
  {
    unique: true,
    partialFilterExpression: {
      email: { $type: "string", $ne: "" },
      status: { $in: ["AVAILABLE", "CLAIMED", "RESERVED"] },
    },
  }
);

offerRecipientSchema.index({ offerId: 1, status: 1, createdAt: -1 });

offerRecipientSchema.index({ restaurantId: 1, status: 1 });

offerRecipientSchema.index({ userId: 1, status: 1, createdAt: -1 });

offerRecipientSchema.index({ offerId: 1, billId: 1 });

const OfferRecipient = mongoose.model("OfferRecipient", offerRecipientSchema);

export default OfferRecipient;

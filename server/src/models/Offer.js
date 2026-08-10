import mongoose from "mongoose";

import {
  DISCOUNT_TYPE_VALUES,
  OFFER_TARGETING,
  OFFER_TARGETING_VALUES,
} from "../utils/constants.js";

const offerSchema = new mongoose.Schema(
  {
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
      index: true,
    },

    // Customer-facing coupon code. Uppercase, unique per restaurant.
    offerCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    // Reuses the bill discount enums ("Amount" | "Percentage") so bill
    // integration is a direct mapping with no conversion.
    discountType: {
      type: String,
      enum: DISCOUNT_TYPE_VALUES,
      required: true,
    },

    discountValue: {
      type: Number,
      required: true,
      min: 1,
    },

    // Minimum bill subtotal required before the offer can be applied.
    minOrderAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Cap on the discount per redemption. 0 = unlimited.
    maxDiscountAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Total number of redemptions across all customers. 0 = unlimited.
    maxRedemptions: {
      type: Number,
      default: 0,
      min: 0,
    },

    // How many times a single customer may redeem this offer.
    perUserRedemptionLimit: {
      type: Number,
      default: 1,
      min: 1,
    },

    validityStart: {
      type: Date,
      required: true,
    },

    validityEnd: {
      type: Date,
      required: true,
    },

    targeting: {
      type: String,
      enum: OFFER_TARGETING_VALUES,
      default: OFFER_TARGETING.ALL,
    },

    // SEGMENT targeting: matched against a customer's history with THIS
    // restaurant only (restaurant-scoped loyalty).
    segmentRules: {
      minBookings: {
        type: Number,
        default: 0,
        min: 0,
      },
      minTotalSpent: {
        type: Number,
        default: 0,
        min: 0,
      },
      // Only customers with at least one COMPLETED booking are eligible.
      hasCompletedBooking: {
        type: Boolean,
        default: false,
      },
      // Eligible only if the customer has a booking within the last N days.
      recentWithinDays: {
        type: Number,
        default: 0,
        min: 0,
      },
      // Eligible only if the customer has NO booking in the last N days.
      inactiveSinceDays: {
        type: Number,
        default: 0,
        min: 0,
      },
    },

    // SELECTED targeting: explicit whitelist of customer users.
    targetUserIds: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "User",
      default: [],
    },

    // Whether the offer discount can be combined with a manual bill discount.
    // When false (default) the offer takes precedence and any manual discount
    // is cleared when the offer is applied.
    isStackable: {
      type: Boolean,
      default: false,
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

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Denormalized usage counters (source of truth is OfferRecipient).
    stats: {
      totalRecipients: {
        type: Number,
        default: 0,
        min: 0,
      },
      totalClaims: {
        type: Number,
        default: 0,
        min: 0,
      },
      totalRedemptions: {
        type: Number,
        default: 0,
        min: 0,
      },
      totalDiscountAmount: {
        type: Number,
        default: 0,
        min: 0,
      },
    },
  },
  {
    timestamps: true,
  }
);

// One offer code per restaurant.
offerSchema.index({ restaurantId: 1, offerCode: 1 }, { unique: true });

offerSchema.index({ restaurantId: 1, validityEnd: 1 });

offerSchema.index({ isActive: 1, isDeleted: 1, validityStart: 1, validityEnd: 1 });

offerSchema.index({ targeting: 1, isActive: 1 });

const Offer = mongoose.model("Offer", offerSchema);

export default Offer;

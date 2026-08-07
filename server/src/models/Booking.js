import mongoose from "mongoose";

import {
  REFUND_STATUS,
  REFUND_STATUS_VALUES,
  SEAT_SELECTION_MODE,
  SEAT_SELECTION_MODE_VALUES,
} from "../utils/constants.js";

const preOrderedFoodSchema = new mongoose.Schema(
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
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

const bookingSchema = new mongoose.Schema(
  {
    bookingCode: {
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

    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
    },

    tableId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RestaurantTable",
      required: true,
    },

    // All tables involved in this booking. `tableId` above always holds the
    // primary (first selected) table for backward compatibility with owner
    // pages, billing, sockets, and audit logs.
    tableIds: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "RestaurantTable",
      default: [],
    },

    // Per-table assignment: which seats (if any) were booked on each table,
    // and how that table was booked (whole table vs individual seats).
    tables: {
      type: [
        new mongoose.Schema(
          {
            tableId: {
              type: mongoose.Schema.Types.ObjectId,
              ref: "RestaurantTable",
              required: true,
            },
            seatSelectionMode: {
              type: String,
              enum: SEAT_SELECTION_MODE_VALUES,
              default: SEAT_SELECTION_MODE.FULL_TABLE,
            },
            seatIds: {
              type: [mongoose.Schema.Types.ObjectId],
              ref: "RestaurantTable.seats",
              default: [],
            },
            seatLabels: {
              type: [String],
              default: [],
            },
          },
          { _id: false }
        ),
      ],
      default: [],
    },

    seatIds: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "RestaurantTable.seats",
      default: [],
    },

    seatLabels: {
      type: [String],
      default: [],
    },

    bookingMode: {
      type: String,
      enum: SEAT_SELECTION_MODE_VALUES,
      default: SEAT_SELECTION_MODE.FULL_TABLE,
    },

    bookingDateTime: {
      type: Date,
      required: true,
    },

    expectedDuration: {
      type: Number,
      default: 120, // Minutes
    },

    numberOfGuests: {
      type: Number,
      required: true,
      min: 1,
    },

    bookingStatus: {
      type: String,
      enum: [
        "Pending",
        "Confirmed",
        "Completed",
        "Cancelled",
        "No Show",
      ],
      default: "Pending",
    },

    bookingType: {
      type: String,
      enum: ["Online", "Walk-In"],
      default: "Online",
    },

    paymentStatus: {
      type: String,
      enum: [
        "Pending",
        "Paid",
        "Partially Paid",
        "Refunded",
      ],
      default: "Pending",
    },

    paymentMethod: {
      type: String,
      enum: [
        "UPI",
        "Card",
        "Net Banking",
        "Cash",
        "Wallet",
      ],
      default: "Cash",
    },

    advanceAmount: {
      type: Number,
      default: 0,
    },

    totalAmount: {
      type: Number,
      default: 0,
    },

    specialRequest: {
      type: String,
      default: "",
      trim: true,
    },

    preOrderedFoods: {
      type: [preOrderedFoodSchema],
      default: [],
    },

    billId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Bill",
        default: null,
    },

    // The payment that created this booking in the payment-first flow.
    sourcePaymentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Payment",
        default: null,
    },

    completedAt: {
      type: Date,
      default: null,
    },

    cancelledAt: {
      type: Date,
      default: null,
    },

    cancellationReason: {
      type: String,
      default: "",
      trim: true,
    },

    cancellationCutoffAt: {
      type: Date,
      default: null,
    },

    noShowAt: {
      type: Date,
      default: null,
    },

    noShowConfirmedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    refundStatus: {
      type: String,
      enum: REFUND_STATUS_VALUES,
      default: REFUND_STATUS.NOT_REQUIRED,
    },

    refundId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Refund",
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

bookingSchema.index({
  restaurantId: 1,
  bookingDateTime: 1,
});

bookingSchema.index({
  restaurantId: 1,
  bookingDateTime: 1,
  tableId: 1,
});

bookingSchema.index({
  restaurantId: 1,
  bookingDateTime: 1,
  tableIds: 1,
});

bookingSchema.index({ userId: 1, bookingDateTime: -1 });

bookingSchema.index({ tableId: 1, bookingStatus: 1 });

bookingSchema.index({ bookingStatus: 1, bookingDateTime: 1 });

const Booking = mongoose.model("Booking", bookingSchema);

export default Booking;

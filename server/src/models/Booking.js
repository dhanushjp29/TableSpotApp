import mongoose from "mongoose";

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
        "Checked In",
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

    checkedInAt: {
      type: Date,
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
  bookingDate: 1,
  bookingTime: 1,
});

const Booking = mongoose.model("Booking", bookingSchema);

export default Booking;

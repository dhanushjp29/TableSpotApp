import mongoose from "mongoose";

const restaurantTableSchema = new mongoose.Schema(
  {
    tableCode: {
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

    tableNumber: {
      type: Number,
      required: true,
    },

    tableName: {
      type: String,
      default: "",
      trim: true,
    },

    capacity: {
      type: Number,
      required: true,
      min: 1,
    },

    minimumCapacity: {
      type: Number,
      default: 1,
      min: 1,
    },

    tableType: {
      type: String,
      enum: [
        "Normal",
        "VIP",
        "Private",
        "Family",
        "Couple",
        "Window",
        "Kids",
        "Other",
      ],
      default: "Normal",
    },

    otherTableType: {
      type: String,
      default: "",
      trim: true,
    },

    tableLocation: {
      type: String,
      enum: [
        "Indoor",
        "Outdoor",
        "Ground Floor",
        "1st Floor",
        "2nd Floor",
        "Terrace",
        "Rooftop",
        "Garden",
        "Pool Side",
        "Beach Side",
        "Other",
      ],
      default: "Indoor",
    },

    otherTableLocation: {
      type: String,
      default: "",
      trim: true,
    },

    floor: {
      type: String,
      default: "",
      trim: true,
    },

    status: {
      type: String,
      enum: [
        "Available",
        "Reserved",
        "Occupied",
        "Cleaning",
        "Maintenance",
      ],
      default: "Available",
    },

    isReservable: {
      type: Boolean,
      default: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    totalBookings: {
      type: Number,
      default: 0,
    },

    displayOrder: {
      type: Number,
      default: 1,
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate table numbers within the same restaurant
restaurantTableSchema.index(
  { restaurantId: 1, tableNumber: 1 },
  { unique: true }
);

const RestaurantTable = mongoose.model(
  "RestaurantTable",
  restaurantTableSchema
);

export default RestaurantTable;

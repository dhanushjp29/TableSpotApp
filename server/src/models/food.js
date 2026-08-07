import mongoose from "mongoose";

import { CURRENCY, CURRENCY_VALUES } from "../utils/constants.js";

const variantSchema = new mongoose.Schema(
  {
    variantName: {
      type: String,
      required: true,
      trim: true,
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    offerPrice: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false }
);

const availabilitySchema = new mongoose.Schema(
  {
    availableDays: [
      {
        type: String,
        enum: [
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
          "Sunday",
        ],
      },
    ],

    startTime: {
      type: String,
      default: "00:00",
    },

    endTime: {
      type: String,
      default: "23:59",
    },
  },
  { _id: false }
);

const specialScheduleSchema = new mongoose.Schema(
  {
    day: {
      type: String,
      enum: [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ],
      required: true,
    },

    startTime: {
      type: String,
      default: "00:00",
    },

    endTime: {
      type: String,
      default: "23:59",
    },
  },
  { _id: false }
);

const foodSchema = new mongoose.Schema(
  {
    foodCode: {
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

    foodName: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    category: {
      type: String,
      enum: [
        "Starters",
        "Main Course",
        "Biryani",
        "Pizza",
        "Burger",
        "Pasta",
        "Sandwich",
        "Chinese",
        "South Indian",
        "North Indian",
        "Desserts",
        "Beverages",
        "Juices",
        "Ice Cream",
        "Combo",
        "Kids Menu",
        "Other",
      ],
      required: true,
    },

    otherCategory: {
      type: String,
      default: "",
      trim: true,
    },

    foodType: {
      type: String,
      enum: ["Veg", "Non-Veg", "Egg", "Vegan", "Jain"],
      required: true,
    },

    spiceLevel: {
      type: String,
      enum: ["Mild", "Medium", "Hot", "Extra Hot"],
      default: "Medium",
    },

    hasVariants: {
      type: Boolean,
      default: false,
    },

    currency: {
      type: String,
      enum: CURRENCY_VALUES,
      default: CURRENCY,
    },

    gstRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    variants: {
      type: [variantSchema],
      default: [],
    },

    preparationTime: {
      type: Number,
      default: 0,
    },

    coverImage: {
      type: String,
      required: true,
    },

    galleryImages: {
      type: [String],
      default: [],
    },

    availability: {
      type: availabilitySchema,
      default: () => ({
        availableDays: [
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
          "Sunday",
        ],
        startTime: "00:00",
        endTime: "23:59",
      }),
    },

    specialSchedule: {
      isEnabled: {
        type: Boolean,
        default: false,
      },

      schedules: {
        type: [specialScheduleSchema],
        default: [],
      },
    },

    isAvailable: {
      type: Boolean,
      default: true,
    },

    isRecommended: {
      type: Boolean,
      default: false,
    },

    isPopular: {
      type: Boolean,
      default: false,
    },

    totalOrders: {
      type: Number,
      default: 0,
    },

    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },

    totalReviews: {
      type: Number,
      default: 0,
    },

    displayOrder: {
      type: Number,
      default: 1,
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

foodSchema.index(
  { restaurantId: 1, foodName: 1 },
  { unique: true }
);

const Food = mongoose.model("Food", foodSchema);

export default Food;

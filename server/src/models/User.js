import mongoose from "mongoose";
import {
  AUTH_PROVIDER,
  AUTH_PROVIDER_VALUES,
  OWNER_BOOKING_STATUS,
  OWNER_BOOKING_STATUS_VALUES,
  RAZORPAY_ACCOUNT_STATUS,
  RAZORPAY_ACCOUNT_STATUS_VALUES,
  USER_ROLE,
  USER_ROLE_VALUES,
} from "../utils/constants.js";

const userSchema = new mongoose.Schema(
  {
    userCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    fullName: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
      minlength: 6,
    },

    provider: {
      type: String,
      enum: AUTH_PROVIDER_VALUES,
      default: AUTH_PROVIDER.LOCAL,
    },

    providerId: {
      type: String,
      default: "",
    },

    phoneNumber: {
      type: String,
      default: "",
      trim: true,
    },

    role: {
      type: String,
      enum: USER_ROLE_VALUES,
      default: USER_ROLE.CUSTOMER,
    },

    razorpayAccountId: {
      type: String,
      default: "",
      trim: true,
    },

    razorpayAccountStatus: {
      type: String,
      enum: RAZORPAY_ACCOUNT_STATUS_VALUES,
      default: RAZORPAY_ACCOUNT_STATUS.NOT_CONNECTED,
    },

    bookingStatus: {
      type: String,
      enum: OWNER_BOOKING_STATUS_VALUES,
      default: OWNER_BOOKING_STATUS.ACTIVE,
    },

    bookingRestrictedAt: {
      type: Date,
      default: null,
    },

    bookingRestrictedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    profileImage: {
      type: String,
      default: "",
    },

    favoriteCuisines: {
      type: [String],
      default: [],
    },

    favoriteRestaurantIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Restaurant",
        default: [],
      },
    ],

    favoriteFoodIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Food",
        default: [],
      },
    ],

    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    totalBookings: {
      type: Number,
      default: 0,
    },

    lastBookingAt: {
      type: Date,
      default: null,
    },

    lastLoginAt: {
      type: Date,
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

const User = mongoose.model("User", userSchema);

export default User;

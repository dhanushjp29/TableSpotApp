import mongoose from "mongoose";
import { USER_ROLE_VALUES, USER_ROLE, AUTH_PROVIDER_VALUES, AUTH_PROVIDER } from "../utils/constants.js";

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

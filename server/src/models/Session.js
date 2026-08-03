import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema(
  {
    sessionCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    refreshToken: {
      type: String,
      required: true,
    },

    deviceName: {
      type: String,
      default: "",
      trim: true,
    },

    browser: {
      type: String,
      default: "",
      trim: true,
    },

    operatingSystem: {
      type: String,
      default: "",
      trim: true,
    },

    ipAddress: {
      type: String,
      default: "",
      trim: true,
    },

    location: {
      type: String,
      default: "",
      trim: true,
    },

    userAgent: {
      type: String,
      default: "",
      trim: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    lastActivityAt: {
      type: Date,
      default: Date.now,
    },

    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Automatically delete expired sessions
sessionSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 }
);

const Session = mongoose.model("Session", sessionSchema);

export default Session;

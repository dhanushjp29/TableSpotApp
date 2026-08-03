import mongoose from "mongoose";

const otpSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    otp: {
      type: String,
      required: true,
      trim: true,
    },

    purpose: {
      type: String,
      enum: [
        "Email Verification",
        "Password Reset",
        "Forgot Password",
        "Change Email",
        "Login Verification",
      ],
      required: true,
    },

    attemptCount: {
      type: Number,
      default: 0,
      min: 0,
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

// Automatically delete expired OTPs
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Only one active OTP per email & purpose
otpSchema.index(
  {
    email: 1,
    purpose: 1,
  },
  {
    unique: true,
  }
);

const OTP = mongoose.model("OTP", otpSchema);

export default OTP;

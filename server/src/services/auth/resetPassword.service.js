import bcrypt from "bcryptjs";

import Session from "../../models/Session.js";
import User from "../../models/User.js";

import ApiError from "../../utils/ApiError.js";

import { verifyOTP } from "../otp.service.js";

import {
  OTP_PURPOSE,
  SALT_ROUNDS,
} from "../../utils/constants.js";

export const resetPassword = async ({
  email,
  otp,
  newPassword,
}) => {
  if (!email) {
    throw new ApiError(400, "Email is required.");
  }

  if (!otp) {
    throw new ApiError(400, "OTP is required.");
  }

  if (!newPassword) {
    throw new ApiError(400, "New password is required.");
  }

  const user = await User.findOne({ email });

  if (!user) {
    throw new ApiError(404, "User not found.");
  }

  if (!user.isEmailVerified) {
    throw new ApiError(
      403,
      "Please verify your email before resetting your password."
    );
  }

  await verifyOTP({
    email,
    otp,
    purpose: OTP_PURPOSE.PASSWORD_RESET,
  });

  const hashedPassword = await bcrypt.hash(
    newPassword,
    SALT_ROUNDS
  );

  user.password = hashedPassword;
  await user.save();

  await Session.deleteMany({
    userId: user._id,
  });

  return {
    email: user.email,
    message: "Password reset successful. Please login again.",
  };
};

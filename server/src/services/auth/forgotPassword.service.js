import User from "../../models/User.js";

import ApiError from "../../utils/ApiError.js";

import { OTP_PURPOSE } from "../../utils/constants.js";

import { sendOTP } from "../otp.service.js";

export const forgotPassword = async ({
  email,
}) => {
  if (!email) {
    throw new ApiError(400, "Email is required.");
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

  await sendOTP({
    email: user.email,
    purpose: OTP_PURPOSE.PASSWORD_RESET,
    userId: user._id,
  });

  return {
    email: user.email,
    message: "Password reset OTP has been sent to your email.",
    expiresIn: 300,
  };
};

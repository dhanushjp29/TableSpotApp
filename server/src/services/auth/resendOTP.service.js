import User from "../../models/User.js";

import ApiError from "../../utils/ApiError.js";

import { OTP_PURPOSE } from "../../utils/constants.js";

import { sendOTP } from "../otp.service.js";

export const resendOTP = async ({ email }) => {
  // Find User
  const user = await User.findOne({ email });

  if (!user) {
    throw new ApiError(404, "User not found.");
  }

  // Already Verified
  if (user.isEmailVerified) {
    throw new ApiError(
      400,
      "Email is already verified. Please login."
    );
  }

  // Send OTP
  await sendOTP({
    email: user.email,
    purpose: OTP_PURPOSE.EMAIL_VERIFICATION,
    userId: user._id,
  });

  return {
    email: user.email,
    message: "A new verification OTP has been sent to your email.",
    expiresIn: 300,
  };
};

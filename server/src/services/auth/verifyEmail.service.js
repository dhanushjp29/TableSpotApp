import bcrypt from "bcryptjs";

import Session from "../../models/Session.js";
import User from "../../models/User.js";

import ApiError from "../../utils/ApiError.js";
import buildUserResponse from "../../utils/buildUserResponse.js";

import { verifyOTP } from "../otp.service.js";

import {
  generateAccessToken,
  generateRefreshToken,
} from "../../utils/jwt.js";

import {
  OTP_PURPOSE,
  SALT_ROUNDS
} from "../../utils/constants.js";

const PENDING_REFRESH_TOKEN = "__PENDING_REFRESH_TOKEN__";

export const verifyEmail = async ({
  email,
  otp,
  deviceInfo = {},
}) => {
  const user = await User.findOne({ email });

  if (!user) {
    throw new ApiError(404, "User not found.");
  }

  if (user.isEmailVerified) {
    throw new ApiError(400, "Email is already verified.");
  }

  await verifyOTP({
    email,
    otp,
    purpose: OTP_PURPOSE.EMAIL_VERIFICATION,
  });

  user.isEmailVerified = true;

  await user.save();

  // Create or reuse existing session for this device
  const { createOrReuseSession } = await import("./session.service.js");
  const session = await createOrReuseSession({ userId: user._id, deviceInfo });

  const refreshToken = generateRefreshToken({
    userId: user._id,
    role: user.role,
    sessionId: session._id,
  });

  const hashedRefreshToken = await bcrypt.hash(
    refreshToken,
    SALT_ROUNDS
  );

  await Session.findByIdAndUpdate(session._id, {
    refreshToken: hashedRefreshToken,
    lastActivityAt: new Date(),
  });

  const accessToken = generateAccessToken({
    userId: user._id,
    role: user.role,
    sessionId: session._id,
  });

  return {
    user: buildUserResponse(user),
    accessToken,
    refreshToken,
    sessionId: session._id,
    message: "Email verified successfully.",
  };
};

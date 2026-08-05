import bcrypt from "bcryptjs";

import Session from "../../models/Session.js";
import User from "../../models/User.js";

import ApiError from "../../utils/ApiError.js";
import buildUserResponse from "../../utils/buildUserResponse.js";

import {
  generateAccessToken,
  generateRefreshToken,
} from "../../utils/jwt.js";

import {
  SALT_ROUNDS
} from "../../utils/constants.js";
import { createOrReuseSession } from "./session.service.js";

const PENDING_REFRESH_TOKEN = "__PENDING_REFRESH_TOKEN__";

export const login = async ({
  email,
  password,
  deviceInfo = {},
}) => {
  // Find User
  const user = await User.findOne({ email });

  if (!user) {
    throw new ApiError(401, "Invalid email or password.");
  }

  // Account Disabled
  if (!user.isActive) {
    throw new ApiError(
      403,
      "Your account has been disabled. Please contact support."
    );
  }

  // Email Verification
  if (!user.isEmailVerified) {
    throw new ApiError(
      403,
      "Please verify your email before logging in."
    );
  }

  // Compare Password
  const isPasswordCorrect = await bcrypt.compare(
    password,
    user.password
  );

  if (!isPasswordCorrect) {
    throw new ApiError(401, "Invalid email or password.");
  }



  // Create or reuse existing session for this device
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
    message: "Login successful.",
  };
};

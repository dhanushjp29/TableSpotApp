import bcrypt from "bcryptjs";

import User from "../../models/User.js";
import Session from "../../models/Session.js";

import ApiError from "../../utils/ApiError.js";
import generateCode from "../../utils/generateCode.js";
import buildUserResponse from "../../utils/buildUserResponse.js";

import { verifyOTP } from "../otp.service.js";

import {
  generateAccessToken,
  generateRefreshToken,
} from "../../utils/jwt.js";

import {
  OTP_PURPOSE,
  CODE_PREFIX,
  SALT_ROUNDS,
  REFRESH_TOKEN_EXPIRY_DAYS,
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

  const sessionCode = await generateCode(
    Session,
    "sessionCode",
    CODE_PREFIX.SESSION
  );

  const session = await Session.create({
    sessionCode,
    userId: user._id,
    refreshToken: PENDING_REFRESH_TOKEN,

    deviceName: deviceInfo.deviceName || "",
    browser: deviceInfo.browser || "",
    operatingSystem: deviceInfo.operatingSystem || "",
    ipAddress: deviceInfo.ipAddress || "",
    userAgent: deviceInfo.userAgent || "",

    expiresAt: new Date(
      Date.now() +
        REFRESH_TOKEN_EXPIRY_DAYS *
          24 *
          60 *
          60 *
      1000
    ),
  });

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

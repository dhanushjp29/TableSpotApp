import bcrypt from "bcryptjs";

import Session from "../../models/Session.js";
import User from "../../models/User.js";

import ApiError from "../../utils/ApiError.js";
import buildUserResponse from "../../utils/buildUserResponse.js";
import generateCode from "../../utils/generateCode.js";

import {
  generateAccessToken,
  generateRefreshToken,
} from "../../utils/jwt.js";

import {
  AUTH_PROVIDER,
  CODE_PREFIX,
  MAX_ACTIVE_SESSIONS,
  REFRESH_TOKEN_EXPIRY_DAYS,
  SALT_ROUNDS,
} from "../../utils/constants.js";

const PENDING_REFRESH_TOKEN = "__PENDING_REFRESH_TOKEN__";

export const googleLogin = async ({
  email,
  fullName,
  providerId,
  profileImage = "",
  deviceInfo = {},
}) => {
  if (!email) {
    throw new ApiError(400, "Email is required.");
  }

  if (!providerId) {
    throw new ApiError(400, "Google provider id is required.");
  }

  let user = await User.findOne({
    $or: [
      { providerId },
      { email },
    ],
  });

  if (!user) {
    const userCode = await generateCode(
      User,
      "userCode",
      CODE_PREFIX.USER
    );

    const hashedPassword = await bcrypt.hash(
      providerId,
      SALT_ROUNDS
    );

    user = await User.create({
      userCode,
      fullName: fullName || email.split("@")[0],
      email,
      password: hashedPassword,
      provider: AUTH_PROVIDER.GOOGLE,
      providerId,
      profileImage,
      isEmailVerified: true,
    });
  } else {
    if (!user.isActive) {
      throw new ApiError(
        403,
        "Your account has been disabled. Please contact support."
      );
    }

    user.provider = AUTH_PROVIDER.GOOGLE;
    user.providerId = providerId;
    user.isEmailVerified = true;

    if (profileImage) {
      user.profileImage = profileImage;
    }

    if (fullName && user.fullName !== fullName) {
      user.fullName = fullName;
    }

    await user.save();
  }

  const activeSessionCount = await Session.countDocuments({
    userId: user._id,
    isActive: true,
  });

  if (activeSessionCount >= MAX_ACTIVE_SESSIONS) {
    const oldestSession = await Session.findOne({
      userId: user._id,
      isActive: true,
    })
      .sort({ createdAt: 1 })
      .select("_id");

    if (oldestSession) {
      await Session.findByIdAndUpdate(oldestSession._id, {
        isActive: false,
      });
    }
  }

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
    message: "Google login successful.",
  };
};

export default googleLogin;

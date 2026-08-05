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
  SALT_ROUNDS
} from "../../utils/constants.js";
import { createOrReuseSession } from "./session.service.js";

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
    message: "Google login successful.",
  };
};

export default googleLogin;

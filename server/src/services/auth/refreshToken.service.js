import bcrypt from "bcryptjs";

import Session from "../../models/Session.js";
import User from "../../models/User.js";

import ApiError from "../../utils/ApiError.js";

import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../../utils/jwt.js";

import {
  REFRESH_TOKEN_EXPIRY_DAYS,
  SALT_ROUNDS,
} from "../../utils/constants.js";

export const refreshToken = async ({
  refreshToken: clientRefreshToken,
}) => {
  if (!clientRefreshToken) {
    throw new ApiError(400, "Refresh token is required.");
  }

  const payload = verifyRefreshToken(clientRefreshToken);

  const {
    sessionId,
    userId,
    role,
  } = payload;

  if (!sessionId) {
    throw new ApiError(401, "Invalid refresh token payload.");
  }

  const session = await Session.findById(sessionId);

  if (!session || !session.isActive) {
    throw new ApiError(401, "Session is no longer active.");
  }

  const isTokenValid = await bcrypt.compare(
    clientRefreshToken,
    session.refreshToken
  );

  if (!isTokenValid) {
    await Session.findByIdAndUpdate(session._id, {
      isActive: false,
      lastActivityAt: new Date(),
    });

    throw new ApiError(401, "Refresh token mismatch.");
  }

  const user = await User.findById(userId || session.userId);

  if (!user || !user.isActive) {
    throw new ApiError(401, "User is no longer active.");
  }

  const nextRefreshToken = generateRefreshToken({
    userId: user._id,
    role: role || user.role,
    sessionId: session._id,
  });

  const hashedRefreshToken = await bcrypt.hash(
    nextRefreshToken,
    SALT_ROUNDS
  );

  await Session.findByIdAndUpdate(session._id, {
    refreshToken: hashedRefreshToken,
    lastActivityAt: new Date(),
    expiresAt: new Date(
      Date.now() +
        REFRESH_TOKEN_EXPIRY_DAYS *
          24 *
          60 *
          60 *
          1000
    ),
  });

  const accessToken = generateAccessToken({
    userId: user._id,
    role: user.role,
    sessionId: session._id,
  });

  return {
    accessToken,
    refreshToken: nextRefreshToken,
    sessionId: session._id,
    message: "Token refreshed successfully.",
  };
};

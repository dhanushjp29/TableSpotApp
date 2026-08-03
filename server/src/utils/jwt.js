import jwt from "jsonwebtoken";

import ApiError from "./ApiError.js";

const signToken = ({
  payload,
  secret,
  expiresIn,
  errorMessage,
}) => {
  if (!secret) {
    throw new ApiError(500, errorMessage);
  }

  return jwt.sign(payload, secret, {
    expiresIn,
  });
};

const verifyToken = ({
  token,
  secret,
  errorMessage,
}) => {
  try {
    if (!secret) {
      throw new Error("Missing secret");
    }

    return jwt.verify(token, secret);
  } catch {
    throw new ApiError(401, errorMessage);
  }
};

export const generateAccessToken = ({
  userId,
  role,
  sessionId,
}) => {
  return signToken({
    payload: {
      userId,
      role,
      sessionId,
    },
    secret: process.env.ACCESS_TOKEN_SECRET,
    expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN,
    errorMessage: "ACCESS_TOKEN_SECRET is not configured.",
  });
};

export const generateRefreshToken = ({
  userId,
  role,
  sessionId,
}) => {
  return signToken({
    payload: {
      userId,
      role,
      sessionId,
    },
    secret: process.env.REFRESH_TOKEN_SECRET,
    expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN,
    errorMessage: "REFRESH_TOKEN_SECRET is not configured.",
  });
};

export const verifyAccessToken = (token) => {
  return verifyToken({
    token,
    secret: process.env.ACCESS_TOKEN_SECRET,
    errorMessage: "Invalid or expired access token.",
  });
};

export const verifyRefreshToken = (token) => {
  return verifyToken({
    token,
    secret: process.env.REFRESH_TOKEN_SECRET,
    errorMessage: "Invalid or expired refresh token.",
  });
};

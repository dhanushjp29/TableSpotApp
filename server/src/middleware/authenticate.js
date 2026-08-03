import User from "../models/User.js";

import ApiError from "../utils/ApiError.js";
import { verifyAccessToken } from "../utils/jwt.js";

const extractAccessToken = (req) => {
  const authHeader = req.headers.authorization || "";

  if (authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }

  return (
    req.cookies?.accessToken ||
    req.headers["x-access-token"] ||
    ""
  );
};

const authenticate = async (req, _res, next) => {
  try {
    const accessToken = extractAccessToken(req);

    if (!accessToken) {
      throw new ApiError(401, "Access token is required.");
    }

    const payload = verifyAccessToken(accessToken);
    const user = await User.findById(payload.userId).select("-password");

    if (!user) {
      throw new ApiError(401, "User not found.");
    }

    if (!user.isActive || user.isDeleted) {
      throw new ApiError(
        403,
        "Your account has been disabled. Please contact support."
      );
    }

    req.user = user;
    req.auth = {
      userId: payload.userId,
      role: payload.role,
      sessionId: payload.sessionId || null,
    };

    return next();
  } catch (error) {
    return next(error);
  }
};

export default authenticate;

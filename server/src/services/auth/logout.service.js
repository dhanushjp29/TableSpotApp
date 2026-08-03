import Session from "../../models/Session.js";

import ApiError from "../../utils/ApiError.js";
import { verifyRefreshToken } from "../../utils/jwt.js";

export const logout = async ({
  refreshToken,
}) => {
  if (!refreshToken) {
    throw new ApiError(400, "Refresh token is required.");
  }

  const payload = verifyRefreshToken(refreshToken);
  const sessionId = payload.sessionId;

  if (!sessionId) {
    throw new ApiError(401, "Invalid refresh token payload.");
  }

  const session = await Session.findById(sessionId);

  if (!session) {
    throw new ApiError(404, "Session not found.");
  }

  await Session.findByIdAndUpdate(session._id, {
    isActive: false,
    lastActivityAt: new Date(),
  });

  return {
    message: "Logged out successfully.",
  };
};

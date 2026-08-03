import bcrypt from "bcryptjs";

import Session from "../../models/Session.js";
import User from "../../models/User.js";

import ApiError from "../../utils/ApiError.js";
import buildUserResponse from "../../utils/buildUserResponse.js";

import {
  SALT_ROUNDS,
} from "../../utils/constants.js";

export const changePassword = async ({
  userId,
  sessionId = null,
  oldPassword,
  newPassword,
}) => {
  if (!userId) {
    throw new ApiError(400, "User id is required.");
  }

  if (!oldPassword) {
    throw new ApiError(400, "Old password is required.");
  }

  if (!newPassword) {
    throw new ApiError(400, "New password is required.");
  }

  const user = await User.findById(userId);

  if (!user) {
    throw new ApiError(404, "User not found.");
  }

  if (!user.isActive) {
    throw new ApiError(
      403,
      "Your account has been disabled. Please contact support."
    );
  }

  const isOldPasswordValid = await bcrypt.compare(
    oldPassword,
    user.password
  );

  if (!isOldPasswordValid) {
    throw new ApiError(401, "Old password is incorrect.");
  }

  const hashedPassword = await bcrypt.hash(
    newPassword,
    SALT_ROUNDS
  );

  user.password = hashedPassword;
  await user.save();

  const sessionFilter = {
    userId: user._id,
  };

  if (sessionId) {
    sessionFilter._id = { $ne: sessionId };
  }

  const deletedSessions = await Session.deleteMany(sessionFilter);

  return {
    user: buildUserResponse(user),
    deletedSessions: deletedSessions.deletedCount || 0,
    message: "Password changed successfully.",
  };
};

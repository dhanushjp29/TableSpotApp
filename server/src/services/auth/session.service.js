import Session from "../../models/Session.js";
import { CODE_PREFIX, MAX_ACTIVE_SESSIONS, REFRESH_TOKEN_EXPIRY_DAYS } from "../../utils/constants.js";
import generateCode from "../../utils/generateCode.js";

/**
 * Find an existing session for the same device (by userAgent/ip/deviceName) and reuse it.
 * Otherwise create a new session. Also enforces MAX_ACTIVE_SESSIONS by deactivating oldest.
 */
export const createOrReuseSession = async ({ userId, deviceInfo = {} }) => {
  const { deviceName = "", browser = "", operatingSystem = "", ipAddress = "", userAgent = "" } = deviceInfo;

  // Try to find an exact matching session for this device+ip or userAgent+ip
  let existing = null;

  if (userAgent && ipAddress) {
    existing = await Session.findOne({ userId, userAgent, ipAddress });
  }

  if (!existing && deviceName && ipAddress) {
    existing = await Session.findOne({ userId, deviceName, ipAddress });
  }

  if (!existing && userAgent) {
    existing = await Session.findOne({ userId, userAgent });
  }

  // Enforce max active sessions (if creating a new one or reactivating one)
  const activeSessionCount = await Session.countDocuments({ userId, isActive: true });
  if (activeSessionCount >= MAX_ACTIVE_SESSIONS) {
    const oldestSession = await Session.findOne({ userId, isActive: true }).sort({ createdAt: 1 }).select("_id");
    if (oldestSession) {
      await Session.findByIdAndUpdate(oldestSession._id, { isActive: false });
    }
  }

  if (existing) {
    // Reactivate and update existing session
    await Session.findByIdAndUpdate(existing._id, {
      isActive: true,
      deviceName,
      browser,
      operatingSystem,
      ipAddress,
      userAgent,
      refreshToken: "__PENDING_REFRESH_TOKEN__",
      lastActivityAt: new Date(),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
    });

    return Session.findById(existing._id);
  }

  // create new session
  const sessionCode = await generateCode(Session, "sessionCode", CODE_PREFIX.SESSION);

  const session = await Session.create({
    sessionCode,
    userId,
    refreshToken: "__PENDING_REFRESH_TOKEN__",
    deviceName,
    browser,
    operatingSystem,
    ipAddress,
    userAgent,
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
  });

  return session;
};

export default {
  createOrReuseSession,
};

import Restaurant from "../models/Restaurant.js";
import RestaurantReport from "../models/RestaurantReport.js";
import RestaurantWarning from "../models/RestaurantWarning.js";
import User from "../models/User.js";

import ApiError from "../utils/ApiError.js";
import generateCode from "../utils/generateCode.js";
import {
  CODE_PREFIX,
  REPORT_STATUS,
  USER_ROLE,
  WARNING_ACTIVE_DAYS,
  WARNING_LEVEL,
  WARNING_STATUS,
} from "../utils/constants.js";

import { createNotification } from "./notification.service.js";
import { sendWarningEventEmail } from "./businessEmail.service.js";

const LEVEL_ORDER = {
  [WARNING_LEVEL.LEVEL_1]: 1,
  [WARNING_LEVEL.LEVEL_2]: 2,
  [WARNING_LEVEL.FINAL]: 3,
};

const populateWarning = (query) =>
  query
    .populate(
      "restaurantId",
      "restaurantCode restaurantName slug city state coverImage"
    )
    .populate("ownerId", "fullName email")
    .populate("issuedBy", "fullName email")
    .populate("clearedBy", "fullName email")
    .populate({
      path: "relatedReportId",
      select: "reportCode category severity status title description createdAt userId",
      populate: { path: "userId", select: "fullName email userCode" },
    });

const getWarningOrThrow = async (warningId) => {
  const warning = await RestaurantWarning.findById(warningId);
  if (!warning || warning.isDeleted) {
    throw new ApiError(404, "Restaurant warning not found.");
  }
  return warning;
};

const defaultExpiresAt = (expiresAt, expiresInDays) => {
  if (expiresAt) {
    return new Date(expiresAt);
  }
  const days = Math.max(Number(expiresInDays) || WARNING_ACTIVE_DAYS, 1);
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
};

const notifyOwner = async ({ warning, owner, restaurant }) => {
  if (!owner?.isActive || owner?.isDeleted) return;
  try {
    await createNotification({
      userId: owner._id,
      title: "Restaurant Warning Issued",
      message: `${restaurant?.restaurantName || "Your restaurant"} received a ${warning.level} warning. ${
        warning.reason ? `Reason: ${warning.reason}` : ""
      }`,
      type: "Restaurant Warning",
      linkId: warning._id,
      linkModel: "RestaurantWarning",
    });
  } catch (error) {
    console.error("Warning notification error:", error.message);
  }
};

const notifyWarningUser = async ({ user, title, message, linkId }) => {
  if (!user?.isActive || user?.isDeleted) return;
  try {
    await createNotification({
      userId: user._id,
      title,
      message,
      type: "Restaurant Warning",
      linkId,
      linkModel: "RestaurantWarning",
    });
  } catch (error) {
    console.error("Warning notification error:", error.message);
  }
};

/**
 * Resolve the customer who filed the report that led to this warning. Uses the
 * snapshotted `reporterId` when present and falls back to the linked report.
 */
const resolveReporter = async (warning) => {
  let reporterId = warning.reporterId;
  if (!reporterId && warning.relatedReportId) {
    const report = await RestaurantReport.findById(
      warning.relatedReportId
    )
      .select("userId")
      .lean();
    reporterId = report?.userId;
  }
  if (!reporterId) return null;
  return User.findById(reporterId)
    .select("_id fullName email isActive isDeleted")
    .lean();
};

/**
 * Whether a customer is part of a warning conversation: they must be the
 * reporter of the report that triggered the warning.
 */
export const isCustomerLinkedToWarning = async (userId, warning) => {
  if (warning.reporterId && String(warning.reporterId) === String(userId)) {
    return true;
  }
  if (warning.relatedReportId) {
    const report = await RestaurantReport.findById(warning.relatedReportId)
      .select("userId")
      .lean();
    return Boolean(report && String(report.userId) === String(userId));
  }
  return false;
};

const notifyAdmins = async ({ title, message, linkId }) => {
  const admins = await User.find({
    role: USER_ROLE.ADMIN,
    isActive: true,
    isDeleted: false,
  })
    .select("_id")
    .lean();

  for (const admin of admins) {
    try {
      await createNotification({
        userId: admin._id,
        title,
        message,
        type: "Restaurant Warning",
        linkId,
        linkModel: "RestaurantWarning",
      });
    } catch (error) {
      console.error("Admin notification error:", error.message);
    }
  }
};

/**
 * Determine the warning level to apply. When the admin supplies an explicit
 * level it wins. Otherwise escalate from the restaurant's active warnings:
 * none/higher unset -> Level 1, active Level 1 -> Level 2, else Final Warning.
 */
const resolveLevel = ({ requestedLevel, activeLevel }) => {
  if (requestedLevel) {
    return requestedLevel;
  }
  if (activeLevel) {
    return activeLevel === WARNING_LEVEL.LEVEL_2
      ? WARNING_LEVEL.FINAL
      : WARNING_LEVEL.LEVEL_2;
  }
  return WARNING_LEVEL.LEVEL_1;
};

export const issueWarning = async ({
  restaurantId,
  title,
  reason,
  issuedBy,
  level,
  expiresInDays,
  expiresAt,
  relatedReportId = null,
}) => {
  const restaurant = await Restaurant.findById(restaurantId);

  if (!restaurant || restaurant.isDeleted) {
    throw new ApiError(404, "Restaurant not found.");
  }

  const owner = await User.findById(restaurant.ownerId).select(
    "_id fullName email isActive isDeleted"
  );

  if (!owner) {
    throw new ApiError(404, "Restaurant owner not found.");
  }

  const activeWarning = await RestaurantWarning.findOne({
    restaurantId,
    status: WARNING_STATUS.ACTIVE,
    isDeleted: false,
  })
    .sort({ createdAt: -1 })
    .select("level")
    .lean();

  const warningLevel = resolveLevel({
    requestedLevel: level,
    activeLevel: activeWarning?.level,
  });

  const report = relatedReportId
    ? await RestaurantReport.findById(relatedReportId)
    : null;

  if (relatedReportId && (!report || report.isDeleted)) {
    throw new ApiError(404, "Related report not found.");
  }

  const warningCode = await generateCode(
    RestaurantWarning,
    "warningCode",
    CODE_PREFIX.WARNING
  );

  const warning = await RestaurantWarning.create({
    warningCode,
    restaurantId,
    ownerId: restaurant.ownerId,
    reporterId: report?.userId || null,
    level: warningLevel,
    title: String(title).trim(),
    reason: String(reason).trim(),
    issuedBy,
    issuedAt: new Date(),
    expiresAt: defaultExpiresAt(expiresAt, expiresInDays),
    status: WARNING_STATUS.ACTIVE,
    relatedReportId: report?._id || null,
  });

  if (report && report.status !== REPORT_STATUS.RESOLVED) {
    report.status = REPORT_STATUS.RESOLVED;
    report.adminId = issuedBy;
    report.adminNotes =
      (report.adminNotes ? `${report.adminNotes}\n` : "") +
      `Warning ${warning.warningCode} (${warningLevel}) issued.`;
    report.statusChangedAt = new Date();
    report.resolvedAt = new Date();
    report.warningId = warning._id;
    await report.save();
  }

  await notifyOwner({ warning, owner, restaurant });

  try {
    await sendWarningEventEmail({ warning, owner, restaurant, event: "issued" });
  } catch (error) {
    console.error("Warning issued email error:", error.message);
  }

  return {
    warning: await populateWarning(RestaurantWarning.findById(warning._id)),
    message: `Warning ${warning.warningCode} issued to ${restaurant.restaurantName}.`,
  };
};

export const updateWarning = async ({
  warningId,
  updates = {},
  performedBy,
}) => {
  const warning = await getWarningOrThrow(warningId);
  const previousLevel = warning.level;
  const previousExpiry = warning.expiresAt;

  const applyingClear =
    updates.status === WARNING_STATUS.CLEARED && warning.status === WARNING_STATUS.ACTIVE;

  if (updates.title !== undefined) {
    warning.title = String(updates.title).trim();
  }
  if (updates.reason !== undefined) {
    warning.reason = String(updates.reason).trim();
  }
  if (updates.level !== undefined) {
    warning.level = updates.level;
  }
  if (updates.expiresAt !== undefined) {
    warning.expiresAt = new Date(updates.expiresAt);
  }

  if (applyingClear) {
    warning.status = WARNING_STATUS.CLEARED;
    warning.clearedBy = performedBy;
    warning.clearedAt = new Date();
    warning.clearedReason = String(updates.clearedReason || "").trim();
  }

  await warning.save();

  const [restaurant, owner] = await Promise.all([
    Restaurant.findById(warning.restaurantId).select("restaurantName").lean(),
    User.findById(warning.ownerId).select("_id fullName email isActive isDeleted").lean(),
  ]);

  if (applyingClear || warning.level !== previousLevel || Number(warning.expiresAt) !== Number(previousExpiry)) {
    await notifyOwner({ warning, owner, restaurant });
    try {
      await sendWarningEventEmail({ warning, owner, restaurant, event: "updated" });
    } catch (error) {
      console.error("Warning updated email error:", error.message);
    }
  }

  return {
    warning: await populateWarning(RestaurantWarning.findById(warning._id)),
    message: applyingClear
      ? "Warning cleared."
      : "Warning updated successfully.",
  };
};

export const addWarningReply = async ({ warningId, user, message }) => {
  const warning = await getWarningOrThrow(warningId);

  if (warning.status !== WARNING_STATUS.ACTIVE) {
    throw new ApiError(
      400,
      "Replies are only allowed on active warnings."
    );
  }

  const isAdmin = user.role === USER_ROLE.ADMIN;
  const isOwner = user.role === USER_ROLE.OWNER;

  if (isOwner) {
    const owned = await Restaurant.exists({
      _id: warning.restaurantId,
      ownerId: user._id,
      isDeleted: false,
    });
    if (!owned) {
      throw new ApiError(
        403,
        "You can only reply to warnings for your own restaurants."
      );
    }
  } else if (!isAdmin) {
    const linked = await isCustomerLinkedToWarning(user._id, warning);
    if (!linked) {
      throw new ApiError(
        403,
        "You can only reply to warnings linked to your own reports."
      );
    }
  }

  warning.replies.push({
    userId: user._id,
    role: isAdmin ? "admin" : isOwner ? "owner" : "customer",
    fullName: user.fullName || "",
    message: String(message).trim(),
  });
  await warning.save();

  const [restaurant, owner, reporter] = await Promise.all([
    Restaurant.findById(warning.restaurantId).select("restaurantName").lean(),
    User.findById(warning.ownerId)
      .select("_id fullName email isActive isDeleted")
      .lean(),
    resolveReporter(warning),
  ]);

  if (isAdmin) {
    notifyWarningUser({
      user: owner,
      title: "Reply on Warning",
      message: `Admin replied to ${warning.warningCode} for ${
        restaurant?.restaurantName || "your restaurant"
      }.`,
      linkId: warning._id,
    });
    notifyWarningUser({
      user: reporter,
      title: "Reply on Warning",
      message: `Admin replied to ${warning.warningCode} for ${
        restaurant?.restaurantName || "the restaurant"
      } you reported.`,
      linkId: warning._id,
    });
  } else if (isOwner) {
    await notifyAdmins({
      title: "Owner Reply on Warning",
      message: `${user.fullName || "The owner"} replied to warning ${warning.warningCode}.`,
      linkId: warning._id,
    });
    notifyWarningUser({
      user: reporter,
      title: "Reply on Warning",
      message: `The restaurant owner replied to ${warning.warningCode} for ${
        restaurant?.restaurantName || "the restaurant"
      } you reported.`,
      linkId: warning._id,
    });
  } else {
    await notifyAdmins({
      title: "Customer Reply on Warning",
      message: `${user.fullName || "The customer"} replied to warning ${warning.warningCode}.`,
      linkId: warning._id,
    });
    notifyWarningUser({
      user: owner,
      title: "Reply on Warning",
      message: `The reporting customer replied to ${warning.warningCode} for ${
        restaurant?.restaurantName || "your restaurant"
      }.`,
      linkId: warning._id,
    });
  }

  return {
    warning: await populateWarning(
      RestaurantWarning.findById(warning._id)
    ),
    message: "Reply added.",
  };
};

export const getWarningById = async ({ warningId }) => {
  const warning = await populateWarning(
    RestaurantWarning.findOne({ _id: warningId, isDeleted: false })
  );

  if (!warning) {
    throw new ApiError(404, "Restaurant warning not found.");
  }

  return { warning };
};

export const getWarnings = async ({
  userId = null,
  isOwner = false,
  isCustomer = false,
  restaurantId = "",
  status = "",
  level = "",
  page = 1,
  limit = 10,
}) => {
  const pageNumber = Math.max(Number(page) || 1, 1);
  const pageSize = Math.min(Math.max(Number(limit) || 10, 1), 100);
  const skip = (pageNumber - 1) * pageSize;

  const scopeMatch = { isDeleted: false };

  if (isOwner && userId) {
    scopeMatch.ownerId = userId;
  } else if (isCustomer && userId) {
    const reportIds = await RestaurantReport.find({
      userId,
      isDeleted: false,
    })
      .select("_id")
      .lean();
    scopeMatch.$or = [
      { reporterId: userId },
      ...(reportIds.length
        ? [{ relatedReportId: { $in: reportIds.map((r) => r._id) } }]
        : []),
    ];
  }
  if (restaurantId) {
    scopeMatch.restaurantId = restaurantId;
  }

  const query = { ...scopeMatch };
  if (status) {
    query.status = status;
  }
  if (level) {
    query.level = level;
  }

  const [warnings, total] = await Promise.all([
    populateWarning(
      RestaurantWarning.find(query).sort({ createdAt: -1 }).skip(skip).limit(pageSize)
    ),
    RestaurantWarning.countDocuments(query),
  ]);

  const statusCounts = await RestaurantWarning.aggregate([
    { $match: scopeMatch },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);

  const counts = {
    ACTIVE: 0,
    EXPIRED: 0,
    CLEARED: 0,
  };
  for (const row of statusCounts) {
    counts[row._id] = row.count;
  }

  return {
    warnings,
    counts,
    meta: {
      page: pageNumber,
      limit: pageSize,
      total,
      totalPages: Math.ceil(total / pageSize) || 1,
    },
  };
};

/**
 * Cron: flip ACTIVE warnings whose expiry has passed to EXPIRED and tell the
 * owner (so the history stays accurate even after the validity window closes).
 */
export const expireActiveWarnings = async () => {
  const now = new Date();

  const warnings = await RestaurantWarning.find({
    status: WARNING_STATUS.ACTIVE,
    expiresAt: { $lt: now },
    isDeleted: false,
  })
    .sort({ expiresAt: 1 })
    .select("_id warningCode level restaurantId ownerId")
    .lean();

  let count = 0;

  for (const warning of warnings) {
    try {
      await RestaurantWarning.updateOne(
        { _id: warning._id },
        {
          $set: {
            status: WARNING_STATUS.EXPIRED,
            expiredAt: now,
          },
        }
      );

      const [restaurant, owner] = await Promise.all([
        Restaurant.findById(warning.restaurantId).select("restaurantName").lean(),
        User.findById(warning.ownerId).select("_id fullName email isActive isDeleted").lean(),
      ]);

      if (owner?.isActive && !owner?.isDeleted) {
        try {
          await createNotification({
            userId: owner._id,
            title: "Warning Expired",
            message: `The ${warning.level} warning for ${
              restaurant?.restaurantName || "your restaurant"
            } has expired.`,
            type: "Restaurant Warning",
            linkId: warning._id,
            linkModel: "RestaurantWarning",
          });
        } catch (error) {
          console.error("Warning expiry notification error:", error.message);
        }
      }

      try {
        await sendWarningEventEmail({
          warning: { ...warning, status: WARNING_STATUS.EXPIRED, expiredAt: now },
          owner,
          restaurant,
          event: "expired",
        });
      } catch (error) {
        console.error("Warning expiry email error:", error.message);
      }

      count += 1;
    } catch (error) {
      console.error(
        `Warning expiry failed for ${warning.warningCode}:`,
        error.message
      );
    }
  }

  return count;
};
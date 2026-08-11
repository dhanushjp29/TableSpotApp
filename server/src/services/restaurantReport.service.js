import Bill from "../models/Bill.js";
import Booking from "../models/Booking.js";
import Restaurant from "../models/Restaurant.js";
import RestaurantReport from "../models/RestaurantReport.js";
import User from "../models/User.js";

import ApiError from "../utils/ApiError.js";
import generateCode from "../utils/generateCode.js";
import {
  BILL_STATUS,
  BOOKING_STATUS,
  CODE_PREFIX,
  REPORT_STATUS,
  USER_ROLE,
} from "../utils/constants.js";

import { createNotification } from "./notification.service.js";
import { sendReportEventEmail } from "./businessEmail.service.js";

const normalizeStringArray = (values = []) =>
  values.map((v) => String(v).trim()).filter(Boolean);

const getReportOrThrow = async (reportId) => {
  const report = await RestaurantReport.findById(reportId);
  if (!report || report.isDeleted) {
    throw new ApiError(404, "Restaurant report not found.");
  }
  return report;
};

const populateReport = (query) =>
  query
    .populate("userId", "userCode fullName email profileImage")
    .populate(
      "restaurantId",
      "restaurantCode restaurantName slug city state coverImage"
    )
    .populate("bookingId", "bookingCode bookingDateTime bookingStatus")
    .populate("billId", "billCode grandTotal billStatus")
    .populate("adminId", "fullName email")
    .populate("warningId", "warningCode level status expiresAt");

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
        type: "Restaurant Report",
        linkId,
        linkModel: "RestaurantReport",
      });
    } catch (error) {
      console.error("Admin notification error:", error.message);
    }
  }
};

/**
 * Return the most recent visit the customer actually completed at the
 * restaurant. A customer can only open a report when they have a completed
 * booking whose bill was never cancelled.
 */
const getEligibleVisit = async ({ userId, restaurantId }) => {
  const bookings = await Booking.find({
    userId,
    restaurantId,
    bookingStatus: BOOKING_STATUS.COMPLETED,
    isDeleted: false,
  })
    .sort({ completedAt: -1, createdAt: -1 })
    .select("_id bookingCode completedAt")
    .lean();

  if (bookings.length === 0) {
    return null;
  }

  const bookingIds = bookings.map((b) => b._id);

  const bills = await Bill.find({
    bookingId: { $in: bookingIds },
    billStatus: { $ne: BILL_STATUS.CANCELLED },
    isDeleted: false,
  })
    .sort({ updatedAt: -1 })
    .select("_id bookingId billCode")
    .lean();

  const billByBooking = new Map(bills.map((b) => [String(b.bookingId), b]));
  const visit = bookings.find((b) => billByBooking.has(String(b._id)));

  if (!visit) {
    return null;
  }

  return {
    bookingId: visit._id,
    bookingCode: visit.bookingCode,
    billId: billByBooking.get(String(visit._id))?._id || null,
  };
};

export const getReportEligibility = async ({ userId, restaurantId }) => {
  const restaurant = await Restaurant.findOne({
    _id: restaurantId,
    isDeleted: false,
  }).select("_id restaurantName isActive");

  if (!restaurant || restaurant.isActive === false) {
    return { canReport: false, reason: "This restaurant is not available." };
  }

  const visit = await getEligibleVisit({ userId, restaurantId });

  if (!visit) {
    return {
      canReport: false,
      reason:
        "You can report a restaurant only after a completed visit with a settled bill at this restaurant.",
    };
  }

  const pendingReport = await RestaurantReport.exists({
    userId,
    restaurantId,
    status: REPORT_STATUS.PENDING,
    isDeleted: false,
  });

  if (pendingReport) {
    return {
      canReport: false,
      reason: "You already have a pending report against this restaurant.",
    };
  }

  return {
    canReport: true,
    restaurantId,
    bookingId: visit.bookingId,
    bookingCode: visit.bookingCode,
    billId: visit.billId,
  };
};

export const createReport = async ({
  userId,
  restaurantId,
  bookingId = null,
  category,
  severity = "Medium",
  title = "",
  description,
  images = [],
}) => {
  const user = await User.findById(userId).select(
    "_id fullName isActive isDeleted"
  );

  if (!user || !user.isActive || user.isDeleted) {
    throw new ApiError(404, "User not found.");
  }

  const restaurant = await Restaurant.findById(restaurantId);

  if (!restaurant || restaurant.isDeleted) {
    throw new ApiError(404, "Restaurant not found.");
  }

  if (restaurant.isActive === false) {
    throw new ApiError(400, "This restaurant is not accepting reports.");
  }

  const eligibility = await getReportEligibility({ userId, restaurantId });

  if (!eligibility.canReport) {
    throw new ApiError(403, eligibility.reason);
  }

  if (bookingId) {
    if (String(eligibility.bookingId) !== String(bookingId)) {
      throw new ApiError(
        400,
        "The booking provided does not match your completed visit at this restaurant."
      );
    }
  }

  const reportCode = await generateCode(
    RestaurantReport,
    "reportCode",
    CODE_PREFIX.REPORT
  );

  const report = await RestaurantReport.create({
    reportCode,
    userId,
    restaurantId,
    bookingId: bookingId || eligibility.bookingId || null,
    billId: eligibility.billId || null,
    category,
    severity,
    title: String(title).trim(),
    description: String(description).trim(),
    images: normalizeStringArray(images).slice(0, 5),
  });

  try {
    await createNotification({
      userId,
      title: "Report Submitted",
      message: `Your report against ${restaurant.restaurantName} has been received. Our team will review it.`,
      type: "Restaurant Report",
      linkId: report._id,
      linkModel: "RestaurantReport",
    });
  } catch (error) {
    console.error("Report submission notification error:", error.message);
  }

  try {
    await sendReportEventEmail({ report, event: "received" });
  } catch (error) {
    console.error("Report received email error:", error.message);
  }

  try {
    await notifyAdmins({
      title: "New Restaurant Report",
      message: `${user.fullName} reported ${restaurant.restaurantName} (${category}).`,
      linkId: report._id,
    });
  } catch (error) {
    console.error("Admin notification error:", error.message);
  }

  return {
    report: await populateReport(RestaurantReport.findById(report._id)),
    message: "Restaurant report submitted successfully.",
  };
};

export const updateReportStatus = async ({
  reportId,
  status,
  adminNotes = "",
  adminId,
}) => {
  const report = await getReportOrThrow(reportId);

  if (report.status === status) {
    throw new ApiError(400, `Report is already ${status.toLowerCase().replace("_", " ")}.`);
  }

  if (status === REPORT_STATUS.RESOLVED) {
    report.adminId = adminId;
    report.adminNotes = String(adminNotes).trim();
    report.status = status;
    report.statusChangedAt = new Date();
    report.resolvedAt = new Date();
    report.rejectedAt = null;
  } else if (status === REPORT_STATUS.REJECTED) {
    report.adminId = adminId;
    report.adminNotes = String(adminNotes).trim();
    report.status = status;
    report.statusChangedAt = new Date();
    report.rejectedAt = new Date();
    report.resolvedAt = null;
  } else {
    report.adminId = adminId;
    report.adminNotes = String(adminNotes).trim();
    report.status = status;
    report.statusChangedAt = new Date();
  }

  await report.save();

  const [restaurant, user] = await Promise.all([
    Restaurant.findById(report.restaurantId).select("restaurantName").lean(),
    User.findById(report.userId).select("_id isActive isDeleted").lean(),
  ]);

  if (status === REPORT_STATUS.RESOLVED) {
    if (user?.isActive && !user?.isDeleted) {
      try {
        await createNotification({
          userId: report.userId,
          title: "Report Resolved",
          message: `Your report against ${restaurant?.restaurantName || "the restaurant"} has been resolved.`,
          type: "Restaurant Report",
          linkId: report._id,
          linkModel: "RestaurantReport",
        });
      } catch (error) {
        console.error("Report resolved notification error:", error.message);
      }
    }
    try {
      await sendReportEventEmail({ report, restaurant, event: "resolved" });
    } catch (error) {
      console.error("Report resolved email error:", error.message);
    }
  }

  if (status === REPORT_STATUS.REJECTED) {
    if (user?.isActive && !user?.isDeleted) {
      try {
        await createNotification({
          userId: report.userId,
          title: "Report Rejected",
          message: `Your report against ${restaurant?.restaurantName || "the restaurant"} was rejected. ${
            report.adminNotes ? `Reason: ${report.adminNotes}` : ""
          }`,
          type: "Restaurant Report",
          linkId: report._id,
          linkModel: "RestaurantReport",
        });
      } catch (error) {
        console.error("Report rejected notification error:", error.message);
      }
    }
    try {
      await sendReportEventEmail({ report, restaurant, event: "rejected" });
    } catch (error) {
      console.error("Report rejected email error:", error.message);
    }
  }

  return {
    report: await populateReport(RestaurantReport.findById(report._id)),
    message:
      status === REPORT_STATUS.RESOLVED
        ? "Report marked as resolved."
        : status === REPORT_STATUS.REJECTED
          ? "Report rejected."
          : "Report moved to under review.",
  };
};

export const getReportById = async ({ reportId }) => {
  const report = await populateReport(
    RestaurantReport.findOne({ _id: reportId, isDeleted: false })
  );

  if (!report) {
    throw new ApiError(404, "Restaurant report not found.");
  }

  return { report };
};

export const getMyReports = async ({ userId, page = 1, limit = 10 }) => {
  const pageNumber = Math.max(Number(page) || 1, 1);
  const pageSize = Math.min(Math.max(Number(limit) || 10, 1), 50);
  const skip = (pageNumber - 1) * pageSize;

  const query = { userId, isDeleted: false };

  const [reports, total] = await Promise.all([
    populateReport(RestaurantReport.find(query).sort({ createdAt: -1 }).skip(skip).limit(pageSize)),
    RestaurantReport.countDocuments(query),
  ]);

  return {
    reports,
    meta: {
      page: pageNumber,
      limit: pageSize,
      total,
      totalPages: Math.ceil(total / pageSize) || 1,
    },
  };
};

export const getReports = async ({
  page = 1,
  limit = 10,
  status = "",
  category = "",
  severity = "",
  search = "",
}) => {
  const pageNumber = Math.max(Number(page) || 1, 1);
  const pageSize = Math.min(Math.max(Number(limit) || 10, 1), 100);
  const skip = (pageNumber - 1) * pageSize;

  const query = { isDeleted: false };

  if (status) {
    query.status = status;
  }
  if (category) {
    query.category = category;
  }
  if (severity) {
    query.severity = severity;
  }

  const restaurants = [];
  if (search) {
    const slugPattern = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    restaurants.push(
      ...(await Restaurant.find({
        isDeleted: false,
        $or: [
          { restaurantName: slugPattern },
          { city: slugPattern },
          { restaurantCode: slugPattern },
        ],
      })
        .select("_id")
        .lean())
    );
  }

  if (restaurants.length > 0) {
    query.restaurantId = { $in: restaurants.map((r) => r._id) };
  } else if (search) {
    query.restaurantId = { $in: [] };
  }

  const [reports, total] = await Promise.all([
    populateReport(RestaurantReport.find(query).sort({ createdAt: -1 }).skip(skip).limit(pageSize)),
    RestaurantReport.countDocuments(query),
  ]);

  const statusCounts = await RestaurantReport.aggregate([
    { $match: { isDeleted: false } },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);

  const counts = { PENDING: 0, UNDER_REVIEW: 0, RESOLVED: 0, REJECTED: 0 };
  for (const row of statusCounts) {
    counts[row._id] = row.count;
  }

  return {
    reports,
    counts,
    meta: {
      page: pageNumber,
      limit: pageSize,
      total,
      totalPages: Math.ceil(total / pageSize) || 1,
    },
  };
};
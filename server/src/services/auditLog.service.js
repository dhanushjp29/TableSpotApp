import AuditLog from "../models/AuditLog.js";
import ApiError from "../utils/ApiError.js";
import generateCode from "../utils/generateCode.js";
import { CODE_PREFIX } from "../utils/constants.js";

export const getAuditLogOrThrow = async (auditLogId) => {
  const auditLog = await AuditLog.findById(auditLogId);

  if (!auditLog) {
    throw new ApiError(404, "Audit log entry not found.");
  }

  return auditLog;
};

/**
 * Append an immutable audit log entry. Entries are write-only: they are never
 * updated or deleted after creation, giving a tamper-evident trail for every
 * money-movement and booking lifecycle event.
 */
export const createAuditLog = async ({
  eventType,
  eventAction = "",
  bookingId = null,
  billId = null,
  paymentId = null,
  refundId = null,
  restaurantId = null,
  userId = null,
  performedBy = null,
  performedByRole = "",
  entityType = "",
  entityId = "",
  amount = 0,
  status = "",
  metadata = {},
}) => {
  const auditCode = await generateCode(
    AuditLog,
    "auditCode",
    CODE_PREFIX.AUDIT
  );

  const auditLog = await AuditLog.create({
    auditCode,
    eventType,
    eventAction,
    bookingId,
    billId,
    paymentId,
    refundId,
    restaurantId,
    userId,
    performedBy,
    performedByRole,
    entityType,
    entityId,
    amount: Number(amount || 0),
    status,
    metadata,
  });

  return auditLog;
};

export const listAuditLogs = async ({
  page = 1,
  limit = 10,
  bookingId = null,
  restaurantId = null,
  userId = null,
  eventType = null,
}) => {
  const query = {};

  if (bookingId) query.bookingId = bookingId;
  if (restaurantId) query.restaurantId = restaurantId;
  if (userId) query.userId = userId;
  if (eventType) query.eventType = eventType;

  const pageNumber = Math.max(Number(page) || 1, 1);
  const pageSize = Math.min(Math.max(Number(limit) || 10, 1), 100);
  const skip = (pageNumber - 1) * pageSize;

  const [auditLogs, total] = await Promise.all([
    AuditLog.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .populate("performedBy", "userCode fullName email role profileImage"),
    AuditLog.countDocuments(query),
  ]);

  return {
    auditLogs,
    meta: {
      page: pageNumber,
      limit: pageSize,
      total,
      totalPages: Math.ceil(total / pageSize) || 1,
    },
  };
};

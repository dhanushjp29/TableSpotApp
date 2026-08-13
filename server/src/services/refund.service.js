import Refund from "../models/Refund.js";
import Booking from "../models/Booking.js";
import Payment from "../models/Payment.js";
import ApiError from "../utils/ApiError.js";
import generateCode from "../utils/generateCode.js";
import { createAuditLog } from "./auditLog.service.js";
import { createNotification } from "./notification.service.js";
import { sendRefundEventEmail } from "./businessEmail.service.js";
import { createRefundForPayment } from "./razorpay.service.js";
import { unlockOwnerIfNoUnresolvedRefunds } from "./ownerRestriction.service.js";
import { getIO } from "../sockets/socket.handler.js";
import crypto from "crypto";
import {
  CODE_PREFIX,
  PAYMENT_TRANSACTION_STATUS,
  REFUND_DEADLINE_DAYS,
  REFUND_METHOD,
  REFUND_REASON,
  REFUND_STATUS,
} from "../utils/constants.js";

const roundAmount = (value) => Math.round(Number(value || 0) * 100) / 100;

const formatAmount = (value) =>
  `₹${roundAmount(value).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;

const REFUND_PROCESSING_TIMEOUT_MS = 10 * 60 * 1000;

const buildRefundFingerprint = ({ amount, reason, refundMethod }) =>
  crypto
    .createHash("sha256")
    .update(`${roundAmount(amount)}|${reason}|${refundMethod}`)
    .digest("hex");

const buildAutomaticRefundKey = ({ bookingId, reason }) =>
  `auto:${bookingId}:${reason}`;

const claimRefundForProcessing = async ({
  refundId,
  processedBy,
  refundMethod,
}) => {
  const current = await Refund.findById(refundId);
  if (!current || current.isDeleted) {
    throw new ApiError(404, "Refund record not found.");
  }

  if (current.refundStatus === REFUND_STATUS.REFUND_PROCESSING) {
    const stale =
      current.processingAt &&
      current.processingAt.getTime() < Date.now() - REFUND_PROCESSING_TIMEOUT_MS;
    if (stale) {
      current.refundStatus = REFUND_STATUS.REFUND_REQUIRES_RECONCILIATION;
      current.reconciliationRequiredAt = new Date();
      current.failureReason =
        "Refund processing became stale; gateway outcome must be verified before retrying.";
      await current.save();
    }
    throw new ApiError(
      409,
      "This refund is already being processed or requires reconciliation."
    );
  }

  if (
    current.refundStatus !== REFUND_STATUS.REFUND_PENDING &&
    current.refundStatus !== REFUND_STATUS.REFUND_OVERDUE
  ) {
    if (
      current.refundStatus === REFUND_STATUS.REFUNDED ||
      current.refundStatus === REFUND_STATUS.REFUND_AWAITING_CUSTOMER_CONFIRMATION
    ) {
      return { refund: current, alreadyProcessed: true };
    }
    throw new ApiError(
      409,
      `This refund has already been handled (current status: ${current.refundStatus}).`
    );
  }

  const claimToken = crypto.randomUUID();
  const claimed = await Refund.findOneAndUpdate(
    {
      _id: refundId,
      refundStatus: {
        $in: [REFUND_STATUS.REFUND_PENDING, REFUND_STATUS.REFUND_OVERDUE],
      },
    },
    {
      $set: {
        refundStatus: REFUND_STATUS.REFUND_PROCESSING,
        refundMethod: refundMethod || current.refundMethod,
        processingAt: new Date(),
        processedBy: processedBy || current.ownerId,
        processingClaimToken: claimToken,
      },
      $inc: { processingAttempt: 1 },
    },
    { new: true }
  );

  if (!claimed) {
    throw new ApiError(409, "This refund is already being processed.");
  }

  return { refund: claimed, claimToken };
};

const reserveRefundAmount = async ({ payment, amount }) => {
  const requestedAmount = roundAmount(amount);
  const reserved = await Payment.findOneAndUpdate(
    {
      _id: payment._id,
      paymentStatus: PAYMENT_TRANSACTION_STATUS.CAPTURED,
      $expr: {
        $lte: [
          {
            $add: [
              { $ifNull: ["$refundedAmount", 0] },
              { $ifNull: ["$refundProcessingAmount", 0] },
              requestedAmount,
            ],
          },
          "$amount",
        ],
      },
    },
    { $inc: { refundProcessingAmount: requestedAmount } },
    { new: true }
  );

  if (!reserved) {
    throw new ApiError(
      409,
      "The requested refund exceeds the remaining refundable amount."
    );
  }
  return reserved;
};

const releaseRefundReservation = async ({ paymentId, amount, completed }) => {
  const requestedAmount = roundAmount(amount);
  await Payment.updateOne(
    { _id: paymentId },
    completed
      ? {
          $inc: {
            refundProcessingAmount: -requestedAmount,
            refundedAmount: requestedAmount,
          },
        }
      : { $inc: { refundProcessingAmount: -requestedAmount } }
  );
};

const getBookingCode = async (bookingId) => {
  if (!bookingId) return "";
  const booking = await Booking.findById(bookingId)
    .select("bookingCode")
    .lean();
  return booking?.bookingCode || "";
};

const notifyCustomerRefund = async ({ refund, title, message }) => {
  if (!refund.customerId) return;
  try {
    await createNotification({
      userId: refund.customerId,
      title,
      message,
      type: "Payment",
      linkId: refund._id,
      linkModel: "Refund",
    });
  } catch (error) {
    console.error(`Notification error on ${title.toLowerCase()}:`, error.message);
  }
};

/**
 * Compute refund eligibility for a booking based on the restaurant's
 * cancellation policy, the booking's cancellation cutoff, and scenario.
 *
 * Scenarios:
 * - CANCELLATION: refundable before the cutoff at policy.refundPercentage.
 * - NO_SHOW:      refundable at policy.noShowRefundPercentage (default 0,
 *                 i.e. the advance is forfeited).
 */
export const calculateRefundEligibility = ({
  booking,
  restaurant,
  cancelledAt = new Date(),
  scenario = "CANCELLATION",
}) => {
  const paidAmount = roundAmount(booking?.advanceAmount || 0);

  const wasPaid = ["Paid", "Partially Paid"].includes(
    booking?.paymentStatus
  );

  if (paidAmount <= 0 || !wasPaid) {
    return { eligible: false, refundAmount: 0, reason: "NOT_PAID" };
  }

  const policy = restaurant?.cancellationPolicy;

  if (!policy || policy.isEnabled === false) {
    return { eligible: false, refundAmount: 0, reason: "NO_POLICY" };
  }

  if (scenario === "NO_SHOW") {
    const refundPercentage = Number(policy.noShowRefundPercentage ?? 0);
    const refundAmount = roundAmount((paidAmount * refundPercentage) / 100);

    return {
      eligible: refundAmount > 0,
      refundAmount,
      reason: "NO_SHOW",
      refundPercentage,
    };
  }

  const cutoff = booking.cancellationCutoffAt
    ? new Date(booking.cancellationCutoffAt).getTime()
    : null;

  if (cutoff && new Date(cancelledAt).getTime() > cutoff) {
    return { eligible: false, refundAmount: 0, reason: "AFTER_CUTOFF" };
  }

  const refundPercentage = Number(policy.refundPercentage ?? 100);
  const refundAmount = roundAmount((paidAmount * refundPercentage) / 100);

  return {
    eligible: refundAmount > 0,
    refundAmount,
    reason: "BEFORE_CUTOFF",
    refundPercentage,
  };
};

export const getRefundOrThrow = async (refundId) => {
  const refund = await Refund.findById(refundId);

  if (!refund || refund.isDeleted) {
    throw new ApiError(404, "Refund record not found.");
  }

  return refund;
};

export const syncBookingRefundStatus = async (
  refund,
  refundStatus = refund?.refundStatus ?? null
) => {
  if (!refund?.bookingId) {
    return null;
  }

  const booking = await Booking.findById(refund.bookingId);
  if (!booking) {
    return null;
  }

  booking.refundStatus = refundStatus ?? null;
  await booking.save();
  return booking;
};

/**
 * Push a real-time refund status update to the restaurant (owner) and the
 * customer rooms. Best-effort — socket failures never break the flow.
 */
const emitRefundUpdate = (refund) => {
  try {
    const io = getIO();

    io.to(`restaurant_${refund.restaurantId}`).emit(
      "refund:statusUpdated",
      {
        refundId: refund._id,
        refundCode: refund.refundCode,
        bookingId: refund.bookingId,
        amount: refund.amount,
        refundStatus: refund.refundStatus,
      }
    );

    if (refund.customerId) {
      io.to(`user_${refund.customerId}`).emit(
        "refund:statusUpdated",
        {
          refundId: refund._id,
          refundCode: refund.refundCode,
          bookingId: refund.bookingId,
          amount: refund.amount,
          refundStatus: refund.refundStatus,
        }
      );
    }
  } catch (error) {
    console.error("Socket error on refund status update:", error.message);
  }
};

export const getRefundById = async ({ refundId }) => {
  const refund = await Refund.findById(refundId)
    .populate({
      path: "bookingId",
      select: "bookingCode bookingDateTime bookingStatus bookingType tableId numberOfGuests totalAmount advanceAmount",
      populate: {
        path: "tableId",
        select: "tableCode tableNumber tableName tableLabel",
      },
    })
    .populate("customerId", "userCode fullName email phoneNumber profileImage")
    .populate("ownerId", "userCode fullName email profileImage")
    .populate("restaurantId", "restaurantCode restaurantName slug city state country coverImage averageRating address pincode phoneNumber email");

  if (!refund || refund.isDeleted) {
    throw new ApiError(404, "Refund record not found.");
  }

  return { refund };
};

/**
 * Create a refund record for a booking.
 */
export const createRefund = async ({
  booking,
  restaurant,
  amount,
  reason,
  remarks = "",
  refundMethod = REFUND_METHOD.RAZORPAY,
  createdBy = null,
  idempotencyKey = "",
}) => {
  const normalizedAmount = roundAmount(amount);
  if (!Number.isFinite(Number(amount)) || normalizedAmount <= 0) {
    throw new ApiError(400, "Refund amount must be greater than zero.");
  }

  const normalizedIdempotencyKey =
    String(idempotencyKey || "").trim() ||
    buildAutomaticRefundKey({ bookingId: booking._id, reason });
  const idempotencyFingerprint = buildRefundFingerprint({
    amount: normalizedAmount,
    reason,
    refundMethod,
  });

  const existing = await Refund.findOne({
    bookingId: booking._id,
    idempotencyKey: normalizedIdempotencyKey,
  });
  if (existing) {
    if (
      existing.idempotencyFingerprint &&
      existing.idempotencyFingerprint !== idempotencyFingerprint
    ) {
      throw new ApiError(
        409,
        "This refund idempotency key was already used with a different request."
      );
    }
    return existing;
  }

  const refundCode = await generateCode(
    Refund,
    "refundCode",
    CODE_PREFIX.REFUND
  );

  const requestedAt = new Date();
  const deadlineAt = new Date(
    requestedAt.getTime() + REFUND_DEADLINE_DAYS * 24 * 60 * 60 * 1000
  );

  let refund;
  try {
    refund = await Refund.create({
      refundCode,
      bookingId: booking._id,
      billId: booking.billId || null,
      restaurantId: booking.restaurantId,
      ownerId: restaurant.ownerId,
      customerId: booking.userId,
      amount: normalizedAmount,
      reason,
      remarks: String(remarks || "").trim(),
      refundMethod,
      refundStatus: REFUND_STATUS.REFUND_PENDING,
      requestedAt,
      deadlineAt,
      createdBy,
      idempotencyKey: normalizedIdempotencyKey,
      idempotencyFingerprint,
    });
  } catch (error) {
    if (error?.code !== 11000) throw error;
    refund = await Refund.findOne({
      bookingId: booking._id,
      idempotencyKey: normalizedIdempotencyKey,
    });
    if (!refund) throw error;
    if (refund.idempotencyFingerprint !== idempotencyFingerprint) {
      throw new ApiError(
        409,
        "This refund idempotency key was already used with a different request."
      );
    }
    return refund;
  }

  await syncBookingRefundStatus(refund);
  void sendRefundEventEmail({ refundId: refund._id, event: "initiated" }).catch((error) => console.error("Refund initiated email error:", error.message));

  return refund;
};

export const listRefunds = async ({
  page = 1,
  limit = 10,
  bookingId = null,
  restaurantId = null,
  customerId = null,
  refundStatus = null,
  notRefunded = false,
}) => {
  const query = { isDeleted: false };

  if (bookingId) query.bookingId = bookingId;
  if (restaurantId) query.restaurantId = restaurantId;
  if (customerId) query.customerId = customerId;
  if (refundStatus) query.refundStatus = refundStatus;
  if (notRefunded) {
    query.refundStatus = {
      $nin: [REFUND_STATUS.REFUNDED, REFUND_STATUS.NOT_REQUIRED],
    };
  }

  const pageNumber = Math.max(Number(page) || 1, 1);
  const pageSize = Math.min(Math.max(Number(limit) || 10, 1), 100);
  const skip = (pageNumber - 1) * pageSize;

  const [refunds, total] = await Promise.all([
    Refund.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .populate({
        path: "bookingId",
        select: "bookingCode bookingDateTime bookingStatus bookingType tableId numberOfGuests totalAmount advanceAmount",
        populate: {
          path: "tableId",
          select: "tableCode tableNumber tableName tableLabel",
        },
      })
      .populate("customerId", "userCode fullName email phoneNumber profileImage")
      .populate("ownerId", "userCode fullName email profileImage")
      .populate("restaurantId", "restaurantCode restaurantName slug city state country coverImage averageRating address pincode phoneNumber email"),
    Refund.countDocuments(query),
  ]);

  return {
    refunds,
    meta: {
      page: pageNumber,
      limit: pageSize,
      total,
      totalPages: Math.ceil(total / pageSize) || 1,
    },
  };
};

const writeAudit = async ({
  eventType,
  eventAction,
  refund,
  performedBy = null,
  metadata = {},
}) => {
  try {
    await createAuditLog({
      eventType,
      eventAction,
      bookingId: refund.bookingId,
      billId: refund.billId,
      refundId: refund._id,
      restaurantId: refund.restaurantId,
      userId: refund.customerId,
      performedBy: performedBy || refund.createdBy,
      amount: refund.amount,
      status: refund.refundStatus,
      metadata: {
        refundCode: refund.refundCode,
        reason: refund.reason,
        refundMethod: refund.refundMethod,
        ...metadata,
      },
    });
  } catch (error) {
    console.error("Audit log error on refund:", error.message);
  }
};

/**
 * Process a pending refund.
 *
 * - Gateway refunds (RAZORPAY): calls Razorpay to reverse the captured
 *   payment, then marks the refund REFUNDED.
 * - Manual refunds (Cash / UPI / etc.): moved to
 *   REFUND_AWAITING_CUSTOMER_CONFIRMATION so the customer can confirm
 *   receipt or dispute it (Phase 7).
 */
export const processRefund = async ({
  refundId,
  processedBy = null,
  refundMethod = null,
}) => {
  const claim = await claimRefundForProcessing({
    refundId,
    processedBy,
    refundMethod,
  });
  const { refund } = claim;
  if (claim.alreadyProcessed) return refund;

  const bookingCode = await getBookingCode(refund.bookingId);
  const bookingSuffix = bookingCode ? ` for booking ${bookingCode}` : "";

  await notifyCustomerRefund({
    refund,
    title: "Refund Initiated",
    message: `A refund of ${formatAmount(refund.amount)} has been initiated${bookingSuffix}.`,
  });

  if (refund.refundMethod !== REFUND_METHOD.RAZORPAY) {
    refund.refundStatus = REFUND_STATUS.REFUND_AWAITING_CUSTOMER_CONFIRMATION;
    refund.customerConfirmationRequired = true;
    await refund.save();
    await syncBookingRefundStatus(refund);
    emitRefundUpdate(refund);

    await writeAudit({
      eventType: "REFUND_AWAITING_CUSTOMER_CONFIRMATION",
      eventAction: "refund_awaiting_customer_confirmation",
      refund,
      performedBy: processedBy,
    });

    void sendRefundEventEmail({ refundId: refund._id, event: "processed" }).catch((error) => console.error("Refund processed email error:", error.message));

    try {
      await createNotification({
        userId: refund.customerId,
        title: "Refund Confirmation Required",
        message: `The restaurant refunded ${formatAmount(refund.amount)} via ${refund.refundMethod}. Confirm receipt of your refund (${refund.refundCode}).`,
        type: "Payment",
        linkId: refund._id,
        linkModel: "Refund",
      });
    } catch (error) {
      console.error(
        "Notification error on manual refund processing:",
        error.message
      );
    }

    return refund;
  }

  const payment = await Payment.findOne({
    bookingId: refund.bookingId,
    paymentStatus: PAYMENT_TRANSACTION_STATUS.CAPTURED,
  }).sort({ createdAt: -1 });

  if (!payment || !payment.razorpayPaymentId) {
    refund.refundStatus = REFUND_STATUS.REFUND_FAILED;
    refund.failedAt = new Date();
    refund.failureReason =
      "No captured Razorpay payment was found for this booking.";
    await refund.save();
    await syncBookingRefundStatus(refund);
    emitRefundUpdate(refund);

    await writeAudit({
      eventType: "REFUND_FAILED",
      eventAction: "refund_failed_no_payment",
      refund,
      performedBy: processedBy,
    });

    await notifyCustomerRefund({
      refund,
      title: "Refund Failed",
      message: `Your refund of ${formatAmount(refund.amount)} could not be processed.`,
    });

    throw new ApiError(409, refund.failureReason);
  }

  try {
    await reserveRefundAmount({ payment, amount: refund.amount });
  } catch (error) {
    refund.refundStatus = REFUND_STATUS.REFUND_FAILED;
    refund.failedAt = new Date();
    refund.failureReason = "The requested refund exceeds the remaining refundable amount.";
    await refund.save();
    await syncBookingRefundStatus(refund);
    throw error;
  }
  await syncBookingRefundStatus(refund);
  emitRefundUpdate(refund);

  await writeAudit({
    eventType: "REFUND_PROCESSING",
    eventAction: "refund_processing",
    refund,
    performedBy: processedBy,
  });

  try {
    const gatewayRefund = await createRefundForPayment({
      razorpayPaymentId: payment.razorpayPaymentId,
      amount: refund.amount,
      refundCode: refund.refundCode,
    });

    refund.gatewayRefundId = gatewayRefund.id;
    refund.transactionId = gatewayRefund.id;
    refund.refundStatus = REFUND_STATUS.REFUNDED;
    refund.completedAt = new Date();
    await refund.save();
    await syncBookingRefundStatus(refund);
    emitRefundUpdate(refund);

    payment.gatewayRefundId = gatewayRefund.id;
    await payment.save();
    await releaseRefundReservation({
      paymentId: payment._id,
      amount: refund.amount,
      completed: true,
    });

    await writeAudit({
      eventType: "REFUNDED",
      eventAction: "refund_completed",
      refund,
      performedBy: processedBy,
      metadata: { gatewayRefundId: gatewayRefund.id },
    });

    await notifyCustomerRefund({
      refund,
      title: "Refund Completed",
      message: `Your refund of ${formatAmount(refund.amount)} has been completed${bookingSuffix}.`,
    });

    void sendRefundEventEmail({ refundId: refund._id, event: "processed" }).catch((error) => console.error("Refund processed email error:", error.message));

    try {
      await unlockOwnerIfNoUnresolvedRefunds(refund.ownerId);
    } catch (error) {
      console.error("Refund auto-unlock error:", error.message);
    }

    return refund;
  } catch (error) {
    await releaseRefundReservation({
      paymentId: payment._id,
      amount: refund.amount,
      completed: false,
    });
    refund.refundStatus = REFUND_STATUS.REFUND_REQUIRES_RECONCILIATION;
    refund.reconciliationRequiredAt = new Date();
    refund.failedAt = new Date();
    refund.failureReason =
      "Razorpay refund outcome could not be confirmed safely. Verify the gateway before retrying.";
    await refund.save();
    await syncBookingRefundStatus(refund);
    emitRefundUpdate(refund);

    await writeAudit({
      eventType: "REFUND_FAILED",
      eventAction: "refund_failed_gateway",
      refund,
      performedBy: processedBy,
      metadata: { failureReason: "gateway_outcome_unconfirmed" },
    });

    await notifyCustomerRefund({
      refund,
      title: "Refund Failed",
      message: `Your refund of ${formatAmount(refund.amount)} could not be processed.`,
    });

    throw error;
  }
};

/**
 * Customer confirms they received a manual (cash / UPI) refund.
 * Only the refund's customer can confirm, and only while the refund is
 * awaiting customer confirmation.
 */
export const confirmCashRefundReceived = async ({
  refundId,
  confirmedBy,
}) => {
  const refund = await getRefundOrThrow(refundId);

  if (String(refund.customerId) !== String(confirmedBy)) {
    throw new ApiError(403, "Only the refund recipient can confirm receipt.");
  }

  const awaiting =
    refund.refundStatus === REFUND_STATUS.REFUND_AWAITING_CUSTOMER_CONFIRMATION;
  const overdueAwaiting =
    refund.refundStatus === REFUND_STATUS.REFUND_OVERDUE &&
    refund.customerConfirmationRequired === true;

  if (!awaiting && !overdueAwaiting) {
    throw new ApiError(
      409,
      `This refund is not awaiting customer confirmation (current status: ${refund.refundStatus}).`
    );
  }

  refund.refundStatus = REFUND_STATUS.REFUNDED;
  refund.completedAt = new Date();
  refund.customerConfirmationRequired = false;
  refund.customerConfirmationAt = new Date();
  refund.customerConfirmationBy = confirmedBy;
  await refund.save();
  await syncBookingRefundStatus(refund);
  emitRefundUpdate(refund);

  await writeAudit({
    eventType: "REFUNDED",
    eventAction: "refund_confirmed_by_customer",
    refund,
    performedBy: confirmedBy,
    metadata: { confirmed: true },
  });

  const bookingCode = await getBookingCode(refund.bookingId);
  const bookingSuffix = bookingCode ? ` for booking ${bookingCode}` : "";

  await notifyCustomerRefund({
    refund,
    title: "Refund Completed",
    message: `Your refund of ${formatAmount(refund.amount)} has been completed${bookingSuffix}.`,
  });

  try {
    await createNotification({
      userId: refund.ownerId,
      title: "Refund Confirmed by Customer",
      message: `The customer confirmed receipt of ${formatAmount(refund.amount)} (${refund.refundCode}).`,
      type: "Payment",
      linkId: refund._id,
      linkModel: "Refund",
    });
  } catch (error) {
    console.error("Notification error on refund confirmation:", error.message);
  }

  void sendRefundEventEmail({ refundId: refund._id, event: "confirmed" }).catch((error) => console.error("Refund confirmation email error:", error.message));

  try {
    await unlockOwnerIfNoUnresolvedRefunds(refund.ownerId);
  } catch (error) {
    console.error("Refund auto-unlock error:", error.message);
  }

  return refund;
};

/**
 * Customer disputes a manual refund they never received.
 */
export const disputeRefund = async ({ refundId, confirmedBy, disputeReason = "" }) => {
  const refund = await getRefundOrThrow(refundId);

  if (String(refund.customerId) !== String(confirmedBy)) {
    throw new ApiError(403, "Only the refund recipient can dispute a refund.");
  }

  const awaiting =
    refund.refundStatus === REFUND_STATUS.REFUND_AWAITING_CUSTOMER_CONFIRMATION;
  const overdueAwaiting =
    refund.refundStatus === REFUND_STATUS.REFUND_OVERDUE &&
    refund.customerConfirmationRequired === true;

  if (!awaiting && !overdueAwaiting) {
    throw new ApiError(
      409,
      `This refund is not awaiting customer confirmation (current status: ${refund.refundStatus}).`
    );
  }

  const reason = String(disputeReason || "").trim();
  if (reason.length < 5) {
    throw new ApiError(
      400,
      "A dispute reason of at least 5 characters is required."
    );
  }

  refund.refundStatus = REFUND_STATUS.REFUND_DISPUTED;
  refund.disputedAt = new Date();
  refund.disputeReason = reason;
  await refund.save();
  await syncBookingRefundStatus(refund);
  emitRefundUpdate(refund);

  await writeAudit({
    eventType: "REFUND_DISPUTED",
    eventAction: "refund_disputed_by_customer",
    refund,
    performedBy: confirmedBy,
    metadata: { disputeReason: reason },
  });

  try {
    await createNotification({
      userId: refund.ownerId,
      title: "Refund Disputed by Customer",
      message: `The customer reported that they did not receive ${formatAmount(refund.amount)} (${refund.refundCode}). Reason: ${reason}`,
      type: "Alert",
      linkId: refund._id,
      linkModel: "Refund",
    });
  } catch (error) {
    console.error("Notification error on refund dispute:", error.message);
  }

  void sendRefundEventEmail({ refundId: refund._id, event: "disputed" }).catch((error) => console.error("Refund dispute email error:", error.message));

  return refund;
};

export { REFUND_REASON, REFUND_STATUS };

import Reconciliation from "../models/Reconciliation.js";
import * as reconciliationService from "../services/reconciliation.service.js";
import { getReconciliationWorkerStatus } from "../services/reconciliation.worker.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";

const POPULATE = [
  {
    path: "paymentId",
    select: "amount currency paymentStatus paymentMethod razorpayOrderId razorpayPaymentId bookingCreationStatus bookingFailureReason bookingFailureAt createdAt",
  },
  { path: "customerId", select: "userCode fullName email phoneNumber" },
  { path: "restaurantId", select: "restaurantCode restaurantName slug" },
  { path: "bookingId", select: "bookingCode bookingStatus bookingDateTime" },
];

export const listReconciliations = asyncHandler(async (req, res) => {
  const {
    status = "",
    page = 1,
    limit = 20,
    openOnly = false,
  } = req.query;

  const query = {};
  if (String(status || "").trim()) query.status = status;
  if (openOnly === "true" || openOnly === true) {
    query.status = { $nin: ["RESOLVED_BOOKING", "RESOLVED_REFUND"] };
  }

  const pageNumber = Math.max(Number(page) || 1, 1);
  const pageSize = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const skip = (pageNumber - 1) * pageSize;

  const [reconciliations, total] = await Promise.all([
    Reconciliation.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .populate(POPULATE),
    Reconciliation.countDocuments(query),
  ]);

  res.status(200).json(
    new ApiResponse(200, "Reconciliation records retrieved.", {
      reconciliations,
      meta: {
        page: pageNumber,
        limit: pageSize,
        total,
        totalPages: Math.ceil(total / pageSize) || 1,
      },
    })
  );
});

export const getStatus = asyncHandler(async (_req, res) => {
  const [pending, manualReview, processing, retryable] = await Promise.all([
    Reconciliation.countDocuments({ status: "PENDING" }),
    Reconciliation.countDocuments({ status: "MANUAL_REVIEW" }),
    Reconciliation.countDocuments({ status: "PROCESSING" }),
    Reconciliation.countDocuments({ status: "FAILED_RETRYABLE" }),
  ]);

  res.status(200).json(
    new ApiResponse(200, "Reconciliation worker status retrieved.", {
      worker: getReconciliationWorkerStatus(),
      counts: { pending, processing, manualReview, retryable },
    })
  );
});

export const retry = asyncHandler(async (req, res) => {
  const result = await reconciliationService.adminRetryReconciliation({
    reconciliationId: req.params.reconciliationId,
    adminUserId: req.user._id,
  });

  if (!result) {
    throw new ApiError(
      409,
      "This reconciliation cannot be retried in its current state."
    );
  }

  res.status(200).json(
    new ApiResponse(200, "Reconciliation re-queued for the worker.", result)
  );
});

export const refund = asyncHandler(async (req, res) => {
  const result = await reconciliationService.adminRefundReconciliation({
    reconciliationId: req.params.reconciliationId,
    adminUserId: req.user._id,
  });

  if (!result) {
    throw new ApiError(
      409,
      "This reconciliation cannot be refunded in its current state."
    );
  }

  res.status(200).json(
    new ApiResponse(200, "Reconciliation refund processed.", result)
  );
});

export const close = asyncHandler(async (req, res) => {
  const reason = String(req.body?.reason || "").trim();

  const result = await reconciliationService.adminCloseReconciliation({
    reconciliationId: req.params.reconciliationId,
    adminUserId: req.user._id,
    reason,
  });

  if (!result) {
    throw new ApiError(
      409,
      "This reconciliation cannot be closed in its current state."
    );
  }

  res.status(200).json(
    new ApiResponse(200, "Reconciliation closed for manual review.", result)
  );
});

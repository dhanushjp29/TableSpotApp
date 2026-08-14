import crypto from "crypto";

import Reconciliation from "../models/Reconciliation.js";
import Booking from "../models/Booking.js";
import Payment from "../models/Payment.js";
import Refund from "../models/Refund.js";
import User from "../models/User.js";
import Restaurant from "../models/Restaurant.js";
import RestaurantTable from "../models/RestaurantTable.js";
import Food from "../models/food.js";
import Offer from "../models/Offer.js";

import {
  findPaymentsRequiringBookingReconciliation,
} from "./payment.service.js";
import {
  createBookingFromPayment,
  validateBookingDraft,
} from "./booking.service.js";
import {
  acquireBookingHolds,
  findActiveHoldByToken,
  releaseBookingHolds,
} from "./bookingHold.service.js";
import { createRefund, processRefund } from "./refund.service.js";
import { createAuditLog } from "./auditLog.service.js";
import { getIO } from "../sockets/socket.handler.js";

import {
  PAYMENT_BOOKING_STATUS,
  PAYMENT_TRANSACTION_STATUS,
  REFUND_METHOD,
  REFUND_REASON,
  REFUND_STATUS,
  RECONCILIATION_MANUAL_REASON,
  RECONCILIATION_RESOLUTION,
  RECONCILIATION_STATUS,
} from "../utils/constants.js";

const PROCESSING_TIMEOUT_MS = 10 * 60 * 1000;
const HOLD_TTL_MINUTES = 20;
const PAST_BOOKING_TOLERANCE_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = Number(process.env.RECONCILIATION_MAX_ATTEMPTS) || 5;
const BASE_RETRY_DELAY_MS =
  Number(process.env.RECONCILIATION_RETRY_BASE_MS) || 5 * 60 * 1000;
const MAX_RETRY_DELAY_MS = 6 * 60 * 60 * 1000;

const roundAmount = (value) => Math.round(Number(value || 0) * 100) / 100;

const TERMINAL_STATUSES = new Set([
  RECONCILIATION_STATUS.RESOLVED_BOOKING,
  RECONCILIATION_STATUS.RESOLVED_REFUND,
  RECONCILIATION_STATUS.MANUAL_REVIEW,
]);

// ---------------------------------------------------------------------------
// Socket notifications
// ---------------------------------------------------------------------------

/**
 * Push a reconciliation status update to the restaurant (owner) and customer
 * rooms. Best-effort — socket failures never break the recovery flow. Only
 * non-sensitive fields are emitted; no secrets, tokens, or credentials.
 */
const emitReconciliationUpdate = ({ reconciliation, payment }) => {
  try {
    const io = getIO();
    const payload = {
      reconciliationId: reconciliation._id,
      paymentId: reconciliation.paymentId,
      bookingId: reconciliation.bookingId || null,
      restaurantId: reconciliation.restaurantId,
      customerId: reconciliation.customerId,
      status: reconciliation.status,
      resolution: reconciliation.resolution || null,
      resolutionReason: reconciliation.resolutionReason || "",
      attempts: reconciliation.attempts || 0,
      amount: payment?.amount || 0,
      currency: payment?.currency || "INR",
      razorpayPaymentId: reconciliation.razorpayPaymentId || payment?.razorpayPaymentId || "",
      updatedAt: new Date(),
    };

    if (reconciliation.restaurantId) {
      io.to(`restaurant_${reconciliation.restaurantId}`).emit(
        "payment:reconciliationUpdated",
        payload
      );
    }

    if (reconciliation.customerId) {
      io.to(`user_${reconciliation.customerId}`).emit(
        "payment:reconciliationUpdated",
        payload
      );
    }
  } catch (error) {
    console.error("Socket error on reconciliation update:", error.message);
  }
};

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

const writeReconciliationAudit = async ({
  payment,
  reconciliation,
  action,
  previousStatus,
  newStatus,
  reason = "",
  performedBy = null,
  metadata = {},
}) => {
  try {
    await createAuditLog({
      eventType: "RECONCILIATION",
      eventAction: action,
      bookingId: reconciliation.bookingId || null,
      paymentId: payment?._id || reconciliation.paymentId,
      restaurantId: reconciliation.restaurantId,
      userId: reconciliation.customerId,
      performedBy: performedBy || null,
      performedByRole: performedBy ? "admin" : "system",
      amount: payment?.amount || 0,
      status: newStatus,
      entityType: "Reconciliation",
      entityId: String(reconciliation._id),
      metadata: {
        previousStatus,
        newStatus,
        attempt: reconciliation.attempts,
        reason,
        razorpayOrderId: reconciliation.razorpayOrderId || payment?.razorpayOrderId || "",
        ...metadata,
      },
    });
  } catch (error) {
    console.error("Reconciliation audit log error:", error.message);
  }
};

// ---------------------------------------------------------------------------
// Candidate discovery
// ---------------------------------------------------------------------------

const hasExistingBooking = async ({ paymentRecord }) => {
  if (paymentRecord.bookingId) {
    const booking = await Booking.findById(paymentRecord.bookingId).select(
      "_id isDeleted"
    );
    if (booking && !booking.isDeleted) return booking;
  }

  return Booking.findOne({
    sourcePaymentId: paymentRecord._id,
    isDeleted: false,
  }).select("_id");
};

const linkPaymentToBooking = async ({ paymentRecord, booking }) => {
  if (!booking) return;
  const updated = await Payment.findOneAndUpdate(
    {
      _id: paymentRecord._id,
      $or: [{ bookingId: null }, { bookingId: booking._id }],
    },
    {
      $set: {
        bookingId: booking._id,
        bookingCreationStatus: PAYMENT_BOOKING_STATUS.SUCCEEDED,
        bookingFailureReason: "",
        bookingFailureAt: null,
      },
    },
    { new: true }
  );
  return updated || paymentRecord;
};

const createReconciliationForPayment = async ({ paymentRecord }) => {
  const existing = await Reconciliation.findOne({ paymentId: paymentRecord._id });
  if (existing) return { created: false, reconciliation: existing };

  try {
    const reconciliation = await Reconciliation.create({
      paymentId: paymentRecord._id,
      customerId: paymentRecord.customerId,
      ownerId: paymentRecord.ownerId || null,
      restaurantId: paymentRecord.restaurantId || null,
      bookingId: null,
      razorpayOrderId: paymentRecord.razorpayOrderId || "",
      razorpayPaymentId: paymentRecord.razorpayPaymentId || "",
      status: RECONCILIATION_STATUS.PENDING,
      nextAttemptAt: new Date(),
    });
    return { created: true, reconciliation };
  } catch (error) {
    if (error?.code !== 11000) throw error;
    const reconciliation = await Reconciliation.findOne({ paymentId: paymentRecord._id });
    return { created: false, reconciliation };
  }
};

/**
 * Scan Payments for reconciliation candidates (captured, booking not
 * materialized, no valid booking) and create a PENDING Reconciliation record
 * for each. Idempotent: an existing record for a payment is never duplicated.
 */
export const enqueueReconciliationCandidates = async ({ log = console } = {}) => {
  const candidates = await findPaymentsRequiringBookingReconciliation({
    limit: 500,
  });

  // Captured payments that lost their booking snapshot entirely still need
  // recovery (manual review or refund), so they are candidates too.
  const snapshotless = await Payment.find({
    paymentStatus: PAYMENT_TRANSACTION_STATUS.CAPTURED,
    bookingId: null,
    bookingData: null,
    bookingCreationStatus: {
      $in: [
        PAYMENT_BOOKING_STATUS.PENDING,
        PAYMENT_BOOKING_STATUS.FAILED_REQUIRES_RECONCILIATION,
        null,
      ],
    },
  })
    .limit(100)
    .lean();

  const payments = [...candidates, ...snapshotless];
  const unique = new Map();
  for (const payment of payments) {
    if (!unique.has(String(payment._id))) {
      unique.set(String(payment._id), payment);
    }
  }

  let enqueued = 0;
  let skippedWithBooking = 0;
  let alreadyTracked = 0;

  for (const paymentRecord of unique.values()) {
    const booking = await hasExistingBooking({ paymentRecord });
    if (booking) {
      await linkPaymentToBooking({ paymentRecord, booking });
      skippedWithBooking += 1;
      continue;
    }

    const { created, reconciliation } = await createReconciliationForPayment({
      paymentRecord,
    });
    if (created) {
      enqueued += 1;
      await writeReconciliationAudit({
        payment: paymentRecord,
        reconciliation,
        action: "reconciliation_enqueued",
        previousStatus: null,
        newStatus: RECONCILIATION_STATUS.PENDING,
        reason: "captured payment without materialized booking",
      });
    } else {
      alreadyTracked += 1;
    }
  }

  log.info?.(
    `[reconciliation] enqueue: ${enqueued} new, ${alreadyTracked} already tracked, ${skippedWithBooking} already have a booking.`
  );
  return { enqueued, alreadyTracked, skippedWithBooking };
};

// ---------------------------------------------------------------------------
// Atomic worker claim
// ---------------------------------------------------------------------------

/**
 * Atomically claim the next reconciliation job. A claim is the ONLY way a
 * worker may touch a record — find-then-update is never used, so concurrent
 * worker instances cannot double-process a payment. Stale PROCESSING claims
 * (processingStartedAt older than PROCESSING_TIMEOUT_MS) are reclaimable.
 */
export const claimReconciliation = async () => {
  const claimToken = crypto.randomUUID();
  const now = new Date();
  const staleBefore = new Date(now.getTime() - PROCESSING_TIMEOUT_MS);

  return Reconciliation.findOneAndUpdate(
    {
      status: {
        $in: [
          RECONCILIATION_STATUS.PENDING,
          RECONCILIATION_STATUS.FAILED_RETRYABLE,
          RECONCILIATION_STATUS.PROCESSING,
        ],
      },
      $or: [
        { status: RECONCILIATION_STATUS.PENDING },
        {
          status: RECONCILIATION_STATUS.FAILED_RETRYABLE,
          nextAttemptAt: { $lte: now },
        },
        {
          status: RECONCILIATION_STATUS.PROCESSING,
          processingStartedAt: { $lte: staleBefore },
        },
      ],
    },
    {
      $set: {
        status: RECONCILIATION_STATUS.PROCESSING,
        claimToken,
        claimedAt: now,
        processingStartedAt: now,
        lastError: "",
      },
      $inc: { attempts: 1 },
    },
    { returnDocument: "after", sort: { nextAttemptAt: 1, createdAt: 1 } }
  );
};

const computeNextAttemptAt = (attempts, now) => {
  const exponent = Math.min(Math.max(attempts - 1, 0), 6);
  const delay = Math.min(
    BASE_RETRY_DELAY_MS * Math.pow(2, exponent),
    MAX_RETRY_DELAY_MS
  );
  return new Date(now.getTime() + delay);
};

/**
 * Finalize a claimed reconciliation. The claimToken in the filter guarantees
 * only the claim holder can move the record; a stale-reclaiming worker that
 * lost the race is ignored.
 */
const finalizeReconciliation = async ({
  reconciliation,
  payment,
  status,
  resolution = null,
  reason = "",
  error = null,
  performedBy = null,
  action,
  previousStatus,
  metadata = {},
}) => {
  const now = new Date();
  const isTerminal = TERMINAL_STATUSES.has(status);

  const $set = {
    status,
    resolution,
    resolutionReason: String(reason || "").slice(0, 1000),
    lastError: String(error?.message || "").slice(0, 1000),
    lastAttemptAt: now,
    claimedAt: null,
    claimToken: "",
    processingStartedAt: null,
    nextAttemptAt: isTerminal ? null : computeNextAttemptAt(reconciliation.attempts, now),
    ...(isTerminal ? { resolvedAt: now } : {}),
  };

  if (status === RECONCILIATION_STATUS.RESOLVED_BOOKING && reconciliation.bookingId) {
    $set.bookingId = reconciliation.bookingId;
  }

  const updated = await Reconciliation.findOneAndUpdate(
    { _id: reconciliation._id, claimToken: reconciliation.claimToken },
    { $set },
    { returnDocument: "after" }
  );

  const effective = updated || (await Reconciliation.findById(reconciliation._id));

  await writeReconciliationAudit({
    payment,
    reconciliation: effective,
    action,
    previousStatus,
    newStatus: status,
    reason: reason || undefined,
    performedBy,
    metadata,
  });

  emitReconciliationUpdate({ reconciliation: effective, payment });

  return effective;
};

// ---------------------------------------------------------------------------
// Snapshot verification
// ---------------------------------------------------------------------------

const verifySnapshot = async ({ paymentRecord }) => {
  const bookingData = paymentRecord.bookingData;
  if (!bookingData) {
    return {
      ok: false,
      reason: RECONCILIATION_MANUAL_REASON.SNAPSHOT_INVALID,
      detail: "Payment has no booking snapshot.",
    };
  }

  const user = await User.findById(paymentRecord.customerId).select(
    "isActive isDeleted"
  );
  if (!user || !user.isActive || user.isDeleted) {
    return {
      ok: false,
      reason: RECONCILIATION_MANUAL_REASON.CUSTOMER_INVALID,
      detail: "Customer is missing or inactive.",
    };
  }

  const restaurant = await Restaurant.findById(bookingData.restaurantId);
  if (!restaurant || restaurant.isDeleted) {
    return {
      ok: false,
      reason: RECONCILIATION_MANUAL_REASON.RESTAURANT_INVALID,
      detail: "Restaurant no longer exists.",
    };
  }
  if (!restaurant.isActive || restaurant.verificationStatus !== "Verified") {
    return {
      ok: false,
      reason: RECONCILIATION_MANUAL_REASON.RESTAURANT_INVALID,
      detail: "Restaurant is inactive or not verified.",
    };
  }

  const bookingAt = new Date(bookingData.bookingDateTime);
  if (Number.isNaN(bookingAt.getTime())) {
    return {
      ok: false,
      reason: RECONCILIATION_MANUAL_REASON.SNAPSHOT_INVALID,
      detail: "Booking date and time is not a valid date.",
    };
  }

  const guests = Number(bookingData.numberOfGuests);
  if (!Number.isFinite(guests) || guests < 1) {
    return {
      ok: false,
      reason: RECONCILIATION_MANUAL_REASON.SNAPSHOT_INVALID,
      detail: "Number of guests is invalid.",
    };
  }

  const tables = Array.isArray(bookingData.tables) ? bookingData.tables : [];
  if (!tables.length) {
    return {
      ok: false,
      reason: RECONCILIATION_MANUAL_REASON.SNAPSHOT_INVALID,
      detail: "Booking snapshot has no tables.",
    };
  }

  const requestedTableIds = [...new Set(tables.map((entry) => String(entry.tableId)))];
  const tableDocs = await RestaurantTable.find({
    _id: { $in: requestedTableIds },
  }).select("restaurantId isActive");
  const tableDocMap = new Map(tableDocs.map((t) => [String(t._id), t]));

  for (const tableId of requestedTableIds) {
    const table = tableDocMap.get(tableId);
    if (!table || !table.isActive) {
      return {
        ok: false,
        reason: RECONCILIATION_MANUAL_REASON.TABLE_INVALID,
        detail: "A booked table is missing or inactive.",
      };
    }
    if (String(table.restaurantId) !== String(restaurant._id)) {
      return {
        ok: false,
        reason: RECONCILIATION_MANUAL_REASON.TABLE_INVALID,
        detail: "A booked table does not belong to this restaurant.",
      };
    }
  }

  const foods = Array.isArray(bookingData.preOrderedFoods)
    ? bookingData.preOrderedFoods
    : [];
  if (foods.length) {
    const foodIds = [...new Set(foods.map((item) => String(item.foodId)))];
    const foodDocs = await Food.find({
      _id: { $in: foodIds },
      restaurantId: restaurant._id,
      isActive: true,
    }).select("_id");
    if (foodDocs.length !== foodIds.length) {
      return {
        ok: false,
        reason: RECONCILIATION_MANUAL_REASON.SNAPSHOT_INVALID,
        detail: "A pre-ordered food is no longer available at this restaurant.",
      };
    }
  }

  if (bookingData.offerId) {
    const offer = await Offer.findById(bookingData.offerId).select(
      "restaurantId isDeleted"
    );
    if (
      !offer ||
      offer.isDeleted ||
      String(offer.restaurantId) !== String(restaurant._id)
    ) {
      return {
        ok: false,
        reason: RECONCILIATION_MANUAL_REASON.OFFER_INVALID,
        detail: "The claimed offer is no longer valid for this restaurant.",
      };
    }
  }

  if (Number(paymentRecord.amount) <= 0) {
    return {
      ok: false,
      reason: RECONCILIATION_MANUAL_REASON.SNAPSHOT_INVALID,
      detail: "Captured amount is not positive.",
    };
  }

  return {
    ok: true,
    restaurant,
    bookingAt,
    guests,
    tables,
    tableIds: tableDocs.map((t) => t._id),
  };
};

// ---------------------------------------------------------------------------
// Booking materialization
// ---------------------------------------------------------------------------

const ensureActiveHold = async ({ paymentRecord }) => {
  const tableIds = (paymentRecord.bookingData?.tables || []).map(
    (entry) => entry.tableId
  );
  const holdToken = paymentRecord.reservationHoldToken;
  if (!holdToken || !tableIds.length) return { holdToken, acquired: false, tableIds };

  const activeHold = await findActiveHoldByToken({ tableIds, holdToken });
  if (activeHold) return { holdToken, acquired: false, tableIds };

  const bookingAt = new Date(paymentRecord.bookingData.bookingDateTime);
  const bookingEnd = new Date(
    bookingAt.getTime() +
      (Number(paymentRecord.bookingData.expectedDuration) || 120) * 60 * 1000
  );

  const hold = await acquireBookingHolds({
    restaurantId: paymentRecord.restaurantId,
    tables: paymentRecord.bookingData.tables || [],
    bookingAt,
    bookingEnd,
    customerId: paymentRecord.customerId,
    paymentId: paymentRecord._id,
    holdToken,
    ttlMinutes: HOLD_TTL_MINUTES,
  });

  return { holdToken, acquired: true, tableIds: hold.tableIds };
};

const releaseHoldIfAcquired = async ({ paymentRecord, acquiredTableIds }) => {
  if (!acquiredTableIds || !acquiredTableIds.length) return;
  try {
    await releaseBookingHolds({
      tableIds: acquiredTableIds,
      holdToken: paymentRecord.reservationHoldToken,
    });
  } catch (error) {
    console.error("Reconciliation hold release failed", {
      paymentId: String(paymentRecord._id),
      reason: error.message,
    });
  }
};

/**
 * Try to materialize the booking from the payment snapshot. Returns one of:
 *   { outcome: "booking", booking }
 *   { outcome: "refund", reason }        -> booking is not feasible, refund safely
 *   { outcome: "manual_review", reason } -> snapshot is invalid, admin decision
 * Throws for transient errors so the worker retries with backoff.
 */
export const attemptBookingMaterialization = async ({
  paymentRecord,
  reconciliation,
}) => {
  const verified = await verifySnapshot({ paymentRecord });
  if (!verified.ok) {
    return {
      outcome: "manual_review",
      reason: verified.reason,
      detail: verified.detail,
    };
  }

  const bookingAt = verified.bookingAt;
  if (bookingAt.getTime() < Date.now() - PAST_BOOKING_TOLERANCE_MS) {
    return {
      outcome: "refund",
      reason: RECONCILIATION_MANUAL_REASON.BOOKING_TIME_PASSED,
      detail: "Booking time has already passed.",
    };
  }

  // Availability re-check against live bookings before any hold is taken.
  try {
    await validateBookingDraft({
      restaurant: verified.restaurant,
      tables: paymentRecord.bookingData.tables,
      numberOfGuests: verified.guests,
      bookingDateTime: bookingAt,
      expectedDuration:
        Number(paymentRecord.bookingData.expectedDuration) || 120,
      preOrderedFoods: paymentRecord.bookingData.preOrderedFoods || [],
    });
  } catch (error) {
    if (error?.statusCode === 409) {
      return {
        outcome: "refund",
        reason: RECONCILIATION_MANUAL_REASON.TABLE_UNAVAILABLE,
        detail: error.message,
      };
    }
    throw error;
  }

  // Atomic table hold: the single source of truth for the time window. A 409
  // here means the slot was taken since the validation above.
  let hold;
  try {
    hold = await ensureActiveHold({ paymentRecord });
  } catch (error) {
    if (error?.statusCode === 409) {
      return {
        outcome: "refund",
        reason: RECONCILIATION_MANUAL_REASON.TABLE_UNAVAILABLE,
        detail: error.message,
      };
    }
    if (error?.statusCode === 404) {
      return {
        outcome: "manual_review",
        reason: RECONCILIATION_MANUAL_REASON.TABLE_INVALID,
        detail: error.message,
      };
    }
    throw error;
  }

  try {
    const created = await createBookingFromPayment({ paymentRecord });
    return { outcome: "booking", booking: created.booking };
  } catch (error) {
    // A booking may exist because a concurrent verification request completed
    // between our hold and the insert.
    const raceBooking = await Booking.findOne({
      sourcePaymentId: paymentRecord._id,
      isDeleted: false,
    }).select("_id");
    if (raceBooking) {
      await linkPaymentToBooking({ paymentRecord, booking: raceBooking });
      return { outcome: "booking", booking: raceBooking };
    }

    await releaseHoldIfAcquired({
      paymentRecord,
      acquiredTableIds: hold?.acquired ? hold.tableIds : [],
    });

    if (
      error?.statusCode === 400 &&
      /Booking time has already passed/i.test(String(error.message))
    ) {
      return {
        outcome: "refund",
        reason: RECONCILIATION_MANUAL_REASON.BOOKING_TIME_PASSED,
        detail: error.message,
      };
    }

    // Everything else (conflict race, hold expiry, transient DB error) is
    // retried with backoff; exhausted attempts route to manual review.
    throw error;
  }
};

// ---------------------------------------------------------------------------
// Refund recovery
// ---------------------------------------------------------------------------

const isRefundedState = (refund) =>
  refund &&
  (refund.refundStatus === REFUND_STATUS.REFUNDED ||
    refund.refundStatus === REFUND_STATUS.REFUND_AWAITING_CUSTOMER_CONFIRMATION);

const refundStatusAfterProcess = (refund) =>
  refund?.refundStatus === REFUND_STATUS.REFUNDED ||
  refund?.refundStatus === REFUND_STATUS.REFUND_AWAITING_CUSTOMER_CONFIRMATION
    ? RECONCILIATION_RESOLUTION.REFUND_COMPLETED
    : RECONCILIATION_RESOLUTION.REFUND_INITIATED;

/**
 * Refund a captured payment that cannot be materialized into a booking.
 * Always routes through the shared refund service (claim, capacity
 * reservation, gateway call, audit, notifications) — never calls Razorpay
 * directly. Returns:
 *   { outcome: "refund", resolution, refund }
 *   { outcome: "manual_review", reason, detail }
 *   { outcome: "retryable", reason }        -> transient, backoff and retry
 */
export const evaluateAndProcessRefund = async ({ paymentRecord }) => {
  const existingRefund = await Refund.findOne({
    paymentId: paymentRecord._id,
    isDeleted: false,
  }).sort({ createdAt: -1 });

  if (existingRefund) {
    if (isRefundedState(existingRefund)) {
      return {
        outcome: "refund",
        resolution: RECONCILIATION_RESOLUTION.REFUND_COMPLETED,
        refund: existingRefund,
      };
    }

    if (
      existingRefund.refundStatus === REFUND_STATUS.REFUND_PENDING ||
      existingRefund.refundStatus === REFUND_STATUS.REFUND_OVERDUE ||
      existingRefund.refundStatus === REFUND_STATUS.REFUND_PROCESSING
    ) {
      try {
        const refund = await processRefund({
          refundId: existingRefund._id,
          processedBy: null,
        });
        return {
          outcome: "refund",
          resolution: refundStatusAfterProcess(refund),
          refund,
        };
      } catch (error) {
        const after = await Refund.findById(existingRefund._id);
        if (
          after &&
          (after.refundStatus === REFUND_STATUS.REFUND_REQUIRES_RECONCILIATION ||
            after.refundStatus === REFUND_STATUS.REFUND_FAILED)
        ) {
          return {
            outcome: "manual_review",
            reason: RECONCILIATION_MANUAL_REASON.REFUND_AMBIGUOUS,
            detail: after.failureReason || error.message,
          };
        }
        return { outcome: "retryable", reason: "refund_in_progress" };
      }
    }

    return {
      outcome: "manual_review",
      reason: RECONCILIATION_MANUAL_REASON.REFUND_AMBIGUOUS,
      detail: `Existing refund is in ${existingRefund.refundStatus}.`,
    };
  }

  const alreadyRefunded = roundAmount(paymentRecord.refundedAmount || 0);
  const inFlight = roundAmount(paymentRecord.refundProcessingAmount || 0);
  const refundable = roundAmount(
    Number(paymentRecord.amount || 0) - alreadyRefunded - inFlight
  );

  if (refundable <= 0) {
    if (alreadyRefunded > 0) {
      return {
        outcome: "refund",
        resolution: RECONCILIATION_RESOLUTION.REFUND_COMPLETED,
      };
    }
    return {
      outcome: "manual_review",
      reason: RECONCILIATION_MANUAL_REASON.NO_REFUNDABLE_AMOUNT,
      detail: "No refundable amount remains on this payment.",
    };
  }

  const restaurant = await Restaurant.findById(paymentRecord.restaurantId).select(
    "ownerId"
  );

  let refund;
  try {
    refund = await createRefund({
      payment: paymentRecord,
      restaurant: restaurant || null,
      amount: refundable,
      reason: REFUND_REASON.OTHER_APPROVED_REASON,
      remarks:
        "Auto-reconciled: captured payment with no confirmable booking was refunded.",
      refundMethod: REFUND_METHOD.RAZORPAY,
      createdBy: null,
    });
  } catch (error) {
    return { outcome: "retryable", reason: "refund_creation_failed" };
  }

  try {
    const processed = await processRefund({
      refundId: refund._id,
      processedBy: null,
    });
    return {
      outcome: "refund",
      resolution: refundStatusAfterProcess(processed),
      refund: processed,
    };
  } catch (error) {
    const after = await Refund.findById(refund._id);
    if (
      after &&
      (after.refundStatus === REFUND_STATUS.REFUND_REQUIRES_RECONCILIATION ||
        after.refundStatus === REFUND_STATUS.REFUND_FAILED)
    ) {
      return {
        outcome: "manual_review",
        reason: RECONCILIATION_MANUAL_REASON.REFUND_AMBIGUOUS,
        detail: after.failureReason || error.message,
      };
    }
    return { outcome: "retryable", reason: "refund_gateway_retry" };
  }
};

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

/**
 * A claimed reconciliation that could not complete due to a transient error is
 * retried with backoff; once attempts are exhausted it moves to MANUAL_REVIEW
 * so an operator decides. Safe under multi-instance: only the claim holder can
 * write the final state.
 */
export const markReconciliationRetryable = async ({
  reconciliation,
  error,
}) => {
  const exhausted = reconciliation.attempts >= MAX_ATTEMPTS;
  return finalizeReconciliation({
    reconciliation,
    payment: null,
    status: exhausted
      ? RECONCILIATION_STATUS.MANUAL_REVIEW
      : RECONCILIATION_STATUS.FAILED_RETRYABLE,
    resolution: exhausted ? RECONCILIATION_RESOLUTION.CLOSED_MANUALLY : null,
    reason: exhausted
      ? RECONCILIATION_MANUAL_REASON.MAX_ATTEMPTS
      : "transient_failure",
    error,
    action: "reconciliation_retryable",
    previousStatus: reconciliation.status,
  });
};

/**
 * Process a single claimed reconciliation through the full recovery pipeline:
 * verify locally -> existing booking -> materialize booking -> safe refund ->
 * manual review. Every transition is audited and claim-tokened.
 */
export const processReconciliation = async ({ reconciliation }) => {
  const previousStatus = reconciliation.status;

  const paymentRecord = await Payment.findById(reconciliation.paymentId);
  if (!paymentRecord) {
    return finalizeReconciliation({
      reconciliation,
      payment: null,
      status: RECONCILIATION_STATUS.MANUAL_REVIEW,
      resolution: RECONCILIATION_RESOLUTION.CLOSED_MANUALLY,
      reason: RECONCILIATION_MANUAL_REASON.PAYMENT_NOT_FOUND,
      action: "reconciliation_manual_review",
      previousStatus,
    });
  }

  if (
    paymentRecord.paymentStatus !== PAYMENT_TRANSACTION_STATUS.CAPTURED
  ) {
    return finalizeReconciliation({
      reconciliation,
      payment: paymentRecord,
      status: RECONCILIATION_STATUS.MANUAL_REVIEW,
      resolution: RECONCILIATION_RESOLUTION.CLOSED_MANUALLY,
      reason: RECONCILIATION_MANUAL_REASON.PAYMENT_NOT_CAPTURED,
      action: "reconciliation_manual_review",
      previousStatus,
    });
  }

  // Step 2: a booking may already exist (crash between insert and link).
  const existingBooking = await hasExistingBooking({ paymentRecord });
  if (existingBooking) {
    const linked = await linkPaymentToBooking({
      paymentRecord,
      booking: existingBooking,
    });
    reconciliation.bookingId = existingBooking._id;
    return finalizeReconciliation({
      reconciliation,
      payment: linked,
      status: RECONCILIATION_STATUS.RESOLVED_BOOKING,
      resolution: RECONCILIATION_RESOLUTION.BOOKING_REUSED,
      reason: "Existing booking recovered by sourcePaymentId.",
      action: "reconciliation_booking_reused",
      previousStatus,
    });
  }

  // Steps 3-4: snapshot verification + atomic availability.
  const materialization = await attemptBookingMaterialization({
    paymentRecord,
    reconciliation,
  });

  if (materialization.outcome === "booking") {
    const booking = materialization.booking;
    const linked = await linkPaymentToBooking({ paymentRecord, booking });
    reconciliation.bookingId = booking._id;
    return finalizeReconciliation({
      reconciliation,
      payment: linked,
      status: RECONCILIATION_STATUS.RESOLVED_BOOKING,
      resolution: RECONCILIATION_RESOLUTION.BOOKING_CREATED,
      reason: "",
      action: "reconciliation_booking_created",
      previousStatus,
    });
  }

  if (materialization.outcome === "manual_review") {
    return finalizeReconciliation({
      reconciliation,
      payment: paymentRecord,
      status: RECONCILIATION_STATUS.MANUAL_REVIEW,
      resolution: RECONCILIATION_RESOLUTION.CLOSED_MANUALLY,
      reason: materialization.reason,
      action: "reconciliation_manual_review",
      previousStatus,
      metadata: { detail: materialization.detail || "" },
    });
  }

  // Step 5: refund decision — booking is not feasible, refund when safe.
  const refund = await evaluateAndProcessRefund({ paymentRecord });

  if (refund.outcome === "refund") {
    reconciliation.resolution = refund.resolution;
    return finalizeReconciliation({
      reconciliation,
      payment: paymentRecord,
      status: RECONCILIATION_STATUS.RESOLVED_REFUND,
      resolution: refund.resolution,
      reason: `Booking could not be materialized; ${refund.resolution.toLowerCase().replace("_", " ")}.`,
      action: "reconciliation_refunded",
      previousStatus,
      metadata: { refundId: refund.refund?._id ? String(refund.refund._id) : "" },
    });
  }

  if (refund.outcome === "manual_review") {
    return finalizeReconciliation({
      reconciliation,
      payment: paymentRecord,
      status: RECONCILIATION_STATUS.MANUAL_REVIEW,
      resolution: RECONCILIATION_RESOLUTION.CLOSED_MANUALLY,
      reason: refund.reason,
      action: "reconciliation_manual_review",
      previousStatus,
      metadata: { detail: refund.detail || "" },
    });
  }

  // Transient failure: retry with backoff or hand off after max attempts.
  const exhausted = reconciliation.attempts >= MAX_ATTEMPTS;
  if (exhausted) {
    return finalizeReconciliation({
      reconciliation,
      payment: paymentRecord,
      status: RECONCILIATION_STATUS.MANUAL_REVIEW,
      resolution: RECONCILIATION_RESOLUTION.CLOSED_MANUALLY,
      reason: RECONCILIATION_MANUAL_REASON.MAX_ATTEMPTS,
      action: "reconciliation_manual_review",
      previousStatus,
    });
  }

  return finalizeReconciliation({
    reconciliation,
    payment: paymentRecord,
    status: RECONCILIATION_STATUS.FAILED_RETRYABLE,
    resolution: null,
    reason: refund.reason || "transient_failure",
    error: new Error(refund.reason || "transient failure"),
    action: "reconciliation_retryable",
    previousStatus,
  });
};

// ---------------------------------------------------------------------------
// Admin manual actions (idempotent, claim-based)
// ---------------------------------------------------------------------------

const claimForAdmin = async ({ reconciliationId, adminUserId }) => {
  const claimToken = crypto.randomUUID();
  const now = new Date();
  return Reconciliation.findOneAndUpdate(
    {
      _id: reconciliationId,
      status: {
        $in: [
          RECONCILIATION_STATUS.MANUAL_REVIEW,
          RECONCILIATION_STATUS.FAILED_RETRYABLE,
        ],
      },
    },
    {
      $set: {
        status: RECONCILIATION_STATUS.PROCESSING,
        claimToken,
        claimedAt: now,
        processingStartedAt: now,
        source: "admin",
      },
      $inc: { attempts: 1 },
    },
    { returnDocument: "after" }
  );
};

export const adminRetryReconciliation = async ({ reconciliationId, adminUserId }) => {
  const claimed = await claimForAdmin({ reconciliationId, adminUserId });
  if (!claimed) {
    return null;
  }

  const updated = await Reconciliation.findOneAndUpdate(
    {
      _id: reconciliationId,
      claimToken: claimed.claimToken,
      status: RECONCILIATION_STATUS.PROCESSING,
    },
    {
      $set: {
        status: RECONCILIATION_STATUS.PENDING,
        claimToken: "",
        claimedAt: null,
        processingStartedAt: null,
        nextAttemptAt: new Date(),
      },
    },
    { returnDocument: "after" }
  );

  await writeReconciliationAudit({
    payment: null,
    reconciliation: updated,
    action: "reconciliation_admin_retry",
    previousStatus: RECONCILIATION_STATUS.MANUAL_REVIEW,
    newStatus: RECONCILIATION_STATUS.PENDING,
    reason: "Re-queued for the worker by an admin.",
    performedBy: adminUserId,
  });

  emitReconciliationUpdate({ reconciliation: updated, payment: null });

  return updated;
};

export const adminRefundReconciliation = async ({
  reconciliationId,
  adminUserId,
}) => {
  const claimed = await claimForAdmin({ reconciliationId, adminUserId });
  if (!claimed) {
    return null;
  }

  try {
    const paymentRecord = await Payment.findById(claimed.paymentId);
    if (!paymentRecord) {
      throw new Error(RECONCILIATION_MANUAL_REASON.PAYMENT_NOT_FOUND);
    }

    const refund = await evaluateAndProcessRefund({ paymentRecord });
    if (refund.outcome === "refund") {
      return finalizeReconciliation({
        reconciliation: claimed,
        payment: paymentRecord,
        status: RECONCILIATION_STATUS.RESOLVED_REFUND,
        resolution: refund.resolution,
        reason: "Admin-approved refund after manual review.",
        action: "reconciliation_admin_refund",
        previousStatus: claimed.status,
        performedBy: adminUserId,
        metadata: { refundId: refund.refund?._id ? String(refund.refund._id) : "" },
      });
    }

    if (refund.outcome === "manual_review") {
      return finalizeReconciliation({
        reconciliation: claimed,
        payment: paymentRecord,
        status: RECONCILIATION_STATUS.MANUAL_REVIEW,
        resolution: RECONCILIATION_RESOLUTION.CLOSED_MANUALLY,
        reason: refund.reason,
        action: "reconciliation_manual_review",
        previousStatus: claimed.status,
        performedBy: adminUserId,
        metadata: { detail: refund.detail || "" },
      });
    }

    throw new Error(refund.reason || "refund in progress");
  } catch (error) {
    return finalizeReconciliation({
      reconciliation: claimed,
      payment: null,
      status: RECONCILIATION_STATUS.MANUAL_REVIEW,
      resolution: RECONCILIATION_RESOLUTION.CLOSED_MANUALLY,
      reason: RECONCILIATION_MANUAL_REASON.REFUND_AMBIGUOUS,
      error,
      action: "reconciliation_manual_review",
      previousStatus: claimed.status,
      performedBy: adminUserId,
    });
  }
};

export const adminCloseReconciliation = async ({
  reconciliationId,
  adminUserId,
  reason = "",
}) => {
  const claimed = await claimForAdmin({ reconciliationId, adminUserId });
  if (!claimed) {
    return null;
  }

  return finalizeReconciliation({
    reconciliation: claimed,
    payment: null,
    status: RECONCILIATION_STATUS.MANUAL_REVIEW,
    resolution: RECONCILIATION_RESOLUTION.CLOSED_MANUALLY,
    reason:
      String(reason || "").trim() ||
      RECONCILIATION_MANUAL_REASON.UNEXPECTED,
    action: "reconciliation_admin_closed",
    previousStatus: claimed.status,
    performedBy: adminUserId,
  });
};

export {
  RECONCILIATION_MANUAL_REASON,
  RECONCILIATION_RESOLUTION,
  RECONCILIATION_STATUS,
};

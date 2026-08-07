import Booking from "../models/Booking.js";
import Refund from "../models/Refund.js";
import Restaurant from "../models/Restaurant.js";
import { createAuditLog } from "./auditLog.service.js";
import { markNoShowBooking } from "./booking.service.js";
import { restrictOwnerIfUnresolvedRefunds } from "./ownerRestriction.service.js";
import {
  BOOKING_STATUS,
  DEFAULT_CUSTOMER_WAITING_PERIOD_MINUTES,
  NO_SHOW_REASON,
  REFUND_STATUS,
} from "../utils/constants.js";

let running = false;

/**
 * Mark Online bookings as No Show once the booking time plus the
 * restaurant's grace period (customerWaitingPeriod) has fully elapsed.
 */
const autoMarkNoShows = async (log) => {
  const restaurants = await Restaurant.find({ isDeleted: false }).select(
    "customerWaitingPeriod"
  );
  const graceMap = new Map(
    restaurants.map((r) => [
      String(r._id),
      Number(r.customerWaitingPeriod) || DEFAULT_CUSTOMER_WAITING_PERIOD_MINUTES,
    ])
  );

  const candidates = await Booking.find({
    isDeleted: false,
    bookingStatus: { $in: [BOOKING_STATUS.PENDING, BOOKING_STATUS.CONFIRMED] },
    bookingType: "Online",
    bookingDateTime: { $lt: new Date() },
  })
    .sort({ bookingDateTime: 1 })
    .limit(200);

  let count = 0;

  for (const booking of candidates) {
    const waitingMinutes =
      graceMap.get(String(booking.restaurantId)) ||
      DEFAULT_CUSTOMER_WAITING_PERIOD_MINUTES;

    const graceEnd = new Date(
      new Date(booking.bookingDateTime).getTime() + waitingMinutes * 60 * 1000
    );

    if (Date.now() < graceEnd.getTime()) {
      continue;
    }

    try {
      await markNoShowBooking({
        bookingId: booking._id,
        remarks: NO_SHOW_REASON.CUSTOMER_DID_NOT_ARRIVE,
        confirmedBy: null,
        confirmedByRole: "SYSTEM",
      });
      count += 1;
      log.log?.(`[deadline-cron] Marked ${booking.bookingCode} as No Show.`);
    } catch (error) {
      log.error?.(
        `[deadline-cron] No-show failed for ${booking.bookingCode}:`,
        error.message
      );
    }
  }

  return count;
};

/**
 * Mark refunds as REFUND_OVERDUE when their processing deadline
 * (refund.requestedAt + REFUND_DEADLINE_DAYS) has passed and they were
 * never settled, confirmed, or disputed.
 */
const expireOverdueRefunds = async (log) => {
  const now = new Date();

  const overdueStatuses = [
    REFUND_STATUS.REFUND_PENDING,
    REFUND_STATUS.REFUND_PROCESSING,
    REFUND_STATUS.REFUND_AWAITING_CUSTOMER_CONFIRMATION,
  ];

  const refunds = await Refund.find({
    isDeleted: false,
    refundStatus: { $in: overdueStatuses },
    deadlineAt: { $lt: now },
  })
    .sort({ deadlineAt: 1 })
    .limit(200);

  let count = 0;

  for (const refund of refunds) {
    try {
      refund.refundStatus = REFUND_STATUS.REFUND_OVERDUE;
      refund.overdueAt = now;
      refund.overdueReason =
        "Refund was not processed within the allowed deadline.";
      await refund.save();

      await Booking.updateOne(
        { _id: refund.bookingId },
        { $set: { refundStatus: REFUND_STATUS.REFUND_OVERDUE } }
      );

      try {
        const { restricted } = await restrictOwnerIfUnresolvedRefunds(
          refund.ownerId
        );
        if (restricted) {
          log.log?.(
            `[deadline-cron] Owner ${refund.ownerId} marked BOOKING_RESTRICTED due to unresolved refunds.`
          );
        }
      } catch (error) {
        log.error?.(
          `[deadline-cron] Restriction update failed for owner ${refund.ownerId}:`,
          error.message
        );
      }

      await createAuditLog({
        eventType: "REFUND_OVERDUE",
        eventAction: "refund_overdue_deadline",
        bookingId: refund.bookingId,
        billId: refund.billId,
        refundId: refund._id,
        restaurantId: refund.restaurantId,
        userId: refund.customerId,
        performedBy: refund.ownerId,
        performedByRole: "SYSTEM",
        amount: refund.amount,
        status: REFUND_STATUS.REFUND_OVERDUE,
        metadata: {
          refundCode: refund.refundCode,
          reason: refund.reason,
          deadlineAt: refund.deadlineAt,
        },
      });

      count += 1;
      log.log?.(
        `[deadline-cron] Refund ${refund.refundCode} marked ${REFUND_STATUS.REFUND_OVERDUE}.`
      );
    } catch (error) {
      log.error?.(
        `[deadline-cron] Overdue check failed for ${refund.refundCode}:`,
        error.message
      );
    }
  }

  return count;
};

export const runDeadlineTasks = async ({
  log = console,
} = {}) => {
  if (running) {
    log.warn?.("[deadline-cron] A run is already in progress; skipping.");
    return { skipped: true };
  }

  running = true;
  const result = { markedNoShow: 0, refundsOverdue: 0, errors: [] };

  try {
    result.markedNoShow = await autoMarkNoShows(log);
    result.refundsOverdue = await expireOverdueRefunds(log);
  } catch (error) {
    result.errors.push(error.message);
    log.error?.("[deadline-cron] Run failed:", error);
  } finally {
    running = false;
  }

  return result;
};

let timer = null;

export const startDeadlineCron = () => {
  if (timer) {
    return timer;
  }

  const intervalMs =
    Number(process.env.DEADLINE_JOB_INTERVAL_MS) || 60 * 60 * 1000;

  const run = () =>
    runDeadlineTasks().catch((error) =>
      console.error("[deadline-cron] Run error:", error.message)
    );

  run();
  timer = setInterval(run, intervalMs);
  timer.unref?.();

  console.log(
    `[deadline-cron] Started. Running every ${Math.round(intervalMs / 60000)} minutes.`
  );

  return timer;
};

import Refund from "../../../src/models/Refund.js";
import Booking from "../../../src/models/Booking.js";
import { CODE_PREFIX, REFUND_STATUS, REFUND_METHOD, REFUND_REASON } from "../../../src/utils/constants.js";
import { codeFor } from "../lib/codes.mjs";
import { upsertOne } from "../lib/helpers.mjs";

const REFUND_PLAN = [
  {
    bookingKey: "coastal:c2:cancelled:-5",
    status: REFUND_STATUS.REFUNDED,
    reason: REFUND_REASON.CUSTOMER_CANCELLED,
  },
  {
    bookingKey: "biryani-house:c3:cancelled:-8",
    status: REFUND_STATUS.REFUND_PENDING,
    reason: REFUND_REASON.CUSTOMER_CANCELLED,
  },
  {
    bookingKey: "rooftop-pizzeria:c11:cancelled:-12",
    status: REFUND_STATUS.REFUNDED,
    reason: REFUND_REASON.CUSTOMER_CANCELLED,
  },
  {
    bookingKey: "pune-thali:c12:cancelled:-18",
    status: REFUND_STATUS.REFUND_DISPUTED,
    reason: REFUND_REASON.CUSTOMER_CANCELLED,
  },
  {
    bookingKey: "coastal:customer:cancelled:-3",
    status: REFUND_STATUS.REFUNDED,
    reason: REFUND_REASON.CUSTOMER_CANCELLED,
  },
];

export const seedRefunds = async (ctx) => {
  let codeIndex = 0;
  let createdCount = 0;

  for (const plan of REFUND_PLAN) {
    const entry = ctx.bookings.get(plan.bookingKey);
    if (!entry) continue;
    const booking = entry.doc;
    const advance = Number(booking.advanceAmount) || 0;
    if (advance <= 0) continue;

    const restaurant = ctx.restaurants.get(entry.spec.restaurantKey).doc;

    codeIndex += 1;
    const refundCode = codeFor(CODE_PREFIX.REFUND, codeIndex);

    const isRefunded = plan.status === REFUND_STATUS.REFUNDED;
    const isDisputed = plan.status === REFUND_STATUS.REFUND_DISPUTED;

    const doc = {
      refundCode,
      bookingId: booking._id,
      paymentId: null,
      billId: ctx.bills.get(plan.bookingKey)?.doc?._id || null,
      restaurantId: restaurant._id,
      ownerId: restaurant.ownerId,
      customerId: booking.userId,
      amount: advance,
      reason: plan.reason,
      remarks: isDisputed ? "Customer disputed the refund amount; awaiting resolution." : "Auto-refund following cancellation policy.",
      refundMethod: REFUND_METHOD.RAZORPAY,
      refundStatus: plan.status,
      gatewayRefundId: isRefunded ? `seed_rfnd_${String(codeIndex).padStart(4, "0")}` : "",
      transactionId: isRefunded ? `seed_txn_${String(codeIndex).padStart(4, "0")}` : "",
      idempotencyKey: `seed:${booking.bookingCode}:refund`,
      requestedAt: booking.cancelledAt,
      processingAttempt: isDisputed ? 3 : isRefunded ? 1 : 0,
      completedAt: isRefunded ? new Date(new Date(booking.cancelledAt).getTime() + 4 * 60 * 60 * 1000) : null,
      disputedAt: isDisputed ? new Date(new Date(booking.cancelledAt).getTime() + 2 * 24 * 60 * 60 * 1000) : null,
      disputeReason: isDisputed ? "Customer claims the full pre-order amount should have been refunded." : "",
      createdBy: ctx.users.get("admin").doc._id,
      processedBy: isRefunded ? ctx.users.get("admin").doc._id : null,
      isDeleted: false,
    };

    const { created, doc: saved } = await upsertOne(Refund, { refundCode }, doc);
    if (created) createdCount += 1;
    ctx.refunds.set(plan.bookingKey, { doc: saved, created });

    const statusUpdate = {
      refundId: saved._id,
      refundStatus: plan.status,
    };
    if (plan.status === REFUND_STATUS.REFUNDED) {
      statusUpdate.paymentStatus = "Refunded";
    }
    await Booking.updateOne({ _id: booking._id }, { $set: statusUpdate });
  }

  return { created: createdCount };
};

export { REFUND_PLAN };

export default seedRefunds;

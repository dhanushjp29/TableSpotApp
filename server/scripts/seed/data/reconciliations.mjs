import Reconciliation from "../../../src/models/Reconciliation.js";
import { RECONCILIATION_STATUS, RECONCILIATION_RESOLUTION } from "../../../src/utils/constants.js";
import { upsertOne, daysAgo } from "../lib/helpers.mjs";

const RECONCILIATIONS = [
  {
    bookingKey: "rooftop-pizzeria:c4:confirmed:-1",
    status: RECONCILIATION_STATUS.RESOLVED_BOOKING,
    resolution: RECONCILIATION_RESOLUTION.BOOKING_CREATED,
    resolutionReason: "Advance payment captured and booking materialized successfully.",
    attempts: 1,
    daysAgoOffset: 1,
  },
  {
    bookingKey: "coastal:c2:cancelled:-5",
    status: RECONCILIATION_STATUS.RESOLVED_REFUND,
    resolution: RECONCILIATION_RESOLUTION.REFUND_COMPLETED,
    resolutionReason: "Booking cancelled and advance refunded to the customer.",
    attempts: 2,
    daysAgoOffset: 8,
  },
  {
    bookingKey: "pune-thali:c12:cancelled:-18",
    status: RECONCILIATION_STATUS.MANUAL_REVIEW,
    resolution: null,
    resolutionReason: "Refund amount disputed by customer; moved to manual review.",
    attempts: 3,
    daysAgoOffset: 18,
  },
  {
    bookingKey: "coastal:customer:cancelled:-3",
    status: RECONCILIATION_STATUS.RESOLVED_REFUND,
    resolution: RECONCILIATION_RESOLUTION.REFUND_COMPLETED,
    resolutionReason: "Booking cancelled by the customer and advance fully refunded.",
    attempts: 1,
    daysAgoOffset: 3,
  },
];

export const seedReconciliations = async (ctx) => {
  let createdCount = 0;

  for (const spec of RECONCILIATIONS) {
    const payment = ctx.payments.find((p) => p.bookingKey === spec.bookingKey && p.type === "Advance");
    if (!payment) continue;
    const booking = ctx.bookings.get(spec.bookingKey).doc;
    const restaurant = ctx.restaurants.get(spec.bookingKey.split(":")[0]).doc;

    const doc = {
      paymentId: payment.doc._id,
      customerId: booking.userId,
      ownerId: restaurant.ownerId,
      restaurantId: restaurant._id,
      bookingId: booking._id,
      razorpayOrderId: "",
      razorpayPaymentId: "",
      status: spec.status,
      resolution: spec.resolution,
      resolutionReason: spec.resolutionReason,
      attempts: spec.attempts,
      lastAttemptAt: daysAgo(spec.daysAgoOffset, 9),
      nextAttemptAt: null,
      processingStartedAt: daysAgo(spec.daysAgoOffset, 9),
      resolvedAt: spec.resolution ? daysAgo(spec.daysAgoOffset, 9) : null,
      source: "worker",
    };

    const { created } = await upsertOne(Reconciliation, { paymentId: payment.doc._id }, doc);
    if (created) createdCount += 1;
  }

  return { created: createdCount };
};

export { RECONCILIATIONS };

export default seedReconciliations;

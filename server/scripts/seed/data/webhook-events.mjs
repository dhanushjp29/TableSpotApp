import WebhookEvent, { WEBHOOK_EVENT_STATUS } from "../../../src/models/WebhookEvent.js";
import { upsertOne, daysAgo } from "../lib/helpers.mjs";

const WEBHOOK_EVENTS = [
  {
    bookingKey: "flagship:customer:completed:28",
    eventType: "payment.captured",
    status: WEBHOOK_EVENT_STATUS.PROCESSED,
    attempts: 1,
    daysAgoOffset: 27,
  },
  {
    bookingKey: "flagship:c1:confirmed:-3",
    eventType: "payment.captured",
    status: WEBHOOK_EVENT_STATUS.PROCESSED,
    attempts: 1,
    daysAgoOffset: 2,
  },
  {
    bookingKey: "rooftop-pizzeria:c4:confirmed:-1",
    eventType: "payment.captured",
    status: WEBHOOK_EVENT_STATUS.PROCESSED,
    attempts: 1,
    daysAgoOffset: 1,
  },
  {
    bookingKey: "hyderabad-dum:c7:confirmed:-6",
    eventType: "payment.captured",
    status: WEBHOOK_EVENT_STATUS.FAILED_RETRYABLE,
    attempts: 3,
    daysAgoOffset: 6,
    lastError: "Signature verification failed on first attempts; retry scheduled.",
  },
  {
    bookingKey: "coastal:c2:cancelled:-5",
    eventType: "refund.processed",
    status: WEBHOOK_EVENT_STATUS.PROCESSED,
    attempts: 1,
    daysAgoOffset: 8,
  },
  {
    bookingKey: "coastal:customer:cancelled:-3",
    eventType: "refund.processed",
    status: WEBHOOK_EVENT_STATUS.PROCESSED,
    attempts: 1,
    daysAgoOffset: 3,
  },
];

export const seedWebhookEvents = async (ctx) => {
  let createdCount = 0;
  let serial = 0;

  for (const spec of WEBHOOK_EVENTS) {
    const payment = ctx.payments.find((p) => p.bookingKey === spec.bookingKey && p.type === "Advance");
    if (!payment) continue;

    serial += 1;
    const eventId = `seed_evt_${String(serial).padStart(4, "0")}`;
    const receivedAt = daysAgo(spec.daysAgoOffset, 10);
    const isProcessed = spec.status === WEBHOOK_EVENT_STATUS.PROCESSED;

    const doc = {
      eventId,
      eventType: spec.eventType,
      status: spec.status,
      claimToken: `seed_claim_${String(serial).padStart(4, "0")}`,
      attempts: spec.attempts,
      receivedAt,
      processingStartedAt: receivedAt,
      processedAt: isProcessed ? new Date(receivedAt.getTime() + 5 * 60 * 1000) : null,
      lastError: spec.lastError || "",
      razorpayOrderId: payment.doc.razorpayOrderId || "",
      razorpayPaymentId: payment.doc.razorpayPaymentId || "",
    };

    const { created } = await upsertOne(WebhookEvent, { eventId }, doc);
    if (created) createdCount += 1;
  }

  return { created: createdCount };
};

export { WEBHOOK_EVENTS };

export default seedWebhookEvents;

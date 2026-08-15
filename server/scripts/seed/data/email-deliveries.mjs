import EmailDelivery from "../../../src/models/EmailDelivery.js";
import { upsertOne, daysAgo } from "../lib/helpers.mjs";

const EMAIL_DELIVERIES = [
  {
    key: "customer-booking-confirmed",
    recipient: "customer@tablespot.app",
    template: "booking-confirmation",
    status: "SENT",
    daysAgoOffset: 1,
  },
  {
    key: "customer-payment-receipt",
    recipient: "customer@tablespot.app",
    template: "payment-receipt",
    status: "SENT",
    daysAgoOffset: 27,
  },
  {
    key: "customer-refund-processed",
    recipient: "customer@tablespot.app",
    template: "refund-processed",
    status: "SENT",
    daysAgoOffset: 3,
  },
  {
    key: "customer-review-invite",
    recipient: "customer@tablespot.app",
    template: "review-invitation",
    status: "PENDING",
    daysAgoOffset: 0,
  },
  {
    key: "owner-new-booking-notice",
    recipient: "owner@tablespot.app",
    template: "new-booking-notice",
    status: "SENT",
    daysAgoOffset: 2,
  },
  {
    key: "owner-report-filed",
    recipient: "owner@tablespot.app",
    template: "report-filed",
    status: "SENT",
    daysAgoOffset: 6,
  },
  {
    key: "owner-warning-issued",
    recipient: "owner@tablespot.app",
    template: "restaurant-warning",
    status: "SENT",
    daysAgoOffset: 6,
  },
  {
    key: "owner-daily-summary",
    recipient: "owner@tablespot.app",
    template: "daily-summary",
    status: "FAILED",
    daysAgoOffset: 1,
    error: "SMTP connection timed out while delivering daily summary.",
  },
  {
    key: "admin-moderation-notice",
    recipient: "admin@tablespot.app",
    template: "moderation-notice",
    status: "SENT",
    daysAgoOffset: 19,
  },
  {
    key: "admin-verification-request",
    recipient: "admin@tablespot.app",
    template: "restaurant-verification",
    status: "SENT",
    daysAgoOffset: 2,
  },
];

export const seedEmailDeliveries = async () => {
  let createdCount = 0;
  for (const spec of EMAIL_DELIVERIES) {
    const doc = {
      eventKey: spec.key,
      recipient: spec.recipient,
      template: spec.template,
      status: spec.status,
      sentAt: spec.status === "SENT" ? daysAgo(spec.daysAgoOffset, 9) : null,
      error: spec.error || "",
    };
    const { created } = await upsertOne(EmailDelivery, { eventKey: spec.key }, doc);
    if (created) createdCount += 1;
  }
  return { created: createdCount };
};

export { EMAIL_DELIVERIES };

export default seedEmailDeliveries;

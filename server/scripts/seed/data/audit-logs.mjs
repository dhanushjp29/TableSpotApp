import AuditLog from "../../../src/models/AuditLog.js";
import { CODE_PREFIX } from "../../../src/utils/constants.js";
import { codeFor } from "../lib/codes.mjs";
import { upsertOne, daysAgo } from "../lib/helpers.mjs";

const AUDIT_EVENTS = [
  {
    bookingKey: "flagship:c1:confirmed:-3",
    eventType: "BOOKING_CREATED",
    eventAction: "CREATE",
    entityType: "Booking",
    performedByRole: "customer",
    status: "Confirmed",
    daysAgoOffset: 2,
  },
  {
    bookingKey: "flagship:customer:completed:28",
    eventType: "BOOKING_COMPLETED",
    eventAction: "UPDATE",
    entityType: "Booking",
    performedByRole: "owner",
    status: "Completed",
    daysAgoOffset: 27,
  },
  {
    bookingKey: "flagship:customer:completed:28",
    eventType: "BILL_PAID",
    eventAction: "UPDATE",
    entityType: "Bill",
    performedByRole: "owner",
    status: "Paid",
    daysAgoOffset: 27,
  },
  {
    bookingKey: "rooftop-pizzeria:c4:confirmed:-1",
    eventType: "PAYMENT_CAPTURED",
    eventAction: "CREATE",
    entityType: "Payment",
    performedByRole: "customer",
    status: "Paid",
    daysAgoOffset: 1,
  },
  {
    bookingKey: "coastal:c2:cancelled:-5",
    eventType: "REFUND_INITIATED",
    eventAction: "CREATE",
    entityType: "Refund",
    performedByRole: "admin",
    status: "REFUND_PENDING",
    daysAgoOffset: 8,
  },
  {
    bookingKey: "flagship:c10:completed:20",
    eventType: "REPORT_FILED",
    eventAction: "CREATE",
    entityType: "RestaurantReport",
    performedByRole: "customer",
    status: "PENDING",
    daysAgoOffset: 19,
  },
  {
    bookingKey: "pune-thali:c13:completed:50",
    eventType: "WARNING_ISSUED",
    eventAction: "CREATE",
    entityType: "RestaurantWarning",
    performedByRole: "admin",
    status: "ACTIVE",
    daysAgoOffset: 19,
  },
  {
    bookingKey: "flagship:SS20",
    eventType: "OFFER_CREATED",
    eventAction: "CREATE",
    entityType: "Offer",
    performedByRole: "owner",
    status: "Active",
    daysAgoOffset: 30,
  },
  {
    bookingKey: "pune-thali:c13:completed:50",
    eventType: "REPORT_RESOLVED",
    eventAction: "UPDATE",
    entityType: "RestaurantReport",
    performedByRole: "admin",
    status: "RESOLVED",
    daysAgoOffset: 5,
  },
  {
    bookingKey: "green-leaf",
    eventType: "RESTAURANT_REGISTERED",
    eventAction: "CREATE",
    entityType: "Restaurant",
    performedByRole: "owner",
    status: "Pending",
    daysAgoOffset: 2,
  },
  {
    bookingKey: "coastal:customer:cancelled:-3",
    eventType: "REFUND_INITIATED",
    eventAction: "CREATE",
    entityType: "Refund",
    performedByRole: "admin",
    status: "REFUND_PENDING",
    daysAgoOffset: 4,
  },
  {
    bookingKey: "madras-cafe:c6:completed:40",
    eventType: "REPORT_FILED",
    eventAction: "CREATE",
    entityType: "RestaurantReport",
    performedByRole: "customer",
    status: "PENDING",
    daysAgoOffset: 6,
  },
];

export const seedAuditLogs = async (ctx) => {
  let codeIndex = 0;
  let createdCount = 0;

  for (const spec of AUDIT_EVENTS) {
    codeIndex += 1;
    const auditCode = codeFor(CODE_PREFIX.AUDIT, codeIndex);

    let booking = null;
    let bill = null;
    let restaurantId = null;
    let userId = null;
    let amount = 0;

    if (spec.entityType === "RestaurantWarning") {
      const warning = ctx.warnings.get("pune-thali")?.doc;
      restaurantId = warning ? warning.restaurantId : null;
    } else if (spec.entityType === "Restaurant") {
      const rest = ctx.restaurants.get("green-leaf").doc;
      restaurantId = rest._id;
      userId = ctx.users.get("o6").doc._id;
    } else {
      const entry = ctx.bookings.get(spec.bookingKey)?.doc;
      booking = entry || null;
      if (booking) {
        restaurantId = booking.restaurantId;
        userId = booking.userId;
      }
      if (spec.eventType === "BILL_PAID" && booking) {
        bill = ctx.bills.get(spec.bookingKey)?.doc || null;
        amount = bill ? bill.grandTotal : 0;
      }
      if (spec.eventType === "PAYMENT_CAPTURED" && booking) {
        amount = Number(booking.advanceAmount) || 0;
      }
      if (spec.eventType === "REFUND_INITIATED" && booking) {
        amount = Number(booking.advanceAmount) || 0;
      }
    }

    const doc = {
      auditCode,
      eventType: spec.eventType,
      eventAction: spec.eventAction,
      bookingId: booking ? booking._id : null,
      billId: bill ? bill._id : null,
      paymentId: null,
      refundId: spec.eventType === "REFUND_INITIATED" ? ctx.refunds.get(spec.bookingKey)?.doc?._id : null,
      restaurantId,
      userId,
      performedBy: ctx.users.get(spec.performedByRole === "admin" ? "admin" : spec.performedByRole === "owner" ? (ctx.ownerByRestaurant.get(spec.bookingKey?.split(":")[0]) || "owner") : spec.performedByRole === "customer" ? userId : "admin")?.doc?._id || null,
      performedByRole: spec.performedByRole,
      entityType: spec.entityType,
      entityId: String(booking ? booking._id : restaurantId || ""),
      amount,
      currency: "INR",
      status: spec.status,
      metadata: { seed: true, event: spec.eventType },
      createdAt: daysAgo(spec.daysAgoOffset, 14),
    };

    const { created } = await upsertOne(AuditLog, { auditCode }, doc);
    if (created) createdCount += 1;
  }

  return { created: createdCount };
};

export { AUDIT_EVENTS };

export default seedAuditLogs;

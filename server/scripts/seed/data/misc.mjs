import OfferRecipient from "../../../src/models/OfferRecipient.js";
import Counter from "../../../src/models/Counter.js";
import User from "../../../src/models/User.js";
import Restaurant from "../../../src/models/Restaurant.js";
import RestaurantTable from "../../../src/models/RestaurantTable.js";
import Food from "../../../src/models/food.js";
import Booking from "../../../src/models/Booking.js";
import Bill from "../../../src/models/Bill.js";
import Refund from "../../../src/models/Refund.js";
import RestaurantReview from "../../../src/models/RestaurantReview.js";
import FoodReview from "../../../src/models/FoodReview.js";
import RestaurantReport from "../../../src/models/RestaurantReport.js";
import RestaurantWarning from "../../../src/models/RestaurantWarning.js";
import Notification from "../../../src/models/Notification.js";
import AuditLog from "../../../src/models/AuditLog.js";
import {
  OFFER_RECIPIENT_STATUS,
  OFFER_USAGE_SOURCE,
  CODE_PREFIX,
} from "../../../src/utils/constants.js";

const USED_RECIPIENTS = [
  "flagship:customer:completed:28",
  "flagship:c7:completed:12",
  "flagship:c10:completed:20",
  "flagship:c14:completed:15",
  "coastal:c2:completed:18",
  "biryani-house:c3:completed:30",
  "rooftop-pizzeria:c4:completed:35",
];

const CLAIMED_RECIPIENTS = [
  "flagship:c1:confirmed:-3",
  "hyderabad-dum:c7:confirmed:-6",
];

const AVAILABLE_RECIPIENTS = [
  { offerKey: "flagship:SS20", userKey: "customer" },
  { offerKey: "bake-brew:BREW20", userKey: "c6" },
  { offerKey: "chettinad:CHET10", userKey: "c9" },
];

const seedRecipients = async (ctx) => {
  let createdCount = 0;

  const save = async (doc) => {
    const existing = await OfferRecipient.findOne({
      offerId: doc.offerId,
      ...(doc.userId ? { userId: doc.userId } : {}),
      status: doc.status,
    }).select("_id").lean();
    if (existing) return false;
    await OfferRecipient.create(doc);
    createdCount += 1;
    return true;
  };

  for (const bookingKey of USED_RECIPIENTS) {
    const entry = ctx.bookings.get(bookingKey);
    const bill = ctx.bills.get(bookingKey)?.doc;
    if (!entry || !entry.spec.offerCode || !bill) continue;
    const booking = entry.doc;
    const offer = ctx.offers.get(`${entry.spec.restaurantKey}:${entry.spec.offerCode}`).doc;
    await save({
      offerId: offer._id,
      restaurantId: booking.restaurantId,
      userId: booking.userId,
      email: "",
      status: OFFER_RECIPIENT_STATUS.USED,
      claimedAt: new Date(booking.bookingDateTime),
      usedAt: booking.completedAt,
      bookingId: booking._id,
      billId: bill._id,
      discountAmount: ctx.bills.get(bookingKey).math.offerDiscountAmount,
      usageSource: OFFER_USAGE_SOURCE.ONLINE,
    });
  }

  for (const bookingKey of CLAIMED_RECIPIENTS) {
    const entry = ctx.bookings.get(bookingKey);
    if (!entry || !entry.spec.offerCode) continue;
    const booking = entry.doc;
    const offer = ctx.offers.get(`${entry.spec.restaurantKey}:${entry.spec.offerCode}`).doc;
    await save({
      offerId: offer._id,
      restaurantId: booking.restaurantId,
      userId: booking.userId,
      email: "",
      status: OFFER_RECIPIENT_STATUS.CLAIMED,
      claimedAt: new Date(booking.bookingDateTime),
      usedAt: null,
      bookingId: booking._id,
      billId: null,
      discountAmount: 0,
      usageSource: OFFER_USAGE_SOURCE.ONLINE,
    });
  }

  for (const spec of AVAILABLE_RECIPIENTS) {
    const offer = ctx.offers.get(spec.offerKey)?.doc;
    const user = ctx.users.get(spec.userKey)?.doc;
    if (!offer || !user) continue;
    await save({
      offerId: offer._id,
      restaurantId: offer.restaurantId,
      userId: user._id,
      email: "",
      status: OFFER_RECIPIENT_STATUS.AVAILABLE,
      claimedAt: null,
      usedAt: null,
      bookingId: null,
      billId: null,
      discountAmount: 0,
      usageSource: null,
    });
  }

  return { created: createdCount };
};

const COUNTER_SPECS = [
  [User, "userCode", CODE_PREFIX.USER],
  [Restaurant, "restaurantCode", CODE_PREFIX.RESTAURANT],
  [RestaurantTable, "tableCode", CODE_PREFIX.TABLE],
  [Food, "foodCode", CODE_PREFIX.FOOD],
  [Booking, "bookingCode", CODE_PREFIX.BOOKING],
  [Bill, "billCode", CODE_PREFIX.BILL],
  [Refund, "refundCode", CODE_PREFIX.REFUND],
  [RestaurantReview, "reviewCode", CODE_PREFIX.REVIEW],
  [FoodReview, "reviewCode", CODE_PREFIX.REVIEW],
  [RestaurantReport, "reportCode", CODE_PREFIX.REPORT],
  [RestaurantWarning, "warningCode", CODE_PREFIX.WARNING],
  [Notification, "notificationCode", CODE_PREFIX.NOTIFICATION],
  [AuditLog, "auditCode", CODE_PREFIX.AUDIT],
];

const alignCounters = async () => {
  let updated = 0;
  for (const [Model, fieldName, prefix] of COUNTER_SPECS) {
    const docs = await Model.find({}, { [fieldName]: 1 }).lean();
    let max = 0;
    for (const doc of docs) {
      const code = doc[fieldName];
      if (typeof code !== "string" || !code.startsWith(prefix)) continue;
      const parsed = Number(code.slice(prefix.length));
      if (Number.isInteger(parsed) && parsed >= 0 && parsed > max) max = parsed;
    }
    const key = `${Model.modelName}:${fieldName}`;
    const existing = await Counter.findOne({ key }).select("sequence").lean();
    if (!existing) {
      await Counter.create({ key, sequence: max });
      updated += 1;
    } else if (Number(existing.sequence) < max) {
      await Counter.updateOne({ key }, { $set: { sequence: max } });
      updated += 1;
    }
  }
  return { updated };
};

export const seedMisc = async (ctx) => {
  const recipients = await seedRecipients(ctx);
  const counters = await alignCounters();
  return { recipients, counters };
};

export default seedMisc;

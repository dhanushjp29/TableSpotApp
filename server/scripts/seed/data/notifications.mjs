import Notification from "../../../src/models/Notification.js";
import { CODE_PREFIX } from "../../../src/utils/constants.js";
import { codeFor } from "../lib/codes.mjs";
import { upsertOne, daysAgo } from "../lib/helpers.mjs";

const NOTIFICATIONS = [
  {
    key: "flagship:c1:confirmed:-3",
    type: "Booking",
    linkModel: "Booking",
    recipientUserKey: "showcase",
    title: "New booking received",
    message: "You have a new table booking for Hyderabadi Chicken Dum Biryani at SS Biryani & Grill.",
    daysAgoOffset: 2,
  },
  {
    key: "chettinad:c2:confirmed:-2",
    type: "Booking",
    linkModel: "Booking",
    recipientUserKey: "owner",
    title: "New booking received",
    message: "A table for 4 has been booked at Chettinad Thattukada.",
    daysAgoOffset: 1,
  },
  {
    key: "rooftop-pizzeria:c4:confirmed:-1",
    type: "Payment",
    linkModel: "Bill",
    recipientUserKey: "c4",
    title: "Advance payment successful",
    message: "Your advance payment for Rooftop Pizzeria has been received. See you soon!",
    daysAgoOffset: 1,
  },
  {
    key: "rooftop-pizzeria:c4:confirmed:-1",
    type: "Booking",
    linkModel: "Bill",
    recipientUserKey: "c4",
    title: "Upfront bill generated",
    message: "Your upfront bill for Rooftop Pizzeria has been generated. Pay the balance at the restaurant.",
    daysAgoOffset: 1,
  },
  {
    key: "flagship:SS20",
    type: "Offer",
    linkModel: "Offer",
    recipientUserKey: "showcase",
    title: "Offer published",
    message: "Your 20% offer SS20 is now live for SS Biryani & Grill.",
    daysAgoOffset: 30,
  },
  {
    key: "flagship:customer:completed:28",
    type: "Restaurant Review",
    linkModel: "RestaurantReview",
    recipientUserKey: "showcase",
    title: "New restaurant review",
    message: "A customer rated SS Biryani & Grill 5 stars.",
    daysAgoOffset: 27,
  },
  {
    key: "flagship:customer:completed:28",
    type: "Food Review",
    linkModel: "FoodReview",
    recipientUserKey: "showcase",
    title: "New food review",
    message: "Hyderabadi Chicken Dum Biryani received a 5-star review.",
    daysAgoOffset: 27,
  },
  {
    key: "flagship:c10:completed:20",
    type: "Restaurant Report",
    linkModel: "RestaurantReport",
    recipientUserKey: "admin",
    title: "New restaurant report filed",
    message: "A high-severity food quality report was filed against SS Biryani & Grill.",
    daysAgoOffset: 19,
  },
  {
    key: "pune-thali",
    type: "Restaurant Warning",
    linkModel: "RestaurantWarning",
    recipientUserKey: "o7",
    title: "Formal warning issued",
    message: "Pune Thali received a Level 1 warning for a confirmed billing error.",
    daysAgoOffset: 19,
  },
  {
    key: "coastal:c2:cancelled:-5",
    type: "Payment",
    linkModel: "Refund",
    recipientUserKey: "c2",
    title: "Refund processed",
    message: "Your refund for the cancelled Coastal Catch booking has been processed.",
    daysAgoOffset: 8,
  },
  {
    key: "none-green-leaf-pending",
    type: "Alert",
    linkModel: "Restaurant",
    recipientUserKey: "admin",
    title: "New restaurant awaiting verification",
    message: "Green Leaf has applied to be listed on TableSpot and is awaiting verification.",
    daysAgoOffset: 2,
  },
  {
    key: "none-system-welcome",
    type: "System",
    linkModel: "",
    recipientUserKey: "admin",
    title: "Welcome to TableSpot",
    message: "The demo dataset has been seeded. Explore bookings, bills, offers and moderation.",
    daysAgoOffset: 0,
  },
  {
    key: "chai-co:customer:confirmed:-2",
    type: "Booking",
    linkModel: "Booking",
    recipientUserKey: "customer",
    title: "Booking confirmed",
    message: "Your table at Chai & Co is confirmed. See you there!",
    daysAgoOffset: 1,
  },
  {
    key: "flagship:customer:completed:28",
    type: "Payment",
    linkModel: "Bill",
    recipientUserKey: "customer",
    title: "Payment received",
    message: "Your advance payment for SS Biryani & Grill was captured successfully.",
    daysAgoOffset: 27,
  },
  {
    key: "flagship:customer:completed:28",
    type: "Restaurant Review",
    linkModel: "RestaurantReview",
    recipientUserKey: "customer",
    title: "Review published",
    message: "Your review of SS Biryani & Grill has been published. Thank you!",
    daysAgoOffset: 27,
  },
  {
    key: "coastal:customer:cancelled:-3",
    type: "Payment",
    linkModel: "Refund",
    recipientUserKey: "customer",
    title: "Refund processed",
    message: "Your refund for the cancelled Coastal Catch booking has been credited.",
    daysAgoOffset: 3,
  },
  {
    key: "none-welcome-customer",
    type: "System",
    linkModel: "",
    recipientUserKey: "customer",
    title: "Welcome to TableSpot",
    message: "Your demo account is ready. Explore bookings, offers and more.",
    daysAgoOffset: 0,
  },
  {
    key: "madras-cafe:c6:completed:40",
    type: "Restaurant Report",
    linkModel: "RestaurantReport",
    recipientUserKey: "owner",
    title: "New report filed",
    message: "A hygiene report was filed against Madras Cafe.",
    daysAgoOffset: 6,
  },
  {
    key: "madras-cafe",
    type: "Restaurant Warning",
    linkModel: "RestaurantWarning",
    recipientUserKey: "owner",
    title: "Formal warning issued",
    message: "Madras Cafe received a Level 1 warning for the hygiene complaint.",
    daysAgoOffset: 6,
  },
  {
    key: "chettinad:c2:completed:40",
    type: "Restaurant Review",
    linkModel: "RestaurantReview",
    recipientUserKey: "owner",
    title: "New restaurant review",
    message: "A customer rated Chettinad Thattukada 5 stars.",
    daysAgoOffset: 39,
  },
  {
    key: "madras-cafe:c6:completed:40",
    type: "Restaurant Report",
    linkModel: "RestaurantReport",
    recipientUserKey: "admin",
    title: "New restaurant report filed",
    message: "A new hygiene report against Madras Cafe needs your review.",
    daysAgoOffset: 6,
  },
];

export const seedNotifications = async (ctx) => {
  let codeIndex = 0;
  let createdCount = 0;

  for (const spec of NOTIFICATIONS) {
    const recipient = ctx.users.get(spec.recipientUserKey)?.doc;
    if (!recipient) continue;

    let linkId = null;
    if (spec.linkModel === "Booking") {
      linkId = ctx.bookings.get(spec.key)?.doc?._id || null;
    } else if (spec.linkModel === "Bill") {
      linkId = ctx.bills.get(spec.key)?.doc?._id || null;
    } else if (spec.linkModel === "Offer") {
      linkId = ctx.offers.get(spec.key)?.doc?._id || null;
    } else if (spec.linkModel === "RestaurantReview") {
      linkId = ctx.restaurantReviews.get(spec.key)?.doc?._id || null;
    } else if (spec.linkModel === "FoodReview") {
      linkId = ctx.foodReviews.get(spec.key)?.doc?._id || null;
    } else if (spec.linkModel === "RestaurantReport") {
      linkId = ctx.reports.get(spec.key)?.doc?._id || null;
    } else if (spec.linkModel === "RestaurantWarning") {
      linkId = ctx.warnings.get(spec.key)?.doc?._id || null;
    } else if (spec.linkModel === "Restaurant") {
      linkId = ctx.restaurants.get("green-leaf").doc._id;
    } else if (spec.linkModel === "Refund") {
      linkId = ctx.refunds.get(spec.key)?.doc?._id || null;
    } else if (spec.linkModel === "Payment") {
      const payment = ctx.payments.find((p) => p.bookingKey === spec.key);
      linkId = payment ? payment.doc._id : null;
    }

    codeIndex += 1;
    const notificationCode = codeFor(CODE_PREFIX.NOTIFICATION, codeIndex);

    const isRead = spec.daysAgoOffset > 0;
    const doc = {
      notificationCode,
      userId: recipient._id,
      title: spec.title,
      message: spec.message,
      type: spec.type,
      linkId,
      linkModel: spec.linkModel,
      isRead,
      readAt: isRead ? daysAgo(spec.daysAgoOffset, 10) : null,
      isActive: true,
    };

    const { created } = await upsertOne(Notification, { notificationCode }, doc);
    if (created) createdCount += 1;
  }

  return { created: createdCount };
};

export { NOTIFICATIONS };

export default seedNotifications;

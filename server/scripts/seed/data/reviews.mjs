import RestaurantReview from "../../../src/models/RestaurantReview.js";
import FoodReview from "../../../src/models/FoodReview.js";
import { CODE_PREFIX } from "../../../src/utils/constants.js";
import { codeFor } from "../lib/codes.mjs";
import { upsertOne } from "../lib/helpers.mjs";
import { FOODS_SPEC } from "./foods.mjs";
import { galleryFor } from "../lib/images.mjs";

const R = (bookingKey, rating, title, comment, opts = {}) => ({
  bookingKey,
  rating,
  title,
  comment,
  status: opts.status || "Published",
  ownerReply: opts.ownerReply || "",
  images: opts.images || false,
});

const RESTAURANT_REVIEWS = [
  R("flagship:customer:completed:28", 5, "Best biryani in Chennai", "The Hyderabadi Chicken Dum Biryani was flavourful and perfectly spiced. Service was quick and the ambience is great.", { ownerReply: "Thank you! So glad you enjoyed the biryani. Do visit again!", images: true }),
  R("flagship:c7:completed:12", 4, "Great food, packed weekends", "Biryani was excellent. The queue on weekends can be long though.", { ownerReply: "Thanks for the feedback — try booking ahead next time!" }),
  R("flagship:c8:completed:45", 5, "Consistently amazing", "Ordered the Veg Biryani and Chicken 65 for the family. Everything tasted fresh.", { images: true }),
  R("flagship:c10:completed:20", 4, "Anniversary dinner done right", "Staff even arranged a small cake as requested. Food was great."),
  R("flagship:c12:completed:30", 5, "A must visit", "Mutton Biryani is the star here. Will come back for sure."),
  R("chettinad:c2:completed:40", 5, "Authentic Chettinad flavour", "The Chettinad chicken was spicy and smoky, just how it should be."),
  R("chettinad:c5:completed:22", 4, "Loved the parotta", "Soft parotta and spicy kurma. Great value for money.", { images: true }),
  R("chettinad:c8:completed:10", 4, "Solid South Indian meal", "Appam and chicken were excellent. Filter coffee was a nice finish."),
  R("coastal:c2:completed:18", 5, "Seafood heaven", "The prawn fry was the best I've had in the city.", { images: true }),
  R("coastal:c9:completed:25", 4, "Fresh catch, great grill", "Grilled fish was tender. Slightly slow service at peak time."),
  R("biryani-house:c3:completed:30", 4, "Good quick biryani spot", "Chicken biryani was fragrant and the starter platter was generous."),
  R("biryani-house:c7:completed:12", 4, "Nice vibe", "Ambience is cosy and the biryani is consistent."),
  R("biryani-house:c11:completed:65", 4, "Family favourite", "We order from here often. Portions are good.", { images: true }),
  R("dosa-junction:c6:completed:25", 4, "Crispy dosas", "Ghee roast was perfectly crisp. Coffee complements it well.", { images: true }),
  R("dosa-junction:c7:completed:40", 4, "Quick and tasty", "Masala dosa and filter coffee. Good for a quick meal."),
  R("rooftop-pizzeria:c4:completed:35", 5, "Wood-fired perfection", "The rooftop view plus wood-fired pizzas is a killer combo.", { ownerReply: "Thanks! The sunset view is our favourite too.", images: true }),
  R("rooftop-pizzeria:c6:completed:20", 4, "Nice place, great pizza", "Margherita was fresh and the garlic bread was buttery."),
  R("rooftop-pizzeria:c8:completed:8", 4, "Good family dinner", "Kids loved the pasta and the service was attentive."),
  R("mumbai-tiffin:c5:completed:30", 4, "Homely vada pav", "Bombay-style vada pav took me right back to Mumbai.", { images: true }),
  R("mumbai-tiffin:c8:completed:12", 4, "Comfort food", "Pav bhaji was tasty and filling. Good portion sizes."),
  R("street-wok:c5:completed:20", 4, "Great Indo-Chinese", "Chilli garlic noodles were spot on. Generous portions."),
  R("street-wok:c13:completed:60", 4, "Wok-tossed perfection", "The burnt garlic fried rice is a must-try."),
  R("madras-cafe:c1:completed:22", 5, "Nostalgic filter coffee", "Old-school madras cafe done right. Idli and podi were excellent.", { images: true }),
  R("madras-cafe:c6:completed:40", 4, "Quick breakfast stop", "Ghee roast, idli and strong coffee. Efficient service."),
  R("chai-co:customer:completed:12", 4, "Cozy chai spot", "Cutting chai and samosa — perfect evening. Ambience is warm.", { images: true }),
  R("chai-co:c11:completed:48", 4, "Good for meetups", "Loaded fries and chai are great for catching up with friends."),
  R("bake-brew:c4:completed:18", 5, "Pastry paradise", "The croissant was buttery and flaky. Coffee is top notch.", { ownerReply: "Happy you loved the croissants! Morning batch is freshest.", images: true }),
  R("bake-brew:c8:completed:28", 4, "Sweet tooth satisfied", "Penne alfredo and lemon tart were both excellent."),
  R("pune-thali:c6:completed:30", 4, "Hearty thali", "The thali is a proper Maharashtrian spread. Unlimited options.", { images: true }),
  R("pune-thali:c13:completed:50", 4, "Great for groups", "The thali portions are generous and the staff is friendly."),
  R("paradise-corner:c7:completed:25", 4, "Biryani done well", "Nice biryani and good service. Reasonable prices."),
  R("paradise-corner:c10:completed:40", 5, "Value for money", "For the price, the food quality is excellent. Loved it."),
  R("green-leaf:c2:completed:30", 4, "Healthy and tasty", "Veg food that doesn't feel like a compromise. The chettinad veg curry was great.", { images: true }),
  R("kochi-spice:c3:completed:35", 4, "Kerala flavours", "Fish curry was authentic. Waiting for your live music nights.", { status: "Pending" }),
];

const F = (bookingKey, foodIndex, rating, title, comment) => ({ bookingKey, foodIndex, rating, title, comment });

const FOOD_REVIEWS = [
  F("flagship:customer:completed:28", 0, 5, "Hyderabadi Chicken Dum Biryani", "Perfectly layered rice, tender chicken, soulful masala."),
  F("flagship:customer:completed:28", 9, 4, "Gulab Jamun", "Warm, soft and syrupy. Great finish to the meal."),
  F("flagship:c1:completed:35", 1, 5, "Mutton Biryani", "Rich, aromatic and the mutton was melt-in-the-mouth."),
  F("rooftop-pizzeria:c4:completed:35", 2, 5, "Chicken BBQ Pizza", "Wood-fired, crispy base, smoky BBQ chicken."),
  F("biryani-house:c3:completed:30", 0, 4, "Chicken Biryani", "Light on oil, strong on flavour."),
  F("chai-co:customer:completed:12", 1, 5, "Cutting Chai", "Strong, sweet and exactly how cutting chai should be."),
  F("coastal:c2:completed:18", 1, 5, "Prawn Fry", "Crisp, spicy and juicy prawns."),
  F("madras-cafe:c1:completed:22", 7, 5, "Filter Coffee", "Frothy, strong and nostalgic."),
  F("bake-brew:c4:completed:18", 0, 4, "Butter Croissant", "Flaky, buttery and fresh."),
  F("chettinad:c2:completed:40", 0, 5, "Karaikudi Chicken Curry", "Fiery, earthy and authentic."),
  F("pune-thali:c6:completed:30", 1, 4, "Maharashtrian Thali", "Filling, varied and tasty."),
];

export const seedReviews = async (ctx) => {
  let restCodeIndex = 0;
  let foodCodeIndex = 200;
  let createdCount = 0;

  for (const spec of RESTAURANT_REVIEWS) {
    const entry = ctx.bookings.get(spec.bookingKey);
    if (!entry || entry.spec.phase !== "completed") continue;
    const booking = entry.doc;
    const bill = ctx.bills.get(spec.bookingKey)?.doc;
    if (!bill || bill.billStatus !== "Paid") continue;

    restCodeIndex += 1;
    const reviewCode = codeFor(CODE_PREFIX.REVIEW, restCodeIndex);
    const doc = {
      reviewCode,
      userId: booking.userId,
      restaurantId: booking.restaurantId,
      bookingId: booking._id,
      rating: spec.rating,
      title: spec.title,
      comment: spec.comment,
      images: spec.images ? [galleryFor(spec.bookingKey.split(":")[0])[0]] : [],
      status: spec.status,
      ownerReply: spec.ownerReply,
      ownerRepliedAt: spec.ownerReply ? new Date(booking.completedAt) : null,
      isActive: true,
    };

    const { created, doc: saved } = await upsertOne(RestaurantReview, { reviewCode }, doc);
    if (created) createdCount += 1;
    ctx.restaurantReviews.set(spec.bookingKey, { doc: saved, created });
  }

  for (const spec of FOOD_REVIEWS) {
    const entry = ctx.bookings.get(spec.bookingKey);
    if (!entry || entry.spec.phase !== "completed") continue;
    const booking = entry.doc;
    const restaurantKey = spec.bookingKey.split(":")[0];
    const food = ctx.foods.get(`${restaurantKey}:${FOODS_SPEC[restaurantKey][spec.foodIndex].name}`)?.doc;
    if (!food) continue;

    foodCodeIndex += 1;
    const reviewCode = codeFor(CODE_PREFIX.REVIEW, foodCodeIndex);
    const doc = {
      reviewCode,
      userId: booking.userId,
      restaurantId: booking.restaurantId,
      foodId: food._id,
      bookingId: booking._id,
      rating: spec.rating,
      title: spec.title,
      comment: spec.comment,
      images: [],
      status: "Published",
      isActive: true,
    };

    const { created, doc: saved } = await upsertOne(FoodReview, { reviewCode }, doc);
    if (created) createdCount += 1;
    ctx.foodReviews.set(spec.bookingKey, { doc: saved, created });
  }

  return { created: createdCount };
};

export default seedReviews;

export { RESTAURANT_REVIEWS, FOOD_REVIEWS };

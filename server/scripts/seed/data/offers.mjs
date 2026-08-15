import Offer from "../../../src/models/Offer.js";
import { upsertOne, daysFromNow, daysAgo } from "../lib/helpers.mjs";

const O = (
  restaurantKey,
  offerCode,
  title,
  description,
  discountType,
  discountValue,
  opts = {}
) => ({
  restaurantKey,
  offerCode,
  title,
  description,
  discountType,
  discountValue,
  minOrderAmount: opts.minOrderAmount || 0,
  maxDiscountAmount: opts.maxDiscountAmount || 0,
  maxRedemptions: opts.maxRedemptions || 0,
  perUserRedemptionLimit: opts.perUserRedemptionLimit || 1,
  validityStart: opts.validityStart || daysAgo(5),
  validityEnd: opts.validityEnd || daysFromNow(180),
  targeting: opts.targeting || "ALL",
  segmentRules: opts.segmentRules || {},
  targetUserIds: opts.targetUserIds || [],
  isStackable: Boolean(opts.isStackable),
  isActive: opts.isActive === undefined ? true : opts.isActive,
});

export const OFFERS_SPEC = [
  O("flagship", "SS20", "SS 20% Off", "Flat 20% off on your table bill above ₹500.", "Percentage", 20, { minOrderAmount: 500, maxDiscountAmount: 200, pop: true }),
  O("flagship", "SSFLAT150", "SS ₹150 Off", "Flat ₹150 off on bills above ₹800.", "Amount", 150, { minOrderAmount: 800, maxDiscountAmount: 150 }),
  O("chettinad", "CHET10", "Chettinad 10% Off", "10% off on all Chettinad specials.", "Percentage", 10, { maxDiscountAmount: 150 }),
  O("coastal", "SEA15", "Coastal 15% Off", "15% off seafood platters and starters.", "Percentage", 15, { minOrderAmount: 400, maxDiscountAmount: 200 }),
  O("biryani-house", "BH15", "Biryani House 15%", "15% off your entire bill.", "Percentage", 15, { maxDiscountAmount: 200, pop: true }),
  O("rooftop-pizzeria", "RTP100", "Rooftop ₹100 Off", "Flat ₹100 off on bills above ₹400.", "Amount", 100, { minOrderAmount: 400, maxDiscountAmount: 100 }),
  O("hyderabad-dum", "HYD20", "Hyderabad Loyalty 20%", "20% off for loyal Hyderabad Dum regulars.", "Percentage", 20, { maxDiscountAmount: 200, targeting: "SEGMENT", segmentRules: { minBookings: 1, hasCompletedBooking: true } }),
  O("mumbai-tiffin", "TIFFIN10", "Tiffin 10% Off", "10% off for repeat Mumbai Tiffin guests.", "Percentage", 10, { maxDiscountAmount: 100, targeting: "SEGMENT", segmentRules: { minBookings: 1, hasCompletedBooking: true } }),
  O("dosa-junction", "DJ50", "Dosa Junction ₹50", "Flat ₹50 off on your table bill.", "Amount", 50, { minOrderAmount: 250, maxDiscountAmount: 50 }),
  O("street-wok", "WOK50", "Street Wok ₹50", "Flat ₹50 off on Indo-Chinese orders.", "Amount", 50, { minOrderAmount: 300, maxDiscountAmount: 50 }),
  O("chai-co", "CHAI50", "Chai & Co ₹50", "Flat ₹50 off on bills above ₹200.", "Amount", 50, { minOrderAmount: 200, maxDiscountAmount: 50 }),
  O("bake-brew", "BREW20", "Bake & Brew 20%", "20% off on desserts and beverages.", "Percentage", 20, { maxDiscountAmount: 150 }),
  O("pune-thali", "THALI75", "Pune Thali ₹75", "Flat ₹75 off on thali combos.", "Amount", 75, { minOrderAmount: 400, maxDiscountAmount: 75 }),
  O("green-leaf", "LEAF100", "Green Leaf ₹100", "Flat ₹100 off on bills above ₹600.", "Amount", 100, { minOrderAmount: 600, maxDiscountAmount: 100 }),
  O("kochi-spice", "KOCHI50", "Kochi Spice ₹50", "Flat ₹50 off on Kerala specials.", "Amount", 50, { minOrderAmount: 300, maxDiscountAmount: 50 }),
  O("sunset-grill", "SUNSET15", "Sunset Grill 15%", "15% off (offer paused during verification).", "Percentage", 15, { maxDiscountAmount: 200, isActive: false }),
];

export const seedOffers = async (ctx) => {
  for (let i = 0; i < OFFERS_SPEC.length; i += 1) {
    const spec = OFFERS_SPEC[i];
    const restaurant = ctx.restaurants.get(spec.restaurantKey).doc;
    const owner = ctx.users.get(ctx.ownerByRestaurant.get(spec.restaurantKey)).doc;

    const doc = {
      restaurantId: restaurant._id,
      offerCode: spec.offerCode,
      title: spec.title,
      description: spec.description,
      discountType: spec.discountType,
      discountValue: spec.discountValue,
      minOrderAmount: spec.minOrderAmount,
      maxDiscountAmount: spec.maxDiscountAmount,
      maxRedemptions: spec.maxRedemptions,
      perUserRedemptionLimit: spec.perUserRedemptionLimit,
      validityStart: spec.validityStart,
      validityEnd: spec.validityEnd,
      targeting: spec.targeting,
      segmentRules: spec.segmentRules,
      targetUserIds: spec.targetUserIds,
      isStackable: spec.isStackable,
      isActive: spec.isActive,
      createdBy: owner._id,
    };

    const { created, doc: saved } = await upsertOne(
      Offer,
      { restaurantId: restaurant._id, offerCode: spec.offerCode },
      doc
    );

    const key = `${spec.restaurantKey}:${spec.offerCode}`;
    ctx.offers.set(key, { doc: saved, created });
  }

  return { created: [...ctx.offers.values()].filter((r) => r.created).length };
};

export default seedOffers;

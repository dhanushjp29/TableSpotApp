import Booking from "../../../src/models/Booking.js";
import { CODE_PREFIX, BOOKING_PAYMENT_POLICY, BOOKING_PAYMENT_TYPE, SEAT_SELECTION_MODE } from "../../../src/utils/constants.js";
import { codeFor } from "../lib/codes.mjs";
import { upsertOne, roundAmount, daysAgo, daysFromNow, computeOfferDiscount, computeAdvanceAmount, computeCancellationCutoffAt } from "../lib/helpers.mjs";
import { FOODS_SPEC } from "./foods.mjs";

const PRE = (i, q, v = null) => ({ i, q, v });

const SPEC = (customerKey, restaurantKey, days, guests, pre, opts = {}) => ({
  customerKey,
  restaurantKey,
  days,
  guests,
  pre,
  hour: opts.hour ?? (days > 0 ? 19 : 19),
  minute: opts.minute ?? 30,
  dur: opts.dur || 120,
  status: opts.status || "Confirmed",
  offerCode: opts.offerCode || null,
  specialRequest: opts.specialRequest || "",
  cancelledAtDaysAgo: opts.cancelledAtDaysAgo || null,
  cancellationReason: opts.cancellationReason || "",
  noShow: Boolean(opts.noShow),
  bookingType: opts.bookingType || "Online",
});

const COMPLETED = [
  // flagship (10)
  SPEC("customer", "flagship", 28, 2, [PRE(0, 1, "Full"), PRE(9, 1)], { status: "Completed", offerCode: "SS20", specialRequest: "Window seat if available" }),
  SPEC("c1", "flagship", 35, 4, [PRE(1, 2)], { status: "Completed", offerCode: "SS20", hour: 13 }),
  SPEC("c7", "flagship", 12, 2, [PRE(0, 1, "Full"), PRE(4, 1), PRE(7, 1)], { status: "Completed", offerCode: "SSFLAT150" }),
  SPEC("c8", "flagship", 45, 4, [PRE(2, 2), PRE(6, 1)], { status: "Completed", hour: 13 }),
  SPEC("c9", "flagship", 60, 2, [PRE(5, 1), PRE(7, 1)], { status: "Completed" }),
  SPEC("c10", "flagship", 20, 6, [PRE(0, 1, "Full"), PRE(1, 1), PRE(6, 1), PRE(8, 4)], { status: "Completed", offerCode: "SS20", specialRequest: "Anniversary cake request" }),
  SPEC("c11", "flagship", 8, 2, [PRE(4, 1), PRE(9, 2)], { status: "Completed", hour: 13 }),
  SPEC("c12", "flagship", 30, 4, [PRE(1, 1), PRE(6, 1), PRE(7, 1)], { status: "Completed" }),
  SPEC("c13", "flagship", 55, 2, [PRE(2, 1), PRE(10, 1)], { status: "Completed" }),
  SPEC("c14", "flagship", 15, 4, [PRE(0, 2), PRE(7, 1)], { status: "Completed", offerCode: "SSFLAT150", hour: 13 }),
  // chettinad (4)
  SPEC("c2", "chettinad", 40, 4, [PRE(0, 1), PRE(3, 1), PRE(9, 2)], { status: "Completed" }),
  SPEC("c5", "chettinad", 22, 2, [PRE(4, 1), PRE(7, 1)], { status: "Completed" }),
  SPEC("c8", "chettinad", 10, 4, [PRE(5, 2), PRE(9, 2), PRE(1, 2)], { status: "Completed", hour: 13 }),
  SPEC("c12", "chettinad", 33, 6, [PRE(0, 1), PRE(1, 2), PRE(3, 1), PRE(9, 3)], { status: "Completed" }),
  // coastal (3)
  SPEC("c2", "coastal", 18, 2, [PRE(1, 1), PRE(3, 1)], { status: "Completed", offerCode: "SEA15" }),
  SPEC("c9", "coastal", 25, 4, [PRE(0, 1), PRE(4, 2), PRE(5, 1)], { status: "Completed" }),
  SPEC("c13", "coastal", 48, 2, [PRE(2, 1), PRE(8, 1)], { status: "Completed" }),
  // biryani-house (4)
  SPEC("c3", "biryani-house", 30, 2, [PRE(0, 1, "Full"), PRE(2, 1)], { status: "Completed", offerCode: "BH15" }),
  SPEC("c4", "biryani-house", 50, 4, [PRE(1, 1), PRE(3, 1), PRE(6, 1)], { status: "Completed" }),
  SPEC("c7", "biryani-house", 12, 2, [PRE(0, 1, "Full"), PRE(4, 1)], { status: "Completed", hour: 13 }),
  SPEC("c11", "biryani-house", 65, 4, [PRE(1, 1), PRE(5, 1), PRE(10, 2)], { status: "Completed" }),
  // dosa-junction (4)
  SPEC("c6", "dosa-junction", 25, 2, [PRE(0, 1), PRE(8, 1)], { status: "Completed", hour: 13 }),
  SPEC("c7", "dosa-junction", 40, 4, [PRE(1, 1), PRE(3, 1), PRE(4, 2)], { status: "Completed" }),
  SPEC("c9", "dosa-junction", 15, 2, [PRE(2, 1), PRE(6, 1)], { status: "Completed", hour: 13 }),
  SPEC("c14", "dosa-junction", 55, 4, [PRE(0, 2), PRE(5, 2)], { status: "Completed" }),
  // rooftop-pizzeria (4)
  SPEC("c4", "rooftop-pizzeria", 35, 4, [PRE(2, 1), PRE(5, 1), PRE(10, 2)], { status: "Completed", offerCode: "RTP100", specialRequest: "Rooftop seating" }),
  SPEC("c6", "rooftop-pizzeria", 20, 2, [PRE(0, 1), PRE(7, 1)], { status: "Completed" }),
  SPEC("c8", "rooftop-pizzeria", 8, 4, [PRE(3, 1), PRE(9, 1), PRE(4, 1)], { status: "Completed", hour: 13 }),
  SPEC("c13", "rooftop-pizzeria", 45, 2, [PRE(2, 1), PRE(6, 1)], { status: "Completed" }),
  // mumbai-tiffin (3)
  SPEC("c5", "mumbai-tiffin", 30, 2, [PRE(0, 1), PRE(3, 1)], { status: "Completed", hour: 13 }),
  SPEC("c8", "mumbai-tiffin", 12, 4, [PRE(1, 1), PRE(7, 1), PRE(4, 1)], { status: "Completed" }),
  SPEC("c12", "mumbai-tiffin", 50, 2, [PRE(2, 1), PRE(5, 1), PRE(3, 1)], { status: "Completed", hour: 13 }),
  // street-wok (3)
  SPEC("c5", "street-wok", 20, 2, [PRE(0, 1), PRE(3, 1)], { status: "Completed" }),
  SPEC("c9", "street-wok", 35, 4, [PRE(4, 1), PRE(7, 1), PRE(0, 2)], { status: "Completed" }),
  SPEC("c13", "street-wok", 60, 2, [PRE(1, 1), PRE(6, 1)], { status: "Completed" }),
  // madras-cafe (3)
  SPEC("c1", "madras-cafe", 22, 2, [PRE(0, 1), PRE(2, 1)], { status: "Completed", hour: 13 }),
  SPEC("c6", "madras-cafe", 40, 4, [PRE(1, 1), PRE(5, 1), PRE(6, 2)], { status: "Completed" }),
  SPEC("c10", "madras-cafe", 15, 2, [PRE(0, 1), PRE(9, 1)], { status: "Completed", hour: 13 }),
  // chai-co (3)
  SPEC("customer", "chai-co", 12, 2, [PRE(0, 1), PRE(4, 1)], { status: "Completed" }),
  SPEC("c7", "chai-co", 30, 2, [PRE(2, 1), PRE(8, 1)], { status: "Completed" }),
  SPEC("c11", "chai-co", 48, 4, [PRE(0, 2), PRE(6, 3), PRE(9, 1)], { status: "Completed" }),
  // bake-brew (3)
  SPEC("c4", "bake-brew", 18, 2, [PRE(4, 1), PRE(6, 1)], { status: "Completed" }),
  SPEC("c8", "bake-brew", 28, 2, [PRE(3, 1), PRE(7, 1)], { status: "Completed", hour: 13 }),
  SPEC("c12", "bake-brew", 45, 4, [PRE(0, 2), PRE(5, 1), PRE(10, 1)], { status: "Completed" }),
  // pune-thali (3)
  SPEC("c6", "pune-thali", 30, 4, [PRE(0, 1), PRE(2, 1), PRE(7, 1)], { status: "Completed" }),
  SPEC("c9", "pune-thali", 15, 2, [PRE(1, 1), PRE(3, 1)], { status: "Completed", hour: 13 }),
  SPEC("c13", "pune-thali", 50, 6, [PRE(0, 1), PRE(4, 1), PRE(9, 2)], { status: "Completed" }),
  // paradise-corner (3)
  SPEC("c7", "paradise-corner", 25, 2, [PRE(0, 1), PRE(8, 1)], { status: "Completed", hour: 13 }),
  SPEC("c10", "paradise-corner", 40, 4, [PRE(1, 1), PRE(3, 1), PRE(4, 2)], { status: "Completed" }),
  SPEC("c14", "paradise-corner", 12, 2, [PRE(0, 1), PRE(7, 1)], { status: "Completed", hour: 13 }),
  // green-leaf (2)
  SPEC("c2", "green-leaf", 30, 2, [PRE(0, 1), PRE(2, 1)], { status: "Completed" }),
  SPEC("c5", "green-leaf", 15, 4, [PRE(1, 1), PRE(4, 1), PRE(7, 1)], { status: "Completed", hour: 13 }),
  // kochi-spice (2)
  SPEC("c3", "kochi-spice", 35, 2, [PRE(0, 1), PRE(1, 2)], { status: "Completed" }),
  SPEC("c4", "kochi-spice", 20, 4, [PRE(2, 1), PRE(5, 1), PRE(7, 1)], { status: "Completed", hour: 13 }),
];

const CONFIRMED = [
  SPEC("c1", "flagship", -3, 2, [PRE(0, 1, "Full")], { offerCode: "SS20", specialRequest: "Prefer a quiet corner" }),
  SPEC("c2", "chettinad", -2, 4, [], { hour: 13 }),
  SPEC("c3", "biryani-house", -4, 2, [PRE(0, 1, "Full")]),
  SPEC("c4", "rooftop-pizzeria", -1, 2, [PRE(0, 1)], { hour: 20 }),
  SPEC("c5", "street-wok", -3, 2, []),
  SPEC("c6", "dosa-junction", -5, 2, [], { hour: 13 }),
  SPEC("c7", "hyderabad-dum", -6, 4, [PRE(0, 1, "Full")], { offerCode: "HYD20" }),
  SPEC("customer", "chai-co", -2, 2, [], { hour: 18 }),
];

const PENDING_BOOKINGS = [
  SPEC("c8", "green-leaf", -2, 2, []),
  SPEC("c9", "madras-cafe", -1, 2, [], { hour: 13 }),
];

const CANCELLED = [
  SPEC("c2", "coastal", -5, 2, [PRE(1, 1)], { status: "Cancelled", cancelledAtDaysAgo: 8, cancellationReason: "Family emergency, unable to make it." }),
  SPEC("c3", "biryani-house", -8, 2, [PRE(0, 1, "Full")], { status: "Cancelled", cancelledAtDaysAgo: 11, cancellationReason: "Client meeting ran late." }),
  SPEC("c10", "street-wok", -3, 2, [], { status: "Cancelled", cancelledAtDaysAgo: 5, cancellationReason: "Plans changed at the last minute." }),
  SPEC("c11", "rooftop-pizzeria", -12, 2, [PRE(0, 1)], { status: "Cancelled", cancelledAtDaysAgo: 15, cancellationReason: "Travel plans cancelled the visit." }),
  SPEC("c12", "pune-thali", -18, 2, [PRE(1, 1)], { status: "Cancelled", cancelledAtDaysAgo: 20, cancellationReason: "Sudden health issue, doctor advised rest." }),
  SPEC("c13", "dosa-junction", -25, 2, [], { status: "Cancelled", cancelledAtDaysAgo: 27, cancellationReason: "Could not reach the restaurant in time." }),
  SPEC("customer", "coastal", -3, 2, [PRE(1, 1)], { status: "Cancelled", cancelledAtDaysAgo: 4, cancellationReason: "Family plans changed at the last minute." }),
];

const NO_SHOW = [
  SPEC("c5", "mumbai-tiffin", -9, 2, [], { status: "No Show", noShow: true }),
  SPEC("c6", "chai-co", -14, 2, [], { status: "No Show", noShow: true }),
];

export { COMPLETED, CONFIRMED, PENDING_BOOKINGS, CANCELLED, NO_SHOW };

const advanceFor = (restaurant, totalAmount, offerDiscount) =>
  computeAdvanceAmount({ restaurant, totalAmount, discountAmount: offerDiscount });

const findTableFor = (ctx, restaurantKey, guests) => {
  const restaurant = ctx.restaurants.get(restaurantKey).doc;
  const restaurantTables = [];
  for (const [key, entry] of ctx.tables) {
    if (key.startsWith(`${restaurantKey}:`)) restaurantTables.push(entry);
  }
  restaurantTables.sort((a, b) => a.doc.capacity - b.doc.capacity);
  const match = restaurantTables.find((t) => t.doc.capacity >= guests) || restaurantTables[0];
  return { restaurant, table: match };
};

const buildPreOrder = (ctx, restaurantKey, pre) => {
  const menu = FOODS_SPEC[restaurantKey];
  return pre.map(({ i, q, v }) => {
    const food = ctx.foods.get(`${restaurantKey}:${menu[i].name}`).doc;
    const variants = food.variants && food.variants.length ? food.variants : [{ variantName: "Regular", price: 0 }];
    const variant = v ? variants.find((x) => x.variantName === v) : variants[0];
    const fallback = variants[0];
    const chosen = variant || fallback;
    const unitPrice = Number(chosen.price) || 0;
    return {
      foodId: food._id,
      variantName: chosen.variantName || "Regular",
      quantity: q,
      price: unitPrice,
    };
  });
};

const totalFor = (preOrderedFoods) =>
  roundAmount(preOrderedFoods.reduce((sum, item) => sum + item.price * item.quantity, 0));

const buildBookingDoc = ({ ctx, spec, bookingCode, bookingDateTime }) => {
  const customer = ctx.users.get(spec.customerKey).doc;
  const { restaurant, table } = findTableFor(ctx, spec.restaurantKey, spec.guests);
  const preOrderedFoods = buildPreOrder(ctx, spec.restaurantKey, spec.pre);
  const totalAmount = totalFor(preOrderedFoods);

  let offer = null;
  if (spec.offerCode) {
    const offerEntry = ctx.offers.get(`${spec.restaurantKey}:${spec.offerCode}`);
    offer = offerEntry ? offerEntry.doc : null;
  }
  const offerDiscount = offer
    ? computeOfferDiscount({ offer, subTotal: totalAmount })
    : 0;

  const advanceAmount = advanceFor(restaurant, totalAmount, offerDiscount);
  const cutoffAt = computeCancellationCutoffAt({ restaurant, bookingAt: bookingDateTime });

  return {
    customer,
    restaurant,
    table,
    preOrderedFoods,
    totalAmount,
    offer,
    offerDiscount,
    advanceAmount,
    cutoffAt,
  };
};

export const seedBookings = async (ctx) => {
  let codeIndex = 0;
  let createdCount = 0;
  const allSpecs = [
    ...COMPLETED.map((s) => ({ ...s, phase: "completed" })),
    ...CONFIRMED.map((s) => ({ ...s, phase: "confirmed" })),
    ...PENDING_BOOKINGS.map((s) => ({ ...s, phase: "pending" })),
    ...CANCELLED.map((s) => ({ ...s, phase: "cancelled" })),
    ...NO_SHOW.map((s) => ({ ...s, phase: "no-show" })),
  ];

  for (const spec of allSpecs) {
    codeIndex += 1;
    const bookingCode = codeFor(CODE_PREFIX.BOOKING, codeIndex);

    const bookingDateTime = spec.days < 0
      ? daysFromNow(Math.abs(spec.days), spec.hour, spec.minute)
      : daysAgo(spec.days, spec.hour, spec.minute);

    const built = buildBookingDoc({ ctx, spec, bookingCode, bookingDateTime });
    const {
      customer,
      restaurant,
      table,
      preOrderedFoods,
      totalAmount,
      offer,
      offerDiscount,
      advanceAmount,
      cutoffAt,
    } = built;

    const isCompleted = spec.status === "Completed";
    const isCancelled = spec.status === "Cancelled";
    const isNoShow = spec.status === "No Show";

    let paymentStatus = "Pending";
    let paymentMethod = "Cash";

    if (isCompleted) {
      paymentStatus = "Paid";
      paymentMethod = advanceAmount > 0 ? "UPI" : "Cash";
    } else if (isCancelled) {
      paymentStatus = advanceAmount > 0 ? "Refunded" : "Pending";
      paymentMethod = advanceAmount > 0 ? "UPI" : "Cash";
    } else if (isNoShow) {
      paymentStatus = advanceAmount > 0 ? "Partially Paid" : "Pending";
      paymentMethod = advanceAmount > 0 ? "UPI" : "Cash";
    } else if (spec.phase === "confirmed") {
      if (advanceAmount >= totalAmount && totalAmount > 0) {
        paymentStatus = "Paid";
        paymentMethod = "UPI";
      } else if (advanceAmount > 0) {
        paymentStatus = "Partially Paid";
        paymentMethod = "UPI";
      }
    }

    const completedAt = isCompleted
      ? new Date(bookingDateTime.getTime() + spec.dur * 60 * 1000)
      : null;

    const cancelledAt = isCancelled && spec.cancelledAtDaysAgo
      ? daysAgo(spec.cancelledAtDaysAgo, 14)
      : null;

    const noShowAt = isNoShow
      ? new Date(bookingDateTime.getTime() + 60 * 60 * 1000)
      : null;

    const doc = {
      bookingCode,
      userId: customer._id,
      restaurantId: restaurant._id,
      tableId: table.doc._id,
      tableIds: [table.doc._id],
      tables: [
        {
          tableId: table.doc._id,
          seatSelectionMode: SEAT_SELECTION_MODE.FULL_TABLE,
          seatIds: [],
          seatLabels: [],
        },
      ],
      seatIds: [],
      seatLabels: [],
      bookingMode: SEAT_SELECTION_MODE.FULL_TABLE,
      bookingDateTime,
      expectedDuration: spec.dur,
      numberOfGuests: spec.guests,
      bookingStatus: spec.status,
      bookingType: spec.bookingType,
      paymentStatus,
      paymentMethod,
      advanceAmount,
      totalAmount,
      specialRequest: spec.specialRequest,
      preOrderedFoods,
      sourcePaymentId: null,
      offerId: offer ? offer._id : null,
      completedAt,
      cancelledAt,
      cancellationReason: spec.cancellationReason,
      cancellationCutoffAt: cutoffAt,
      noShowAt,
      noShowConfirmedBy: isNoShow ? ctx.users.get("owner").doc._id : null,
      refundStatus: isNoShow ? "NOT_REQUIRED" : (isCancelled && advanceAmount > 0 ? "REFUND_PENDING" : null),
      refundId: null,
      isActive: true,
    };

    const { created, doc: saved } = await upsertOne(Booking, { bookingCode }, doc);
    if (created) createdCount += 1;

    const key = `${spec.restaurantKey}:${spec.customerKey}:${spec.phase}:${spec.days}`;
    ctx.bookings.set(key, { doc: saved, created, spec, built });
  }

  return { created: createdCount };
};

export default seedBookings;

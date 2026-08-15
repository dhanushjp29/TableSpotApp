const DAY_MS = 24 * 60 * 60 * 1000;

const roundAmount = (value) => Math.round((Number(value) || 0) * 100) / 100;

const atHour = (date, hour = 19, minute = 30) => {
  const d = new Date(date);
  d.setHours(hour, minute, 0, 0);
  return d;
};

const daysAgo = (days, hour = 19, minute = 30) =>
  atHour(new Date(Date.now() - Math.round(days) * DAY_MS), hour, minute);

const daysFromNow = (days, hour = 19, minute = 30) =>
  atHour(new Date(Date.now() + Math.round(days) * DAY_MS), hour, minute);

const buildSlug = (text) =>
  String(text || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const upsertOne = async (Model, query, doc) => {
  const existing = await Model.findOne(query).lean();
  if (existing) {
    const updated = await Model.findOneAndUpdate(query, { $set: doc }, { new: true });
    return { doc: updated, created: false };
  }
  const created = await Model.create(doc);
  return { doc: created, created: true };
};

const pick = (arr, seed) => {
  if (!arr || arr.length === 0) return null;
  return arr[Math.abs(Number(seed) || 0) % arr.length];
};

const makeSeats = (capacity, prefix = "S") => {
  const seats = [];
  for (let i = 1; i <= capacity; i += 1) {
    const angle = (Math.PI / 2) + ((i - 1) / Math.max(1, capacity)) * 2 * Math.PI;
    seats.push({
      seatIndex: i,
      seatLabel: `${prefix}${i}`,
      position: {
        x: Math.round((50 + 34 * Math.cos(angle)) * 10) / 10,
        y: Math.round((50 + 24 * Math.sin(angle)) * 10) / 10,
      },
    });
  }
  return seats;
};

const computeOfferDiscount = ({ offer, subTotal = 0 }) => {
  const total = roundAmount(Math.max(0, Number(subTotal) || 0));
  if (total <= 0 || !offer) return 0;

  const value = Number(offer.discountValue || 0);
  let discount = offer.discountType === "Percentage" ? (total * value) / 100 : value;
  discount = Math.min(discount, total);
  if (Number(offer.maxDiscountAmount) > 0) {
    discount = Math.min(discount, Number(offer.maxDiscountAmount));
  }
  return roundAmount(discount);
};

const computeAdvanceAmount = ({ restaurant, totalAmount, discountAmount = 0 }) => {
  const policy = restaurant?.bookingPaymentPolicy || {};
  const type = policy.type || "PAY_ON_SPOT";
  const paymentType = policy.paymentType || "FIXED_AMOUNT";
  const maximumAmount = Number(policy.maximumAmount) || 200;
  const total = roundAmount(Number(totalAmount) || 0);
  const discount = roundAmount(Math.max(0, Number(discountAmount) || 0));

  if (type !== "PAY_TO_BOOK") return 0;

  if (paymentType === "FIXED_AMOUNT") {
    return Math.min(Number(policy.fixedAmount) || 0, maximumAmount);
  }
  if (paymentType === "PERCENTAGE") {
    return Math.min(roundAmount((total * Number(policy.percentage || 0)) / 100), maximumAmount);
  }
  if (paymentType === "FULL_PREORDER") {
    return Math.max(roundAmount(total - discount), 0);
  }
  return 0;
};

const computeCancellationCutoffAt = ({ restaurant, bookingAt }) => {
  const policy = restaurant?.cancellationPolicy;
  if (!policy || !policy.isEnabled) return null;
  const hours = Number(policy.hoursBeforeBooking) || 0;
  return new Date(new Date(bookingAt).getTime() - hours * 60 * 60 * 1000);
};

export {
  DAY_MS,
  roundAmount,
  atHour,
  daysAgo,
  daysFromNow,
  buildSlug,
  upsertOne,
  pick,
  makeSeats,
  computeOfferDiscount,
  computeAdvanceAmount,
  computeCancellationCutoffAt,
};

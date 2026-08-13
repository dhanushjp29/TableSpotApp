import Booking from "../models/Booking.js";
import Offer from "../models/Offer.js";
import OfferRecipient from "../models/OfferRecipient.js";
import Restaurant from "../models/Restaurant.js";
import User from "../models/User.js";

import ApiError from "../utils/ApiError.js";
import {
  BOOKING_STATUS,
  DISCOUNT_TYPE,
  OFFER_EXPIRY_REMINDER_DAYS,
  OFFER_RECIPIENT_STATUS,
  OFFER_TARGETING,
  OFFER_USAGE_SOURCE,
} from "../utils/constants.js";
import { createNotification } from "./notification.service.js";

const roundAmount = (value) => Math.round(Number(value || 0) * 100) / 100;

const ACTIVE_RECIPIENT_STATUSES = [
  OFFER_RECIPIENT_STATUS.AVAILABLE,
  OFFER_RECIPIENT_STATUS.CLAIMED,
  OFFER_RECIPIENT_STATUS.RESERVED,
];
const CLAIMABLE_RECIPIENT_STATUSES = [
  OFFER_RECIPIENT_STATUS.AVAILABLE,
  OFFER_RECIPIENT_STATUS.CLAIMED,
];

const formatAmount = (value) =>
  `₹${roundAmount(value).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;

// ===============================
// Offer lifecycle helpers
// ===============================

export const isOfferLive = (offer) => {
  if (!offer || offer.isDeleted || offer.isActive === false) return false;

  const now = Date.now();
  const start = offer.validityStart ? new Date(offer.validityStart).getTime() : NaN;
  const end = offer.validityEnd ? new Date(offer.validityEnd).getTime() : NaN;

  if (Number.isNaN(start) || Number.isNaN(end)) return false;

  return now >= start && now <= end;
};

/**
 * Compute the effective discount for an offer against a bill subtotal.
 * Capped at the subtotal and at maxDiscountAmount when set.
 */
export const computeOfferDiscount = ({ offer, subTotal = 0 }) => {
  const total = roundAmount(Math.max(0, Number(subTotal) || 0));
  if (total <= 0) return 0;

  const value = Number(offer.discountValue || 0);
  let discount = 0;

  if (offer.discountType === DISCOUNT_TYPE.PERCENTAGE) {
    discount = (total * value) / 100;
  } else {
    discount = value;
  }

  discount = Math.min(discount, total);

  if (Number(offer.maxDiscountAmount) > 0) {
    discount = Math.min(discount, Number(offer.maxDiscountAmount));
  }

  return roundAmount(discount);
};

/**
 * Restaurant-scoped loyalty stats used for SEGMENT targeting. Only this
 * restaurant's own bookings count — a customer can never be included based on
 * activity at another restaurant. The most recent visit is captured so
 * "recent visitors" / "inactive customers" segments can be evaluated.
 */
export const getUserRestaurantStats = async ({ userId, restaurantId }) => {
  const bookings = await Booking.find({
    userId,
    restaurantId,
    isDeleted: false,
    bookingStatus: {
      $in: [
        BOOKING_STATUS.CONFIRMED,
        BOOKING_STATUS.COMPLETED,
        BOOKING_STATUS.NO_SHOW,
      ],
    },
  }).select("totalAmount bookingStatus bookingDateTime");

  const totalSpent = bookings.reduce(
    (sum, booking) => sum + Number(booking.totalAmount || 0),
    0
  );

  const dates = bookings
    .map((booking) => new Date(booking.bookingDateTime).getTime())
    .filter((t) => !Number.isNaN(t))
    .sort((a, b) => b - a);

  return {
    bookingsCount: bookings.length,
    completedBookingsCount: bookings.filter(
      (booking) => booking.bookingStatus === BOOKING_STATUS.COMPLETED
    ).length,
    totalSpent: roundAmount(totalSpent),
    lastBookingAt: dates.length > 0 ? new Date(dates[0]) : null,
  };
};

/**
 * Evaluate an offer's SEGMENT rules against a customer's restaurant stats.
 * Returns true when every configured rule passes. Callers must compute stats
 * once and reuse them (getAvailableOffers lists many offers).
 */
export const matchesSegmentRules = ({ rules = {}, stats }) => {
  const { bookingsCount, completedBookingsCount, totalSpent, lastBookingAt } =
    stats || {};

  if (Number(rules.minBookings) > 0 && bookingsCount < Number(rules.minBookings)) {
    return false;
  }

  if (
    Number(rules.minTotalSpent) > 0 &&
    totalSpent < Number(rules.minTotalSpent)
  ) {
    return false;
  }

  if (rules.hasCompletedBooking && completedBookingsCount < 1) {
    return false;
  }

  const daysSinceLastVisit =
    lastBookingAt && !Number.isNaN(new Date(lastBookingAt).getTime())
      ? (Date.now() - new Date(lastBookingAt).getTime()) / (24 * 60 * 60 * 1000)
      : Number.POSITIVE_INFINITY;

  if (
    Number(rules.recentWithinDays) > 0 &&
    daysSinceLastVisit > Number(rules.recentWithinDays)
  ) {
    return false;
  }

  if (
    Number(rules.inactiveSinceDays) > 0 &&
    daysSinceLastVisit <= Number(rules.inactiveSinceDays)
  ) {
    return false;
  }

  return true;
};

/**
 * Targeting + segment eligibility. `userId` is required for SELECTED and
 * SEGMENT; ALL offers are open to everyone.
 */
export const isUserEligibleForOffer = async ({ offer, userId }) => {
  if (!userId) return offer.targeting === OFFER_TARGETING.ALL;

  if (offer.targeting === OFFER_TARGETING.ALL) return true;

  if (offer.targeting === OFFER_TARGETING.SELECTED) {
    const targetIds = (offer.targetUserIds || []).map((id) => String(id));
    return targetIds.includes(String(userId));
  }

  if (offer.targeting === OFFER_TARGETING.SEGMENT) {
    const stats = await getUserRestaurantStats({
      userId,
      restaurantId: offer.restaurantId,
    });
    return matchesSegmentRules({
      rules: offer.segmentRules || {},
      stats,
    });
  }

  return false;
};

const assertOfferLive = (offer) => {
  if (!offer) {
    throw new ApiError(404, "Offer not found.");
  }

  if (offer.isDeleted) {
    throw new ApiError(404, "Offer not found.");
  }

  if (!isOfferLive(offer)) {
    throw new ApiError(
      409,
      "This offer is not currently active. Please check the offer validity period."
    );
  }
};

const getOfferOrThrow = async (offerId) => {
  const offer = await Offer.findById(offerId);

  if (!offer || offer.isDeleted) {
    throw new ApiError(404, "Offer not found.");
  }

  return offer;
};

const getRestaurantOwnedBy = async ({ restaurantId, ownerId }) => {
  if (!restaurantId) {
    throw new ApiError(400, "Restaurant is required.");
  }

  const restaurant = await Restaurant.findOne({
    _id: restaurantId,
    ownerId,
    isDeleted: false,
  }).select("_id restaurantName");

  if (!restaurant) {
    throw new ApiError(403, "You can only manage offers for your own restaurants.");
  }

  return restaurant;
};

const countActiveRecipients = async (offerId) =>
  OfferRecipient.countDocuments({
    offerId,
    status: { $in: ACTIVE_RECIPIENT_STATUSES },
    isDeleted: false,
  });

const countUserRedemptions = async ({ offerId, userId }) =>
  OfferRecipient.countDocuments({
    offerId,
    userId,
    status: OFFER_RECIPIENT_STATUS.USED,
    isDeleted: false,
  });

const countUserActiveRecipients = async ({ offerId, userId }) =>
  OfferRecipient.countDocuments({
    offerId,
    userId,
    status: { $in: ACTIVE_RECIPIENT_STATUSES },
    isDeleted: false,
  });

const findUserActiveRecipient = async ({ offerId, userId }) =>
  OfferRecipient.findOne({
    offerId,
    userId,
    status: { $in: ACTIVE_RECIPIENT_STATUSES },
    isDeleted: false,
  }).select("_id status bookingId");

export const attachBookingToClaimedOffer = async ({ offerId, userId, bookingId }) => {
  if (!offerId || !userId || !bookingId) return null;

  return OfferRecipient.findOneAndUpdate(
    {
      offerId,
      userId,
      status: OFFER_RECIPIENT_STATUS.CLAIMED,
      bookingId: null,
      isDeleted: false,
    },
    { $set: { bookingId, status: OFFER_RECIPIENT_STATUS.RESERVED } },
    { new: true }
  );
};

export const releaseClaimedOfferForBooking = async ({ offerId, userId, bookingId }) => {
  if (!offerId || !userId || !bookingId) return null;

  return OfferRecipient.findOneAndUpdate(
    {
      offerId,
      userId,
      bookingId,
      status: OFFER_RECIPIENT_STATUS.RESERVED,
      isDeleted: false,
    },
    {
      $set: {
        // Cancellation releases the claim; it is not an expiry or a use.
        status: OFFER_RECIPIENT_STATUS.AVAILABLE,
        bookingId: null,
        expiredAt: null,
      },
    },
    { new: true }
  );
};

const ensureCodeUniqueness = async ({ restaurantId, offerCode, excludeOfferId = null }) => {
  const query = {
    restaurantId,
    offerCode,
    isDeleted: false,
  };

  if (excludeOfferId) {
    query._id = { $ne: excludeOfferId };
  }

  const existing = await Offer.findOne(query).select("_id").lean();

  if (existing) {
    throw new ApiError(
      409,
      `Offer code "${offerCode}" is already in use for this restaurant.`
    );
  }
};

// ===============================
// Owner CRUD
// ===============================

export const createOffer = async ({ ownerId, data }) => {
  const restaurant = await getRestaurantOwnedBy({
    restaurantId: data.restaurantId,
    ownerId,
  });

  const offerCode = String(data.offerCode || "").trim().toUpperCase();

  if (!offerCode) {
    throw new ApiError(400, "Offer code is required.");
  }

  if (!/^[A-Z0-9_-]{3,30}$/.test(offerCode)) {
    throw new ApiError(
      400,
      "Offer code must be 3-30 characters using letters, numbers, underscore or dash."
    );
  }

  await ensureCodeUniqueness({ restaurantId: data.restaurantId, offerCode });

  const validityStart = new Date(data.validityStart);
  const validityEnd = new Date(data.validityEnd);

  if (validityEnd.getTime() <= validityStart.getTime()) {
    throw new ApiError(400, "Validity end must be after validity start.");
  }

  if (
    data.discountType === "Percentage" &&
    Number(data.discountValue) > 100
  ) {
    throw new ApiError(400, "Percentage discount value cannot exceed 100.");
  }

  if (data.targeting === OFFER_TARGETING.SELECTED && !data.targetUserIds?.length) {
    throw new ApiError(400, "Selected targeting requires at least one customer.");
  }

  const offer = await Offer.create({
    restaurantId: data.restaurantId,
    offerCode,
    title: String(data.title).trim(),
    description: String(data.description || "").trim(),
    discountType: data.discountType,
    discountValue: Number(data.discountValue),
    minOrderAmount: Number(data.minOrderAmount || 0),
    maxDiscountAmount: Number(data.maxDiscountAmount || 0),
    maxRedemptions: Number(data.maxRedemptions || 0),
    perUserRedemptionLimit: Number(data.perUserRedemptionLimit || 1),
    validityStart,
    validityEnd,
    targeting: data.targeting,
    segmentRules: {
      minBookings: Number(data.segmentRules?.minBookings || 0),
      minTotalSpent: Number(data.segmentRules?.minTotalSpent || 0),
      hasCompletedBooking: Boolean(data.segmentRules?.hasCompletedBooking),
      recentWithinDays: Number(data.segmentRules?.recentWithinDays || 0),
      inactiveSinceDays: Number(data.segmentRules?.inactiveSinceDays || 0),
    },
    targetUserIds: data.targetUserIds || [],
    isStackable: Boolean(data.isStackable),
    isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
    createdBy: ownerId,
  });

  // Notify manually-selected customers that a new offer is available.
  if (
    offer.targeting === OFFER_TARGETING.SELECTED &&
    Array.isArray(offer.targetUserIds) &&
    offer.targetUserIds.length > 0
  ) {
    await notifyOfferAvailable({
      offer,
      userIds: offer.targetUserIds,
    });
  }

  return {
    offer,
    message: "Offer created successfully.",
  };
};

export const updateOffer = async ({ ownerId, offerId, updates }) => {
  const offer = await getOfferOrThrow(offerId);

  if (String(offer.createdBy) !== String(ownerId) && offer.restaurantId) {
    await getRestaurantOwnedBy({ restaurantId: offer.restaurantId, ownerId });
  }

  const immutables = ["_id", "offerCode", "restaurantId", "createdBy", "stats"];

  for (const key of immutables) {
    delete updates[key];
  }

  // Existing redemptions freeze the economics of an offer so history is never
  // rewritten under customers who already used it.
  const hasRedemptions = Number(offer.stats?.totalRedemptions || 0) > 0;

  if (hasRedemptions) {
    if (updates.discountType !== undefined || updates.discountValue !== undefined) {
      throw new ApiError(
        409,
        "This offer already has redemptions; its discount cannot be changed."
      );
    }

    if (
      updates.maxRedemptions !== undefined &&
      Number(updates.maxRedemptions) < offer.stats.totalRedemptions
    ) {
      throw new ApiError(
        409,
        "Max redemptions cannot be set below the number already redeemed."
      );
    }
  }

  if (updates.validityStart !== undefined || updates.validityEnd !== undefined) {
    const validityStart = updates.validityStart
      ? new Date(updates.validityStart)
      : new Date(offer.validityStart);
    const validityEnd = updates.validityEnd
      ? new Date(updates.validityEnd)
      : new Date(offer.validityEnd);

    if (validityEnd.getTime() <= validityStart.getTime()) {
      throw new ApiError(400, "Validity end must be after validity start.");
    }
  }

  if (
    updates.targeting === OFFER_TARGETING.SELECTED &&
    !(updates.targetUserIds?.length || offer.targetUserIds?.length)
  ) {
    throw new ApiError(400, "Selected targeting requires at least one customer.");
  }

  const assignIfPresent = (field) => {
    if (updates[field] !== undefined) {
      offer[field] = updates[field];
    }
  };

  [
    "title",
    "description",
    "discountType",
    "minOrderAmount",
    "maxDiscountAmount",
    "maxRedemptions",
    "perUserRedemptionLimit",
    "targeting",
    "isStackable",
    "isActive",
  ].forEach(assignIfPresent);

  if (updates.discountValue !== undefined) {
    offer.discountValue = Number(updates.discountValue);
  }

  const effectiveDiscountType = updates.discountType ?? offer.discountType;
  const effectiveDiscountValue =
    updates.discountValue !== undefined ? Number(updates.discountValue) : Number(offer.discountValue);

  if (
    effectiveDiscountType === "Percentage" &&
    Number(effectiveDiscountValue) > 100
  ) {
    throw new ApiError(400, "Percentage discount value cannot exceed 100.");
  }

  if (updates.validityStart !== undefined) {
    offer.validityStart = new Date(updates.validityStart);
  }

  if (updates.validityEnd !== undefined) {
    offer.validityEnd = new Date(updates.validityEnd);
  }

  if (updates.segmentRules !== undefined) {
    offer.segmentRules = {
      minBookings: Number(updates.segmentRules.minBookings || 0),
      minTotalSpent: Number(updates.segmentRules.minTotalSpent || 0),
      hasCompletedBooking: Boolean(updates.segmentRules.hasCompletedBooking),
      recentWithinDays: Number(updates.segmentRules.recentWithinDays || 0),
      inactiveSinceDays: Number(updates.segmentRules.inactiveSinceDays || 0),
    };
  }

  if (updates.targetUserIds !== undefined) {
    offer.targetUserIds = updates.targetUserIds;
  }

  await offer.save();

  return {
    offer,
    message: "Offer updated successfully.",
  };
};

export const setOfferActive = async ({ ownerId, offerId, isActive }) => {
  const offer = await getOfferOrThrow(offerId);

  if (String(offer.createdBy) !== String(ownerId)) {
    await getRestaurantOwnedBy({ restaurantId: offer.restaurantId, ownerId });
  }

  offer.isActive = Boolean(isActive);
  await offer.save();

  return {
    offer,
    message: offer.isActive ? "Offer activated." : "Offer deactivated.",
  };
};

export const deleteOffer = async ({ ownerId, offerId }) => {
  const offer = await getOfferOrThrow(offerId);

  if (String(offer.createdBy) !== String(ownerId)) {
    await getRestaurantOwnedBy({ restaurantId: offer.restaurantId, ownerId });
  }

  if (Number(offer.stats?.totalRedemptions || 0) > 0) {
    throw new ApiError(
      409,
      "This offer already has redemptions and cannot be deleted. Deactivate it instead."
    );
  }

  offer.isDeleted = true;
  offer.deletedAt = new Date();
  offer.isActive = false;
  await offer.save();

  return {
    offer,
    message: "Offer deleted successfully.",
  };
};

export const getOffers = async ({ ownerId = null,
  restaurantId = null,
  page = 1,
  limit = 10,
  search = "",
  status = null,
  admin = false,
}) => {
  const query = { isDeleted: false };

  if (restaurantId) {
    if (!admin) {
      await getRestaurantOwnedBy({ restaurantId, ownerId });
    }
    query.restaurantId = restaurantId;
  } else if (ownerId && !admin) {
    const restaurants = await Restaurant.find({ ownerId, isDeleted: false })
      .select("_id")
      .lean();
    query.restaurantId = { $in: restaurants.map((r) => r._id) };
  }

  const searchTerm = String(search || "").trim().toUpperCase();

  if (searchTerm) {
    query.$or = [
      { offerCode: { $regex: new RegExp(searchTerm, "i") } },
      { title: { $regex: new RegExp(search, "i") } },
    ];
  }

  if (status === "active") {
    query.isActive = true;
  } else if (status === "inactive") {
    query.isActive = false;
  }

  const pageNumber = Math.max(Number(page) || 1, 1);
  const pageSize = Math.min(Math.max(Number(limit) || 10, 1), 100);
  const skip = (pageNumber - 1) * pageSize;

  const [offers, total] = await Promise.all([
    Offer.find(query).sort({ createdAt: -1 }).skip(skip).limit(pageSize),
    Offer.countDocuments(query),
  ]);

  return {
    offers,
    meta: {
      page: pageNumber,
      limit: pageSize,
      total,
      totalPages: Math.ceil(total / pageSize) || 1,
    },
  };
};

export const getOfferById = async ({ offerId }) => {
  const offer = await getOfferOrThrow(offerId);
  await offer.populate("restaurantId", "restaurantName address city state country");
  return { offer };
};

/**
 * Owner-facing aggregate + per-status recipient counts for one offer.
 * The statistics are always scoped to the offer (and thus its restaurant).
 */
export const getOfferStats = async ({ offerId, ownerId = null }) => {
  const offer = await getOfferOrThrow(offerId);

  if (ownerId && String(offer.createdBy) !== String(ownerId)) {
    await getRestaurantOwnedBy({ restaurantId: offer.restaurantId, ownerId });
  }

  const [available, claimed, reserved, used, expired] = await Promise.all([
    OfferRecipient.countDocuments({
      offerId,
      status: OFFER_RECIPIENT_STATUS.AVAILABLE,
      isDeleted: false,
    }),
    OfferRecipient.countDocuments({
      offerId,
      status: OFFER_RECIPIENT_STATUS.CLAIMED,
      isDeleted: false,
    }),
    OfferRecipient.countDocuments({
      offerId,
      status: OFFER_RECIPIENT_STATUS.RESERVED,
      isDeleted: false,
    }),
    OfferRecipient.countDocuments({
      offerId,
      status: OFFER_RECIPIENT_STATUS.USED,
      isDeleted: false,
    }),
    OfferRecipient.countDocuments({
      offerId,
      status: OFFER_RECIPIENT_STATUS.EXPIRED,
      isDeleted: false,
    }),
  ]);

  return {
    offer,
    counts: {
      totalRecipients: offer.stats?.totalRecipients || 0,
      available,
      claimed,
      reserved,
      used,
      expired,
      totalRedemptions: offer.stats?.totalRedemptions || 0,
      totalDiscountAmount: offer.stats?.totalDiscountAmount || 0,
    },
  };
};

export const getOfferRecipients = async ({
  offerId,
  ownerId = null,
  page = 1,
  limit = 10,
  status = null,
}) => {
  const offer = await getOfferOrThrow(offerId);

  if (ownerId && String(offer.createdBy) !== String(ownerId)) {
    await getRestaurantOwnedBy({ restaurantId: offer.restaurantId, ownerId });
  }

  const query = { offerId, isDeleted: false };

  if (status && OFFER_RECIPIENT_STATUS[status]) {
    query.status = status;
  }

  const pageNumber = Math.max(Number(page) || 1, 1);
  const pageSize = Math.min(Math.max(Number(limit) || 10, 1), 100);
  const skip = (pageNumber - 1) * pageSize;

  const [recipients, total] = await Promise.all([
    OfferRecipient.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .populate("userId", "userCode fullName email phoneNumber profileImage")
      .populate("bookingId", "bookingCode bookingStatus bookingDateTime")
      .populate("billId", "billCode grandTotal payment.paymentStatus"),
    OfferRecipient.countDocuments(query),
  ]);

  return {
    recipients,
    meta: {
      page: pageNumber,
      limit: pageSize,
      total,
      totalPages: Math.ceil(total / pageSize) || 1,
    },
  };
};

// ===============================
// Customer side
// ===============================

/**
 * Offers the logged-in customer can see/claim for a restaurant right now:
 * live, eligible (targeting/segment), and not already fully redeemed.
 */
export const getAvailableOffers = async ({
  customerId,
  restaurantId,
  page = 1,
  limit = 10,
  excludeClaimed = false,
}) => {
  // restaurantId is optional: when omitted, live offers across every active
  // restaurant are returned (each offer carries its restaurant so the UI can
  // show where it is valid).
  let restaurantIds = null;

  if (restaurantId) {
    const restaurant = await Restaurant.findById(restaurantId).select("_id");

    if (!restaurant || restaurant.isDeleted) {
      throw new ApiError(404, "Restaurant not found.");
    }
    restaurantIds = [restaurant._id];
  } else {
    const restaurants = await Restaurant.find({
      isDeleted: false,
      isActive: true,
    }).select("_id");
    restaurantIds = restaurants.map((restaurant) => restaurant._id);
  }

  const now = new Date();

  const candidates = await Offer.find({
    restaurantId: { $in: restaurantIds },
    isDeleted: false,
    isActive: true,
    validityStart: { $lte: now },
    validityEnd: { $gte: now },
  })
    .populate("restaurantId", "restaurantCode restaurantName slug city coverImage")
    .sort({ validityEnd: 1 });

  const eligible = [];
  const statsCache = new Map();

  for (const offer of candidates) {
    let allowed = false;

    if (offer.targeting === OFFER_TARGETING.ALL) {
      allowed = true;
    } else if (offer.targeting === OFFER_TARGETING.SELECTED) {
      allowed = (offer.targetUserIds || []).some(
        (id) => String(id) === String(customerId)
      );
    } else if (offer.targeting === OFFER_TARGETING.SEGMENT) {
      const offerRestaurantId = offer.restaurantId?._id || offer.restaurantId;
      const statsKey = String(offerRestaurantId);
      if (!statsCache.has(statsKey)) {
        statsCache.set(
          statsKey,
          await getUserRestaurantStats({
            userId: customerId,
            restaurantId: offerRestaurantId,
          })
        );
      }
      allowed = matchesSegmentRules({
        rules: offer.segmentRules || {},
        stats: statsCache.get(statsKey),
      });
    }

    if (!allowed) continue;

    const usedCount = await countUserRedemptions({
      offerId: offer._id,
      userId: customerId,
    });
    const activeCount = await countUserActiveRecipients({
      offerId: offer._id,
      userId: customerId,
    });
    const activeRecipient = await findUserActiveRecipient({
      offerId: offer._id,
      userId: customerId,
    });

    // Keep an existing CLAIMED offer visible so the customer can attach it
    // to the booking. Only USED redemptions consume this limit.
    if (usedCount >= offer.perUserRedemptionLimit) continue;
    if (activeRecipient?.bookingId) continue;
    if (excludeClaimed && ["CLAIMED", "RESERVED", "USED"].includes(activeRecipient?.status)) continue;

    if (offer.maxRedemptions > 0) {
      const reserved =
        (await countActiveRecipients(offer._id)) + (offer.stats?.totalRedemptions || 0);
      if (reserved >= offer.maxRedemptions && activeCount === 0) continue;
    }

    eligible.push(offer);
  }

  const pageNumber = Math.max(Number(page) || 1, 1);
  const pageSize = Math.min(Math.max(Number(limit) || 10, 1), 100);
  const startIndex = (pageNumber - 1) * pageSize;

  return {
    offers: eligible.slice(startIndex, startIndex + pageSize),
    meta: {
      page: pageNumber,
      limit: pageSize,
      total: eligible.length,
      totalPages: Math.ceil(eligible.length / pageSize) || 1,
    },
  };
};

const PUBLIC_OFFER_SELECT =
  "_id offerCode title description discountType discountValue minOrderAmount validityStart validityEnd isStackable";

/**
 * Lightweight list of currently-live offers for a restaurant's public detail
 * page. Unlike getAvailableOffers this performs no per-user targeting — the
 * customer's eligibility is evaluated at claim/bill time.
 */
export const getRestaurantActiveOffers = async ({
  restaurantId,
  limit = 10,
}) => {
  const now = new Date();

  const offers = await Offer.find({
    restaurantId,
    isDeleted: false,
    isActive: true,
    validityStart: { $lte: now },
    validityEnd: { $gte: now },
  })
    .select(PUBLIC_OFFER_SELECT)
    .sort({ validityEnd: 1 })
    .limit(Math.min(Math.max(Number(limit) || 10, 1), 50));

  return { offers };
};

/**
 * Notify a set of customers that an offer is now available for them. Used for
 * manually-selected (SELECTED) offers at creation time.
 */
export const notifyOfferAvailable = async ({ offer, userIds = [] }) => {
  if (!offer || !Array.isArray(userIds) || userIds.length === 0) return 0;

  let count = 0;
  const seen = new Set();

  for (const userId of userIds) {
    if (seen.has(String(userId))) continue;
    seen.add(String(userId));

    try {
      await createNotification({
        userId,
        title: "New Offer Available",
        message: `A new offer ${offer.offerCode} (${offer.title}) is available at your restaurant. Claim it before it expires!`,
        type: "Offer",
        linkId: offer._id,
        linkModel: "Offer",
      });
      count += 1;
    } catch (error) {
      console.error("Notification error on offer available:", error.message);
    }
  }

  return count;
};

/**
 * Claim an offer for the logged-in customer. Idempotent: claiming an already
 * claimed offer returns the existing recipient.
 */
export const claimOffer = async ({ customerId, offerId }) => {
  const offer = await getOfferOrThrow(offerId);
  assertOfferLive(offer);

  const eligible = await isUserEligibleForOffer({ offer, userId: customerId });

  if (!eligible) {
    throw new ApiError(403, "This offer is not available to you.");
  }

  // Repeated explicit claims are idempotent while the existing claim is
  // active. The active recipient still counts against the limit for booking
  // and availability validation; this only preserves claim API semantics.
  const existingActiveRecipient = await OfferRecipient.findOne({
    offerId: offer._id,
    userId: customerId,
    status: { $in: ACTIVE_RECIPIENT_STATUSES },
    isDeleted: false,
  });

  if (existingActiveRecipient?.status === OFFER_RECIPIENT_STATUS.CLAIMED) {
    return {
      offer,
      recipient: existingActiveRecipient,
      message: "Offer already claimed.",
    };
  }

  const usedCount = await countUserRedemptions({
    offerId: offer._id,
    userId: customerId,
  });

  const activeCount = await countUserActiveRecipients({
    offerId: offer._id,
    userId: customerId,
  });
  const activeRecipient = await findUserActiveRecipient({
    offerId: offer._id,
    userId: customerId,
  });

  if (activeRecipient?.bookingId) {
    throw new ApiError(409, "This offer is already attached to another booking.");
  }

  if (usedCount >= offer.perUserRedemptionLimit) {
    throw new ApiError(409, "You have already used this offer.");
  }

  if (offer.maxRedemptions > 0) {
    const reserved = (await countActiveRecipients(offer._id)) + (offer.stats?.totalRedemptions || 0);

    if (reserved >= offer.maxRedemptions && activeCount === 0) {
      throw new ApiError(409, "This offer has no remaining slots.");
    }
  }

  let recipient = await OfferRecipient.findOne({
    offerId: offer._id,
    userId: customerId,
    status: { $in: ACTIVE_RECIPIENT_STATUSES },
    isDeleted: false,
  });

  const wasCreated = !recipient;

  if (!recipient) {
    try {
      recipient = await OfferRecipient.create({
        offerId: offer._id,
        restaurantId: offer.restaurantId,
        userId: customerId,
        status: OFFER_RECIPIENT_STATUS.CLAIMED,
        claimedAt: new Date(),
      });
    } catch (error) {
      if (error?.code === 11000) {
        recipient = await OfferRecipient.findOne({
          offerId: offer._id,
          userId: customerId,
          status: { $in: ACTIVE_RECIPIENT_STATUSES },
          isDeleted: false,
        });
      } else {
        throw error;
      }
    }
  } else {
    recipient.status = OFFER_RECIPIENT_STATUS.CLAIMED;
    recipient.claimedAt = new Date();
    await recipient.save();
  }

  const statsIncrement = wasCreated
    ? { "stats.totalRecipients": 1, "stats.totalClaims": 1 }
    : { "stats.totalClaims": 1 };

  await Offer.findByIdAndUpdate(offer._id, { $inc: statsIncrement });

  try {
    await createNotification({
      userId: customerId,
      title: "Offer Claimed",
      message: `You claimed ${offer.offerCode} (${offer.title}). Apply it when you book or dine at the restaurant.`,
      type: "Offer",
      linkId: offer._id,
      linkModel: "Offer",
    });
  } catch (error) {
    console.error("Notification error on offer claimed:", error.message);
  }

  if (offer.createdBy) {
    try {
      await createNotification({
        userId: offer.createdBy,
        title: "Offer Claimed",
        message: `A customer claimed ${offer.offerCode} (${offer.title}).`,
        type: "Offer",
        linkId: offer._id,
        linkModel: "Offer",
      });
    } catch (error) {
      console.error("Owner notification error on offer claimed:", error.message);
    }
  }

  return {
    offer,
    recipient,
    message: "Offer claimed successfully.",
  };
};

/**
 * Offers the customer has already claimed/used, across all restaurants.
 */
export const getMyOffers = async ({
  customerId,
  page = 1,
  limit = 10,
  status = null,
}) => {
  const query = { userId: customerId, isDeleted: false };

  if (status && OFFER_RECIPIENT_STATUS[status]) {
    query.status = status;
  }

  const pageNumber = Math.max(Number(page) || 1, 1);
  const pageSize = Math.min(Math.max(Number(limit) || 10, 1), 100);
  const skip = (pageNumber - 1) * pageSize;

  const [recipients, total] = await Promise.all([
    OfferRecipient.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .populate({
        path: "offerId",
        select:
          "offerCode title description discountType discountValue minOrderAmount maxDiscountAmount validityStart validityEnd targeting isActive isDeleted",
      })
      .populate("restaurantId", "restaurantCode restaurantName slug city coverImage")
      .populate("billId", "billCode grandTotal payment.paymentStatus"),
    OfferRecipient.countDocuments(query),
  ]);

  return {
    offers: recipients,
    meta: {
      page: pageNumber,
      limit: pageSize,
      total,
      totalPages: Math.ceil(total / pageSize) || 1,
    },
  };
};

/**
 * Validate + auto-claim an offer at booking time. Used by the booking and
 * payment services so a claimed offer is guaranteed to be on record before a
 * booking is created. Returns the offer snapshot to store on the booking.
 */
export const validateClaimedOfferForBooking = async ({
  customerId,
  restaurantId,
  offerId,
  subTotal = 0,
}) => {
  if (!offerId) return null;

  const offer = await getOfferOrThrow(offerId);

  if (String(offer.restaurantId) !== String(restaurantId)) {
    throw new ApiError(400, "This offer does not belong to the selected restaurant.");
  }

  assertOfferLive(offer);

  if (
    Number(offer.minOrderAmount) > 0 &&
    Number(subTotal) < Number(offer.minOrderAmount)
  ) {
    throw new ApiError(
      409,
      `This offer requires a minimum order of ${formatAmount(offer.minOrderAmount)}.`
    );
  }

  const eligible = await isUserEligibleForOffer({ offer, userId: customerId });

  if (!eligible) {
    throw new ApiError(403, "This offer is not available to you.");
  }

  const usedCount = await countUserRedemptions({
    offerId: offer._id,
    userId: customerId,
  });
  const activeCount = await countUserActiveRecipients({
    offerId: offer._id,
    userId: customerId,
  });
  const activeRecipient = await findUserActiveRecipient({
    offerId: offer._id,
    userId: customerId,
  });

  if (activeRecipient?.bookingId) {
    throw new ApiError(409, "This offer is already attached to another booking.");
  }

  // An existing active claim is the slot being attached to this booking;
  // it must not be rejected as if it were an additional redemption.
  if (usedCount >= offer.perUserRedemptionLimit) {
    throw new ApiError(409, "You have already used this offer.");
  }

  if (offer.maxRedemptions > 0) {
    const reserved = (await countActiveRecipients(offer._id)) + (offer.stats?.totalRedemptions || 0);

    if (reserved >= offer.maxRedemptions && activeCount === 0) {
      throw new ApiError(409, "This offer has no remaining slots.");
    }
  }

  let recipient = await OfferRecipient.findOne({
    offerId: offer._id,
    userId: customerId,
    status: { $in: ACTIVE_RECIPIENT_STATUSES },
    isDeleted: false,
  });

  if (!recipient) {
    try {
      recipient = await OfferRecipient.create({
        offerId: offer._id,
        restaurantId: offer.restaurantId,
        userId: customerId,
        status: OFFER_RECIPIENT_STATUS.CLAIMED,
        claimedAt: new Date(),
      });
      await Offer.findByIdAndUpdate(offer._id, {
        $inc: { "stats.totalRecipients": 1, "stats.totalClaims": 1 },
      });
      try {
        await createNotification({
          userId: customerId,
          title: "Offer Claimed",
          message: `You claimed ${offer.offerCode} (${offer.title}). It will be applied to your booking.`,
          type: "Offer",
          linkId: offer._id,
          linkModel: "Offer",
        });
      } catch (error) {
        console.error("Notification error on auto-claimed offer:", error.message);
      }
    } catch (error) {
      if (error?.code === 11000) {
        recipient = await OfferRecipient.findOne({
          offerId: offer._id,
          userId: customerId,
          status: { $in: ACTIVE_RECIPIENT_STATUSES },
          isDeleted: false,
        });
      } else {
        throw error;
      }
    }
  }

  return {
    offerId: offer._id,
    offerCode: offer.offerCode,
    title: offer.title,
    discountType: offer.discountType,
    discountValue: offer.discountValue,
    minOrderAmount: offer.minOrderAmount,
    maxDiscountAmount: offer.maxDiscountAmount,
    isStackable: offer.isStackable,
  };
};

// ===============================
// Bill integration (walk-in + online)
// ===============================

/**
 * Resolve an offer against a bill's subtotal. For ONLINE usage the customer
 * must already hold a CLAIMED/AVAILABLE recipient for the offer. For WALK_IN,
 * private offers (SELECTED/SEGMENT) require an email that resolves to a real
 * account eligible for the offer. Public ALL offers may be used by code alone;
 * a provided email that matches an account is linked to it, otherwise the
 * email is recorded on the recipient for anonymous usage tracking.
 * Returns the offer, discount and the identity to mark USED.
 */
export const resolveOfferForBill = async ({
  restaurantId,
  offerId = null,
  offerCode = null,
  customerId = null,
  customerEmail = "",
  subTotal = 0,
  bookingId = null,
  usageSource = OFFER_USAGE_SOURCE.WALK_IN,
}) => {
  let offer = null;

  if (offerId) {
    offer = await Offer.findById(offerId);
  } else if (offerCode) {
    const code = String(offerCode || "").trim().toUpperCase();
    offer = await Offer.findOne({
      restaurantId,
      offerCode: code,
      isDeleted: false,
    });
  }

  if (!offer || offer.isDeleted) {
    throw new ApiError(404, "Offer not found for the given code.");
  }

  if (String(offer.restaurantId) !== String(restaurantId)) {
    throw new ApiError(400, "This offer does not belong to this restaurant.");
  }

  assertOfferLive(offer);

  if (Number(offer.minOrderAmount) > 0 && Number(subTotal) < Number(offer.minOrderAmount)) {
    throw new ApiError(
      409,
      `This offer requires a minimum bill of ${formatAmount(offer.minOrderAmount)}.`
    );
  }

  let resolvedCustomerId = customerId || null;
  let resolvedEmail = "";

  if (usageSource === OFFER_USAGE_SOURCE.WALK_IN) {
    const email = String(customerEmail || "").trim().toLowerCase();

    if (offer.targeting !== OFFER_TARGETING.ALL && !email) {
      throw new ApiError(
        400,
        "This offer requires a customer email to be applied."
      );
    }

    if (email) {
      const user = await User.findOne({
        email,
        isDeleted: false,
        isActive: true,
      }).select("_id email");

      if (user) {
        resolvedCustomerId = user._id;
        resolvedEmail = email;
      } else if (offer.targeting !== OFFER_TARGETING.ALL) {
        throw new ApiError(
          403,
          "This offer is only available to invited customers with a TableSpot account."
        );
      } else {
        // Unknown email + public offer: allowed. The email is recorded on the
        // recipient so usage is tracked without falsely linking another user.
        resolvedEmail = email;
      }
    }
  }

  if (resolvedCustomerId) {
    const eligible = await isUserEligibleForOffer({
      offer,
      userId: resolvedCustomerId,
    });

    if (!eligible) {
      throw new ApiError(403, "This offer is not available to this customer.");
    }
  }

  const discountAmount = computeOfferDiscount({ offer, subTotal });

  if (discountAmount <= 0) {
    throw new ApiError(409, "This offer cannot be applied to this bill.");
  }

  if (resolvedCustomerId) {
    const usedCount = await countUserRedemptions({
      offerId: offer._id,
      userId: resolvedCustomerId,
    });

    if (usedCount >= offer.perUserRedemptionLimit) {
      throw new ApiError(409, "This customer has already used this offer.");
    }

    if (usageSource === OFFER_USAGE_SOURCE.ONLINE) {
      if (!bookingId) {
        throw new ApiError(409, "A booking is required to use this offer online.");
      }

      const reservedRecipient = await OfferRecipient.findOne({
        offerId: offer._id,
        userId: resolvedCustomerId,
        bookingId,
        status: OFFER_RECIPIENT_STATUS.RESERVED,
        isDeleted: false,
      });

      if (!reservedRecipient) {
        throw new ApiError(409, "This offer is not reserved for the selected booking.");
      }
    }
  } else if (resolvedEmail) {
    // Anonymous walk-in: enforce the per-user limit against the recorded email
    // so the same address cannot repeatedly consume a public offer.
    const usedByEmail = await OfferRecipient.countDocuments({
      offerId: offer._id,
      userId: null,
      email: resolvedEmail,
      status: OFFER_RECIPIENT_STATUS.USED,
      isDeleted: false,
    });

    if (usedByEmail >= offer.perUserRedemptionLimit) {
      throw new ApiError(409, "This offer has already been used for this email.");
    }
  }

  return {
    offer,
    customerId: resolvedCustomerId,
    discountAmount,
    email: resolvedEmail,
  };
};

/**
 * Atomically consume a usage slot and mark a recipient USED against a bill.
 * Idempotent per (offer, bill): a bill already carrying this offer is a no-op.
 */
export const applyOfferToBill = async ({
  bill,
  offer,
  customerId = null,
  email = "",
  discountAmount = 0,
  usageSource = OFFER_USAGE_SOURCE.WALK_IN,
  bookingId = null,
}) => {
  if (!bill) {
    throw new ApiError(500, "Bill context is required to apply an offer.");
  }

  if (
    bill.offer?.offerId &&
    String(bill.offer.offerId) !== String(offer._id)
  ) {
    throw new ApiError(409, "This bill already has an offer applied.");
  }

  let recipient = await OfferRecipient.findOne({
    offerId: offer._id,
    ...(customerId ? { userId: customerId } : { userId: null }),
    ...(customerId ? {} : email ? { email } : {}),
    status: OFFER_RECIPIENT_STATUS.USED,
    billId: bill._id,
    isDeleted: false,
  });

  if (recipient) {
    return { applied: false, bill };
  }

  if (usageSource === OFFER_USAGE_SOURCE.ONLINE && customerId) {
      recipient = await OfferRecipient.findOne({
        offerId: offer._id,
        userId: customerId,
        bookingId,
        status: OFFER_RECIPIENT_STATUS.RESERVED,
        isDeleted: false,
      });
  } else {
    recipient = await OfferRecipient.findOne({
      offerId: offer._id,
      ...(customerId ? { userId: customerId } : { userId: null }),
      ...(customerId ? {} : email ? { email } : {}),
      status: { $in: CLAIMABLE_RECIPIENT_STATUSES },
      isDeleted: false,
    });
  }

  let wasCreated = false;

  if (usageSource === OFFER_USAGE_SOURCE.ONLINE && customerId && !recipient) {
    throw new ApiError(409, "This offer is not reserved for the selected booking.");
  }

  if (!recipient) {
    wasCreated = true;
    try {
      recipient = await OfferRecipient.create({
        offerId: offer._id,
        restaurantId: offer.restaurantId,
        userId: customerId || null,
        email: String(email || "").trim().toLowerCase(),
        status: OFFER_RECIPIENT_STATUS.AVAILABLE,
      });
    } catch (error) {
      if (error?.code === 11000) {
        recipient = await OfferRecipient.findOne({
          offerId: offer._id,
          ...(customerId ? { userId: customerId } : { userId: null }),
          ...(customerId ? {} : email ? { email } : {}),
          status: { $in: ACTIVE_RECIPIENT_STATUSES },
          isDeleted: false,
        });
      } else {
        throw error;
      }
    }
  }

  let statsUpdated = false;

  try {
    if (offer.maxRedemptions > 0) {
      const updated = await Offer.findOneAndUpdate(
        { _id: offer._id, "stats.totalRedemptions": { $lt: offer.maxRedemptions } },
        {
          $inc: {
            "stats.totalRedemptions": 1,
            "stats.totalDiscountAmount": discountAmount,
            ...(wasCreated ? { "stats.totalRecipients": 1 } : {}),
          },
        },
        { new: true }
      );

      if (!updated) {
        throw new ApiError(409, "This offer has reached its total redemption limit.");
      }
    } else {
      const increment = {
        "stats.totalRedemptions": 1,
        "stats.totalDiscountAmount": discountAmount,
        ...(wasCreated ? { "stats.totalRecipients": 1 } : {}),
      };
      await Offer.findByIdAndUpdate(offer._id, { $inc: increment });
    }

    statsUpdated = true;

    // Atomically consume the recipient's active slot. When two requests race
    // to use the same single-use CLAIMED/AVAILABLE recipient, only the first
    // update wins; the loser throws and rolls the bill's offer back.
    const claimedSlot = await OfferRecipient.findOneAndUpdate(
      {
        _id: recipient._id,
        ...(usageSource === OFFER_USAGE_SOURCE.ONLINE
          ? { status: OFFER_RECIPIENT_STATUS.RESERVED, bookingId }
          : { status: { $in: CLAIMABLE_RECIPIENT_STATUSES } }),
        isDeleted: false,
      },
      {
        $set: {
          status: OFFER_RECIPIENT_STATUS.USED,
          usedAt: new Date(),
          bookingId: bookingId || recipient.bookingId || null,
          billId: bill._id,
          discountAmount,
          usageSource,
        },
      },
      { new: true }
    );

    if (!claimedSlot) {
      throw new ApiError(409, "This offer has already been consumed.");
    }

    recipient = claimedSlot;
  } catch (error) {
    if (statsUpdated) {
      try {
        await Offer.findByIdAndUpdate(offer._id, {
          $inc: {
            "stats.totalRedemptions": -1,
            "stats.totalDiscountAmount": -discountAmount,
            ...(wasCreated ? { "stats.totalRecipients": -1 } : {}),
          },
        });
      } catch (rollbackError) {
        console.error("Offer stats rollback error:", rollbackError.message);
      }
    }
    throw error;
  }

  if (recipient.userId) {
    try {
      await createNotification({
        userId: recipient.userId,
        title: "Offer Used",
        message: `Your offer ${offer.offerCode} (${offer.title}) worth ${formatAmount(discountAmount)} was applied to your bill.`,
        type: "Offer",
        linkId: bill._id,
        linkModel: "Bill",
      });
    } catch (error) {
      console.error("Notification error on offer used:", error.message);
    }
  }

  if (offer.createdBy) {
    try {
      await createNotification({
        userId: offer.createdBy,
        title: "Offer Used",
        message: `Offer ${offer.offerCode} (${offer.title}) worth ${formatAmount(discountAmount)} was used by a customer.`,
        type: "Offer",
        linkId: bill._id,
        linkModel: "Bill",
      });
    } catch (error) {
      console.error("Owner notification error on offer used:", error.message);
    }
  }

  return { applied: true, bill, recipient };
};

/**
 * Snapshot payload stored on the Bill once an offer is applied.
 */
export const buildOfferSnapshot = ({ offer, discountAmount, appliedAt = new Date() }) => ({
  offerId: offer._id,
  offerCode: offer.offerCode,
  title: offer.title,
  discountType: offer.discountType,
  discountValue: offer.discountValue,
  discountAmount: roundAmount(discountAmount),
  isStackable: Boolean(offer.isStackable),
  appliedAt,
});

// ===============================
// Expiry reminders (cron)
// ===============================

/**
 * Notify customers once that an offer they claimed is about to expire.
 * Returns the number of notifications sent.
 */
export const notifyOffersExpiringSoon = async ({ log = console } = {}) => {
  const now = new Date();
  const horizonMs = OFFER_EXPIRY_REMINDER_DAYS * 24 * 60 * 60 * 1000;

  const expiringOffers = await Offer.find({
    isDeleted: false,
    isActive: true,
    validityStart: { $lte: now },
    validityEnd: { $gt: now, $lte: new Date(now.getTime() + horizonMs) },
  })
    .select("_id offerCode title validityEnd restaurantId")
    .lean();

  let count = 0;

  for (const offer of expiringOffers) {
    const recipients = await OfferRecipient.find({
      offerId: offer._id,
      userId: { $ne: null },
      status: { $in: ACTIVE_RECIPIENT_STATUSES },
      isDeleted: false,
    })
      .select("userId")
      .lean();

    const seen = new Set();

    for (const recipient of recipients) {
      if (seen.has(String(recipient.userId))) continue;
      seen.add(String(recipient.userId));

      try {
        await createNotification({
          userId: recipient.userId,
          title: "Offer Expiring Soon",
          message: `Your offer ${offer.offerCode} (${offer.title}) expires on ${new Date(offer.validityEnd).toLocaleDateString()}. Use it before it's gone!`,
          type: "Offer",
          linkId: offer._id,
          linkModel: "Offer",
        });
        count += 1;
      } catch (error) {
        log.error?.(
          `[offer-expiry] Notification failed for ${offer.offerCode}:`,
          error.message
        );
      }
    }
  }

  return count;
};

/**
 * Move CLAIMED/AVAILABLE recipients of expired offers to EXPIRED and notify
 * the customers. Returns the number of recipients expired.
 */
export const expireOffersAndNotify = async ({ log = console } = {}) => {
  const now = new Date();

  const expiredOffers = await Offer.find({
    isDeleted: false,
    validityEnd: { $lt: now },
  })
    .select("_id offerCode title restaurantId")
    .lean();

  let count = 0;

  for (const offer of expiredOffers) {
    const recipients = await OfferRecipient.find({
      offerId: offer._id,
      status: { $in: ACTIVE_RECIPIENT_STATUSES },
      isDeleted: false,
    }).select("userId email");

    const updated = await OfferRecipient.updateMany(
      {
        offerId: offer._id,
        status: { $in: ACTIVE_RECIPIENT_STATUSES },
        isDeleted: false,
      },
      {
        $set: {
          status: OFFER_RECIPIENT_STATUS.EXPIRED,
          expiredAt: new Date(),
        },
      }
    );

    count += updated.modifiedCount || 0;

    const seen = new Set();

    for (const recipient of recipients) {
      if (!recipient.userId || seen.has(String(recipient.userId))) continue;
      seen.add(String(recipient.userId));

      try {
        await createNotification({
          userId: recipient.userId,
          title: "Offer Expired",
          message: `Your offer ${offer.offerCode} (${offer.title}) has expired. Check out the latest offers at the restaurant!`,
          type: "Offer",
          linkId: offer._id,
          linkModel: "Offer",
        });
      } catch (error) {
        log.error?.(
          `[offer-expired] Notification failed for ${offer.offerCode}:`,
          error.message
        );
      }
    }
  }

  return count;
};

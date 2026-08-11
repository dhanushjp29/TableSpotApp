import Booking from "../models/Booking.js";
import Bill from "../models/Bill.js";
import Payment from "../models/Payment.js";
import Refund from "../models/Refund.js";
import Offer from "../models/Offer.js";
import OfferRecipient from "../models/OfferRecipient.js";
import RestaurantReview from "../models/RestaurantReview.js";
import FoodReview from "../models/FoodReview.js";
import RestaurantTable from "../models/RestaurantTable.js";
import Restaurant from "../models/Restaurant.js";
import User from "../models/User.js";
import ApiError from "../utils/ApiError.js";
import { getOwnedRestaurantIds } from "../middleware/ownership.js";
import {
  BILL_STATUS,
  BOOKING_STATUS,
  OFFER_RECIPIENT_STATUS,
  PAYMENT_TRANSACTION_STATUS,
  PAYMENT_STATUS,
  REFUND_STATUS,
} from "../utils/constants.js";

const TZ = "Asia/Kolkata";
const REVENUE_BILL_STATUSES = [BILL_STATUS.GENERATED, BILL_STATUS.PAID];
const DAY_MS = 24 * 60 * 60 * 1000;

const WEEKDAY_BY_NUM = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const round = (n, digits = 2) => {
  const value = Number(n) || 0;
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

const pct = (part, whole) => {
  const value = Number(whole);
  if (!value) return null;
  return round((Number(part) / value) * 100, 1);
};

const changePct = (current, previous) => {
  const prev = Number(previous);
  if (!prev) return null;
  return round(((Number(current) - prev) / prev) * 100, 1);
};

const startOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfDay = (date) => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

const dateToString = (d) => {
  const date = new Date(d);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
};

const padDateString = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

const statusLabel = {
  [REFUND_STATUS.REFUND_PENDING]: "Pending",
  [REFUND_STATUS.REFUND_PROCESSING]: "Processing",
  [REFUND_STATUS.REFUND_AWAITING_CUSTOMER_CONFIRMATION]: "Awaiting Confirmation",
  [REFUND_STATUS.REFUNDED]: "Refunded",
  [REFUND_STATUS.REFUND_OVERDUE]: "Overdue",
  [REFUND_STATUS.REFUND_FAILED]: "Failed",
  [REFUND_STATUS.REFUND_DISPUTED]: "Disputed",
};

const arrayToMap = (arr) =>
  (arr || []).reduce((acc, item) => {
    acc[item._id] = item;
    return acc;
  }, {});

/**
 * Resolve the restaurant scope for an owner/admin request.
 * - owner: owned restaurant ids (or a single owned restaurant)
 * - admin: any (or the requested one)
 */
const resolveScope = async ({ req, restaurantId }) => {
  const ownedIds = await getOwnedRestaurantIds(req);
  let ids = ownedIds;

  if (restaurantId && restaurantId !== "all") {
    if (ownedIds && !ownedIds.some((id) => String(id) === String(restaurantId))) {
      throw new ApiError(403, "You do not have permission for this restaurant.");
    }
    ids = [restaurantId];
  } else if (!restaurantId || restaurantId === "all") {
    ids = ownedIds;
  }

  const scopeMatch = ids && ids.length ? { restaurantId: { $in: ids } } : {};
  return { ids, scopeMatch };
};

/**
 * Parse startDate/endDate (YYYY-MM-DD) into a { from, to } inclusive range.
 * Defaults to the last 30 days.
 */
const resolveDateRange = ({ startDate, endDate }) => {
  const to = endDate ? endOfDay(new Date(`${endDate}T23:59:59`)) : endOfDay(new Date());
  const from = startDate
    ? startOfDay(new Date(`${startDate}T00:00:00`))
    : new Date(to.getTime() - 29 * DAY_MS);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new ApiError(400, "Invalid date range. Use YYYY-MM-DD dates.");
  }

  const rangeMs = to.getTime() - from.getTime();
  const prevFrom = new Date(from.getTime() - rangeMs - DAY_MS);
  const prevTo = new Date(from.getTime() - DAY_MS);

  return { from, to, prevFrom, prevTo };
};

const hourOfBooking = {
  $hour: { date: "$bookingDateTime", timezone: TZ },
};

const dayOfWeekBooking = {
  $dayOfWeek: { date: "$bookingDateTime", timezone: TZ },
};

const dateStringBooking = (format) => ({
  $dateToString: { format, date: "$bookingDateTime", timezone: TZ },
});

const dateStringBill = (format) => ({
  $dateToString: { format, date: "$createdAt", timezone: TZ },
});

const buildBookingAnalytics = async ({ scopeMatch, from, to }) => {
  const match = { ...scopeMatch, isDeleted: false, bookingDateTime: { $gte: from, $lte: to } };

  const [data] = await Booking.aggregate([
    { $match: match },
    {
      $facet: {
        overview: [
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              totalGuests: { $sum: { $ifNull: ["$numberOfGuests", 0] } },
              totalDuration: { $sum: { $ifNull: ["$expectedDuration", 0] } },
              customers: { $addToSet: "$userId" },
            },
          },
        ],
        byStatus: [{ $group: { _id: "$bookingStatus", count: { $sum: 1 } } }],
        byType: [{ $group: { _id: "$bookingType", count: { $sum: 1 } } }],
        byHour: [{ $group: { _id: hourOfBooking, count: { $sum: 1 } } }],
        byWeekday: [{ $group: { _id: dayOfWeekBooking, count: { $sum: 1 } } }],
        daily: [
          {
            $group: {
              _id: dateStringBooking("%Y-%m-%d"),
              count: { $sum: 1 },
              completed: {
                $sum: { $cond: [{ $eq: ["$bookingStatus", BOOKING_STATUS.COMPLETED] }, 1, 0] },
              },
              cancelled: {
                $sum: { $cond: [{ $eq: ["$bookingStatus", BOOKING_STATUS.CANCELLED] }, 1, 0] },
              },
            },
          },
        ],
        customers: [
          { $group: { _id: "$userId", bookings: { $sum: 1 } } },
          { $sort: { bookings: -1 } },
        ],
      },
    },
  ]);

  const overview = data?.overview?.[0] || {};
  const byStatus = (data?.byStatus || []).reduce((acc, s) => {
    acc[s._id || "Unknown"] = s.count;
    return acc;
  }, {});
  const byType = (data?.byType || []).reduce((acc, t) => {
    acc[t._id || "Unknown"] = t.count;
    return acc;
  }, {});
  const byHour = (data?.byHour || []).map((h) => ({ hour: h._id, count: h.count }));
  const byWeekday = (data?.byWeekday || []).map((w) => ({ day: w._id, count: w.count }));
  const dailyMap = arrayToMap(data?.daily || []);

  const total = overview.total || 0;
  const completed = byStatus[BOOKING_STATUS.COMPLETED] || 0;

  return {
    total,
    completed,
    cancelled: byStatus[BOOKING_STATUS.CANCELLED] || 0,
    pending: byStatus[BOOKING_STATUS.PENDING] || 0,
    confirmed: byStatus[BOOKING_STATUS.CONFIRMED] || 0,
    noShow: byStatus[BOOKING_STATUS.NO_SHOW] || 0,
    online: byType.Online || 0,
    walkIn: byType["Walk-In"] || 0,
    avgGuests: total ? round(overview.totalGuests / total, 1) : 0,
    avgDuration: total ? round(overview.totalDuration / total, 0) : 0,
    completionRate: pct(completed, total),
    cancellationRate: pct(byStatus[BOOKING_STATUS.CANCELLED] || 0, total),
    distinctCustomers: (overview.customers || []).filter(Boolean).length,
    peakHour: byHour.length ? byHour.sort((a, b) => b.count - a.count)[0].hour : null,
    busiestDay: byWeekday.length
      ? WEEKDAY_BY_NUM[byWeekday.sort((a, b) => b.count - a.count)[0].day - 1] || null
      : null,
    byStatus: Object.entries(byStatus).map(([key, count]) => ({ status: key, count })),
    byType: Object.entries(byType).map(([key, count]) => ({ type: key, count })),
    byHour,
    byWeekday,
    daily: data?.daily || [],
    dailyMap,
    customers: data?.customers || [],
  };
};

const buildBillAnalytics = async ({ scopeMatch, from, to }) => {
  const match = { ...scopeMatch, isDeleted: false, createdAt: { $gte: from, $lte: to } };
  const inRevenue = { $in: ["$billStatus", REVENUE_BILL_STATUSES] };

  const [data] = await Bill.aggregate([
    { $match: match },
    {
      $facet: {
        overview: [
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              billed: { $sum: { $cond: [inRevenue, 1, 0] } },
              paid: {
                $sum: { $cond: [{ $eq: ["$payment.paymentStatus", PAYMENT_STATUS.PAID] }, 1, 0] },
              },
              partial: {
                $sum: {
                  $cond: [{ $eq: ["$payment.paymentStatus", PAYMENT_STATUS.PARTIALLY_PAID] }, 1, 0],
                },
              },
              pending: {
                $sum: { $cond: [{ $eq: ["$payment.paymentStatus", PAYMENT_STATUS.PENDING] }, 1, 0] },
              },
              cancelled: {
                $sum: { $cond: [{ $eq: ["$billStatus", BILL_STATUS.CANCELLED] }, 1, 0] },
              },
              draft: { $sum: { $cond: [{ $eq: ["$billStatus", BILL_STATUS.DRAFT] }, 1, 0] } },
              online: { $sum: { $cond: [{ $eq: ["$billType", "Online"] }, 1, 0] } },
              walkIn: { $sum: { $cond: [{ $eq: ["$billType", "Walk-In"] }, 1, 0] } },
              gross: { $sum: { $cond: [inRevenue, "$grandTotal", 0] } },
              totalPaid: { $sum: { $cond: [inRevenue, "$payment.totalPaid", 0] } },
              balanceDue: { $sum: { $cond: [inRevenue, "$payment.balanceDue", 0] } },
              subtotal: { $sum: { $cond: [inRevenue, "$subTotal", 0] } },
              manualDiscount: { $sum: { $cond: [inRevenue, "$discount.value", 0] } },
              offerDiscount: { $sum: { $cond: [inRevenue, "$offer.discountAmount", 0] } },
              tax: { $sum: { $cond: [inRevenue, "$taxAmount", 0] } },
              serviceCharge: { $sum: { $cond: [inRevenue, "$serviceCharge", 0] } },
              deliveryCharge: { $sum: { $cond: [inRevenue, "$deliveryCharge", 0] } },
              maxBill: { $max: { $cond: [inRevenue, "$grandTotal", 0] } },
              minBill: {
                $min: {
                  $cond: [
                    { $and: [inRevenue, { $gt: ["$grandTotal", 0] }] },
                    "$grandTotal",
                    1e15,
                  ],
                },
              },
            },
          },
        ],
        avg: [
          { $match: { billStatus: { $in: REVENUE_BILL_STATUSES } } },
          { $group: { _id: null, avgBill: { $avg: "$grandTotal" } } },
        ],
        byStatus: [{ $group: { _id: "$billStatus", count: { $sum: 1 } } }],
        byPaymentStatus: [
          { $group: { _id: "$payment.paymentStatus", count: { $sum: 1 } } },
        ],
        daily: [
          { $match: { billStatus: { $in: REVENUE_BILL_STATUSES } } },
          {
            $group: {
              _id: dateStringBill("%Y-%m-%d"),
              count: { $sum: 1 },
              gross: { $sum: "$grandTotal" },
              totalPaid: { $sum: "$payment.totalPaid" },
            },
          },
        ],
        paymentMethods: [
          { $unwind: { path: "$payment.payments", preserveNullAndEmptyArrays: false } },
          { $match: { "payment.payments.amount": { $gt: 0 } } },
          {
            $group: {
              _id: "$payment.payments.paymentMethod",
              count: { $sum: 1 },
              amount: { $sum: "$payment.payments.amount" },
            },
          },
        ],
        items: [
          { $unwind: { path: "$orderedItems", preserveNullAndEmptyArrays: false } },
          {
            $group: {
              _id: "$orderedItems.foodName",
              foodId: { $first: "$orderedItems.foodId" },
              qty: { $sum: { $ifNull: ["$orderedItems.quantity", 0] } },
              revenue: { $sum: { $ifNull: ["$orderedItems.totalPrice", 0] } },
            },
          },
          { $sort: { revenue: -1 } },
        ],
        categoryItems: [
          { $unwind: { path: "$orderedItems", preserveNullAndEmptyArrays: false } },
          {
            $group: {
              _id: {
                foodName: "$orderedItems.foodName",
                foodId: "$orderedItems.foodId",
              },
              qty: { $sum: { $ifNull: ["$orderedItems.quantity", 0] } },
              revenue: { $sum: { $ifNull: ["$orderedItems.totalPrice", 0] } },
            },
          },
          { $sort: { revenue: -1 } },
        ],
        offerRevenue: [
          { $match: { "offer.offerCode": { $ne: "" }, billStatus: { $in: REVENUE_BILL_STATUSES } } },
          {
            $group: {
              _id: "$offer.offerCode",
              bills: { $sum: 1 },
              revenue: { $sum: "$grandTotal" },
              discount: { $sum: "$offer.discountAmount" },
            },
          },
        ],
        byRestaurant: [
          { $match: { billStatus: { $in: REVENUE_BILL_STATUSES } } },
          {
            $group: {
              _id: "$restaurantId",
              bills: { $sum: 1 },
              gross: { $sum: "$grandTotal" },
              totalPaid: { $sum: "$payment.totalPaid" },
              avgBill: { $avg: "$grandTotal" },
            },
          },
        ],
      },
    },
  ]);

  const overview = data?.overview?.[0] || {};
  const avg = data?.avg?.[0];
  const billed = overview.billed || 0;
  const avgBill = avg?.avgBill ?? (billed ? round(overview.gross / billed, 2) : 0);

  return {
    ...overview,
    gross: round(overview.gross || 0),
    totalPaid: round(overview.totalPaid || 0),
    balanceDue: round(overview.balanceDue || 0),
    subtotal: round(overview.subtotal || 0),
    manualDiscount: round(overview.manualDiscount || 0),
    offerDiscount: round(overview.offerDiscount || 0),
    discountTotal: round((overview.manualDiscount || 0) + (overview.offerDiscount || 0)),
    tax: round(overview.tax || 0),
    serviceCharge: round(overview.serviceCharge || 0),
    deliveryCharge: round(overview.deliveryCharge || 0),
    avgBill: round(avgBill, 2),
    maxBill: round(overview.maxBill || 0),
    minBill: overview.minBill === 1e15 ? 0 : round(overview.minBill || 0),
    collectionRate: billed ? pct(overview.totalPaid || 0, overview.gross || 0) : null,
    byStatus: data?.byStatus || [],
    byPaymentStatus: data?.byPaymentStatus || [],
    daily: data?.daily || [],
    dailyMap: arrayToMap(data?.daily || []),
    paymentMethods: data?.paymentMethods || [],
    items: data?.items || [],
    categoryItems: data?.categoryItems || [],
    offerRevenue: data?.offerRevenue || [],
    byRestaurant: data?.byRestaurant || [],
  };
};

const buildPaymentAnalytics = async ({ scopeMatch, from, to }) => {
  const [gateway] = await Payment.aggregate([
    {
      $match: {
        ...scopeMatch,
        paymentStatus: PAYMENT_TRANSACTION_STATUS.CAPTURED,
        createdAt: { $gte: from, $lte: to },
      },
    },
    {
      $facet: {
        overview: [{ $group: { _id: null, count: { $sum: 1 }, amount: { $sum: "$amount" } } }],
        byPurpose: [{ $group: { _id: "$paymentPurpose", count: { $sum: 1 }, amount: { $sum: "$amount" } } }],
      },
    },
  ]);

  const gatewayOverview = gateway?.overview?.[0] || {};

  return {
    gateway: {
      count: gatewayOverview.count || 0,
      amount: round(gatewayOverview.amount || 0),
      byPurpose: gateway?.byPurpose || [],
    },
  };
};

const buildRefundAnalytics = async ({ scopeMatch, from, to }) => {
  const match = { ...scopeMatch, isDeleted: false, createdAt: { $gte: from, $lte: to } };

  const [data] = await Refund.aggregate([
    { $match: match },
    {
      $facet: {
        overview: [{ $group: { _id: null, count: { $sum: 1 }, amount: { $sum: "$amount" } } }],
        byStatus: [{ $group: { _id: "$refundStatus", count: { $sum: 1 }, amount: { $sum: "$amount" } } }],
        byMethod: [{ $group: { _id: "$refundMethod", count: { $sum: 1 }, amount: { $sum: "$amount" } } }],
        byReason: [{ $group: { _id: "$reason", count: { $sum: 1 }, amount: { $sum: "$amount" } } }],
        byRestaurant: [
          { $group: { _id: "$restaurantId", count: { $sum: 1 }, amount: { $sum: "$amount" } } },
        ],
      },
    },
  ]);

  const overview = data?.overview?.[0] || {};

  return {
    count: overview.count || 0,
    amount: round(overview.amount || 0),
    byStatus: (data?.byStatus || []).map((s) => ({
      status: s._id,
      label: statusLabel[s._id] || s._id,
      count: s.count,
      amount: round(s.amount || 0),
    })),
    byMethod: (data?.byMethod || []).map((m) => ({
      method: m._id,
      count: m.count,
      amount: round(m.amount || 0),
    })),
    byReason: data?.byReason || [],
    byRestaurant: data?.byRestaurant || [],
  };
};

const buildOfferAnalytics = async ({ scopeMatch, from, to }) => {
  const now = new Date();

  const [offerData] = await Offer.aggregate([
    { $match: { ...scopeMatch, isDeleted: false } },
    {
      $facet: {
        overview: [
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              active: {
                $sum: {
                  $cond: [
                    { $and: [{ $lte: ["$validityStart", now] }, { $gte: ["$validityEnd", now] }, "$isActive"] },
                    1,
                    0,
                  ],
                },
              },
              expired: { $sum: { $cond: [{ $lt: ["$validityEnd", now] }, 1, 0] } },
              upcoming: { $sum: { $cond: [{ $gt: ["$validityStart", now] }, 1, 0] } },
            },
          },
        ],
      },
    },
  ]);

  const [usedData] = await OfferRecipient.aggregate([
    {
      $match: {
        ...scopeMatch,
        isDeleted: false,
        status: OFFER_RECIPIENT_STATUS.USED,
        usedAt: { $gte: from, $lte: to },
      },
    },
    {
      $facet: {
        overview: [
          { $group: { _id: null, used: { $sum: 1 }, discount: { $sum: "$discountAmount" } } },
        ],
        bySource: [
          { $group: { _id: "$usageSource", used: { $sum: 1 }, discount: { $sum: "$discountAmount" } } },
        ],
        top: [
          { $group: { _id: "$offerId", used: { $sum: 1 }, discount: { $sum: "$discountAmount" } } },
          { $sort: { used: -1 } },
          { $limit: 10 },
        ],
      },
    },
  ]);

  const [claimedData] = await OfferRecipient.aggregate([
    {
      $match: { ...scopeMatch, isDeleted: false, claimedAt: { $gte: from, $lte: to } },
    },
    { $group: { _id: null, claimed: { $sum: 1 } } },
  ]);

  const overview = offerData?.overview?.[0] || {};
  const usedOverview = usedData?.overview?.[0] || {};
  const claimed = claimedData?.[0]?.claimed || 0;

  return {
    total: overview.total || 0,
    active: overview.active || 0,
    expired: overview.expired || 0,
    upcoming: overview.upcoming || 0,
    claimed,
    used: usedOverview.used || 0,
    discountGiven: round(usedOverview.discount || 0),
    redemptionRate: claimed ? pct(usedOverview.used || 0, claimed) : null,
    bySource: (usedData?.bySource || []).map((s) => ({
      source: s._id,
      used: s.used,
      discount: round(s.discount || 0),
    })),
    top: usedData?.top || [],
  };
};

const buildReviewAnalytics = async ({ scopeMatch, from, to }) => {
  const match = { ...scopeMatch, createdAt: { $gte: from, $lte: to } };

  const reviewAgg = () => [
    { $match: match },
    {
      $facet: {
        overview: [
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              avgRating: { $avg: "$rating" },
              replied: {
                $sum: {
                  $cond: [
                    { $and: [{ $ne: ["$ownerReply", ""] }, { $ne: ["$ownerReply", null] }] },
                    1,
                    0,
                  ],
                },
              },
            },
          },
        ],
        byRating: [{ $group: { _id: "$rating", count: { $sum: 1 } } }],
        byRestaurant: [{ $group: { _id: "$restaurantId", count: { $sum: 1 }, avg: { $avg: "$rating" } } }],
      },
    },
  ];

  const [restaurant] = await RestaurantReview.aggregate(reviewAgg());
  const [food] = await FoodReview.aggregate(reviewAgg());

  const summarize = (data, type) => {
    const overview = data?.overview?.[0] || {};
    const distribution = [1, 2, 3, 4, 5].map((star) => ({
      star,
      count: (data?.byRating || []).find((r) => Number(r._id) === star)?.count || 0,
    }));
    return {
      type,
      count: overview.count || 0,
      avgRating: overview.count ? round(overview.avgRating, 2) : 0,
      replied: overview.replied || 0,
      notReplied: (overview.count || 0) - (overview.replied || 0),
      replyRate: overview.count ? pct(overview.replied || 0, overview.count) : null,
      distribution,
      byRestaurant: data?.byRestaurant || [],
    };
  };

  return {
    restaurant: summarize(restaurant, "Restaurant"),
    food: summarize(food, "Food"),
  };
};

const buildTableAnalytics = async ({ scopeMatch, from, to }) => {
  const [tableData] = await RestaurantTable.aggregate([
    { $match: scopeMatch },
    {
      $facet: {
        overview: [
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              active: { $sum: { $cond: ["$isActive", 1, 0] } },
              capacity: { $sum: { $ifNull: ["$capacity", 0] } },
            },
          },
        ],
        list: [
          { $project: { _id: 1, tableCode: 1, tableName: 1, capacity: 1, isActive: 1 } },
          { $sort: { tableCode: 1 } },
        ],
      },
    },
  ]);

  const bookingMatch = { ...scopeMatch, isDeleted: false, bookingDateTime: { $gte: from, $lte: to } };
  const byTable = await Booking.aggregate([
    { $match: bookingMatch },
    { $unwind: { path: "$tableIds", preserveNullAndEmptyArrays: false } },
    { $group: { _id: "$tableIds", bookings: { $sum: 1 } } },
    { $sort: { bookings: -1 } },
  ]);

  const overview = tableData?.overview?.[0] || {};
  const tableMap = new Map((tableData?.list || []).map((t) => [String(t._id), t]));

  const tableStats = byTable.map((row) => ({
    tableId: row._id,
    tableCode: tableMap.get(String(row._id))?.tableCode || "-",
    tableName: tableMap.get(String(row._id))?.tableName || "",
    bookings: row.bookings,
    capacity: tableMap.get(String(row._id))?.capacity || 0,
  }));

  return {
    total: overview.total || 0,
    active: overview.active || 0,
    capacity: overview.capacity || 0,
    tableStats,
    mostBooked: tableStats[0] || null,
    leastBooked: tableStats[tableStats.length - 1] || null,
  };
};

const buildCustomerAnalytics = async ({ bookingAnalytics, billAnalytics, scopeMatch, from, to }) => {
  const customerBookings = (bookingAnalytics.customers || []).filter((c) => c._id);
  const totalCustomers = customerBookings.length || bookingAnalytics.distinctCustomers || 0;
  const returning = customerBookings.filter((c) => c.bookings > 1).length;
  const loyal = customerBookings.filter((c) => c.bookings >= 5).length;

  const spendByCustomer = await Bill.aggregate([
    {
      $match: {
        ...scopeMatch,
        isDeleted: false,
        billStatus: { $in: REVENUE_BILL_STATUSES },
        createdAt: { $gte: from, $lte: to },
        customerId: { $ne: null },
      },
    },
    {
      $group: {
        _id: "$customerId",
        name: { $first: "$customerName" },
        bills: { $sum: 1 },
        spent: { $sum: "$payment.totalPaid" },
        grand: { $sum: "$grandTotal" },
      },
    },
    { $sort: { spent: -1 } },
    { $limit: 5 },
  ]);

  const topCustomers = await User.find({ _id: { $in: spendByCustomer.map((c) => c._id) } })
    .select("fullName email userCode")
    .lean();

  const topByName = new Map(topCustomers.map((u) => [String(u._id), u]));

  const topSpenders = spendByCustomer.map((c) => ({
    customerId: c._id,
    name: c.name || topByName.get(String(c._id))?.fullName || "Guest",
    email: topByName.get(String(c._id))?.email || "",
    bills: c.bills,
    spent: round(c.spent || 0),
  }));

  const customerUserIds = customerBookings.map((c) => c._id).filter(Boolean);
  const frequentUsers = await User.find({ _id: { $in: customerUserIds.slice(0, 10) } })
    .select("fullName userCode")
    .lean();
  const frequentByName = new Map(frequentUsers.map((u) => [String(u._id), u]));

  const mostFrequent = customerBookings[0]
    ? {
        customerId: customerBookings[0]._id,
        name: frequentByName.get(String(customerBookings[0]._id))?.fullName || "Guest",
        bookings: customerBookings[0].bookings,
      }
    : null;

  const customersWithSpend = spendByCustomer.length;
  const avgSpend = customersWithSpend
    ? round(billAnalytics.totalPaid / customersWithSpend, 2)
    : 0;

  return {
    total: totalCustomers,
    newCustomers: Math.max(0, totalCustomers - returning),
    returning,
    loyal,
    repeatRate: totalCustomers ? pct(returning, totalCustomers) : null,
    avgBookingsPerCustomer: totalCustomers ? round(bookingAnalytics.total / totalCustomers, 2) : 0,
    avgSpendPerCustomer: avgSpend,
    topSpenders,
    mostFrequent,
    distribution: [
      { segment: "New", count: Math.max(0, totalCustomers - returning), color: "#3b82f6" },
      { segment: "Returning", count: returning - loyal, color: "#8b5cf6" },
      { segment: "Loyal", count: loyal, color: "#ec4899" },
    ],
  };
};

const buildComparison = async ({ ids, scopeMatch, from, to }) => {
  if (!ids || ids.length < 2) return [];

  const restaurants = await Restaurant.find({ _id: { $in: ids } })
    .select("restaurantName _id")
    .lean();
  const restaurantMap = new Map(restaurants.map((r) => [String(r._id), r]));

  const bookingMatch = { ...scopeMatch, isDeleted: false, bookingDateTime: { $gte: from, $lte: to } };
  const bookings = await Booking.aggregate([
    { $match: bookingMatch },
    {
      $group: {
        _id: "$restaurantId",
        bookings: { $sum: 1 },
        completed: {
          $sum: { $cond: [{ $eq: ["$bookingStatus", BOOKING_STATUS.COMPLETED] }, 1, 0] },
        },
        customers: { $addToSet: "$userId" },
      },
    },
  ]);

  const billMatch = { ...scopeMatch, isDeleted: false, createdAt: { $gte: from, $lte: to } };
  const bills = await Bill.aggregate([
    { $match: billMatch },
    {
      $group: {
        _id: "$restaurantId",
        bills: { $sum: 1 },
        revenue: {
          $sum: { $cond: [{ $in: ["$billStatus", REVENUE_BILL_STATUSES] }, "$grandTotal", 0] },
        },
        avgBill: {
          $avg: {
            $cond: [{ $in: ["$billStatus", REVENUE_BILL_STATUSES] }, "$grandTotal", null],
          },
        },
      },
    },
  ]);

  const refunds = await Refund.aggregate([
    { $match: { ...scopeMatch, isDeleted: false, createdAt: { $gte: from, $lte: to } } },
    { $group: { _id: "$restaurantId", count: { $sum: 1 }, amount: { $sum: "$amount" } } },
  ]);

  const reviews = await RestaurantReview.aggregate([
    { $match: { ...scopeMatch, createdAt: { $gte: from, $lte: to } } },
    { $group: { _id: "$restaurantId", count: { $sum: 1 }, avg: { $avg: "$rating" } } },
  ]);

  const bookingMap = new Map(bookings.map((b) => [String(b._id), b]));
  const billMap = new Map(bills.map((b) => [String(b._id), b]));
  const refundMap = new Map(refunds.map((r) => [String(r._id), r]));
  const reviewMap = new Map(reviews.map((r) => [String(r._id), r]));

  return ids.map((id) => {
    const key = String(id);
    const bkg = bookingMap.get(key) || {};
    const bil = billMap.get(key) || {};
    const ref = refundMap.get(key) || {};
    const rev = reviewMap.get(key) || {};
    return {
      restaurantId: id,
      restaurantName: restaurantMap.get(key)?.restaurantName || "Restaurant",
      bookings: bkg.bookings || 0,
      completed: bkg.completed || 0,
      customers: (bkg.customers || []).filter(Boolean).length,
      bills: bil.bills || 0,
      revenue: round(bil.revenue || 0),
      avgBill: round(bil.avgBill || 0, 2),
      refunds: ref.count || 0,
      refundAmount: round(ref.amount || 0),
      reviewCount: rev.count || 0,
      rating: rev.count ? round(rev.avg, 2) : 0,
    };
  });
};

const fillSeries = ({ from, to, dailyMap, valueKey, groupBy = "day" }) => {
  const start = startOfDay(from);
  const end = startOfDay(to);
  const result = [];
  let cursor = new Date(start);

  if (groupBy === "day") {
    while (cursor <= end) {
      const key = dateToString(cursor);
      result.push({
        period: key,
        ...(valueKey ? { value: dailyMap[key]?.[valueKey] || 0 } : {}),
      });
      cursor = new Date(cursor.getTime() + DAY_MS);
    }
    return result;
  }

  if (groupBy === "week") {
    const buckets = {};
    while (cursor <= end) {
      const weekStart = new Date(cursor);
      const day = (weekStart.getDay() + 6) % 7;
      weekStart.setDate(weekStart.getDate() - day);
      const key = dateToString(weekStart);
      buckets[key] = (buckets[key] || 0) + (dailyMap[dateToString(cursor)]?.[valueKey] || 0);
      cursor = new Date(cursor.getTime() + DAY_MS);
    }
    return Object.entries(buckets).map(([period, value]) => ({ period, value }));
  }

  const buckets = {};
  while (cursor <= end) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
    buckets[key] = (buckets[key] || 0) + (dailyMap[dateToString(cursor)]?.[valueKey] || 0);
    cursor = new Date(cursor.getTime() + DAY_MS);
  }
  return Object.entries(buckets).map(([period, value]) => ({ period, value }));
};

const buildTrends = ({ from, to, bookingDaily, billDaily, groupBy }) => {
  const bkgMap = arrayToMap(bookingDaily || []);
  const billMap = arrayToMap(billDaily || []);

  const revenue = fillSeries({
    from,
    to,
    dailyMap: billMap,
    valueKey: "gross",
    groupBy,
  });

  const bills = fillSeries({
    from,
    to,
    dailyMap: billMap,
    valueKey: "count",
    groupBy,
  });

  const bookings = fillSeries({
    from,
    to,
    dailyMap: bkgMap,
    valueKey: "count",
    groupBy,
  });

  return { revenue, bills, bookings };
};

const buildPreviousPeriod = async ({ scopeMatch, prevFrom, prevTo }) => {
  const bookingMatch = {
    ...scopeMatch,
    isDeleted: false,
    bookingDateTime: { $gte: prevFrom, $lte: prevTo },
  };
  const [booking] = await Booking.aggregate([
    { $match: bookingMatch },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        completed: {
          $sum: { $cond: [{ $eq: ["$bookingStatus", BOOKING_STATUS.COMPLETED] }, 1, 0] },
        },
        customers: { $addToSet: "$userId" },
      },
    },
  ]);

  const billMatch = {
    ...scopeMatch,
    isDeleted: false,
    billStatus: { $in: REVENUE_BILL_STATUSES },
    createdAt: { $gte: prevFrom, $lte: prevTo },
  };
  const [bill] = await Bill.aggregate([
    { $match: billMatch },
    { $group: { _id: null, gross: { $sum: "$grandTotal" }, count: { $sum: 1 } } },
  ]);

  const refundMatch = {
    ...scopeMatch,
    isDeleted: false,
    createdAt: { $gte: prevFrom, $lte: prevTo },
  };
  const [refund] = await Refund.aggregate([
    { $match: refundMatch },
    { $group: { _id: null, amount: { $sum: "$amount" } } },
  ]);

  return {
    bookings: {
      total: booking?.total || 0,
      completed: booking?.completed || 0,
      customers: (booking?.customers || []).filter(Boolean).length,
    },
    revenue: { gross: round(bill?.gross || 0), bills: bill?.count || 0 },
    refunds: { amount: round(refund?.amount || 0) },
  };
};

const selectGroupBy = ({ from, to, groupBy }) => {
  const days = Math.round((to.getTime() - from.getTime()) / DAY_MS) + 1;
  if (groupBy === "day" || groupBy === "week" || groupBy === "month") return groupBy;
  if (days > 120) return "month";
  if (days > 45) return "week";
  return "day";
};

const buildBusinessHealth = ({ bookingAnalytics, billAnalytics, customerAnalytics, refundAnalytics, offerAnalytics, reviewAnalytics }) => ({
  bookingCompletionRate: bookingAnalytics.completionRate,
  repeatCustomerRate: customerAnalytics.repeatRate,
  averageBillValue: billAnalytics.avgBill,
  refundRate: billAnalytics.gross ? pct(refundAnalytics.amount, billAnalytics.gross) : null,
  offerRedemptionRate: offerAnalytics.redemptionRate,
  averageRating: reviewAnalytics.restaurant.avgRating,
  paymentCollectionRate: billAnalytics.collectionRate,
  cancellationRate: bookingAnalytics.cancellationRate,
});

/**
 * Build the full owner analytics report for a restaurant scope and date range.
 */
export const buildOwnerReport = async ({ req, restaurantId, startDate, endDate, groupBy }) => {
  const { ids, scopeMatch } = await resolveScope({ req, restaurantId });
  const { from, to, prevFrom, prevTo } = resolveDateRange({ startDate, endDate });
  const resolvedGroupBy = selectGroupBy({ from, to, groupBy });

  const [bookingAnalytics, billAnalytics, paymentAnalytics, refundAnalytics, offerAnalytics, reviewAnalytics, tableAnalytics, comparison, previousPeriod] =
    await Promise.all([
      buildBookingAnalytics({ scopeMatch, from, to }),
      buildBillAnalytics({ scopeMatch, from, to }),
      buildPaymentAnalytics({ scopeMatch, from, to }),
      buildRefundAnalytics({ scopeMatch, from, to }),
      buildOfferAnalytics({ scopeMatch, from, to }),
      buildReviewAnalytics({ scopeMatch, from, to }),
      buildTableAnalytics({ scopeMatch, from, to }),
      buildComparison({ ids, scopeMatch, from, to }),
      buildPreviousPeriod({ scopeMatch, prevFrom, prevTo }),
    ]);

  const customerAnalytics = await buildCustomerAnalytics({
    bookingAnalytics,
    billAnalytics,
    scopeMatch,
    from,
    to,
  });

  const trends = buildTrends({
    from,
    to,
    bookingDaily: bookingAnalytics.daily,
    billDaily: billAnalytics.daily,
    groupBy: resolvedGroupBy,
  });

  const gross = billAnalytics.gross;
  const refundAmount = refundAnalytics.amount;
  const netRevenue = Math.max(0, gross - refundAmount);

  let restaurantName = "All Restaurants";
  if (ids && ids.length === 1) {
    const restaurant = await Restaurant.findById(ids[0]).select("restaurantName").lean();
    restaurantName = restaurant?.restaurantName || "Restaurant";
  } else if (ids && ids.length > 0) {
    const restaurants = await Restaurant.find({ _id: { $in: ids } })
      .select("restaurantName")
      .lean();
    restaurantName = restaurants.map((r) => r.restaurantName).join(", ");
  }

  const offerTop = offerAnalytics.top;
  const offerRevenueMap = new Map(
    (billAnalytics.offerRevenue || []).map((o) => [String(o._id), o])
  );
  const offerDetails = [];
  if (offerTop.length) {
    const offers = await Offer.find({ _id: { $in: offerTop.map((o) => o._id) } })
      .select("offerCode title discountType discountValue")
      .lean();
    const offerMap = new Map(offers.map((o) => [String(o._id), o]));
    offerTop.forEach((row) => {
      const offer = offerMap.get(String(row._id));
      const revenue = offerRevenueMap.get(String(offer?.offerCode));
      offerDetails.push({
        offerId: row._id,
        offerCode: offer?.offerCode || "-",
        title: offer?.title || "-",
        used: row.used,
        discount: round(row.discount || 0),
        revenueGenerated: revenue ? round(revenue.revenue || 0) : null,
      });
    });
  }

  const paymentMethods = (billAnalytics.paymentMethods || []).map((m) => ({
    method: m._id || "Other",
    count: m.count,
    amount: round(m.amount || 0),
  }));
  const paymentTotal = paymentMethods.reduce((sum, m) => sum + m.amount, 0);
  const onlineAmount = paymentMethods
    .filter((m) => m.method !== "Cash")
    .reduce((sum, m) => sum + m.amount, 0);
  const offlineAmount = paymentMethods
    .filter((m) => m.method === "Cash")
    .reduce((sum, m) => sum + m.amount, 0);
  const onlineCount = paymentMethods
    .filter((m) => m.method !== "Cash")
    .reduce((sum, m) => sum + m.count, 0);
  const offlineCount = paymentMethods
    .filter((m) => m.method === "Cash")
    .reduce((sum, m) => sum + m.count, 0);

  return {
    meta: {
      generatedAt: new Date().toISOString(),
      restaurantId: ids && ids.length === 1 ? ids[0] : restaurantId || "all",
      restaurantName,
      restaurantCount: ids ? ids.length : null,
      range: {
        start: padDateString(from),
        end: padDateString(to),
        label: `${padDateString(from)} to ${padDateString(to)}`,
      },
      previousRange: {
        start: padDateString(prevFrom),
        end: padDateString(prevTo),
      },
      groupBy: resolvedGroupBy,
    },
    summary: {
      bookings: {
        total: bookingAnalytics.total,
        confirmed: bookingAnalytics.confirmed,
        completed: bookingAnalytics.completed,
        cancelled: bookingAnalytics.cancelled,
        noShow: bookingAnalytics.noShow,
        pending: bookingAnalytics.pending,
        online: bookingAnalytics.online,
        walkIn: bookingAnalytics.walkIn,
        onlinePct: bookingAnalytics.total ? pct(bookingAnalytics.online, bookingAnalytics.total) : null,
        walkInPct: bookingAnalytics.total ? pct(bookingAnalytics.walkIn, bookingAnalytics.total) : null,
        avgGuests: bookingAnalytics.avgGuests,
        avgDuration: bookingAnalytics.avgDuration,
        completionRate: bookingAnalytics.completionRate,
        change: {
          total: changePct(bookingAnalytics.total, previousPeriod.bookings.total),
          completed: changePct(bookingAnalytics.completed, previousPeriod.bookings.completed),
        },
      },
      revenue: {
        gross,
        discounts: billAnalytics.discountTotal,
        manualDiscount: billAnalytics.manualDiscount,
        offerDiscount: billAnalytics.offerDiscount,
        tax: billAnalytics.tax,
        serviceCharge: billAnalytics.serviceCharge,
        deliveryCharge: billAnalytics.deliveryCharge,
        refunds: refundAmount,
        net: netRevenue,
        refundRate: gross ? pct(refundAmount, gross) : null,
        change: changePct(gross, previousPeriod.revenue.gross),
      },
      bills: {
        total: billAnalytics.total,
        billed: billAnalytics.billed,
        paid: billAnalytics.paid,
        partial: billAnalytics.partial,
        pending: billAnalytics.pending,
        cancelled: billAnalytics.cancelled,
        draft: billAnalytics.draft,
        online: billAnalytics.online,
        walkIn: billAnalytics.walkIn,
        totalBilled: billAnalytics.gross,
        totalPaid: billAnalytics.totalPaid,
        balanceDue: billAnalytics.balanceDue,
        avgBill: billAnalytics.avgBill,
        maxBill: billAnalytics.maxBill,
        minBill: billAnalytics.minBill,
        collectionRate: billAnalytics.collectionRate,
        change: changePct(billAnalytics.gross, previousPeriod.revenue.gross),
      },
      customers: customerAnalytics,
      refunds: {
        count: refundAnalytics.count,
        amount: refundAmount,
        rate: gross ? pct(refundAmount, gross) : null,
      },
      offers: offerAnalytics,
      reviews: {
        total: reviewAnalytics.restaurant.count + reviewAnalytics.food.count,
        restaurant: reviewAnalytics.restaurant,
        food: reviewAnalytics.food,
      },
    },
    bookings: {
      total: bookingAnalytics.total,
      byStatus: bookingAnalytics.byStatus,
      byType: bookingAnalytics.byType,
      byHour: bookingAnalytics.byHour,
      byWeekday: bookingAnalytics.byWeekday,
      peakHour: bookingAnalytics.peakHour,
      busiestDay: bookingAnalytics.busiestDay,
      avgGuests: bookingAnalytics.avgGuests,
      avgDuration: bookingAnalytics.avgDuration,
      trend: trends.bookings,
      previous: previousPeriod.bookings,
    },
    revenue: {
      gross,
      trend: trends.revenue,
      billTrend: trends.bills,
      breakdown: [
        { key: "gross", label: "Gross Revenue", value: gross, type: "revenue" },
        { key: "manualDiscount", label: "Manual Discounts", value: billAnalytics.manualDiscount, type: "discount" },
        { key: "offerDiscount", label: "Offer Discounts", value: billAnalytics.offerDiscount, type: "discount" },
        { key: "tax", label: "Tax", value: billAnalytics.tax, type: "tax" },
        { key: "serviceCharge", label: "Service Charges", value: billAnalytics.serviceCharge, type: "service" },
        { key: "deliveryCharge", label: "Delivery Charges", value: billAnalytics.deliveryCharge, type: "delivery" },
        { key: "refunds", label: "Refunds", value: refundAmount, type: "refund" },
        { key: "net", label: "Net Revenue", value: netRevenue, type: "net" },
      ],
    },
    billing: {
      totals: billAnalytics,
      byStatus: billAnalytics.byStatus,
      byPaymentStatus: billAnalytics.byPaymentStatus,
      avgBill: billAnalytics.avgBill,
      maxBill: billAnalytics.maxBill,
      minBill: billAnalytics.minBill,
      trend: trends.bills,
    },
    payments: {
      methods: paymentMethods,
      total: paymentTotal,
      onlineAmount,
      offlineAmount,
      onlineCount,
      offlineCount,
      onlinePct: paymentTotal ? pct(onlineAmount, paymentTotal) : null,
      offlinePct: paymentTotal ? pct(offlineAmount, paymentTotal) : null,
      gateway: paymentAnalytics.gateway,
    },
    refunds: refundAnalytics,
    customers: customerAnalytics,
    food: {
      top: (billAnalytics.items || []).slice(0, 10).map((item, index) => ({
        rank: index + 1,
        foodName: item._id || "-",
        foodId: item.foodId,
        qty: item.qty || 0,
        revenue: round(item.revenue || 0),
        avgPrice: item.qty ? round((item.revenue || 0) / item.qty, 2) : 0,
      })),
      category: (billAnalytics.categoryItems || []).slice(0, 10).map((item, index) => ({
        rank: index + 1,
        foodName: item._id?.foodName || "-",
        foodId: item._id?.foodId || null,
        qty: item.qty || 0,
        revenue: round(item.revenue || 0),
        avgPrice: item.qty ? round((item.revenue || 0) / item.qty, 2) : 0,
      })),
    },
    tables: tableAnalytics,
    offers: { ...offerAnalytics, top: offerDetails },
    reviews: reviewAnalytics,
    comparison,
    peakHours: bookingAnalytics.byHour.slice().sort((a, b) => a.hour - b.hour),
    businessHealth: buildBusinessHealth({
      bookingAnalytics,
      billAnalytics,
      customerAnalytics,
      refundAnalytics,
      offerAnalytics,
      reviewAnalytics,
    }),
  };
};

const DEFAULT_EXPORT_LIMIT = 5000;

/**
 * Detailed rows used by the Excel/PDF exporters. Scoped the same way as the
 * dashboard report but returns document rows instead of aggregates.
 */
export const buildOwnerReportDetails = async ({ req, restaurantId, startDate, endDate }) => {
  const { ids, scopeMatch } = await resolveScope({ req, restaurantId });
  const { from, to } = resolveDateRange({ startDate, endDate });

  const restaurantMatch = ids && ids.length ? { restaurantId: { $in: ids } } : {};

  const [bookings, bills, refunds, restaurantReviews, foodReviews, tables] = await Promise.all([
    Booking.find({
      ...restaurantMatch,
      isDeleted: false,
      bookingDateTime: { $gte: from, $lte: to },
    })
      .select(
        "bookingCode bookingType bookingStatus bookingMode bookingDateTime expectedDuration numberOfGuests totalAmount advanceAmount tableIds userId createdAt"
      )
      .populate("userId", "fullName email userCode")
      .sort({ bookingDateTime: -1 })
      .limit(DEFAULT_EXPORT_LIMIT)
      .lean(),

    Bill.find({
      ...restaurantMatch,
      isDeleted: false,
      createdAt: { $gte: from, $lte: to },
    })
      .select(
        "billCode billType billStatus billCode bookingId tableId customerName customerId subTotal discount offer taxAmount taxableAmount serviceCharge deliveryCharge grandTotal payment orderedItems createdAt"
      )
      .sort({ createdAt: -1 })
      .limit(DEFAULT_EXPORT_LIMIT)
      .lean(),

    Refund.find({
      ...restaurantMatch,
      isDeleted: false,
      createdAt: { $gte: from, $lte: to },
    })
      .select(
        "refundCode bookingId billId amount reason remarks refundMethod refundStatus createdAt"
      )
      .sort({ createdAt: -1 })
      .limit(DEFAULT_EXPORT_LIMIT)
      .lean(),

    RestaurantReview.find({ ...restaurantMatch, createdAt: { $gte: from, $lte: to } })
      .select("reviewCode rating title comment status ownerReply ownerRepliedAt createdAt")
      .populate("userId", "fullName")
      .sort({ createdAt: -1 })
      .limit(DEFAULT_EXPORT_LIMIT)
      .lean(),

    FoodReview.find({ ...restaurantMatch, createdAt: { $gte: from, $lte: to } })
      .select("reviewCode rating title comment status ownerReply ownerRepliedAt createdAt")
      .populate("userId", "fullName")
      .sort({ createdAt: -1 })
      .limit(DEFAULT_EXPORT_LIMIT)
      .lean(),

    RestaurantTable.find(restaurantMatch)
      .select("tableCode tableName capacity isActive restaurantId")
      .sort({ tableCode: 1 })
      .lean(),
  ]);

  const tableIds = tables.map((t) => t._id);
  const bookingByTable = await Booking.aggregate([
    {
      $match: {
        ...restaurantMatch,
        isDeleted: false,
        bookingDateTime: { $gte: from, $lte: to },
        "tableIds.0": { $exists: true },
      },
    },
    { $unwind: "$tableIds" },
    { $group: { _id: "$tableIds", bookings: { $sum: 1 } } },
  ]);

  return {
    bookings,
    bills,
    refunds,
    restaurantReviews,
    foodReviews,
    tables: tables.map((t) => ({
      ...t,
      bookings: bookingByTable.find((b) => String(b._id) === String(t._id))?.bookings || 0,
    })),
  };
};

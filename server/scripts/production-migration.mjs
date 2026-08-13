import "dotenv/config";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";

import Payment from "../src/models/Payment.js";
import Booking from "../src/models/Booking.js";
import Refund from "../src/models/Refund.js";
import WebhookEvent from "../src/models/WebhookEvent.js";
import User from "../src/models/User.js";
import Restaurant from "../src/models/Restaurant.js";
import Session from "../src/models/Session.js";
import OTP from "../src/models/OTP.js";
import {
  PAYMENT_TRANSACTION_STATUS,
  REFUND_STATUS,
  RAZORPAY_ACCOUNT_STATUS,
} from "../src/utils/constants.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// The application loads server/src/.env. Keep this script aligned without
// printing any credential values.
const dotenvPath = path.join(__dirname, "..", "src", ".env");
const dotenv = await import("dotenv");
dotenv.config({ path: dotenvPath });

const mode = process.argv.includes("--migrate") ? "migrate" : "audit";
const SAMPLE_LIMIT = 20;
const SUCCESSFUL_REFUND_STATUSES = [REFUND_STATUS.REFUNDED];
const ACTIVE_REFUND_STATUSES = [
  REFUND_STATUS.REFUND_PENDING,
  REFUND_STATUS.REFUND_OVERDUE,
  REFUND_STATUS.REFUND_PROCESSING,
  REFUND_STATUS.REFUND_REQUIRES_RECONCILIATION,
];

const sampleIds = (rows) => rows.slice(0, SAMPLE_LIMIT).map((row) => String(row._id || row));

const duplicateGroups = async (model, group, match = {}) =>
  model.aggregate([
    { $match: match },
    { $group: { _id: group, count: { $sum: 1 }, ids: { $push: "$_id" } } },
    { $match: { count: { $gt: 1 } } },
    { $limit: SAMPLE_LIMIT },
  ]);

const printSection = (title, value) => {
  console.log(`\n=== ${title} ===`);
  console.log(JSON.stringify(value, null, 2));
};

const listIndexes = async (model) => model.collection.listIndexes().toArray();

const auditIndexes = async () => {
  const collections = { Payment, Booking, Refund, WebhookEvent, User, Restaurant, Session, OTP };
  const result = {};
  for (const [name, model] of Object.entries(collections)) {
    result[name] = await listIndexes(model);
  }
  printSection("Existing indexes", result);
  return result;
};

const auditDuplicates = async () => {
  const result = {
    paymentIdempotency: await duplicateGroups(
      Payment,
      { customerId: "$customerId", idempotencyKey: "$idempotencyKey" },
      { idempotencyKey: { $type: "string" } }
    ),
    legacyGlobalPaymentIdempotency: await duplicateGroups(
      Payment,
      { idempotencyKey: "$idempotencyKey" },
      { idempotencyKey: { $type: "string" } }
    ),
    paymentIdempotencyAcrossCustomers: await Payment.aggregate([
      { $match: { idempotencyKey: { $type: "string" } } },
      { $group: { _id: "$idempotencyKey", customers: { $addToSet: "$customerId" }, ids: { $push: "$_id" }, count: { $sum: 1 } } },
      { $match: { $expr: { $gt: [{ $size: "$customers" }, 1] } } },
      { $limit: SAMPLE_LIMIT },
    ]),
    paymentRazorpayOrder: await duplicateGroups(
      Payment,
      { razorpayOrderId: "$razorpayOrderId" },
      { razorpayOrderId: { $type: "string" } }
    ),
    paymentRazorpayPayment: await duplicateGroups(
      Payment,
      { razorpayPaymentId: "$razorpayPaymentId" },
      { razorpayPaymentId: { $type: "string" } }
    ),
    refundIdempotency: await duplicateGroups(
      Refund,
      { bookingId: "$bookingId", idempotencyKey: "$idempotencyKey" },
      { idempotencyKey: { $type: "string" } }
    ),
    refundGatewayId: await duplicateGroups(
      Refund,
      { gatewayRefundId: "$gatewayRefundId" },
      { gatewayRefundId: { $type: "string" } }
    ),
    webhookEventId: await duplicateGroups(
      WebhookEvent,
      { eventId: "$eventId" },
      { eventId: { $type: "string" } }
    ),
  };

  printSection("Duplicate groups (sampled)", Object.fromEntries(
    Object.entries(result).map(([key, rows]) => [key, rows.map((row) => ({ ...row, ids: sampleIds(row.ids) }))])
  ));
  return result;
};

const auditRefundAccounting = async () => {
  const rows = await Payment.aggregate([
    { $match: { paymentStatus: PAYMENT_TRANSACTION_STATUS.CAPTURED } },
    {
      $lookup: {
        from: Refund.collection.name,
        localField: "bookingId",
        foreignField: "bookingId",
        as: "refunds",
      },
    },
    {
      $project: {
        paymentId: "$_id",
        capturedAmount: "$amount",
        storedRefundedAmount: { $ifNull: ["$refundedAmount", 0] },
        storedProcessingAmount: { $ifNull: ["$refundProcessingAmount", 0] },
        successfulRefundAmount: {
          $sum: {
            $map: {
              input: {
                $filter: {
                  input: "$refunds",
                  as: "refund",
                  cond: { $in: ["$$refund.refundStatus", SUCCESSFUL_REFUND_STATUSES] },
                },
              },
              as: "refund",
              in: { $ifNull: ["$$refund.amount", 0] },
            },
          },
        },
        activeProcessingAmount: {
          $sum: {
            $map: {
              input: {
                $filter: {
                  input: "$refunds",
                  as: "refund",
                  cond: { $in: ["$$refund.refundStatus", ACTIVE_REFUND_STATUSES] },
                },
              },
              as: "refund",
              in: { $ifNull: ["$$refund.amount", 0] },
            },
          },
        },
      },
    },
  ]);

  const mismatches = rows.filter(
    (row) =>
      Math.abs(Number(row.storedRefundedAmount) - Number(row.successfulRefundAmount)) > 0.005 ||
      Math.abs(Number(row.storedProcessingAmount) - Number(row.activeProcessingAmount)) > 0.005
  );
  printSection("Refund accounting mismatches", mismatches.slice(0, SAMPLE_LIMIT));
  return { rows, mismatches };
};

const auditRelationships = async () => {
  const [missingPayment, missingBooking, capturedNoBooking, missingOwner] = await Promise.all([
    Refund.aggregate([
      { $match: { bookingId: { $ne: null } } },
      { $lookup: { from: Payment.collection.name, localField: "bookingId", foreignField: "bookingId", as: "payments" } },
      { $match: { payments: { $size: 0 } } },
      { $limit: SAMPLE_LIMIT },
    ]),
    Booking.aggregate([
      { $match: { sourcePaymentId: { $ne: null } } },
      { $lookup: { from: Payment.collection.name, localField: "sourcePaymentId", foreignField: "_id", as: "payments" } },
      { $match: { payments: { $size: 0 } } },
      { $limit: SAMPLE_LIMIT },
    ]),
    Payment.find({ paymentStatus: PAYMENT_TRANSACTION_STATUS.CAPTURED, bookingId: null }).select("_id razorpayOrderId customerId restaurantId bookingData").limit(SAMPLE_LIMIT).lean(),
    Restaurant.find({ $or: [{ ownerId: null }, { ownerId: { $exists: false } }] }).select("_id restaurantCode").limit(SAMPLE_LIMIT).lean(),
  ]);

  const ownerMapping = await Restaurant.aggregate([
    { $match: { ownerId: { $ne: null } } },
    { $lookup: { from: User.collection.name, localField: "ownerId", foreignField: "_id", as: "owner" } },
    { $unwind: { path: "$owner", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 1,
        restaurantCode: 1,
        ownerId: 1,
        ownerExists: { $ne: [{ $type: "$owner._id" }, "missing"] },
        ownerAccountId: "$owner.razorpayAccountId",
        ownerAccountStatus: "$owner.razorpayAccountStatus",
        restaurantAccountId: "$razorpayAccountId",
        connectedWithoutAccount: {
          $and: [
            { $eq: ["$owner.razorpayAccountStatus", RAZORPAY_ACCOUNT_STATUS.CONNECTED] },
            { $eq: [{ $ifNull: ["$owner.razorpayAccountId", ""] }, ""] },
          ],
        },
        accountWithoutConnected: {
          $and: [
            { $ne: [{ $ifNull: ["$owner.razorpayAccountId", ""] }, ""] },
            { $ne: ["$owner.razorpayAccountStatus", RAZORPAY_ACCOUNT_STATUS.CONNECTED] },
          ],
        },
        staleRestaurantCopy: {
          $and: [
            { $ne: [{ $ifNull: ["$razorpayAccountId", ""] }, ""] },
            { $ne: ["$razorpayAccountId", "$owner.razorpayAccountId"] },
          ],
        },
      },
    },
  ]);

  printSection("Relationship audit", {
    refundsMissingPayment: sampleIds(missingPayment),
    bookingsMissingSourcePayment: sampleIds(missingBooking),
    capturedPaymentsWithoutBooking: sampleIds(capturedNoBooking),
    restaurantsMissingOwner: sampleIds(missingOwner),
    ownerMappingIssues: ownerMapping.filter((row) => !row.ownerExists || row.connectedWithoutAccount || row.accountWithoutConnected || row.staleRestaurantCopy).slice(0, SAMPLE_LIMIT),
  });
};

const auditOperationalStates = async () => {
  const [paymentStates, invalidAmounts, capturedWithoutOrder, failedPaymentsWithBooking, webhookStates, staleWebhookEvents, failedWebhooks, unknownWebhooks, webhookReferencesMissingPayment] = await Promise.all([
    Payment.find({ $or: [
      { paymentStatus: PAYMENT_TRANSACTION_STATUS.CAPTURED, bookingId: null },
      { orderCreationStatus: { $in: ["PROCESSING", "RECOVERY_REQUIRED"] } },
      { bookingCreationStatus: { $in: ["PENDING", "FAILED_REQUIRES_RECONCILIATION"] } },
    ] }).select("_id paymentStatus bookingId razorpayOrderId orderCreationStatus bookingCreationStatus").limit(SAMPLE_LIMIT).lean(),
    Payment.find({ amount: { $lte: 0 } }).select("_id amount paymentStatus bookingId").limit(SAMPLE_LIMIT).lean(),
    Payment.find({ paymentStatus: PAYMENT_TRANSACTION_STATUS.CAPTURED, $or: [{ razorpayOrderId: null }, { razorpayOrderId: "" }] }).select("_id paymentStatus razorpayOrderId bookingId").limit(SAMPLE_LIMIT).lean(),
    Payment.find({ paymentStatus: PAYMENT_TRANSACTION_STATUS.FAILED, bookingId: { $ne: null } }).select("_id paymentStatus bookingId").limit(SAMPLE_LIMIT).lean(),
    WebhookEvent.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    WebhookEvent.find({ status: "PROCESSING", processingStartedAt: { $lt: new Date(Date.now() - 5 * 60 * 1000) } }).select("_id eventId eventType processingStartedAt").limit(SAMPLE_LIMIT).lean(),
    WebhookEvent.find({ status: "FAILED_RETRYABLE" }).select("_id eventId eventType lastError attempts").limit(SAMPLE_LIMIT).lean(),
    WebhookEvent.find({ eventType: { $nin: ["payment.captured", "payment.failed"] } }).select("_id eventId eventType").limit(SAMPLE_LIMIT).lean(),
    WebhookEvent.aggregate([
      { $match: { $or: [{ razorpayOrderId: { $type: "string" } }, { razorpayPaymentId: { $type: "string" } }] } },
      { $lookup: { from: Payment.collection.name, let: { orderId: "$razorpayOrderId", paymentId: "$razorpayPaymentId" }, pipeline: [{ $match: { $expr: { $or: [{ $and: [{ $ne: ["$$orderId", null] }, { $eq: ["$razorpayOrderId", "$$orderId"] }] }, { $and: [{ $ne: ["$$paymentId", null] }, { $eq: ["$razorpayPaymentId", "$$paymentId"] }] }] } } }], as: "payments" } },
      { $match: { payments: { $size: 0 } } },
      { $project: { _id: 1, eventId: 1, eventType: 1, razorpayOrderId: 1, razorpayPaymentId: 1 } },
      { $limit: SAMPLE_LIMIT },
    ]),
  ]);
  printSection("Operational state audit", { paymentStates, invalidAmounts, capturedWithoutOrder, failedPaymentsWithBooking, webhookStates, staleWebhookEvents, failedWebhooks, unknownWebhooks, webhookReferencesMissingPayment });
};

const assertNoDuplicatesForRequiredIndexes = async (duplicates) => {
  const blocking = [
    "paymentIdempotency",
    "paymentRazorpayOrder",
    "refundIdempotency",
    "webhookEventId",
  ].filter((key) => duplicates[key]?.length);
  if (blocking.length) {
    throw new Error(`Migration refused: duplicate data blocks required indexes: ${blocking.join(", ")}`);
  }
};

const createRequiredIndexes = async () => {
  const indexes = [
    [Payment.collection, { customerId: 1, idempotencyKey: 1 }, { unique: true, name: "payment_customer_idempotency_unique_partial", partialFilterExpression: { idempotencyKey: { $type: "string" } } }],
    [Payment.collection, { razorpayOrderId: 1 }, { unique: true, sparse: true, name: "payment_razorpay_order_unique" }],
    [Refund.collection, { bookingId: 1, idempotencyKey: 1 }, { unique: true, name: "refund_booking_idempotency_unique_partial", partialFilterExpression: { idempotencyKey: { $type: "string" } } }],
    [WebhookEvent.collection, { eventId: 1 }, { unique: true, name: "razorpay_webhook_event_unique" }],
  ];

  for (const [collection, keys, options] of indexes) {
    await collection.createIndex(keys, options);
    console.log(`Created/verified index ${options.name} on ${collection.name}.`);
  }
};

const backfillMissingRefundCounters = async (refundAccounting) => {
  let updated = 0;
  for (const row of refundAccounting.rows) {
    const payment = await Payment.findOne({ _id: row.paymentId }).select("refundedAmount refundProcessingAmount");
    if (!payment) continue;
    const update = {};
    if (payment.refundedAmount === undefined || payment.refundedAmount === null) {
      update.refundedAmount = Number(row.successfulRefundAmount || 0);
    }
    if (payment.refundProcessingAmount === undefined || payment.refundProcessingAmount === null) {
      update.refundProcessingAmount = Number(row.activeProcessingAmount || 0);
    }
    if (Object.keys(update).length) {
      await Payment.updateOne({ _id: row.paymentId }, { $set: update });
      updated += 1;
    }
  }
  console.log(`Backfilled missing refund counters on ${updated} payment document(s). Existing non-matching values were not overwritten.`);
};

const main = async () => {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is not configured.");
  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`Running production MongoDB ${mode} mode.`);

  await auditIndexes();
  const duplicates = await auditDuplicates();
  const refundAccounting = await auditRefundAccounting();
  await auditRelationships();
  await auditOperationalStates();

  if (mode === "migrate") {
    await assertNoDuplicatesForRequiredIndexes(duplicates);
    await backfillMissingRefundCounters(refundAccounting);
    await createRequiredIndexes();
    console.log("Migration completed without deleting or overwriting business/payment records.");
  } else {
    console.log("Audit mode is read-only. Use --migrate only after resolving reported duplicates and reviewing mismatches.");
  }
};

try {
  await main();
} catch (error) {
  console.error(`Migration failed safely: ${error.message}`);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}

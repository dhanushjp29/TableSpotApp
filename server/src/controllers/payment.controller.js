import Booking from "../models/Booking.js";
import crypto from "node:crypto";
import mongoose from "mongoose";
import Restaurant from "../models/Restaurant.js";
import Bill from "../models/Bill.js";
import Payment from "../models/Payment.js";
import Refund from "../models/Refund.js";
import User from "../models/User.js";
import * as razorpayService from "../services/razorpay.service.js";
import { addBillPayment } from "../services/bill.service.js";
import {
  handlePaymentCaptured,
  notifyPaymentFailedCustomer,
} from "../services/payment.service.js";
import {
  validateAndResolveOrderedFoods,
  validateBookingDraft,
} from "../services/booking.service.js";
import { computeOfferDiscount, validateClaimedOfferForBooking } from "../services/offer.service.js";
import {
  acquireBookingHolds,
  findActiveHoldByToken,
  releaseBookingHolds,
} from "../services/bookingHold.service.js";
import {
  calculateRequiredBookingPayment,
  getEffectiveBookingPaymentPolicy,
} from "../services/bookingPayment.service.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import {
  BOOKING_PAYMENT_POLICY,
  PAYMENT_BOOKING_STATUS,
  PAYMENT_ORDER_STATUS,
  PAYMENT_PURPOSE,
  PAYMENT_STATUS,
  PAYMENT_METHOD,
  PAYMENT_METHOD_VALUES,
  PAYMENT_TRANSACTION_STATUS,
  RAZORPAY_ACCOUNT_STATUS,
  USER_ROLE,
} from "../utils/constants.js";
import { getOwnedRestaurantIds } from "../middleware/ownership.js";
import { assertRestaurantOwnedByUser } from "../middleware/ownership.js";
import { getIO } from "../sockets/socket.handler.js";
import { getTestRazorpayAccountId } from "../config/razorpay.js";

const ONLINE_PAYMENT_METHODS = new Set([
  PAYMENT_METHOD.UPI,
  PAYMENT_METHOD.CARD,
  PAYMENT_METHOD.NET_BANKING,
  PAYMENT_METHOD.WALLET,
]);

const ONLINE_TRANSACTION_STATUS = {
  [PAYMENT_TRANSACTION_STATUS.CAPTURED]: "Success",
  [PAYMENT_TRANSACTION_STATUS.PENDING]: "Pending",
  [PAYMENT_TRANSACTION_STATUS.FAILED]: "Failed",
};

const PURPOSE_LABELS = {
  [PAYMENT_PURPOSE.BOOKING_ADVANCE]: "Booking Advance",
  [PAYMENT_PURPOSE.PREORDER_PAYMENT]: "Pre-Order Payment",
  [PAYMENT_PURPOSE.SPOT_FOOD_PAYMENT]: "Spot Order Payment",
  [PAYMENT_PURPOSE.BILL_PAYMENT]: "Bill Payment",
  [PAYMENT_PURPOSE.REFUND]: "Refund",
  [PAYMENT_PURPOSE.OTHER]: "Other",
};

const roundAmount = (value) => Math.round(Number(value || 0) * 100) / 100;

const getConnectedOwnerPaymentAccount = async (restaurant) => {
  // TEST/DEMO override: when RAZORPAY_MODE=test and TEST_RAZORPAY_ACCOUNT_ID
  // is configured, use that single Route account for all payment flows instead
  // of requiring each owner to have their own connected account.
  const testAccountId = getTestRazorpayAccountId();
  if (testAccountId) {
    return {
      owner: await User.findById(restaurant.ownerId).select(
        "_id bookingStatus razorpayAccountId razorpayAccountStatus"
      ),
      razorpayAccountId: testAccountId,
    };
  }

  const owner = await User.findById(restaurant.ownerId).select(
    "_id bookingStatus razorpayAccountId razorpayAccountStatus"
  );

  if (
    !owner?.razorpayAccountId ||
    owner.razorpayAccountStatus !== RAZORPAY_ACCOUNT_STATUS.CONNECTED
  ) {
    throw new ApiError(
      400,
      "This restaurant's owner does not have a connected Razorpay payment account."
    );
  }

  return {
    owner,
    razorpayAccountId: owner.razorpayAccountId,
  };
};

const releasePaymentFirstHold = async (paymentRecord) => {
  if (!paymentRecord?.bookingData || !paymentRecord.reservationHoldToken) {
    return;
  }

  try {
    await releaseBookingHolds({
      tableIds: (paymentRecord.bookingData.tables || []).map(
        (entry) => entry.tableId
      ),
      holdToken: paymentRecord.reservationHoldToken,
    });
  } catch (releaseError) {
    console.error("Failed to release payment-first booking hold", {
      paymentId: String(paymentRecord._id),
      reason: releaseError.message,
    });
  }
};

const ensurePaymentFirstHold = async ({ paymentRecord }) => {
  if (!paymentRecord?.bookingData || !paymentRecord.reservationHoldToken) {
    return paymentRecord;
  }

  const tableIds = (paymentRecord.bookingData.tables || []).map(
    (entry) => entry.tableId
  );
  const activeHold = await findActiveHoldByToken({
    tableIds,
    holdToken: paymentRecord.reservationHoldToken,
  });
  if (activeHold) return paymentRecord;

  const bookingAt = new Date(paymentRecord.bookingData.bookingDateTime);
  const bookingEnd = new Date(
    bookingAt.getTime() +
      (Number(paymentRecord.bookingData.expectedDuration) || 120) * 60 * 1000
  );
  const holdToken = new mongoose.Types.ObjectId().toString();
  const hold = await acquireBookingHolds({
    restaurantId: paymentRecord.restaurantId,
    tables: paymentRecord.bookingData.tables || [],
    bookingAt,
    bookingEnd,
    customerId: paymentRecord.customerId,
    holdToken,
    ttlMinutes: 2,
  });

  const updated = await Payment.findOneAndUpdate(
    { _id: paymentRecord._id },
    { $set: { reservationHoldToken: hold.holdToken } },
    { new: true }
  );
  if (!updated) {
    await releaseBookingHolds({
      tableIds: hold.tableIds,
      holdToken: hold.holdToken,
    });
    throw new ApiError(409, "Payment order recovery could not be completed.");
  }
  return updated;
};

const stableSerialize = (value) => {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value ?? null);
};

const buildOrderFingerprint = (payload) =>
  crypto
    .createHash("sha256")
    .update(stableSerialize(payload))
    .digest("hex");

const buildOrderReceipt = ({ customerId, idempotencyKey }) =>
  `rcpt_idem_${crypto
    .createHash("sha256")
    .update(`${customerId}:${idempotencyKey}`)
    .digest("hex")
    .slice(0, 24)}`;

const paymentOrderResponse = (paymentRecord) => ({
  order: {
    id: paymentRecord.razorpayOrderId,
    amount: Math.round(Number(paymentRecord.amount) * 100),
    currency: paymentRecord.currency,
  },
  razorpayKeyId: process.env.RAZORPAY_KEY_ID,
  paymentId: paymentRecord._id,
});

const resolveExistingIdempotentPayment = async ({
  paymentRecord,
  fingerprint,
}) => {
  if (
    paymentRecord.idempotencyFingerprint &&
    paymentRecord.idempotencyFingerprint !== fingerprint
  ) {
    throw new ApiError(
      409,
      "This idempotency key was already used with a different payment request."
    );
  }

  if (
    paymentRecord.orderCreationStatus === PAYMENT_ORDER_STATUS.CREATED &&
    paymentRecord.razorpayOrderId
  ) {
    return { paymentRecord, shouldCreate: false };
  }

  const recoveredOrder = await razorpayService.findPaymentOrderByReceipt({
    receipt: paymentRecord.orderReceipt,
  });

  if (recoveredOrder?.id) {
    const updated = await Payment.findOneAndUpdate(
      { _id: paymentRecord._id, razorpayOrderId: null },
      {
        $set: {
          razorpayOrderId: recoveredOrder.id,
          orderCreationStatus: PAYMENT_ORDER_STATUS.CREATED,
          orderCreationError: "",
        },
      },
      { new: true }
    );
    return { paymentRecord: updated || paymentRecord, shouldCreate: false };
  }

  if (
    paymentRecord.orderCreationStatus === PAYMENT_ORDER_STATUS.PROCESSING ||
    paymentRecord.orderCreationStatus === PAYMENT_ORDER_STATUS.RECOVERY_REQUIRED
  ) {
    if (paymentRecord.orderCreationStatus === PAYMENT_ORDER_STATUS.PROCESSING) {
      await Payment.updateOne(
        { _id: paymentRecord._id, orderCreationStatus: PAYMENT_ORDER_STATUS.PROCESSING },
        {
          $set: {
            orderCreationStatus: PAYMENT_ORDER_STATUS.RECOVERY_REQUIRED,
            orderCreationError: "Previous order creation ended before local completion.",
          },
        }
      );
    }
    throw new ApiError(
      409,
      "Payment order creation is still being recovered. Please retry shortly."
    );
  }

  if (paymentRecord.orderCreationStatus === PAYMENT_ORDER_STATUS.FAILED_RETRYABLE) {
    const attemptId = new mongoose.Types.ObjectId().toString();
    const claimed = await Payment.findOneAndUpdate(
      {
        _id: paymentRecord._id,
        orderCreationStatus: PAYMENT_ORDER_STATUS.FAILED_RETRYABLE,
      },
      {
        $set: {
          orderCreationStatus: PAYMENT_ORDER_STATUS.PROCESSING,
          orderCreationAttemptId: attemptId,
          orderCreationStartedAt: new Date(),
          orderCreationError: "",
        },
      },
      { new: true }
    );

    if (claimed) return { paymentRecord: claimed, shouldCreate: true, attemptId };
  }

  throw new ApiError(409, "Payment order creation could not be safely retried.");
};

const reservePaymentOrder = async ({
  paymentData,
  idempotencyKey,
  fingerprint,
  receipt,
}) => {
  const attemptId = new mongoose.Types.ObjectId().toString();
  const insertData = {
    ...paymentData,
    idempotencyKey,
    idempotencyFingerprint: fingerprint,
    orderReceipt: receipt,
    orderCreationStatus: PAYMENT_ORDER_STATUS.PROCESSING,
    orderCreationAttemptId: attemptId,
    orderCreationStartedAt: new Date(),
    orderCreationError: "",
    razorpayOrderId: null,
  };

  let paymentRecord;
  try {
    paymentRecord = await Payment.findOneAndUpdate(
      { customerId: paymentData.customerId, idempotencyKey },
      { $setOnInsert: insertData },
      { new: true, upsert: true }
    );
  } catch (error) {
    if (error?.code !== 11000) throw error;
    paymentRecord = await Payment.findOne({
      customerId: paymentData.customerId,
      idempotencyKey,
    });
  }

  if (!paymentRecord) {
    throw new ApiError(500, "Unable to reserve payment order creation.");
  }

  if (
    paymentRecord.orderCreationAttemptId === attemptId &&
    paymentRecord.orderCreationStatus === PAYMENT_ORDER_STATUS.PROCESSING
  ) {
    return { paymentRecord, shouldCreate: true, attemptId };
  }

  return resolveExistingIdempotentPayment({ paymentRecord, fingerprint });
};

const createReservedRazorpayOrder = async ({
  paymentRecord,
  attemptId,
  bookingId,
  amount,
  razorpayAccountId,
}) => {
  let order;
  try {
    order = await razorpayService.createPaymentOrder({
      bookingId,
      amount,
      razorpayAccountId,
      receipt: paymentRecord.orderReceipt,
    });
  } catch (error) {
    await Payment.updateOne(
      { _id: paymentRecord._id, orderCreationAttemptId: attemptId },
      {
        $set: {
          orderCreationStatus: PAYMENT_ORDER_STATUS.FAILED_RETRYABLE,
          orderCreationError: String(error?.message || "Order creation failed").slice(0, 1000),
        },
      }
    );
    throw error;
  }

  let updated;
  try {
    updated = await Payment.findOneAndUpdate(
      {
        _id: paymentRecord._id,
        orderCreationAttemptId: attemptId,
        orderCreationStatus: PAYMENT_ORDER_STATUS.PROCESSING,
      },
      {
        $set: {
          razorpayOrderId: order.id,
          orderCreationStatus: PAYMENT_ORDER_STATUS.CREATED,
          orderCreationError: "",
        },
      },
      { new: true }
    );
  } catch (error) {
    await Payment.updateOne(
      { _id: paymentRecord._id, orderCreationAttemptId: attemptId },
      {
        $set: {
          orderCreationStatus: PAYMENT_ORDER_STATUS.RECOVERY_REQUIRED,
          orderCreationError: "Razorpay order was created but local payment state could not be updated.",
        },
      }
    );
    throw new ApiError(
      409,
      "Razorpay order was created but payment state requires recovery."
    );
  }

  if (!updated) {
    throw new ApiError(
      409,
      "Razorpay order was created but payment state requires recovery."
    );
  }

  return updated;
};

const buildSummary = (transactions) => {
  const totalPaid = roundAmount(
    transactions
      .filter((t) => t.type === "payment" && t.status === "Success")
      .reduce((sum, t) => sum + Number(t.amount || 0), 0)
  );

  const totalPaidOnline = roundAmount(
    transactions
      .filter(
        (t) =>
          t.type === "payment" &&
          t.status === "Success" &&
          (t.source === "online" || ONLINE_PAYMENT_METHODS.has(t.method))
      )
      .reduce((sum, t) => sum + Number(t.amount || 0), 0)
  );

  const totalPaidOffline = roundAmount(
    transactions
      .filter(
        (t) =>
          t.type === "payment" &&
          t.status === "Success" &&
          t.source === "offline" &&
          t.method === PAYMENT_METHOD.CASH
      )
      .reduce((sum, t) => sum + Number(t.amount || 0), 0)
  );

  const totalRefunded = roundAmount(
    transactions
      .filter((t) => t.type === "refund" && t.status === "Success")
      .reduce((sum, t) => sum + Number(t.amount || 0), 0)
  );

  return {
    totalPaid,
    totalPaidOnline,
    totalPaidOffline,
    totalRefunded,
    netAmount: roundAmount(totalPaid - totalRefunded),
    counts: {
      total: transactions.length,
      success: transactions.filter((t) => t.status === "Success").length,
      pending: transactions.filter((t) => t.status === "Pending").length,
      failed: transactions.filter((t) => t.status === "Failed").length,
    },
  };
};

const REFUND_METHOD_LABELS = {
  CASH: "Cash",
  UPI: "UPI",
  CARD: "Card",
  NET_BANKING: "Net Banking",
  WALLET: "Wallet",
  RAZORPAY: "Online",
};

const REFUND_STATUS_TRANSACTION_STATUS = {
  REFUNDED: "Success",
  REFUND_FAILED: "Failed",
};

const refundToTransaction = (refund) => ({
  type: "refund",
  source: "refund",
  refundId: refund._id,
  refundCode: refund.refundCode,
  purpose: "Refund",
  amount: roundAmount(refund.amount),
  method: REFUND_METHOD_LABELS[refund.refundMethod] || refund.refundMethod || "Refund",
  status: REFUND_STATUS_TRANSACTION_STATUS[refund.refundStatus] || "Pending",
  transactionId: refund.transactionId || refund.gatewayRefundId || null,
  bookingCode: refund.bookingId?.bookingCode || null,
  bookingId: refund.bookingId?._id || refund.bookingId,
  restaurantName: refund.restaurantId?.restaurantName || null,
  restaurantCode: refund.restaurantId?.restaurantCode || null,
  date: refund.completedAt || refund.createdAt,
  notes: refund.remarks || "",
});

/**
 * Initiate a Razorpay payment order for booking
 */
export const createOrder = asyncHandler(async (req, res) => {
    const {
      bookingId,
      purpose = PAYMENT_PURPOSE.BOOKING_ADVANCE,
      idempotencyKey = "",
      amount,
      bookingData,
    } = req.body;

    // =========================== Payment-first ===========================
    // No booking exists yet: the customer pays for a booking draft and the
    // booking is only created (CONFIRMED) once the payment is captured.
    if (!bookingId) {
      return await createPaymentFirstOrder({
        req,
        res,
        purpose,
        idempotencyKey,
        bookingData,
      });
    }
    // =====================================================================

    const booking = await Booking.findById(bookingId).populate("restaurantId");

    if (!booking || booking.isDeleted) {
        throw new ApiError(404, "Booking not found.");
    }

    // Ensure request is made by the customer of the booking or an owner / admin
    if (req.user.role === "customer" && String(booking.userId) !== String(req.user._id)) {
        throw new ApiError(403, "You can only make payment for your own bookings.");
    }
    if (req.user.role !== USER_ROLE.CUSTOMER) {
      await assertRestaurantOwnedByUser(req, booking.restaurantId?._id || booking.restaurantId);
    }

    if (booking.paymentStatus === PAYMENT_STATUS.PAID) {
        throw new ApiError(400, "This booking has already been paid.");
    }

    const restaurant = booking.restaurantId;
    if (!restaurant) {
        throw new ApiError(404, "Restaurant not found for this booking.");
    }

    const policy = getEffectiveBookingPaymentPolicy(restaurant);

    if (
      purpose === PAYMENT_PURPOSE.BOOKING_ADVANCE &&
      policy.type === BOOKING_PAYMENT_POLICY.PAY_ON_SPOT
    ) {
      throw new ApiError(
        400,
        "This restaurant collects payment on the spot; no advance payment is required."
      );
    }

    // Select amount based on purpose
    let amountToCharge = 0;
    let billId = null;

    switch (purpose) {
      case PAYMENT_PURPOSE.BOOKING_ADVANCE:
        amountToCharge = booking.advanceAmount;
        break;
      case PAYMENT_PURPOSE.PREORDER_PAYMENT:
        amountToCharge = booking.totalAmount;
        break;
      case PAYMENT_PURPOSE.BILL_PAYMENT:
        if (!booking.billId) {
          throw new ApiError(400, "This booking does not have an active bill to pay.");
        }
        billId = booking.billId;
        amountToCharge = roundAmount(Number(amount) || 0);
        break;
      default:
        throw new ApiError(400, "Unsupported payment purpose.");
    }

    if (amountToCharge <= 0) {
        throw new ApiError(400, "Booking amount must be greater than zero to initiate payment.");
    }

    if (purpose === PAYMENT_PURPOSE.BILL_PAYMENT) {
      const bill = await Bill.findById(billId);
      if (!bill || bill.isDeleted) {
        throw new ApiError(404, "Bill not found for this booking.");
      }

      const balanceDue = roundAmount(
        bill.grandTotal - (bill.payment?.totalPaid || 0)
      );

      if (amountToCharge > balanceDue) {
        throw new ApiError(
          400,
          "Payment amount exceeds the outstanding bill balance."
        );
      }
    }

    const normalizedIdempotencyKey = String(idempotencyKey || "").trim();

    // User.razorpayAccountId is the canonical owner account. The restaurant
    // copy is intentionally not used because it may be stale after an owner
    // reconnects a different Razorpay account.
    const { razorpayAccountId: ownerRazorpayAccountId } =
      await getConnectedOwnerPaymentAccount(restaurant);

    const fingerprint = buildOrderFingerprint({
      customerId: String(booking.userId),
      bookingId: String(booking._id),
      restaurantId: String(restaurant._id),
      purpose,
      amount: amountToCharge,
      billId: billId ? String(billId) : null,
    });
    const receipt = normalizedIdempotencyKey
      ? buildOrderReceipt({
          customerId: String(booking.userId),
          idempotencyKey: normalizedIdempotencyKey,
        })
      : "";

    const paymentData = {
        bookingId: booking._id,
        customerId: booking.userId,
        ownerId: restaurant.ownerId,
        restaurantId: restaurant._id,
        billId,
        paymentPurpose: purpose,
        amount: amountToCharge,
        currency: "INR",
        paymentStatus: PAYMENT_TRANSACTION_STATUS.PENDING,
        bookingCreationStatus: PAYMENT_BOOKING_STATUS.SUCCEEDED,
    };

    let paymentRecord;
    if (normalizedIdempotencyKey) {
      const reservation = await reservePaymentOrder({
        paymentData,
        idempotencyKey: normalizedIdempotencyKey,
        fingerprint,
        receipt,
      });

      if (!reservation.shouldCreate) {
        return res.status(200).json(
          new ApiResponse(200, "Razorpay payment order already exists.", paymentOrderResponse(reservation.paymentRecord))
        );
      }

      paymentRecord = await createReservedRazorpayOrder({
        paymentRecord: reservation.paymentRecord,
        attemptId: reservation.attemptId,
        bookingId: booking._id,
        amount: amountToCharge,
        razorpayAccountId: ownerRazorpayAccountId,
      });
    } else {
      const order = await razorpayService.createPaymentOrder({
        bookingId: booking._id,
        amount: amountToCharge,
        razorpayAccountId: ownerRazorpayAccountId,
      });
      paymentRecord = await Payment.create({
        ...paymentData,
        razorpayOrderId: order.id,
        orderCreationStatus: PAYMENT_ORDER_STATUS.CREATED,
      });
      return res.status(200).json(
        new ApiResponse(200, "Razorpay payment order generated successfully.", {
          order: { id: order.id, amount: order.amount, currency: order.currency },
          razorpayKeyId: process.env.RAZORPAY_KEY_ID,
          paymentId: paymentRecord._id,
        })
      );
    }

    res.status(200).json(
        new ApiResponse(200, "Razorpay payment order generated successfully.", paymentOrderResponse(paymentRecord))
    );
});

/**
 * Payment-first order creation: validates a booking draft against live
 * availability, computes the required advance from server-side food prices,
 * and stores a Pending Payment with a bookingData snapshot (no Booking row).
 */
const createPaymentFirstOrder = async ({
  req,
  res,
  purpose,
  idempotencyKey,
  bookingData,
}) => {
    if (purpose !== PAYMENT_PURPOSE.BOOKING_ADVANCE) {
      throw new ApiError(
        400,
        "A booking ID is required for this payment purpose."
      );
    }

    if (!bookingData || !bookingData.restaurantId) {
      throw new ApiError(
        400,
        "A booking draft (restaurantId, tables, date, guests) is required to initiate payment."
      );
    }

    const restaurant = await Restaurant.findById(bookingData.restaurantId);

    if (!restaurant || restaurant.isDeleted) {
      throw new ApiError(404, "Restaurant not found.");
    }

    if (!restaurant.isActive) {
      throw new ApiError(400, "Restaurant is not active.");
    }

    if (restaurant.verificationStatus !== "Verified") {
      throw new ApiError(403, "This restaurant is not verified for bookings.");
    }

    const { owner, razorpayAccountId: ownerRazorpayAccountId } =
      await getConnectedOwnerPaymentAccount(restaurant);

    if (owner?.bookingStatus === "BOOKING_RESTRICTED") {
      throw new ApiError(
        409,
        "This restaurant is currently not accepting new bookings."
      );
    }

    const policy = getEffectiveBookingPaymentPolicy(restaurant);

    if (policy.type !== BOOKING_PAYMENT_POLICY.PAY_TO_BOOK) {
      throw new ApiError(
        400,
        "This restaurant does not require an advance payment. Book directly instead."
      );
    }

    // Validate availability now (no hold — the booking does not exist until
    // the payment is captured) so the customer is not charged for a slot that
    // is already gone.
    await validateBookingDraft({
      restaurant,
      tables: bookingData.tables || [],
      numberOfGuests: bookingData.numberOfGuests,
      bookingDateTime: bookingData.bookingDateTime,
      expectedDuration: bookingData.expectedDuration || 120,
      preOrderedFoods: bookingData.preOrderedFoods || [],
    });

    const bookingAt = new Date(bookingData.bookingDateTime);
    const bookingEnd = new Date(
      bookingAt.getTime() + (Number(bookingData.expectedDuration) || 120) * 60 * 1000
    );
    // Compute the required advance from server-side food prices (never the
    // client-supplied price).
    const orderedFoods = await validateAndResolveOrderedFoods({
      foods: bookingData.preOrderedFoods || [],
      restaurantId: restaurant._id,
    });

    const totalAmount = orderedFoods.reduce(
      (sum, item) => sum + Number(item.price) * Number(item.quantity),
      0
    );

    // Validate the claimed offer early so the customer is never charged for a
    // discount that cannot be honoured once the payment captures.
    let claimedOfferId = null;
    let offerDiscount = 0;
    if (bookingData.offerId) {
      const validatedOffer = await validateClaimedOfferForBooking({
        offerId: bookingData.offerId,
        restaurantId: restaurant._id,
        customerId: req.user._id,
        subTotal: totalAmount,
      });
      claimedOfferId = validatedOffer?.offerId || null;
      if (validatedOffer) {
        offerDiscount = computeOfferDiscount({
          offer: validatedOffer,
          subTotal: totalAmount,
        });
      }
    }

    const amountToCharge = calculateRequiredBookingPayment({
      restaurant,
      totalAmount,
      discountAmount: claimedOfferId ? offerDiscount : 0,
    });

    if (amountToCharge <= 0) {
      throw new ApiError(
        400,
        "No advance payment is required for this booking."
      );
    }

    const normalizedIdempotencyKey = String(idempotencyKey || "").trim();
    const bookingSnapshot = {
        restaurantId: restaurant._id,
        tables: (bookingData.tables || []).map((entry) => ({
          tableId: entry.tableId,
          seatIds: entry.seatIds || [],
        })),
        bookingDateTime: bookingAt,
        expectedDuration: Number(bookingData.expectedDuration) || 120,
        numberOfGuests: Number(bookingData.numberOfGuests),
        specialRequest: String(bookingData.specialRequest || "").trim(),
        offerId: claimedOfferId,
        preOrderedFoods: (bookingData.preOrderedFoods || []).map((item) => ({
          foodId: item.foodId,
          variantName: item.variantName || "Regular",
          quantity: Number(item.quantity),
          price: Number(item.price || 0),
        })),
      };
    const fingerprint = buildOrderFingerprint({
      customerId: String(req.user._id),
      purpose,
      amount: amountToCharge,
      bookingData: bookingSnapshot,
    });
    const receipt = normalizedIdempotencyKey
      ? buildOrderReceipt({
          customerId: String(req.user._id),
          idempotencyKey: normalizedIdempotencyKey,
        })
      : "";

    const paymentDataForReservation = {
      bookingId: null,
      bookingData: bookingSnapshot,
      customerId: req.user._id,
      ownerId: restaurant.ownerId,
      restaurantId: restaurant._id,
      billId: null,
      paymentPurpose: purpose,
      amount: amountToCharge,
      currency: "INR",
      paymentStatus: PAYMENT_TRANSACTION_STATUS.PENDING,
      bookingCreationStatus: PAYMENT_BOOKING_STATUS.PENDING,
    };

    if (normalizedIdempotencyKey) {
      const existing = await Payment.findOne({
        customerId: req.user._id,
        idempotencyKey: normalizedIdempotencyKey,
      });

      if (existing) {
        let reservation = await resolveExistingIdempotentPayment({
          paymentRecord: existing,
          fingerprint,
        });

        reservation.paymentRecord = await ensurePaymentFirstHold({
          paymentRecord: reservation.paymentRecord,
        });

        if (reservation.shouldCreate) {
          const paymentRecord = await createReservedRazorpayOrder({
            paymentRecord: reservation.paymentRecord,
            attemptId: reservation.attemptId,
            bookingId: restaurant._id,
            amount: amountToCharge,
            razorpayAccountId: ownerRazorpayAccountId,
          });
          return res.status(200).json(
            new ApiResponse(200, "Razorpay payment order generated successfully.", paymentOrderResponse(paymentRecord))
          );
        }

        return res.status(200).json(
          new ApiResponse(200, "Razorpay payment order already exists.", paymentOrderResponse(reservation.paymentRecord))
        );
      }
    }

    const holdToken = new mongoose.Types.ObjectId().toString();
    const hold = await acquireBookingHolds({
      restaurantId: restaurant._id,
      tables: bookingData.tables || [],
      bookingAt,
      bookingEnd,
      customerId: req.user._id,
      holdToken,
      ttlMinutes: 2,
    });

    let paymentRecord;
    try {
    if (normalizedIdempotencyKey) {
      const reservation = await reservePaymentOrder({
        paymentData: {
          ...paymentDataForReservation,
          reservationHoldToken: hold.holdToken,
        },
        idempotencyKey: normalizedIdempotencyKey,
        fingerprint,
        receipt,
      });

      if (!reservation.shouldCreate) {
        await releaseBookingHolds({ tableIds: hold.tableIds, holdToken: hold.holdToken });
        reservation.paymentRecord = await ensurePaymentFirstHold({
          paymentRecord: reservation.paymentRecord,
        });
        return res.status(200).json(
          new ApiResponse(200, "Razorpay payment order already exists.", paymentOrderResponse(reservation.paymentRecord))
        );
      }

      paymentRecord = await createReservedRazorpayOrder({
        paymentRecord: reservation.paymentRecord,
        attemptId: reservation.attemptId,
        bookingId: restaurant._id,
        amount: amountToCharge,
        razorpayAccountId: ownerRazorpayAccountId,
      });
    } else {
      let order;
      try {
        order = await razorpayService.createPaymentOrder({
          bookingId: restaurant._id,
          amount: amountToCharge,
          razorpayAccountId: ownerRazorpayAccountId,
        });
      } catch (error) {
        await releaseBookingHolds({ tableIds: hold.tableIds, holdToken: hold.holdToken });
        throw error;
      }

      try {
        paymentRecord = await Payment.create({
          ...paymentDataForReservation,
          reservationHoldToken: hold.holdToken,
          razorpayOrderId: order.id,
          orderCreationStatus: PAYMENT_ORDER_STATUS.CREATED,
        });
      } catch (error) {
      try {
        await releaseBookingHolds({
          tableIds: hold.tableIds,
          holdToken: hold.holdToken,
        });
      } catch (releaseError) {
        console.error("Failed to release hold after payment record failure", {
          holdToken: hold.holdToken,
          reason: releaseError.message,
        });
      }
      throw error;
      }
    }
    } catch (error) {
      try {
        await releaseBookingHolds({
          tableIds: hold.tableIds,
          holdToken: hold.holdToken,
        });
      } catch (releaseError) {
        console.error("Failed to release hold after idempotent order failure", {
          holdToken: hold.holdToken,
          reason: releaseError.message,
        });
      }
      throw error;
    }

    res.status(200).json(
      new ApiResponse(200, "Razorpay payment order generated successfully.", paymentOrderResponse(paymentRecord))
    );
  }

/**
 * Verify Razorpay payment signature & update database status
 */
export const verifyPayment = asyncHandler(async (req, res) => {
    const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        bookingId,
        paymentMethod,
    } = req.body;

    console.log(`[PAY-DIAG] verifyPayment ENTER orderId=${razorpay_order_id} paymentId=${razorpay_payment_id} bookingId=${bookingId} method=${paymentMethod} userId=${req.user._id}`);

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        throw new ApiError(400, "All Razorpay payment attributes are required.");
    }

    // Find standalone Payment record
    const paymentRecord = await Payment.findOne({ razorpayOrderId: razorpay_order_id });
    if (!paymentRecord) {
        console.error(`[PAY-DIAG] verifyPayment ABORT: no payment record for orderId=${razorpay_order_id}`);
        throw new ApiError(404, "Associated payment transaction not found.");
    }
    console.log(`[PAY-DIAG] verifyPayment found payment id=${paymentRecord._id} status=${paymentRecord.paymentStatus} amount=${paymentRecord.amount} bookingId=${paymentRecord.bookingId} razorpayPaymentId=${paymentRecord.razorpayPaymentId}`);

    // Only the customer who owns the payment (or an admin) may verify it —
    // never another customer.
    if (
        req.user.role === USER_ROLE.CUSTOMER &&
        String(paymentRecord.customerId) !== String(req.user._id)
    ) {
        throw new ApiError(
            403,
            "You can only verify payments for your own bookings."
        );
    }

    // When a booking ID is supplied it must be the booking this payment
    // belongs to.
    if (bookingId) {
        const booking = await Booking.findById(bookingId);
        if (!booking || booking.isDeleted) {
            throw new ApiError(404, "Booking not found.");
        }

        if (req.user.role !== USER_ROLE.CUSTOMER) {
          await assertRestaurantOwnedByUser(req, booking.restaurantId);
        }

        if (String(paymentRecord.bookingId) !== String(booking._id)) {
            throw new ApiError(
                409,
                "Payment transaction does not belong to this booking."
            );
        }
    }

    // Idempotency: a payment already captured and linked to a booking should
    // not be processed twice. A captured payment-first record without a
    // booking must continue through materialization so customer retries can
    // recover it instead of returning a false success.
    console.log(`[PAY-DIAG] verifyPayment IDEMPOTENCY CHECK: paymentStatus=${paymentRecord.paymentStatus} CAPTURED=${PAYMENT_TRANSACTION_STATUS.CAPTURED} match=${paymentRecord.razorpayPaymentId === razorpay_payment_id} bookingId=${paymentRecord.bookingId}`);
    if (
      paymentRecord.paymentStatus === PAYMENT_TRANSACTION_STATUS.CAPTURED &&
      paymentRecord.razorpayPaymentId === razorpay_payment_id &&
      paymentRecord.bookingId
    ) {
      const linkedBooking = paymentRecord.bookingId
        ? await Booking.findById(paymentRecord.bookingId)
        : null;

      return res.status(200).json(
        new ApiResponse(200, "Payment already verified.", {
          bookingId: linkedBooking?._id || paymentRecord.bookingId || null,
          bookingStatus: linkedBooking?.bookingStatus || null,
          paymentStatus: linkedBooking?.paymentStatus || paymentRecord.paymentStatus,
          paymentId: paymentRecord._id,
        })
      );
    }

    try {
        // Verify Signature
        console.log(`[PAY-DIAG] verifyPayment VERIFYING SIGNATURE...`);
        razorpayService.verifyPaymentSignature({
            razorpayOrderId: razorpay_order_id,
            razorpayPaymentId: razorpay_payment_id,
            razorpaySignature: razorpay_signature,
        });
    } catch (error) {
        // Mark Payment status as Failed on validation crash
        const wasFailed =
            paymentRecord.paymentStatus === PAYMENT_TRANSACTION_STATUS.FAILED;
        paymentRecord.paymentStatus = PAYMENT_TRANSACTION_STATUS.FAILED;
        await paymentRecord.save();
        await releasePaymentFirstHold(paymentRecord);

        // Notify once — only when this marks the first transition to FAILED,
        // so the webhook's payment.failed event cannot double-notify.
        if (!wasFailed) {
            await notifyPaymentFailedCustomer({ paymentRecord });
        }
        throw error;
    }

    paymentRecord.razorpaySignature = razorpay_signature;
    await paymentRecord.save();
    console.log(`[PAY-DIAG] verifyPayment SIGNATURE VERIFIED, saved razorpaySignature`);

    // Use the payment method supplied by the client for this transaction when
    // available; otherwise derive it from the stored payment record, and only
    // fall back to a default when neither is present.
    const resolvedPaymentMethod = PAYMENT_METHOD_VALUES.includes(paymentMethod)
        ? paymentMethod
        : paymentRecord.paymentMethod || PAYMENT_METHOD.CARD;

    console.log(`[PAY-DIAG] verifyPayment CALLING handlePaymentCaptured with orderId=${razorpay_order_id} paymentId=${razorpay_payment_id} method=${resolvedPaymentMethod}`);
    await handlePaymentCaptured({
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      paymentMethod: resolvedPaymentMethod,
      transactionNotes: `Paid via Razorpay. Order ID: ${razorpay_order_id}`,
    });

    console.log(`[PAY-DIAG] verifyPayment handlePaymentCaptured COMPLETED`);
    // handlePaymentCaptured may have created the booking (payment-first), so
    // re-read the payment record to pick up the newly linked booking id.
    const freshPayment = await Payment.findById(paymentRecord._id);
    let linkedBooking = null;
    if (freshPayment.bookingId) {
      linkedBooking = await Booking.findById(freshPayment.bookingId);
    }

    console.log(`[PAY-DIAG] verifyPayment RESPONSE: freshPaymentId=${freshPayment._id} freshPaymentStatus=${freshPayment.paymentStatus} freshPaymentBookingId=${freshPayment.bookingId} linkedBookingId=${linkedBooking?._id} linkedBookingAdvanceAmount=${linkedBooking?.advanceAmount} linkedBookingPaymentStatus=${linkedBooking?.paymentStatus}`);
    res.status(200).json(
        new ApiResponse(200, "Payment verified and booking confirmed successfully.", {
            bookingId: linkedBooking?._id || freshPayment.bookingId || null,
            bookingStatus: linkedBooking?.bookingStatus || null,
            paymentStatus: linkedBooking?.paymentStatus || freshPayment.paymentStatus,
            paymentId: freshPayment._id,
        })
    );
});

/**
 * Get an aggregated, role-scoped payment/transaction history.
 * - Customer: all payments made against their own bookings.
 * - Owner: all payments received across their restaurants.
 * - Admin: all payments in the platform.
 *
 * Combines online Razorpay transactions (Payment collection) with
 * offline bill payments (Bill.payment.payments) and returns a unified
 * ledger ordered by date (newest first).
 */
export const getHistory = asyncHandler(async (req, res) => {
    const { bookingId, restaurantId, paymentMethod, purpose, status } = req.query;

    let paymentQuery = {};
    let billQuery = { isDeleted: false };
    let refundQuery = {};

    if (req.user.role === USER_ROLE.CUSTOMER) {
        paymentQuery.customerId = req.user._id;
        refundQuery.customerId = req.user._id;

        const userBookings = await Booking.find({
            userId: req.user._id,
            isDeleted: false,
        })
            .select("_id")
            .lean();
        billQuery.bookingId = { $in: userBookings.map((b) => b._id) };
    } else if (req.user.role === USER_ROLE.OWNER) {
        const ownedRestaurantIds = await getOwnedRestaurantIds(req);

        if (!ownedRestaurantIds.length) {
            return res.status(200).json(
                new ApiResponse(200, "Payment history retrieved successfully.", {
                    transactions: [],
                    summary: buildSummary([]),
                })
            );
        }

        paymentQuery = {
            ownerId: req.user._id,
            restaurantId: { $in: ownedRestaurantIds },
        };

        refundQuery = {
            ownerId: req.user._id,
            restaurantId: { $in: ownedRestaurantIds },
        };

        if (restaurantId) {
            await assertRestaurantOwnedByUser(req, restaurantId);
            paymentQuery.restaurantId = restaurantId;
            refundQuery.restaurantId = restaurantId;
            const scopedBookings = await Booking.find({
                restaurantId,
                isDeleted: false,
            })
                .select("_id")
                .lean();
            billQuery.bookingId = { $in: scopedBookings.map((b) => b._id) };
        } else {
            const restaurantBookings = await Booking.find({
                restaurantId: { $in: ownedRestaurantIds },
                isDeleted: false,
            })
                .select("_id")
                .lean();
            billQuery.bookingId = { $in: restaurantBookings.map((b) => b._id) };
        }
    }

    if (bookingId) {
        if (req.user.role === USER_ROLE.OWNER) {
            const booking = await Booking.findById(bookingId).select("restaurantId").lean();
            if (!booking) {
                throw new ApiError(404, "Booking not found.");
            }
            await assertRestaurantOwnedByUser(req, booking.restaurantId);
        }
        paymentQuery.bookingId = bookingId;
        billQuery.bookingId = bookingId;
        refundQuery.bookingId = bookingId;
    }

    const [onlinePayments, bills, refunds] = await Promise.all([
        Payment.find(paymentQuery)
            .populate("bookingId", "bookingCode bookingDateTime")
            .populate("restaurantId", "restaurantCode restaurantName slug city state country coverImage averageRating address pincode phoneNumber email")
            .sort({ createdAt: -1 })
            .lean(),
        Bill.find(billQuery)
            .populate({
                path: "bookingId",
                select: "bookingCode bookingDateTime restaurantId",
                populate: {
                    path: "restaurantId",
                    select: "restaurantCode restaurantName",
                },
            })
            .sort({ createdAt: -1 })
            .lean(),
        Refund.find(refundQuery)
            .populate("bookingId", "bookingCode bookingDateTime")
            .populate("restaurantId", "restaurantCode restaurantName slug city state country coverImage averageRating address pincode phoneNumber email")
            .sort({ createdAt: -1 })
            .lean(),
    ]);

    const transactions = [];
    const razorpayTransactionIds = new Set();

    // Online booking payments (source of truth for Razorpay)
    for (const payment of onlinePayments) {
        if (payment.razorpayPaymentId) {
            razorpayTransactionIds.add(payment.razorpayPaymentId);
        }

        transactions.push({
            type: "payment",
            source: "online",
            paymentId: payment._id,
            purpose: PURPOSE_LABELS[payment.paymentPurpose] || "Booking Advance",
            amount: roundAmount(payment.amount),
            method: payment.paymentMethod || "Online",
            status: ONLINE_TRANSACTION_STATUS[payment.paymentStatus] || payment.paymentStatus,
            transactionId: payment.razorpayPaymentId || payment.razorpayOrderId,
            bookingCode: payment.bookingId?.bookingCode || null,
            bookingId: payment.bookingId?._id || payment.bookingId,
            restaurantName: payment.restaurantId?.restaurantName || null,
            restaurantCode: payment.restaurantId?.restaurantCode || null,
            date: payment.createdAt,
            notes: "",
        });
    }

    // Offline bill payments (skipping Razorpay entries already counted above)
    for (const bill of bills) {
        const booking = bill.bookingId;
        const restaurant = booking?.restaurantId || null;
        const paymentEntries = bill.payment?.payments || [];

        paymentEntries.forEach((entry, index) => {
            if (entry.transactionId && razorpayTransactionIds.has(entry.transactionId)) {
                return;
            }

            if (
                entry.paymentMethod === PAYMENT_METHOD.CARD &&
                (entry.notes || "").includes("Razorpay")
            ) {
                return;
            }

            const notes = (entry.notes || "").toLowerCase();
            let purpose = "Bill Payment";
            if (notes.includes("pre-order")) purpose = "Pre-Order Payment";
            else if (notes.includes("spot")) purpose = "Spot Order Payment";

            transactions.push({
                type: "payment",
                source: "offline",
              paymentId: `${bill._id}:${index}`,
              billId: bill._id,
                purpose,
                amount: roundAmount(entry.amount),
                method: entry.paymentMethod,
                status: "Success",
                transactionId: entry.transactionId || null,
                bookingCode: booking?.bookingCode || null,
                bookingId: booking?._id || bill.bookingId,
                restaurantName: restaurant?.restaurantName || null,
                restaurantCode: restaurant?.restaurantCode || null,
                date: entry.paidAt || bill.createdAt,
                notes: entry.notes || "",
            });
        });
    }

    // Refund transactions (debits) so the history shows money out as well as in
    for (const refund of refunds) {
        transactions.push(refundToTransaction(refund));
    }

    transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

    const filteredTransactions = transactions.filter((t) => {
        if (paymentMethod && t.method !== paymentMethod) return false;
        if (purpose && t.purpose !== purpose) return false;
        if (status && t.status !== status) return false;
        return true;
    });

    res.status(200).json(
        new ApiResponse(200, "Payment history retrieved successfully.", {
            transactions: filteredTransactions,
            summary: buildSummary(transactions),
        })
    );
});

import Booking from "../models/Booking.js";
import Payment from "../models/Payment.js";
import { addBillPayment } from "./bill.service.js";
import { createBookingFromPayment } from "./booking.service.js";
import { createAuditLog } from "./auditLog.service.js";
import {
  BOOKING_STATUS,
  PAYMENT_METHOD,
  PAYMENT_STATUS,
  PAYMENT_TRANSACTION_STATUS,
} from "../utils/constants.js";
import { getIO } from "../sockets/socket.handler.js";

const roundAmount = (value) => Math.round(Number(value || 0) * 100) / 100;

/**
 * Map a Razorpay payment method code to the app's payment method enum.
 */
export const mapRazorpayMethod = (method) => {
  switch ((method || "").toLowerCase()) {
    case "upi":
      return PAYMENT_METHOD.UPI;
    case "card":
    case "emi":
      return PAYMENT_METHOD.CARD;
    case "netbanking":
      return PAYMENT_METHOD.NET_BANKING;
    case "wallet":
      return PAYMENT_METHOD.WALLET;
    default:
      return PAYMENT_METHOD.CARD;
  }
};

/**
 * Mark a Razorpay payment as captured and reflect it on the booking/bill.
 * Idempotent: already-captured payments are returned untouched.
 */
export const handlePaymentCaptured = async ({
  razorpayOrderId,
  razorpayPaymentId,
  paymentMethod,
  transactionNotes = "",
}) => {
  const paymentRecord = await Payment.findOne({ razorpayOrderId });

  if (!paymentRecord) {
    throw new Error(`No payment record found for order ${razorpayOrderId}`);
  }

  if (paymentRecord.paymentStatus === PAYMENT_TRANSACTION_STATUS.CAPTURED) {
    return { duplicate: true, paymentRecord };
  }

  paymentRecord.razorpayPaymentId = razorpayPaymentId;
  paymentRecord.paymentStatus = PAYMENT_TRANSACTION_STATUS.CAPTURED;
  paymentRecord.paymentMethod = paymentMethod || PAYMENT_METHOD.CARD;
  await paymentRecord.save();

  try {
    await createAuditLog({
      eventType: "PAYMENT_CAPTURED",
      eventAction: "payment_captured",
      bookingId: paymentRecord.bookingId,
      billId: paymentRecord.billId,
      paymentId: paymentRecord._id,
      restaurantId: paymentRecord.restaurantId,
      userId: paymentRecord.customerId,
      amount: paymentRecord.amount,
      status: PAYMENT_TRANSACTION_STATUS.CAPTURED,
      metadata: {
        razorpayOrderId,
        razorpayPaymentId,
        paymentPurpose: paymentRecord.paymentPurpose,
      },
    });
  } catch (error) {
    console.error("Audit log error on payment captured:", error.message);
  }

  // Payment-first: the payment has no booking yet — atomically create the
  // CONFIRMED booking from the bookingData snapshot now that the money is
  // captured, then link the two records.
  let booking = paymentRecord.bookingId
    ? await Booking.findById(paymentRecord.bookingId)
    : null;

  if (!booking && paymentRecord.bookingData) {
    const created = await createBookingFromPayment({ paymentRecord });
    booking = created.booking;

    paymentRecord.bookingId = booking._id;
    await paymentRecord.save();
  }

  if (booking && !booking.isDeleted) {
    booking.paymentMethod = paymentRecord.paymentMethod;

    let finalPaymentStatus = PAYMENT_STATUS.PARTIALLY_PAID;
    if (roundAmount(paymentRecord.amount) >= roundAmount(booking.totalAmount)) {
      finalPaymentStatus = PAYMENT_STATUS.PAID;
    }
    booking.paymentStatus = finalPaymentStatus;

    if (booking.bookingStatus === BOOKING_STATUS.PENDING) {
      booking.bookingStatus = BOOKING_STATUS.CONFIRMED;
    }

    await booking.save();

    if (booking.billId) {
      try {
        await addBillPayment({
          billId: booking.billId,
          paymentMethod: paymentRecord.paymentMethod,
          amount: paymentRecord.amount,
          transactionId: razorpayPaymentId,
          notes:
            transactionNotes ||
            `Paid via Razorpay. Order ID: ${razorpayOrderId}`,
        });
      } catch (error) {
        console.error(
          "Webhook bill ledger update failed:",
          error.message
        );
      }
    }

    try {
      const io = getIO();
      io.to(`restaurant_${booking.restaurantId}`).emit(
        "booking:statusUpdated",
        {
          bookingId: booking._id,
          status: booking.bookingStatus,
          paymentStatus: booking.paymentStatus,
        }
      );
    } catch (error) {
      console.error("Socket emit failed on captured payment:", error.message);
    }
  }

  return { duplicate: false, paymentRecord };
};

/**
 * Mark a Razorpay payment as failed (only if not already captured).
 */
export const handlePaymentFailed = async ({ razorpayOrderId, razorpayPaymentId = "" }) => {
  const paymentRecord = await Payment.findOne({ razorpayOrderId });

  if (!paymentRecord) return null;

  if (paymentRecord.paymentStatus === PAYMENT_TRANSACTION_STATUS.CAPTURED) {
    return paymentRecord;
  }

  paymentRecord.razorpayPaymentId = razorpayPaymentId || paymentRecord.razorpayPaymentId;
  paymentRecord.paymentStatus = PAYMENT_TRANSACTION_STATUS.FAILED;
  await paymentRecord.save();

  try {
    await createAuditLog({
      eventType: "PAYMENT_FAILED",
      eventAction: "payment_failed",
      bookingId: paymentRecord.bookingId,
      billId: paymentRecord.billId,
      paymentId: paymentRecord._id,
      restaurantId: paymentRecord.restaurantId,
      userId: paymentRecord.customerId,
      amount: paymentRecord.amount,
      status: PAYMENT_TRANSACTION_STATUS.FAILED,
      metadata: {
        razorpayOrderId,
        razorpayPaymentId,
        paymentPurpose: paymentRecord.paymentPurpose,
      },
    });
  } catch (error) {
    console.error("Audit log error on payment failed:", error.message);
  }

  return paymentRecord;
};

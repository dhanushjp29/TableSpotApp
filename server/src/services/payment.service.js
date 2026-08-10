import Booking from "../models/Booking.js";
import Bill from "../models/Bill.js";
import Payment from "../models/Payment.js";
import { addBillPayment } from "./bill.service.js";
import { createBookingFromPayment } from "./booking.service.js";
import { createAuditLog } from "./auditLog.service.js";
import { createNotification } from "./notification.service.js";
import { sendPaymentEventEmail } from "./businessEmail.service.js";
import {
  BOOKING_STATUS,
  PAYMENT_METHOD,
  PAYMENT_STATUS,
  PAYMENT_TRANSACTION_STATUS,
} from "../utils/constants.js";
import { getIO } from "../sockets/socket.handler.js";

const roundAmount = (value) => Math.round(Number(value || 0) * 100) / 100;

const formatAmount = (value) =>
  `₹${roundAmount(value).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;

/**
 * Resolve the human-friendly reference label and the notification link target
 * for a payment record. Bill payments link to the Bill; booking payments link
 * to the Booking. Returns an empty label/link when neither exists (e.g. a
 * failed payment-first order that never produced a booking).
 */
const resolvePaymentReference = async ({ paymentRecord, booking }) => {
  if (paymentRecord.billId) {
    const bill = await Bill.findById(paymentRecord.billId)
      .select("billCode")
      .lean();
    if (bill) {
      return {
        label: `bill ${bill.billCode}`,
        linkId: bill._id,
        linkModel: "Bill",
      };
    }
  }

  if (booking) {
    return {
      label: `booking ${booking.bookingCode}`,
      linkId: booking._id,
      linkModel: "Booking",
    };
  }

  return { label: "", linkId: null, linkModel: "" };
};

/**
 * Notify the customer that a payment failed. Safe to call from the webhook
 * handler and from frontend signature verification — callers must guard on
 * the payment's previous status so the event is notified exactly once.
 */
export const notifyPaymentFailedCustomer = async ({ paymentRecord }) => {
  if (!paymentRecord?.customerId) return;

  try {
    const booking = paymentRecord.bookingId
      ? await Booking.findById(paymentRecord.bookingId)
      : null;
    const reference = await resolvePaymentReference({
      paymentRecord,
      booking,
    });
    const referenceSuffix = reference?.label ? ` for ${reference.label}` : "";
    await createNotification({
      userId: paymentRecord.customerId,
      title: "Payment Failed",
      message: `Your payment of ${formatAmount(paymentRecord.amount)}${referenceSuffix} could not be completed.`,
      type: "Payment",
      linkId: reference?.linkId || null,
      linkModel: reference?.linkModel || "",
    });
  } catch (error) {
    console.error("Notification error on payment failed:", error.message);
  }
};

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
    let booking = paymentRecord.bookingId
      ? await Booking.findById(paymentRecord.bookingId)
      : null;

    if (!booking && paymentRecord.bookingData) {
      booking = await Booking.findOne({
        sourcePaymentId: paymentRecord._id,
        isDeleted: false,
      });
    }

    if (booking) {
      if (!paymentRecord.bookingId) {
        paymentRecord.bookingId = booking._id;
        await paymentRecord.save();
      }

      return { duplicate: true, paymentRecord };
    }
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
          source: "online",
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

  // Notify the customer ("Payment Successful") and the owner ("Payment
  // Received"). This branch only runs on the first capture of this payment;
  // handlePaymentCaptured returns early with { duplicate: true } for any
  // re-delivery, so the webhook and frontend verification cannot double-notify.
  if (paymentRecord.customerId || paymentRecord.ownerId) {
    let reference = null;
    try {
      reference = await resolvePaymentReference({ paymentRecord, booking });
    } catch (error) {
      console.error("Notification reference error on payment success:", error.message);
    }

    const referenceSuffix = reference?.label ? ` for ${reference.label}` : "";

    if (paymentRecord.customerId) {
      try {
        await createNotification({
          userId: paymentRecord.customerId,
          title: "Payment Successful",
          message: `Your payment of ${formatAmount(paymentRecord.amount)}${referenceSuffix} was successful.`,
          type: "Payment",
          linkId: reference?.linkId || null,
          linkModel: reference?.linkModel || "",
        });
      } catch (error) {
        console.error("Notification error on payment success:", error.message);
      }
    }

    if (paymentRecord.ownerId) {
      try {
        await createNotification({
          userId: paymentRecord.ownerId,
          title: "Payment Received",
          message: `${formatAmount(paymentRecord.amount)} payment received${referenceSuffix}.`,
          type: "Payment",
          linkId: reference?.linkId || null,
          linkModel: reference?.linkModel || "",
        });
      } catch (error) {
        console.error("Notification error on payment received:", error.message);
      }
    }
  }

  void sendPaymentEventEmail({ paymentId: paymentRecord._id, event: "successful" }).catch((error) => console.error("Payment success email error:", error.message));

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

  const wasFailed =
    paymentRecord.paymentStatus === PAYMENT_TRANSACTION_STATUS.FAILED;

  paymentRecord.razorpayPaymentId = razorpayPaymentId || paymentRecord.razorpayPaymentId;
  paymentRecord.paymentStatus = PAYMENT_TRANSACTION_STATUS.FAILED;
  await paymentRecord.save();

  if (paymentRecord.reservationHoldToken && paymentRecord.bookingData) {
    await releaseBookingHolds({
      tableIds: (paymentRecord.bookingData.tables || []).map((entry) => entry.tableId),
      holdToken: paymentRecord.reservationHoldToken,
    });
  }

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

  // Notify the customer about the failed payment. Idempotent: only the first
  // transition into the FAILED state triggers a notification, so webhook
  // retries and the frontend verification path cannot double-notify.
  if (!wasFailed) {
    await notifyPaymentFailedCustomer({ paymentRecord });
    void sendPaymentEventEmail({ paymentId: paymentRecord._id, event: "failed" }).catch((error) => console.error("Payment failure email error:", error.message));
  }

  return paymentRecord;
};
import { releaseBookingHolds } from "./bookingHold.service.js";

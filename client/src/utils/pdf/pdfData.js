// Data enrichment helpers for the PDF download buttons. Each returns the
// full set of documents a receipt needs (transaction + booking + bill).

import { bookingApi } from "../../api/booking.api.js";
import { billApi } from "../../api/bill.api.js";
import { refundApi } from "../../api/refund.api.js";

/** Fetch a booking and its linked bill (when present). Failures fall back to null. */
export const fetchBookingAndBill = async (bookingId) => {
  let booking = null;
  if (bookingId) {
    try {
      const bookingRes = await bookingApi.getById(bookingId);
      booking = bookingRes?.data?.booking || null;
    } catch {
      booking = null;
    }
  }

  let bill = null;
  const linkedBillId = booking?.billId
    ? typeof booking.billId === "object"
      ? booking.billId._id
      : booking.billId
    : null;
  if (linkedBillId) {
    try {
      const billRes = await billApi.getById(linkedBillId);
      bill = billRes?.data?.bill || null;
    } catch {
      bill = null;
    }
  }

  return { booking, bill };
};

/** Resolve a refund and its booking/bill. `fallback` is used if the detail fetch fails. */
export const fetchRefundReceiptData = async (refundId, fallback = null) => {
  let refund = fallback;
  if (refundId) {
    try {
      const refundRes = await refundApi.getById(refundId);
      refund = refundRes?.data?.refund || refund;
    } catch {
      // keep the fallback refund
    }
  }

  const bookingId =
    (typeof refund?.bookingId === "object"
      ? refund.bookingId._id
      : refund?.bookingId) || null;
  const { booking, bill } = await fetchBookingAndBill(bookingId);

  return { refund, booking, bill };
};

/** Build the receipt data for a payment-history transaction row. */
export const fetchPaymentReceiptData = async (transaction) => {
  if (transaction.type === "refund") {
    const data = await fetchRefundReceiptData(transaction.refundId, null);
    return { transaction, ...data };
  }
  const { booking, bill } = await fetchBookingAndBill(transaction.bookingId);
  return { transaction, booking, bill, refund: null };
};

export const paymentReceiptFilename = (data) => {
  const { transaction } = data;
  const ref =
    transaction.transactionId ||
    (transaction.paymentId
      ? String(transaction.paymentId).slice(-8)
      : "receipt");
  return `TableSpot_Payment_${ref}.pdf`;
};

export const refundReceiptFilename = (data) => {
  const code =
    data.refund?.refundCode ||
    data.refund?.transactionId ||
    data.transaction?.refundCode ||
    "receipt";
  return `TableSpot_Refund_${code}.pdf`;
};

export const bookingReceiptFilename = (data) =>
  `TableSpot_Booking_${data.booking?.bookingCode || "booking"}.pdf`;

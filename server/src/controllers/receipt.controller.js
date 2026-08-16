import { USER_ROLE } from "../utils/constants.js";
import ApiError from "../utils/ApiError.js";
import * as bookingService from "../services/booking.service.js";
import * as billService from "../services/bill.service.js";
import * as refundService from "../services/refund.service.js";
import Payment from "../models/Payment.js";
import Restaurant from "../models/Restaurant.js";
import { verifyBillAccess, verifyBookingAccess } from "../middleware/ownership.js";
import { createBillPdf, createBookingPdf, createPaymentPdf, createRefundPdf } from "../services/emailPdf.service.js";
import { buildBillReceiptData, buildBookingReceiptData, buildPaymentReceiptData, buildRefundReceiptData } from "../services/receiptData.service.js";

const getId = (value) => value?._id || value;

const assertPaymentAccess = (req, payment) => {
  if (req.user.role === USER_ROLE.ADMIN) return;
  const allowedId = req.user.role === USER_ROLE.CUSTOMER ? getId(payment.customerId) : getId(payment.ownerId);
  if (String(allowedId) !== String(req.user._id)) throw new ApiError(403, "You do not have access to this payment receipt.");
};

const assertRefundAccess = async (req, refund) => {
  if (req.user.role === USER_ROLE.ADMIN) return;
  const targetId = req.user.role === USER_ROLE.CUSTOMER ? getId(refund.customerId) : getId(refund.ownerId);
  if (String(targetId) !== String(req.user._id)) throw new ApiError(403, "You do not have access to this refund receipt.");
  if (req.user.role === USER_ROLE.OWNER) {
    const restaurant = await Restaurant.findById(getId(refund.restaurantId)).select("ownerId");
    if (!restaurant || String(restaurant.ownerId) !== String(req.user._id)) throw new ApiError(403, "You do not have access to this refund receipt.");
  }
};

const sendPdf = (res, buffer, filename) => {
  res.set({ "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${filename}"`, "Content-Length": buffer.length, "Cache-Control": "private, no-store" });
  res.send(buffer);
};

export const booking = async (req, res) => {
  const { booking } = await bookingService.getBookingById({ bookingId: req.params.id });
  await verifyBookingAccess(req, booking);
  const receiptData = buildBookingReceiptData({ booking });
  sendPdf(res, await createBookingPdf({ booking, receiptData }), `TableSpot-Receipt-${booking.bookingCode || "booking"}.pdf`);
};

export const bill = async (req, res) => {
  const { bill } = await billService.getBillById({ billId: req.params.id });
  if (bill.bookingId?._id) await verifyBillAccess(req, bill.bookingId._id);
  else if (req.user.role !== USER_ROLE.ADMIN) {
    const restaurant = await Restaurant.findById(getId(bill.restaurantId)).select("ownerId");
    if (req.user.role !== USER_ROLE.OWNER || !restaurant || String(restaurant.ownerId) !== String(req.user._id)) throw new ApiError(403, "You do not have access to this bill receipt.");
  }
  const receiptData = buildBillReceiptData({ bill, booking: bill.bookingId || null });
  sendPdf(res, await createBillPdf({ bill, booking: bill.bookingId || null, receiptData }), `TableSpot-Receipt-${bill.billCode || "bill"}.pdf`);
};

export const payment = async (req, res) => {
  const paymentRecord = await Payment.findById(req.params.id)
    .populate({ path: "bookingId", populate: [
      { path: "userId", select: "fullName email phoneNumber" },
      { path: "restaurantId", select: "restaurantName address city state country pincode phoneNumber email" },
      { path: "tableId", select: "tableCode tableNumber tableName tableLabel" },
    ] })
    .populate("billId")
    .populate("restaurantId", "restaurantName address city state country pincode phoneNumber email gstin")
    .populate("customerId", "fullName email phoneNumber")
    .lean();
  if (!paymentRecord) throw new ApiError(404, "Payment not found.");
  assertPaymentAccess(req, paymentRecord);
  const reference = paymentRecord.razorpayPaymentId || paymentRecord.razorpayOrderId || paymentRecord._id;
  const receiptData = buildPaymentReceiptData({ payment: paymentRecord, booking: paymentRecord.bookingId, bill: paymentRecord.billId });
  sendPdf(res, await createPaymentPdf({ payment: paymentRecord, booking: paymentRecord.bookingId, bill: paymentRecord.billId, receiptData }), `TableSpot-Receipt-${reference}.pdf`);
};

export const refund = async (req, res) => {
  const { refund } = await refundService.getRefundById({ refundId: req.params.id });
  await assertRefundAccess(req, refund);
  const payment = refund.paymentId ? await Payment.findById(refund.paymentId).select("razorpayOrderId razorpayPaymentId paymentMethod paymentStatus createdAt").lean() : null;
  const receiptData = buildRefundReceiptData({ refund, booking: refund.bookingId, bill: refund.billId, payment });
  sendPdf(res, await createRefundPdf({ refund, booking: refund.bookingId, bill: refund.billId, payment, receiptData }), `TableSpot-Receipt-${refund.refundCode || "refund"}.pdf`);
};

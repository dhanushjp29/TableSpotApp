import Booking from "../models/Booking.js";
import Bill from "../models/Bill.js";
import EmailDelivery from "../models/EmailDelivery.js";
import Payment from "../models/Payment.js";
import Refund from "../models/Refund.js";
import User from "../models/User.js";
import { compileTemplate } from "../utils/templateParser.js";
import { sendEmail } from "./email.service.js";
import { createBillPdf, createBookingPdf, createPaymentPdf, createRefundPdf } from "./emailPdf.service.js";

const escapeHtml = (input) => String(input ?? "—").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
const money = (input) => `INR ${Number(input || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const details = (rows) => rows.filter(([, content]) => content !== undefined && content !== null && content !== "").map(([label, content]) => `<div style="margin:0 0 10px;"><span style="display:inline-block;min-width:145px;color:#6b7280;font-size:13px;">${escapeHtml(label)}</span><strong style="color:#111827;font-size:13px;">${escapeHtml(content)}</strong></div>`).join("");

const claimDelivery = async ({ eventKey, recipient, template }) => {
  if (!recipient) return null;
  try {
    return await EmailDelivery.create({ eventKey, recipient, template, status: "PENDING" });
  } catch (error) {
    if (error?.code === 11000) {
      // A completed or in-flight delivery is never sent again. A previous
      // transport failure may be retried safely when the source event is
      // replayed, while the atomic status condition still prevents races.
      return EmailDelivery.findOneAndUpdate(
        { eventKey, status: "FAILED" },
        { $set: { status: "PENDING", recipient, template, error: "" } },
        { new: true }
      );
    }
    throw error;
  }
};

const deliver = async ({ eventKey, to, template, subject, variables, attachments = [] }) => {
  const delivery = await claimDelivery({ eventKey, recipient: to, template });
  if (!delivery) return false;
  try {
    await sendEmail({ to, subject, html: compileTemplate(template, variables), attachments });
    await EmailDelivery.findByIdAndUpdate(delivery._id, { status: "SENT", sentAt: new Date(), error: "" });
    return true;
  } catch (error) {
    await EmailDelivery.findByIdAndUpdate(delivery._id, { status: "FAILED", error: error.message });
    console.error(`Business email failed (${template}):`, error.message);
    return false;
  }
};

const baseVariables = ({ label, title, name, message, rows, cta = "" }) => ({
  EVENT_LABEL: label,
  TITLE: title,
  NAME: name || "there",
  MESSAGE: message,
  DETAILS: details(rows),
  CTA_BLOCK: cta ? `<p style="margin:22px 0 0;text-align:center;"><a href="${escapeHtml(cta)}" style="display:inline-block;background:#dc2626;color:#ffffff;text-decoration:none;border-radius:8px;padding:12px 20px;font-weight:700;font-size:13px;">Open TableSpot</a></p>` : "",
  YEAR: new Date().getFullYear(),
});

const populatedBooking = (bookingId) => Booking.findById(bookingId)
  .populate("userId", "fullName email phoneNumber")
  .populate("restaurantId", "restaurantName address city state country ownerId")
  .populate("tableId", "tableName tableCode tableNumber")
  .populate("billId")
  .populate("refundId");

export const sendBookingEventEmail = async ({ bookingId, event }) => {
  const booking = await populatedBooking(bookingId);
  if (!booking) return;
  const isCompleted = event === "completed";
  const template = event === "cancelled" ? "booking-cancelled" : event === "completed" ? "booking-completed" : event === "confirmed" ? "booking-confirmed" : "booking-created";
  const label = event === "cancelled" ? "Booking cancelled" : event === "completed" ? "Visit completed" : "Booking confirmed";
  const title = event === "cancelled" ? "Your booking was cancelled" : event === "completed" ? "Thanks for dining with us" : "Your booking is confirmed";
  const message = event === "cancelled" ? `Your booking at ${booking.restaurantId?.restaurantName || "the restaurant"} was cancelled.` : event === "completed" ? `Your visit at ${booking.restaurantId?.restaurantName || "the restaurant"} is complete. Your bill receipt is attached.` : `Your booking at ${booking.restaurantId?.restaurantName || "the restaurant"} is confirmed.`;
  const pdf = isCompleted ? await createBillPdf({ bill: booking.billId, booking }) : await createBookingPdf({ booking });
  const attachment = { filename: `${booking.bookingCode || "tablespot-booking"}.pdf`, content: pdf, contentType: "application/pdf" };
  const variables = baseVariables({ label, title, name: booking.userId?.fullName, message, cta: process.env.CLIENT_URL });
  await deliver({ eventKey: `BOOKING_${event.toUpperCase()}_CUSTOMER_${booking._id}`, to: booking.userId?.email, template, subject: `${title} · TableSpot`, variables, attachments: [attachment] });
  if (!isCompleted) {
    const owner = await User.findById(booking.restaurantId?.ownerId).select("email fullName");
    await deliver({ eventKey: `BOOKING_${event.toUpperCase()}_OWNER_${booking._id}`, to: owner?.email, template, subject: `${label} · ${booking.bookingCode}`, variables: baseVariables({ label, title: `${label}: ${booking.bookingCode}`, name: owner?.fullName, message, rows: [["Customer", booking.userId?.fullName], ["Restaurant", booking.restaurantId?.restaurantName], ["Status", booking.bookingStatus]], cta: process.env.CLIENT_URL }), attachments: [attachment] });
  }
};

export const sendBillEventEmail = async ({ billId, event }) => {
  const bill = await Bill.findById(billId).populate("bookingId").populate("restaurantId", "restaurantName address city ownerId");
  if (!bill) return;
  const booking = bill.bookingId;
  const customer = await User.findById(booking?.userId).select("email fullName");
  const owner = await User.findById(bill.restaurantId?.ownerId).select("email fullName");
  const template = event === "settled" ? "bill-settled" : "bill-generated";
  const label = event === "settled" ? "Bill settled" : "Bill generated";
  const pdf = await createBillPdf({ bill, booking });
  const attachment = { filename: `${bill.billCode || "tablespot-bill"}.pdf`, content: pdf, contentType: "application/pdf" };
  const rows = [["Bill", bill.billCode], ["Booking", booking?.bookingCode], ["Restaurant", bill.restaurantId?.restaurantName], ["Grand total", money(bill.grandTotal)], ["Status", bill.billStatus]];
  const message = event === "settled" ? "Your bill has been settled. The receipt is attached." : "Your bill has been generated. The bill receipt is attached.";
  await deliver({ eventKey: `BILL_${event.toUpperCase()}_CUSTOMER_${bill._id}`, to: customer?.email, template, subject: `${label} · ${bill.billCode}`, variables: baseVariables({ label, title: label, name: customer?.fullName, message, rows, cta: process.env.CLIENT_URL }), attachments: [attachment] });
  await deliver({ eventKey: `BILL_${event.toUpperCase()}_OWNER_${bill._id}`, to: owner?.email, template, subject: `${label} · ${bill.billCode}`, variables: baseVariables({ label, title: `${label}: ${bill.billCode}`, name: owner?.fullName, message, rows, cta: process.env.CLIENT_URL }), attachments: [attachment] });
};

export const sendPaymentEventEmail = async ({ paymentId, event }) => {
  const payment = await Payment.findById(paymentId).populate("bookingId").populate("billId");
  if (!payment) return;
  const customer = await User.findById(payment.customerId).select("email fullName");
  const owner = await User.findById(payment.ownerId).select("email fullName");
  const successful = event === "successful";
  const template = successful ? "payment-successful" : "payment-failed";
  const label = successful ? "Payment successful" : "Payment failed";
  const rows = [["Amount", money(payment.amount)], ["Reference", payment.razorpayPaymentId || payment.razorpayOrderId], ["Booking", payment.bookingId?.bookingCode], ["Status", payment.paymentStatus]];
  const variables = baseVariables({ label, title: label, name: customer?.fullName, message: successful ? "Your payment was received successfully." : "Your payment could not be completed. No charge confirmation was recorded.", rows, cta: process.env.CLIENT_URL });
  const attachments = successful ? [{ filename: `payment-${payment._id}.pdf`, content: await createPaymentPdf({ payment, booking: payment.bookingId, bill: payment.billId }), contentType: "application/pdf" }] : [];
  await deliver({ eventKey: `PAYMENT_${event.toUpperCase()}_CUSTOMER_${payment._id}`, to: customer?.email, template, subject: `${label} · TableSpot`, variables, attachments });
  if (successful) await deliver({ eventKey: `PAYMENT_${event.toUpperCase()}_OWNER_${payment._id}`, to: owner?.email, template, subject: `${label} · TableSpot`, variables: baseVariables({ label, title: `${label}: ${money(payment.amount)}`, name: owner?.fullName, message: "A customer payment was received successfully.", rows, cta: process.env.CLIENT_URL }), attachments });
};

export const sendRefundEventEmail = async ({ refundId, event }) => {
  const refund = await Refund.findById(refundId).populate("bookingId").populate("billId");
  if (!refund) return;
  const customer = await User.findById(refund.customerId).select("email fullName");
  const owner = await User.findById(refund.ownerId).select("email fullName");
  const template = ["initiated", "processed"].includes(event) ? "refund-initiated" : event === "confirmed" ? "refund-confirmed" : "refund-disputed";
  const label = event === "initiated" ? "Refund initiated" : event === "processed" ? "Refund processed" : event === "confirmed" ? "Refund confirmed" : "Refund disputed";
  const rows = [["Refund", refund.refundCode], ["Amount", money(refund.amount)], ["Booking", refund.bookingId?.bookingCode], ["Status", refund.refundStatus], ["Reason", refund.reason], ["Remarks", refund.remarks]];
  const attachment = { filename: `${refund.refundCode || "tablespot-refund"}.pdf`, content: await createRefundPdf({ refund, booking: refund.bookingId, bill: refund.billId }), contentType: "application/pdf" };
  await deliver({ eventKey: `REFUND_${event.toUpperCase()}_CUSTOMER_${refund._id}`, to: customer?.email, template, subject: `${label} · ${refund.refundCode}`, variables: baseVariables({ label, title: label, name: customer?.fullName, message: event === "disputed" ? "A refund has been disputed and is under review." : `Your refund status is ${refund.refundStatus}.`, rows, cta: process.env.CLIENT_URL }), attachments: [attachment] });
  await deliver({ eventKey: `REFUND_${event.toUpperCase()}_OWNER_${refund._id}`, to: owner?.email, template, subject: `${label} · ${refund.refundCode}`, variables: baseVariables({ label, title: `${label}: ${refund.refundCode}`, name: owner?.fullName, message: `Refund ${refund.refundCode} is currently ${refund.refundStatus}.`, rows, cta: process.env.CLIENT_URL }), attachments: [attachment] });
};

export const sendRestaurantVerificationEmail = async ({ restaurant, approved }) => {
  const owner = await User.findById(restaurant.ownerId).select("email fullName");
  const template = approved ? "restaurant-approved" : "restaurant-rejected";
  const label = approved ? "Restaurant approved" : "Restaurant rejected";
  await deliver({ eventKey: `RESTAURANT_${approved ? "APPROVED" : "REJECTED"}_${restaurant._id}`, to: owner?.email, template, subject: `${label} · ${restaurant.restaurantName}`, variables: baseVariables({ label, title: label, name: owner?.fullName, message: approved ? `${restaurant.restaurantName} is now live on TableSpot.` : `${restaurant.restaurantName} was not approved.${restaurant.rejectionReason ? ` Reason: ${restaurant.rejectionReason}` : ""}`, rows: [["Restaurant", restaurant.restaurantName], ["Status", restaurant.verificationStatus]], cta: process.env.CLIENT_URL }) });
};

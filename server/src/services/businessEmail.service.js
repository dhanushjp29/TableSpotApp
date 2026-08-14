import Booking from "../models/Booking.js";
import Bill from "../models/Bill.js";
import EmailDelivery from "../models/EmailDelivery.js";
import Payment from "../models/Payment.js";
import Refund from "../models/Refund.js";
import Restaurant from "../models/Restaurant.js";
import RestaurantReport from "../models/RestaurantReport.js";
import RestaurantWarning from "../models/RestaurantWarning.js";
import User from "../models/User.js";
import { compileTemplate } from "../utils/templateParser.js";
import { sendEmail } from "./email.service.js";
import { billReceiptRows, bookingReceiptRows, createBillPdf, createBookingPdf, createPaymentPdf, createRefundPdf, paymentReceiptRows, refundReceiptRows } from "./emailPdf.service.js";
import { buildBillReceiptData, buildBookingReceiptData, buildPaymentReceiptData, buildRefundReceiptData } from "./receiptData.service.js";

const escapeHtml = (input) => String(input ?? "—").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
const money = (input) => `INR ${Number(input || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || "tablespotapp@gmail.com";
const SUPPORT_PHONE = process.env.SUPPORT_PHONE || "+916374428721";
const details = (rows = []) =>
  `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">${
    rows
      .filter(([, content]) => content !== undefined && content !== null && content !== "")
      .map(([label, content], i) =>
        `<tr style="${i > 0 ? 'border-top:1px solid #f0ede9;' : ''}">`
        + `<td style="padding:10px 0;width:44%;vertical-align:top;font-size:12px;font-weight:600;letter-spacing:0.4px;color:#9ca3af;text-transform:uppercase;padding-right:12px;">${escapeHtml(label)}</td>`
        + `<td style="padding:10px 0;vertical-align:top;font-size:14px;font-weight:500;color:#111827;">${escapeHtml(content)}</td>`
        + `</tr>`
      )
      .join("")
  }</table>`;

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

const baseVariables = ({ label, title, name, message, rows, cta = "", instructions = "" }) => ({
  EVENT_LABEL: label,
  TITLE: title,
  NAME: name || "there",
  MESSAGE: message,
  DETAILS: details(rows),
  INSTRUCTIONS_BLOCK: instructions
    ? `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 0;"><tr><td style="background:#fef9f0;border:1px solid #fde68a;border-left:4px solid #f59e0b;border-radius:10px;padding:14px 18px;"><p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#92400e;">Booking instructions</p><p style="margin:0;font-size:13px;color:#78350f;line-height:1.6;">${escapeHtml(instructions)}</p></td></tr></table>`
    : "",
  CTA_BLOCK: cta
    ? `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 0;"><tr><td align="center"><a href="${escapeHtml(cta)}" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#b91c1c,#c62828);color:#ffffff;text-decoration:none;border-radius:10px;padding:14px 32px;font-size:14px;font-weight:700;letter-spacing:0.3px;">Open TableSpot &rarr;</a></td></tr></table>`
    : "",
  SUPPORT_EMAIL,
  SUPPORT_PHONE,
  CLIENT_URL: process.env.CLIENT_URL || "",
  YEAR: new Date().getFullYear(),
});

const populatedBooking = (bookingId) => Booking.findById(bookingId)
  .populate("userId", "fullName email phoneNumber")
  .populate("restaurantId", "restaurantName address city state country pincode phoneNumber email ownerId")
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
  const bill = isCompleted ? booking.billId : null;
  const hasBill = !!bill;
  const receiptData = isCompleted && hasBill ? buildBillReceiptData({ bill, booking }) : buildBookingReceiptData({ booking });
  const pdf = isCompleted && hasBill ? await createBillPdf({ bill, booking, receiptData }) : await createBookingPdf({ booking, receiptData });
  const attachment = { filename: `TableSpot-Receipt-${booking.bookingCode || "booking"}.pdf`, content: pdf, contentType: "application/pdf" };
  const rows = isCompleted && hasBill ? billReceiptRows(receiptData) : bookingReceiptRows(receiptData);
  const instructions = ["created", "confirmed"].includes(event) ? "Please arrive 10 minutes before your reservation time. You can manage or cancel your booking from your TableSpot account." : "";
  const variables = baseVariables({ label, title, name: booking.userId?.fullName, message, rows, instructions, cta: process.env.CLIENT_URL });
  await deliver({ eventKey: `BOOKING_${event.toUpperCase()}_CUSTOMER_${booking._id}`, to: booking.userId?.email, template, subject: `${title} · TableSpot`, variables, attachments: [attachment] });
  if (!isCompleted) {
    const owner = await User.findById(booking.restaurantId?.ownerId).select("email fullName");
    await deliver({ eventKey: `BOOKING_${event.toUpperCase()}_OWNER_${booking._id}`, to: owner?.email, template, subject: `${label} · ${booking.bookingCode}`, variables: baseVariables({ label, title: `${label}: ${booking.bookingCode}`, name: owner?.fullName, message, rows, cta: process.env.CLIENT_URL }), attachments: [attachment] });
  }
};

export const sendBillEventEmail = async ({ billId, event }) => {
  const bill = await Bill.findById(billId)
    .populate({ path: "bookingId", populate: [
      { path: "userId", select: "fullName email phoneNumber" },
      { path: "restaurantId", select: "restaurantName address city state country pincode phoneNumber email" },
      { path: "tableId", select: "tableCode tableNumber tableName tableLabel" },
    ] })
    .populate("restaurantId", "restaurantName address city state country pincode phoneNumber email ownerId");
  if (!bill) return;
  const booking = bill.bookingId;
  const customer = await User.findById(booking?.userId).select("email fullName");
  const owner = await User.findById(bill.restaurantId?.ownerId).select("email fullName");
  const template = event === "settled" ? "bill-settled" : "bill-generated";
  const label = event === "settled" ? "Bill settled" : "Bill generated";
  const receiptData = buildBillReceiptData({ bill, booking });
  const pdf = await createBillPdf({ bill, booking, receiptData });
  const attachment = { filename: `TableSpot-Receipt-${bill.billCode || "bill"}.pdf`, content: pdf, contentType: "application/pdf" };
  const rows = billReceiptRows(receiptData);
  const message = event === "settled" ? "Your bill has been settled. The receipt is attached." : "Your bill has been generated. The bill receipt is attached.";
  await deliver({ eventKey: `BILL_${event.toUpperCase()}_CUSTOMER_${bill._id}`, to: customer?.email, template, subject: `${label} · ${bill.billCode}`, variables: baseVariables({ label, title: label, name: customer?.fullName, message, rows, cta: process.env.CLIENT_URL }), attachments: [attachment] });
  await deliver({ eventKey: `BILL_${event.toUpperCase()}_OWNER_${bill._id}`, to: owner?.email, template, subject: `${label} · ${bill.billCode}`, variables: baseVariables({ label, title: `${label}: ${bill.billCode}`, name: owner?.fullName, message, rows, cta: process.env.CLIENT_URL }), attachments: [attachment] });
};

export const sendPaymentEventEmail = async ({ paymentId, event }) => {
  const payment = await Payment.findById(paymentId)
    .populate({ path: "bookingId", populate: [
      { path: "userId", select: "fullName email phoneNumber" },
      { path: "restaurantId", select: "restaurantName address city state country pincode phoneNumber email" },
      { path: "tableId", select: "tableCode tableNumber tableName tableLabel" },
    ] })
    .populate("billId")
    .populate("customerId", "fullName email phoneNumber")
    .populate("restaurantId", "restaurantName address city state country pincode phoneNumber email");
  if (!payment) return;
  const customer = await User.findById(payment.customerId).select("email fullName");
  const owner = await User.findById(payment.ownerId).select("email fullName");
  const successful = event === "successful";
  const template = successful ? "payment-successful" : "payment-failed";
  const label = successful ? "Payment successful" : "Payment failed";
  const receiptData = buildPaymentReceiptData({ payment, booking: payment.bookingId, bill: payment.billId });
  const rows = paymentReceiptRows(receiptData);
  const variables = baseVariables({ label, title: label, name: customer?.fullName, message: successful ? "Your payment was received successfully." : "Your payment could not be completed. No charge confirmation was recorded.", rows, cta: process.env.CLIENT_URL });
  const paymentRef = payment.transactionId || payment.razorpayPaymentId || payment.razorpayOrderId || String(payment._id);
  const attachments = successful ? [{ filename: `TableSpot-Receipt-${paymentRef}.pdf`, content: await createPaymentPdf({ payment, booking: payment.bookingId, bill: payment.billId, receiptData }), contentType: "application/pdf" }] : [];
  await deliver({ eventKey: `PAYMENT_${event.toUpperCase()}_CUSTOMER_${payment._id}`, to: customer?.email, template, subject: `${label} · TableSpot`, variables, attachments });
  if (successful) await deliver({ eventKey: `PAYMENT_${event.toUpperCase()}_OWNER_${payment._id}`, to: owner?.email, template, subject: `${label} · TableSpot`, variables: baseVariables({ label, title: `${label}: ${money(payment.amount)}`, name: owner?.fullName, message: "A customer payment was received successfully.", rows, cta: process.env.CLIENT_URL }), attachments });
};

export const sendRefundEventEmail = async ({ refundId, event }) => {
  const refund = await Refund.findById(refundId)
    .populate({ path: "bookingId", populate: [
      { path: "userId", select: "fullName email phoneNumber" },
      { path: "restaurantId", select: "restaurantName address city state country pincode phoneNumber email" },
      { path: "tableId", select: "tableCode tableNumber tableName tableLabel" },
    ] })
    .populate("billId")
    .populate("paymentId", "razorpayOrderId razorpayPaymentId paymentMethod paymentStatus createdAt")
    .populate("customerId", "fullName email phoneNumber")
    .populate("ownerId", "fullName email")
    .populate("restaurantId", "restaurantName address city state country pincode phoneNumber email");
  if (!refund) return;
  const customer = await User.findById(refund.customerId).select("email fullName");
  const owner = await User.findById(refund.ownerId).select("email fullName");
  const template = ["initiated", "processed"].includes(event) ? "refund-initiated" : event === "confirmed" ? "refund-confirmed" : "refund-disputed";
  const label = event === "initiated" ? "Refund initiated" : event === "processed" ? "Refund processed" : event === "confirmed" ? "Refund confirmed" : "Refund disputed";
  const receiptData = buildRefundReceiptData({ refund, booking: refund.bookingId, bill: refund.billId, payment: refund.paymentId });
  const rows = refundReceiptRows(receiptData);
  const attachment = { filename: `TableSpot-Receipt-${refund.refundCode || "refund"}.pdf`, content: await createRefundPdf({ refund, booking: refund.bookingId, bill: refund.billId, payment: refund.paymentId, receiptData }), contentType: "application/pdf" };
  await deliver({ eventKey: `REFUND_${event.toUpperCase()}_CUSTOMER_${refund._id}`, to: customer?.email, template, subject: `${label} · ${refund.refundCode}`, variables: baseVariables({ label, title: label, name: customer?.fullName, message: event === "disputed" ? "A refund has been disputed and is under review." : `Your refund status is ${refund.refundStatus}.`, rows, cta: process.env.CLIENT_URL }), attachments: [attachment] });
  await deliver({ eventKey: `REFUND_${event.toUpperCase()}_OWNER_${refund._id}`, to: owner?.email, template, subject: `${label} · ${refund.refundCode}`, variables: baseVariables({ label, title: `${label}: ${refund.refundCode}`, name: owner?.fullName, message: `Refund ${refund.refundCode} is currently ${refund.refundStatus}.`, rows, cta: process.env.CLIENT_URL }), attachments: [attachment] });
};

export const sendRestaurantVerificationEmail = async ({ restaurant, approved }) => {
  const owner = await User.findById(restaurant.ownerId).select("email fullName");
  const template = approved ? "restaurant-approved" : "restaurant-rejected";
  const label = approved ? "Restaurant approved" : "Restaurant rejected";
  await deliver({ eventKey: `RESTAURANT_${approved ? "APPROVED" : "REJECTED"}_${restaurant._id}`, to: owner?.email, template, subject: `${label} · ${restaurant.restaurantName}`, variables: baseVariables({ label, title: label, name: owner?.fullName, message: approved ? `${restaurant.restaurantName} is now live on TableSpot.` : `${restaurant.restaurantName} was not approved.${restaurant.rejectionReason ? ` Reason: ${restaurant.rejectionReason}` : ""}`, rows: [["Restaurant", restaurant.restaurantName], ["Status", restaurant.verificationStatus]], cta: process.env.CLIENT_URL }) });
};

const REPORT_STATUS_TEXT = {
  PENDING: "Pending",
  UNDER_REVIEW: "Under Review",
  RESOLVED: "Resolved",
  REJECTED: "Rejected",
};

const WARNING_STATUS_TEXT = {
  ACTIVE: "Active",
  EXPIRED: "Expired",
  CLEARED: "Cleared",
};

export const sendReportEventEmail = async ({ report, event, restaurant = null }) => {
  const customer = await User.findById(report.userId).select("email fullName isActive isDeleted");
  if (!customer?.email || customer.isDeleted || customer.isActive === false) return;

  const restaurantInfo = restaurant || (await Restaurant.findById(report.restaurantId).select("restaurantName").lean());
  const booking = report.bookingId
    ? await Booking.findById(report.bookingId).select("bookingCode").lean()
    : null;

  const label =
    event === "received"
      ? "Report received"
      : event === "rejected"
        ? "Report rejected"
        : "Report resolved";

  const title =
    event === "received"
      ? "We received your report"
      : event === "rejected"
        ? "Your report was not upheld"
        : "Your report has been resolved";

  const message =
    event === "received"
      ? `Thank you for letting us know about your experience at ${restaurantInfo?.restaurantName || "the restaurant"}. Our team is reviewing your report.`
      : event === "rejected"
        ? `Your report against ${restaurantInfo?.restaurantName || "the restaurant"} was reviewed and could not be upheld.${report.adminNotes ? ` Note: ${report.adminNotes}` : ""}`
        : `Your report against ${restaurantInfo?.restaurantName || "the restaurant"} has been reviewed and resolved.${report.adminNotes ? ` Note: ${report.adminNotes}` : ""}`;

  const rows = [
    ["Report", report.reportCode],
    ["Restaurant", restaurantInfo?.restaurantName],
    ["Category", report.category],
    ["Severity", report.severity],
    ["Booking", booking?.bookingCode],
    ["Status", REPORT_STATUS_TEXT[report.status] || report.status],
  ];

  await deliver({
    eventKey: `REPORT_${event.toUpperCase()}_CUSTOMER_${report._id}`,
    to: customer.email,
    template: "business-event",
    subject: `${label} · ${report.reportCode}`,
    variables: baseVariables({ label, title, name: customer.fullName, message, rows, cta: process.env.CLIENT_URL }),
  });
};

export const sendWarningEventEmail = async ({ warning, event, owner = null, restaurant = null }) => {
  const ownerInfo = owner || (await User.findById(warning.ownerId).select("email fullName isActive isDeleted"));
  if (!ownerInfo?.email || ownerInfo.isDeleted || ownerInfo.isActive === false) return;

  const restaurantInfo = restaurant || (await Restaurant.findById(warning.restaurantId).select("restaurantName").lean());

  const label =
    event === "issued"
      ? "Restaurant warning issued"
      : event === "expired"
        ? "Restaurant warning expired"
        : "Restaurant warning updated";

  const title =
    event === "issued"
      ? `${restaurantInfo?.restaurantName || "Your restaurant"} received a ${warning.level} warning`
      : event === "expired"
        ? "Your warning has expired"
        : "Your warning was updated";

  const message =
    event === "issued"
      ? `We have issued a ${warning.level} warning to ${restaurantInfo?.restaurantName || "your restaurant"}. Please review the reason and take corrective action before the expiry date.`
      : event === "expired"
        ? `The ${warning.level} warning for ${restaurantInfo?.restaurantName || "your restaurant"} has now expired.`
        : `The ${warning.level} warning for ${restaurantInfo?.restaurantName || "your restaurant"} was updated.`;

  const rows = [
    ["Warning", warning.warningCode],
    ["Restaurant", restaurantInfo?.restaurantName],
    ["Level", warning.level],
    ["Status", WARNING_STATUS_TEXT[warning.status] || warning.status],
    ["Reason", warning.reason],
    ["Issued", warning.issuedAt ? new Date(warning.issuedAt).toLocaleDateString() : ""],
    ["Expires", warning.expiresAt ? new Date(warning.expiresAt).toLocaleDateString() : ""],
  ];

  await deliver({
    eventKey: `WARNING_${event.toUpperCase()}_OWNER_${warning._id}`,
    to: ownerInfo.email,
    template: "business-event",
    subject: `${label} · ${warning.warningCode}`,
    variables: baseVariables({ label, title, name: ownerInfo.fullName, message, rows, cta: process.env.CLIENT_URL }),
  });
};

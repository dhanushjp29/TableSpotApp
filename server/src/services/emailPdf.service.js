import PDFDocument from "pdfkit";

const money = (value) => `INR ${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const value = (input, fallback = "—") => input === undefined || input === null || input === "" ? fallback : String(input);

const renderPdf = ({ title, code, rows = [], note = "This is a computer-generated document from TableSpot." }) =>
  new Promise((resolve, reject) => {
    const document = new PDFDocument({ size: "A4", margin: 48 });
    const chunks = [];
    document.on("data", (chunk) => chunks.push(chunk));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);
    document.fillColor("#dc2626").fontSize(24).font("Helvetica-Bold").text("TableSpot");
    document.moveDown(0.5).fillColor("#111827").fontSize(18).text(title);
    if (code) document.moveDown(0.25).fillColor("#6b7280").fontSize(10).text(`Reference: ${code}`);
    document.moveDown(1);
    rows.forEach(([label, content]) => {
      document.fillColor("#6b7280").fontSize(10).text(label.toUpperCase());
      document.fillColor("#111827").fontSize(12).text(value(content));
      document.moveDown(0.55);
    });
    document.moveDown(1).strokeColor("#e5e7eb").moveTo(48, document.y).lineTo(547, document.y).stroke();
    document.moveDown(0.7).fillColor("#6b7280").fontSize(9).text(note, { align: "center" });
    document.end();
  });

export const createBookingPdf = ({ booking }) => renderPdf({
  title: `Booking ${value(booking?.bookingStatus, "Confirmation")}`,
  code: booking?.bookingCode,
  rows: [
    ["Restaurant", booking?.restaurantId?.restaurantName],
    ["Date and time", booking?.bookingDateTime || booking?.bookingDate],
    ["Guests", booking?.numberOfGuests],
    ["Table", booking?.tableId?.tableName || booking?.tableId?.tableCode],
    ["Customer", booking?.userId?.fullName],
    ["Status", booking?.bookingStatus],
    ["Cancellation reason", booking?.cancellationReason],
  ],
});

export const createBillPdf = ({ bill, booking }) => renderPdf({
  title: `Bill ${value(bill?.billStatus, "Receipt")}`,
  code: bill?.billCode || booking?.bookingCode,
  rows: [
    ["Restaurant", booking?.restaurantId?.restaurantName],
    ["Booking", booking?.bookingCode],
    ["Subtotal", money(bill?.subTotal)],
    ["Discount", money(bill?.discount?.value)],
    ["Grand total", money(bill?.grandTotal)],
    ["Payment status", bill?.payment?.paymentStatus || bill?.billStatus],
  ],
});

export const createPaymentPdf = ({ payment, booking, bill }) => renderPdf({
  title: `Payment ${value(payment?.paymentStatus)}`,
  code: payment?.transactionId || payment?.razorpayPaymentId || payment?._id,
  rows: [
    ["Amount", money(payment?.amount)],
    ["Method", payment?.paymentMethod],
    ["Booking", booking?.bookingCode],
    ["Bill", bill?.billCode],
    ["Status", payment?.paymentStatus],
  ],
});

export const createRefundPdf = ({ refund, booking, bill }) => renderPdf({
  title: `Refund ${value(refund?.refundStatus)}`,
  code: refund?.refundCode,
  rows: [
    ["Amount", money(refund?.amount)],
    ["Method", refund?.refundMethod],
    ["Booking", booking?.bookingCode],
    ["Bill", bill?.billCode],
    ["Status", refund?.refundStatus],
    ["Reason", refund?.reason],
    ["Remarks", refund?.remarks],
  ],
});

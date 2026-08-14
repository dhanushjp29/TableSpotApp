/**
 * Email flow test harness.
 *
 * Triggers EVERY transactional email in the app against real application data
 * seeded in a throwaway MongoDB database, sends them through the real Gmail
 * SMTP transport, and captures the rendered HTML + PDF attachments to disk for
 * visual verification.
 *
 * SAFETY: every recipient is hardcoded to EMAIL below (tablespotapp@gmail.com).
 * No other address is ever used.
 *
 * Usage (from server/):
 *   node scripts/email-flow-test.mjs
 */
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../src/.env") });

const EMAIL = "tablespotapp@gmail.com";
const OUT_DIR = process.env.EMAIL_FLOW_OUT_DIR || path.resolve(__dirname, "../.email-qa-out");
const DB_URI = process.env.EMAIL_FLOW_DB_URI || "mongodb://127.0.0.1:27017/tablespot_email_test";

fs.mkdirSync(OUT_DIR, { recursive: true });

// Fresh output dir so stale artifacts from previous runs are never mistaken
// for current sends.
for (const entry of fs.readdirSync(OUT_DIR)) {
  fs.rmSync(path.join(OUT_DIR, entry), { recursive: true, force: true });
}

// ---- Capture every send while still delivering through the real transport ----
const captured = [];
let sendCounter = 0;

const writeArtifacts = (index, record) => {
  const htmlFile = `${index}-${record.subject.replace(/[^A-Za-z0-9]+/g, "_").slice(0, 50)}.html`;
  fs.writeFileSync(path.join(OUT_DIR, htmlFile), record.html);
  const pdfFiles = [];
  for (const attachment of record.attachments || []) {
    if (!attachment.content) continue;
    const safeName = (attachment.filename || "file").replace(/[^A-Za-z0-9._-]/g, "_");
    const file = `${index}-${safeName}`;
    fs.writeFileSync(path.join(OUT_DIR, file), attachment.content);
    pdfFiles.push(file);
  }
  return { htmlFile, pdfFiles };
};

const originalCreateTransport = nodemailer.createTransport;
nodemailer.createTransport = (options) => {
  const transport = originalCreateTransport(options);
  const originalSendMail = transport.sendMail.bind(transport);
  transport.sendMail = async (mailOptions) => {
    sendCounter += 1;
    const index = String(sendCounter).padStart(3, "0");
    const record = {
      index,
      to: mailOptions.to,
      from: mailOptions.from,
      subject: mailOptions.subject,
      html: mailOptions.html,
      attachments: (mailOptions.attachments || []).map((a) => ({
        filename: a.filename,
        contentType: a.contentType,
        content: a.content ? Buffer.from(a.content) : null,
      })),
    };
    const { htmlFile, pdfFiles } = writeArtifacts(index, record);
    try {
      const info = await originalSendMail(mailOptions);
      record.delivered = Array.isArray(info.accepted) && info.accepted.length > 0;
      record.accepted = info.accepted;
      record.messageId = info.messageId;
    } catch (error) {
      record.delivered = false;
      record.error = error.message;
    }
    record.htmlFile = htmlFile;
    record.pdfFiles = pdfFiles;
    captured.push(record);
    if (record.error) throw new Error(record.error);
    return { accepted: record.accepted, messageId: record.messageId };
  };
  return transport;
};

import mongoose from "mongoose";
import User from "../src/models/User.js";
import Restaurant from "../src/models/Restaurant.js";
import RestaurantTable from "../src/models/RestaurantTable.js";
import Booking from "../src/models/Booking.js";
import Bill from "../src/models/Bill.js";
import Payment from "../src/models/Payment.js";
import Refund from "../src/models/Refund.js";
import RestaurantReport from "../src/models/RestaurantReport.js";
import RestaurantWarning from "../src/models/RestaurantWarning.js";
import { sendOTP } from "../src/services/otp.service.js";
import {
  sendBillEventEmail,
  sendBookingEventEmail,
  sendPaymentEventEmail,
  sendRefundEventEmail,
  sendReportEventEmail,
  sendRestaurantVerificationEmail,
  sendWarningEventEmail,
} from "../src/services/businessEmail.service.js";
import { OTP_PURPOSE } from "../src/utils/constants.js";

const run = (label, fn) => fn().catch((error) => console.log(`[GROUP-FAILED] ${label}: ${error.message}`));

async function main() {
  await mongoose.connect(DB_URI);
  await mongoose.connection.db.dropDatabase();
  console.log("Connected to test DB and dropped it.");

  const user = await User.create({
    userCode: "USR-QA-EMAIL",
    fullName: "TableSpot QA User",
    email: EMAIL,
    password: "Tablespot@123",
    phoneNumber: "+91 99900 00001",
    role: "customer",
  });

  const restaurant = await Restaurant.create({
    restaurantCode: "RST-QA-EMAIL",
    slug: "tablespot-test-kitchen",
    ownerId: user._id,
    restaurantName: "TableSpot Test Kitchen",
    description: "QA restaurant used to exercise every email flow.",
    contactPerson: "TableSpot QA User",
    phoneNumber: "+91 99900 00001",
    email: EMAIL,
    address: "12, Diner Street, Nungambakkam",
    city: "Chennai",
    state: "Tamil Nadu",
    country: "India",
    pincode: "600001",
    location: { latitude: 13.0827, longitude: 80.2707 },
    coverImage: "https://res.cloudinary.com/demo/image/upload/cover.png",
    galleryImages: [
      "https://res.cloudinary.com/demo/image/upload/g1.png",
      "https://res.cloudinary.com/demo/image/upload/g2.png",
      "https://res.cloudinary.com/demo/image/upload/g3.png",
    ],
    verificationStatus: "Verified",
  });

  const table = await RestaurantTable.create({
    tableCode: "TBL-QA-01",
    restaurantId: restaurant._id,
    tableNumber: 1,
    tableName: "QA Corner Table",
    capacity: 6,
  });

  const bookingA = await Booking.create({
    bookingCode: "TSQABK01",
    userId: user._id,
    restaurantId: restaurant._id,
    tableId: table._id,
    tableIds: [table._id],
    bookingDateTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
    numberOfGuests: 4,
    bookingStatus: "Confirmed",
    paymentStatus: "Paid",
    paymentMethod: "UPI",
    advanceAmount: 200,
    totalAmount: 1200,
  });

  const bookingB = await Booking.create({
    bookingCode: "TSQABK02",
    userId: user._id,
    restaurantId: restaurant._id,
    tableId: table._id,
    tableIds: [table._id],
    bookingDateTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    numberOfGuests: 2,
    bookingStatus: "Cancelled",
    paymentStatus: "Refunded",
    paymentMethod: "UPI",
    advanceAmount: 200,
    totalAmount: 800,
    cancellationReason: "Change of plans",
    cancelledAt: new Date(),
  });

  const billGenerated = await Bill.create({
    billCode: "TSQABL01",
    bookingId: bookingA._id,
    billType: "ONLINE",
    tableId: table._id,
    customerName: "TableSpot QA User",
    customerPhone: "+91 99900 00001",
    customerEmail: EMAIL,
    restaurantId: restaurant._id,
    subTotal: 1500,
    discount: { type: "Amount", value: 100 },
    taxAmount: 0,
    grandTotal: 1400,
    offer: { discountType: "Amount", discountValue: 0 },
    payment: { totalPaid: 0, balanceDue: 1400, paymentStatus: "Pending" },
    billStatus: "Generated",
    generatedBy: user._id,
    generatedAt: new Date(),
  });

  const bookingC = await Booking.create({
    bookingCode: "TSQABK03",
    userId: user._id,
    restaurantId: restaurant._id,
    tableId: table._id,
    tableIds: [table._id],
    bookingDateTime: new Date(Date.now() - 24 * 60 * 60 * 1000),
    numberOfGuests: 3,
    bookingStatus: "Completed",
    paymentStatus: "Paid",
    paymentMethod: "UPI",
    advanceAmount: 0,
    totalAmount: 1400,
    completedAt: new Date(),
  });

  const billPaid = await Bill.create({
    billCode: "TSQABL02",
    bookingId: bookingC._id,
    billType: "ONLINE",
    tableId: table._id,
    customerName: "TableSpot QA User",
    customerPhone: "+91 99900 00001",
    customerEmail: EMAIL,
    restaurantId: restaurant._id,
    subTotal: 1500,
    discount: { type: "Amount", value: 100 },
    taxAmount: 0,
    grandTotal: 1400,
    offer: { discountType: "Amount", discountValue: 0 },
    payment: { totalPaid: 1400, balanceDue: 0, paymentStatus: "Paid" },
    billStatus: "Paid",
    generatedBy: user._id,
    generatedAt: new Date(),
  });

  bookingC.billId = billPaid._id;
  await bookingC.save();

  const paymentSuccess = await Payment.create({
    customerId: user._id,
    ownerId: user._id,
    restaurantId: restaurant._id,
    bookingId: bookingA._id,
    billId: billGenerated._id,
    amount: 200,
    paymentMethod: "UPI",
    razorpayOrderId: "order_QA1234567890",
    razorpayPaymentId: "pay_QA1234567890",
    paymentStatus: "Captured",
  });

  const paymentFailed = await Payment.create({
    customerId: user._id,
    ownerId: user._id,
    restaurantId: restaurant._id,
    bookingId: bookingA._id,
    billId: billGenerated._id,
    amount: 200,
    paymentMethod: "Card",
    razorpayOrderId: "order_QAFAILED1",
    paymentStatus: "Failed",
  });

  const refund = await Refund.create({
    refundCode: "TSQARF01",
    bookingId: bookingA._id,
    billId: billGenerated._id,
    restaurantId: restaurant._id,
    ownerId: user._id,
    customerId: user._id,
    amount: 200,
    reason: "CUSTOMER_CANCELLED",
    remarks: "Advance refunded to the original payment method.",
    refundMethod: "RAZORPAY",
    refundStatus: "REFUND_PENDING",
  });

  const report = await RestaurantReport.create({
    reportCode: "TSQARPT01",
    userId: user._id,
    restaurantId: restaurant._id,
    bookingId: bookingA._id,
    category: "Hygiene",
    severity: "High",
    title: "Cleanliness concern",
    description: "The washroom was not clean during the visit.",
    status: "PENDING",
  });

  const warning = await RestaurantWarning.create({
    warningCode: "TSQAWRN01",
    restaurantId: restaurant._id,
    ownerId: user._id,
    reporterId: user._id,
    level: "Level 1",
    title: "Cleanliness issue",
    reason: "Two hygiene complaints were confirmed during inspection.",
    issuedBy: user._id,
    issuedAt: new Date(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    status: "ACTIVE",
  });

  console.log("Seeding complete. Triggering email flows concurrently...");

  // ---- Trigger every email flow (independent groups run concurrently) ----
  const groups = [
    run("otp", async () => {
      await sendOTP({ email: EMAIL, purpose: OTP_PURPOSE.EMAIL_VERIFICATION, userId: user._id });
      await sendOTP({ email: EMAIL, purpose: OTP_PURPOSE.PASSWORD_RESET, userId: user._id });
    }),

    run("booking", async () => {
      await sendBookingEventEmail({ bookingId: bookingA._id, event: "created" });
      await sendBookingEventEmail({ bookingId: bookingA._id, event: "confirmed" });
      await sendBookingEventEmail({ bookingId: bookingB._id, event: "cancelled" });
      await sendBookingEventEmail({ bookingId: bookingC._id, event: "completed" });
    }),

    run("bill", async () => {
      await sendBillEventEmail({ billId: billGenerated._id, event: "generated" });
      await sendBillEventEmail({ billId: billPaid._id, event: "settled" });
    }),

    run("payment", async () => {
      await sendPaymentEventEmail({ paymentId: paymentSuccess._id, event: "successful" });
      await sendPaymentEventEmail({ paymentId: paymentFailed._id, event: "failed" });
    }),

    run("refund", async () => {
      const events = ["initiated", "processed", "confirmed", "disputed"];
      const statuses = ["REFUND_PENDING", "REFUND_PROCESSING", "REFUNDED", "REFUND_DISPUTED"];
      for (let i = 0; i < events.length; i += 1) {
        refund.refundStatus = statuses[i];
        await refund.save();
        await sendRefundEventEmail({ refundId: refund._id, event: events[i] });
      }
    }),

    run("restaurant", async () => {
      restaurant.verificationStatus = "Verified";
      restaurant.rejectionReason = "";
      await restaurant.save();
      await sendRestaurantVerificationEmail({ restaurant, approved: true });
      restaurant.verificationStatus = "Rejected";
      restaurant.rejectionReason = "Address verification could not be completed.";
      await restaurant.save();
      await sendRestaurantVerificationEmail({ restaurant, approved: false });
    }),

    run("report", async () => {
      const events = ["received", "resolved", "rejected"];
      for (let i = 0; i < events.length; i += 1) {
        report.status = events[i] === "received" ? "PENDING" : events[i] === "resolved" ? "RESOLVED" : "REJECTED";
        report.adminNotes = events[i] === "received" ? "" : events[i] === "resolved" ? "Issue verified and resolved by our team." : "No evidence of the reported issue was found.";
        await report.save();
        await sendReportEventEmail({ report, event: events[i] });
      }
    }),

    run("warning", async () => {
      const events = ["issued", "updated", "expired"];
      for (let i = 0; i < events.length; i += 1) {
        warning.status = events[i] === "expired" ? "EXPIRED" : "ACTIVE";
        await warning.save();
        await sendWarningEventEmail({ warning, event: events[i] });
      }
    }),
  ];

  await Promise.all(groups);

  // ---- Report ----
  captured.sort((a, b) => Number(a.index) - Number(b.index));
  const manifest = ["index\tto\tsubject\tdelivered\thtml\tpdfs"];
  for (const record of captured) {
    manifest.push(`${record.index}\t${record.to}\t${record.subject}\t${record.delivered ? "DELIVERED" : `FAILED${record.error ? `: ${record.error}` : ""}`}\t${record.htmlFile}\t${record.pdfFiles.join(",")}`);
    console.log(`[${record.index}] ${record.delivered ? "DELIVERED" : "FAILED"} | to=${record.to} | subject="${record.subject}"${record.error ? ` | ${record.error}` : ""}`);
  }
  fs.writeFileSync(path.join(OUT_DIR, "manifest.tsv"), manifest.join("\n"));

  const deliveredCount = captured.filter((record) => record.delivered).length;
  console.log(`\nTotal sends: ${captured.length} | delivered: ${deliveredCount} | failed: ${captured.length - deliveredCount}`);
  console.log(`Artifacts written to: ${OUT_DIR}`);

  await mongoose.connection.close();
  process.exit(deliveredCount === captured.length ? 0 : 1);
}

main().catch((error) => {
  console.error("Harness crashed:", error);
  process.exitCode = 1;
});

import assert from "node:assert/strict";
import { buildBillReceiptData, buildBookingReceiptData, buildPaymentReceiptData, buildRefundReceiptData } from "../src/services/receiptData.service.js";
import { billReceiptRows, bookingReceiptRows, createBillPdf, createBookingPdf, createPaymentPdf, createRefundPdf, paymentReceiptRows, refundReceiptRows } from "../src/services/emailPdf.service.js";

const customer = { _id: "customer-1", fullName: "QA Customer", email: "tablespotapp@gmail.com", phoneNumber: "9999999999" };
const restaurant = { _id: "restaurant-1", restaurantName: "QA Restaurant", address: "1 Main Street", city: "Chennai", phoneNumber: "9000000000" };
const table = { _id: "table-1", tableName: "Table 4", tableCode: "T4", tableNumber: 4 };
const booking = { _id: "booking-1", bookingCode: "TSQABK01", userId: customer, restaurantId: restaurant, tableId: table, bookingDateTime: "2035-01-01T10:00:00.000Z", bookingStatus: "CONFIRMED", numberOfGuests: 2, totalAmount: 1200, advanceAmount: 200 };
const bill = { _id: "bill-1", billCode: "TSQABL01", bookingId: booking, restaurantId: restaurant, customerName: customer.fullName, subTotal: 1500, discount: { value: 100 }, taxableAmount: 1400, taxAmount: 0, grandTotal: 1400, payment: { paymentStatus: "PAID", totalPaid: 1400, balanceDue: 0, payments: [] }, orderedItems: [] };
const payment = { _id: "payment-1", transactionId: "pay_QA1234567890", razorpayPaymentId: "pay_QA1234567890", razorpayOrderId: "order_QA1234567890", amount: 200, paymentMethod: "RAZORPAY", paymentStatus: "SUCCESS", bookingId: booking, billId: bill, customerId: customer, restaurantId: restaurant };
const refund = { _id: "refund-1", refundCode: "TSQARF01", amount: 200, refundStatus: "REFUND_DISPUTED", bookingId: booking, billId: bill, paymentId: payment, customerId: customer, restaurantId: restaurant };

const cases = [
  ["BOOKING", buildBookingReceiptData({ booking }), bookingReceiptRows, () => createBookingPdf({ booking, receiptData: buildBookingReceiptData({ booking }) })],
  ["BILL", buildBillReceiptData({ bill, booking }), billReceiptRows, () => createBillPdf({ bill, booking, receiptData: buildBillReceiptData({ bill, booking }) })],
  ["PAYMENT", buildPaymentReceiptData({ payment, booking, bill }), paymentReceiptRows, () => createPaymentPdf({ payment, booking, bill, receiptData: buildPaymentReceiptData({ payment, booking, bill }) })],
  ["REFUND", buildRefundReceiptData({ refund, booking, bill, payment }), refundReceiptRows, () => createRefundPdf({ refund, booking, bill, payment, receiptData: buildRefundReceiptData({ refund, booking, bill, payment }) })],
];

for (const [type, data, rows, pdf] of cases) {
  assert.equal(data.receipt.receiptType, type);
  assert.ok(data.receipt.receiptNumber);
  assert.equal(rows(data).some(([, value]) => String(value).includes(data.receipt.receiptNumber)), true);
  assert.ok((await pdf()).length > 1000);
  console.log(`[PASS] canonical ${type} data is consumed by email rows and PDF`);
}

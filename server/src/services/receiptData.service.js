/*
 * The only business-data mapping used by receipt presentations.
 * This service deliberately reads persisted values; it does not calculate
 * totals, taxes, balances, paid amounts, or refunds.
 */
const objectOf = (value) => (value && typeof value === "object" ? value : null);
const first = (...values) => values.find((value) => value !== undefined && value !== null && value !== "");
const tableName = (table) => table?.tableName || (table?.tableNumber ? `Table ${table.tableNumber}` : undefined) || table?.tableCode || table?.tableLabel;
const tableList = (booking, bill) => {
  const entries = booking?.tables?.length ? booking.tables.map((entry) => entry.tableId || entry) : booking?.tableId ? [booking.tableId] : [];
  if (bill?.tableId) entries.push(bill.tableId);
  return [...new Map(entries.filter(Boolean).map((entry) => [String(entry?._id || entry), entry])).values()];
};
const restaurant = (booking, bill, payment, refund) => {
  const source = refund?.restaurantId || payment?.restaurantId || bill?.restaurantId || booking?.restaurantId || {};
  return {
    restaurantName: source.restaurantName,
    restaurantCode: source.restaurantCode,
    address: source.address,
    city: source.city,
    state: source.state,
    country: source.country,
    pincode: source.pincode,
    phone: source.phoneNumber || source.phone,
    email: source.email,
    ownerId: source.ownerId,
  };
};
const customer = (booking, bill, payment, refund) => {
  const source = refund?.customerId || payment?.customerId || booking?.userId || {};
  return {
    customerName: bill?.customerName || source.fullName,
    customerEmail: bill?.customerEmail || source.email,
    customerPhone: bill?.customerPhone || source.phoneNumber || source.phone,
  };
};
const bookingData = (booking, bill) => {
  const tables = tableList(booking, bill);
  return booking ? {
    bookingNumber: booking.bookingCode,
    bookingDate: booking.bookingDateTime || booking.bookingDate,
    bookingTime: booking.bookingTime,
    bookingStatus: booking.bookingStatus,
    numberOfGuests: booking.numberOfGuests,
    duration: booking.expectedDuration,
    specialRequest: booking.specialRequest,
    tables: tables.map((table) => ({ tableNumber: table.tableNumber, tableName: table.tableName, tableCode: table.tableCode, capacity: table.capacity, label: tableName(table) })),
    totalAmount: booking.totalAmount,
    advanceAmount: booking.advanceAmount,
    paymentStatus: booking.paymentStatus,
    paymentMethod: booking.paymentMethod,
    preOrderedFoods: booking.preOrderedFoods || [],
  } : null;
};
const billData = (bill) => bill ? {
  billNumber: bill.billCode,
  billDate: bill.createdAt,
  billType: bill.billType,
  items: bill.orderedItems || [],
  subtotal: bill.subTotal,
  discount: bill.discount?.value,
  taxableAmount: bill.taxableAmount,
  tax: bill.taxAmount,
  serviceCharge: bill.serviceCharge,
  deliveryCharge: bill.deliveryCharge,
  total: bill.grandTotal,
  paidAmount: bill.payment?.totalPaid,
  advanceAmount: bill.payment?.advanceAmount,
  balanceAmount: bill.payment?.balanceDue,
  paymentStatus: bill.payment?.paymentStatus || bill.billStatus,
  paymentHistory: bill.payment?.payments || [],
} : null;
const paymentData = (payment) => payment ? {
  paymentId: payment.transactionId || payment.razorpayPaymentId,
  razorpayPaymentId: payment.razorpayPaymentId,
  razorpayOrderId: payment.razorpayOrderId,
  amount: payment.amount,
  paymentMethod: payment.paymentMethod,
  paymentStatus: payment.paymentStatus,
  paidAt: payment.capturedAt || payment.paidAt || payment.createdAt,
  purpose: payment.purpose,
} : null;
const refundData = (refund, payment) => refund ? {
  refundId: refund.refundCode,
  refundAmount: refund.amount,
  refundStatus: refund.refundStatus,
  refundReason: refund.reason,
  remarks: refund.remarks,
  disputeReason: refund.disputeReason,
  processedBy: objectOf(refund.ownerId) ? { name: refund.ownerId.fullName, email: refund.ownerId.email } : null,
  processedAt: refund.completedAt,
  requestedAt: refund.requestedAt,
  deadlineAt: refund.deadlineAt,
  originalPaymentId: payment?.razorpayPaymentId || payment?.transactionId,
  originalOrderId: payment?.razorpayOrderId,
  reference: refund.transactionId || refund.gatewayRefundId,
  method: refund.refundMethod,
} : null;

export const buildReceiptData = ({ type, booking = null, bill = null, payment = null, refund = null }) => ({
  receipt: {
    receiptNumber: refund?.refundCode || payment?.transactionId || payment?.razorpayPaymentId || bill?.billCode || booking?.bookingCode,
    receiptType: type,
    referenceId: String(refund?._id || payment?._id || bill?._id || booking?._id || ""),
    createdAt: refund?.createdAt || payment?.createdAt || bill?.createdAt || booking?.createdAt,
    status: refund?.refundStatus || payment?.paymentStatus || bill?.payment?.paymentStatus || bill?.billStatus || booking?.bookingStatus,
  },
  restaurant: restaurant(booking, bill, payment, refund),
  customer: customer(booking, bill, payment, refund),
  booking: bookingData(booking, bill),
  bill: billData(bill),
  payment: paymentData(payment),
  refund: refundData(refund, payment),
});

export const buildBookingReceiptData = ({ booking }) => buildReceiptData({ type: "BOOKING", booking, bill: objectOf(booking?.billId), refund: objectOf(booking?.refundId) });
export const buildBillReceiptData = ({ bill, booking = bill?.bookingId || null }) => buildReceiptData({ type: "BILL", booking, bill });
export const buildPaymentReceiptData = ({ payment, booking = payment?.bookingId || null, bill = payment?.billId || null }) => buildReceiptData({ type: "PAYMENT", booking, bill, payment });
export const buildRefundReceiptData = ({ refund, booking = refund?.bookingId || null, bill = refund?.billId || null, payment = refund?.paymentId || null }) => buildReceiptData({ type: "REFUND", booking, bill, payment, refund });

export const receiptRows = (data) => {
  const r = data?.restaurant || {}, c = data?.customer || {}, b = data?.booking || {}, bill = data?.bill, p = data?.payment, f = data?.refund;
  const table = b.tables?.map((entry) => entry.label).filter(Boolean).join(", ");
  const address = [r.address, r.city, r.state, r.pincode, r.country].filter(Boolean).join(", ");
  const rows = {
    BOOKING: [["Booking number", b.bookingNumber], ["Booking date", b.bookingDate], ["Restaurant", r.restaurantName], ["Customer", c.customerName], ["Booking type", undefined], ["Email", c.customerEmail], ["Phone", c.customerPhone], ["Guests", b.numberOfGuests], ["Table(s)", table], ["Duration", b.duration ? `${b.duration} min` : undefined], ["Payment", b.paymentStatus], ["Payment method", b.paymentMethod], ["Restaurant address", address], ["Status", b.bookingStatus], ["Advance paid", b.advanceAmount], ["Total amount", b.totalAmount]],
    BILL: [["Bill number", bill?.billNumber], ["Booking number", b.bookingNumber], ["Customer", c.customerName], ["Customer email", c.customerEmail], ["Customer phone", c.customerPhone], ["Booking date", b.bookingDate], ["Table(s)", table], ["Payment status", bill?.paymentStatus], ["Restaurant phone", r.phone], ["Subtotal", bill?.subtotal], ["Discount", bill?.discount], ["Taxable amount", bill?.taxableAmount], ["Tax", bill?.tax], ["Grand total", bill?.total], ["Total paid", bill?.paidAmount], ["Balance due", bill?.balanceAmount]],
    PAYMENT: [["Amount", p?.amount], ["Purpose", p?.purpose], ["Method", p?.paymentMethod], ["Payment ID", p?.paymentId], ["Razorpay order ID", p?.razorpayOrderId], ["Payment date", p?.paidAt], ["Restaurant", r.restaurantName], ["Customer", c.customerName], ["Booking number", b.bookingNumber], ["Bill number", bill?.billNumber], ["Balance due", bill?.balanceAmount], ["Status", p?.paymentStatus]],
    REFUND: [["Refund number", f?.refundId], ["Amount", f?.refundAmount], ["Status", f?.refundStatus], ["Restaurant", r.restaurantName], ["Customer", c.customerName], ["Reason", f?.refundReason], ["Method", f?.method], ["Requested", f?.requestedAt], ["Deadline", f?.deadlineAt], ["Completed", f?.processedAt], ["Reference", f?.reference], ["Booking number", b.bookingNumber], ["Bill number", bill?.billNumber], ["Remarks", f?.remarks], ["Dispute reason", f?.disputeReason]],
  };
  return rows[data?.receipt?.receiptType] || [];
};

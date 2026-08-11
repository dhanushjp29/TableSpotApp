// Owner analytics report Excel export - 13 worksheets built on the shared
// ExcelJS builder (utils/excel) with TableSpot brand styling.
import { addSheet, createWorkbook, exportFilename, saveWorkbook } from "./excel/excelExport.js";
import { toNumber } from "./excel/excelFormatters.js";
import { formatDate } from "./formatDate.js";

const money = (value) => toNumber(value) ?? 0;

const paymentStatus = (bill) => bill?.payment?.paymentStatus || "Pending";

const bookingCustomer = (booking) =>
  typeof booking.userId === "object" && booking.userId ? booking.userId.fullName || booking.userId.email || "Guest" : "Guest";

const bookingCustomerEmail = (booking) =>
  typeof booking.userId === "object" && booking.userId ? booking.userId.email || "" : "";

const tableLabel = (bill) =>
  bill?.tableId?.tableCode ||
  bill?.tableId?.tableName ||
  bill?.tableId?.tableNumber ||
  "-";

const payLabel = (value) => value ?? "—";

export async function exportOwnerReportToExcel({ report, details }) {
  const meta = report?.meta || {};
  const subtitle = `Generated on ${new Date().toLocaleString()}  •  Restaurant: ${meta.restaurantName || "All Restaurants"}  •  Period: ${meta.range?.label || ""}`;

  const workbook = createWorkbook();

  // 1. Executive Summary
  const execRows = [];
  const pushKpi = (label, value) => execRows.push({ label, value });

  const summary = report?.summary || {};
  const sBookings = summary.bookings || {};
  const sRevenue = summary.revenue || {};
  const sBills = summary.bills || {};
  const sCustomers = summary.customers || {};
  const sRefunds = summary.refunds || {};
  const sOffers = summary.offers || {};
  const sReviews = summary.reviews || {};

  pushKpi("Total Bookings", { value: sBookings.total, type: "int" });
  pushKpi("Confirmed Bookings", { value: sBookings.confirmed, type: "int" });
  pushKpi("Completed Bookings", { value: sBookings.completed, type: "int" });
  pushKpi("Cancelled Bookings", { value: sBookings.cancelled, type: "int" });
  pushKpi("No-Show Bookings", { value: sBookings.noShow, type: "int" });
  pushKpi("Booking Completion Rate", {
    value: sBookings.completionRate,
    type: "percentage",
  });
  pushKpi("Average Party Size", { value: sBookings.avgGuests, type: "number" });
  pushKpi("Gross Revenue", { value: sRevenue.gross, type: "money" });
  pushKpi("Net Revenue (after refunds)", { value: sRevenue.net, type: "money" });
  pushKpi("Discounts", { value: sRevenue.discounts, type: "money" });
  pushKpi("Tax", { value: sRevenue.tax, type: "money" });
  pushKpi("Refunds", { value: sRevenue.refunds, type: "money" });
  pushKpi("Total Bills", { value: sBills.total, type: "int" });
  pushKpi("Total Billed", { value: sBills.totalBilled, type: "money" });
  pushKpi("Total Paid", { value: sBills.totalPaid, type: "money" });
  pushKpi("Balance Due", { value: sBills.balanceDue, type: "money" });
  pushKpi("Average Bill Value", { value: sBills.avgBill, type: "money" });
  pushKpi("Payment Collection Rate", {
    value: sBills.collectionRate,
    type: "percentage",
  });
  pushKpi("Total Customers", { value: sCustomers.total, type: "int" });
  pushKpi("Returning Customers", { value: sCustomers.returning, type: "int" });
  pushKpi("Repeat Rate", { value: sCustomers.repeatRate, type: "percentage" });
  pushKpi("Average Spend / Customer", {
    value: sCustomers.avgSpendPerCustomer,
    type: "money",
  });
  pushKpi("Total Refunds", { value: sRefunds.count, type: "int" });
  pushKpi("Refund Amount", { value: sRefunds.amount, type: "money" });
  pushKpi("Total Offers", { value: sOffers.total, type: "int" });
  pushKpi("Active Offers", { value: sOffers.active, type: "int" });
  pushKpi("Offer Claims", { value: sOffers.claimed, type: "int" });
  pushKpi("Offer Redemptions", { value: sOffers.used, type: "int" });
  pushKpi("Total Reviews", { value: sReviews.total, type: "int" });
  pushKpi("Average Restaurant Rating", {
    value: sReviews.restaurant?.avgRating,
    type: "number",
  });

  addSheet({
    workbook,
    sheetName: "Executive Summary",
    title: "TableSpot - Analytics Report",
    subtitle,
    columns: [
      { header: "Metric", key: "label", width: 34 },
      { header: "Value", key: "value", width: 20 },
    ],
    rows: execRows.map((row) => ({ label: row.label, value: row.value })),
    summary: [],
  });

  // 2. Booking Summary
  const bookingSummaryRows = [
    { label: "Total Bookings", value: sBookings.total, type: "int" },
    { label: "Online Bookings", value: sBookings.online, type: "int" },
    { label: "Walk-in Bookings", value: sBookings.walkIn, type: "int" },
    { label: "Online %", value: sBookings.onlinePct, type: "percentage" },
    { label: "Walk-in %", value: sBookings.walkInPct, type: "percentage" },
    { label: "Average Guests / Booking", value: sBookings.avgGuests, type: "number" },
    { label: "Average Duration (min)", value: sBookings.avgDuration, type: "int" },
    { label: "Peak Booking Hour", value: report?.bookings?.peakHour, type: "text" },
    { label: "Busiest Day", value: report?.bookings?.busiestDay, type: "text" },
  ];

  const statusRows = (report?.bookings?.byStatus || []).map((row) => ({
    label: `Status: ${row.status || "Unknown"}`,
    value: row.count,
    type: "int",
  }));

  const typeRows = (report?.bookings?.byType || []).map((row) => ({
    label: `Source: ${row.type || "Unknown"}`,
    value: row.count,
    type: "int",
  }));

  addSheet({
    workbook,
    sheetName: "Booking Summary",
    title: "TableSpot - Booking Summary",
    subtitle,
    columns: [
      { header: "Metric", key: "label", width: 34 },
      { header: "Value", key: "value", width: 20 },
    ],
    rows: [...bookingSummaryRows, ...statusRows, ...typeRows],
  });

  // 3. Booking Details
  const bookingColumns = [
    { header: "Booking Code", key: "bookingCode", width: 16 },
    { header: "Restaurant", key: "restaurant", width: 26 },
    { header: "Customer", key: "customer", width: 22 },
    { header: "Email", key: "email", width: 26 },
    { header: "Type", key: "bookingType", width: 12 },
    { header: "Status", key: "bookingStatus", width: 14 },
    { header: "Date", key: "bookingDateTime", type: "datetime", width: 18 },
    { header: "Guests", key: "numberOfGuests", type: "int", width: 10 },
    { header: "Duration (min)", key: "expectedDuration", type: "int", width: 14 },
    { header: "Total Amount", key: "totalAmount", type: "money", width: 14 },
    { header: "Advance", key: "advanceAmount", type: "money", width: 14 },
  ];

  const bookingRows = (details?.bookings || []).map((booking) => ({
    bookingCode: booking.bookingCode || booking._id || "-",
    restaurant: booking.restaurantId?.restaurantName || "-",
    customer: bookingCustomer(booking),
    email: bookingCustomerEmail(booking),
    bookingType: booking.bookingType || "-",
    bookingStatus: booking.bookingStatus || "-",
    bookingDateTime: booking.bookingDateTime,
    numberOfGuests: booking.numberOfGuests,
    expectedDuration: booking.expectedDuration,
    totalAmount: money(booking.totalAmount),
    advanceAmount: money(booking.advanceAmount),
  }));

  addSheet({
    workbook,
    sheetName: "Booking Details",
    title: "TableSpot - Booking Details",
    subtitle,
    columns: bookingColumns,
    rows: bookingRows,
    summary: [
      { label: "Total Bookings", value: bookingRows.length, type: "int" },
    ],
  });

  // 4. Revenue
  const revenueRows = (report?.revenue?.breakdown || []).map((row) => ({
    item: row.label,
    value: row.value,
  }));
  revenueRows.push({
    item: "Revenue by Day (trend)",
    value: (report?.revenue?.trend || []).length,
  });

  addSheet({
    workbook,
    sheetName: "Revenue",
    title: "TableSpot - Revenue Overview",
    subtitle,
    columns: [
      { header: "Item", key: "item", width: 30 },
      { header: "Amount", key: "value", type: "money", width: 20 },
    ],
    rows: revenueRows,
  });

  // 5. Bills
  const billColumns = [
    { header: "Bill Code", key: "billCode", width: 16 },
    { header: "Type", key: "billType", width: 12 },
    { header: "Customer", key: "customer", width: 22 },
    { header: "Date", key: "createdAt", type: "datetime", width: 18 },
    { header: "Subtotal", key: "subTotal", type: "money", width: 14 },
    { header: "Manual Discount", key: "manualDiscount", type: "money", width: 14 },
    { header: "Offer Discount", key: "offerDiscount", type: "money", width: 14 },
    { header: "Tax", key: "taxAmount", type: "money", width: 14 },
    { header: "Service", key: "serviceCharge", type: "money", width: 12 },
    { header: "Delivery", key: "deliveryCharge", type: "money", width: 12 },
    { header: "Grand Total", key: "grandTotal", type: "money", width: 14 },
    { header: "Paid", key: "totalPaid", type: "money", width: 14 },
    { header: "Due", key: "balanceDue", type: "money", width: 14 },
    { header: "Status", key: "billStatus", width: 14 },
    { header: "Payment", key: "paymentStatus", width: 16 },
  ];

  const billRows = (details?.bills || []).map((bill) => ({
    billCode: bill.billCode || bill._id || "-",
    billType: bill.billType === "Walk-In" ? "Walk-in" : bill.billType || "Online",
    customer: bill.customerName || "Guest",
    createdAt: bill.createdAt,
    subTotal: money(bill.subTotal),
    manualDiscount: money(bill.discount?.value),
    offerDiscount: money(bill.offer?.discountAmount),
    taxAmount: money(bill.taxAmount),
    serviceCharge: money(bill.serviceCharge),
    deliveryCharge: money(bill.deliveryCharge),
    grandTotal: money(bill.grandTotal),
    totalPaid: money(bill.payment?.totalPaid),
    balanceDue: money(bill.payment?.balanceDue),
    billStatus: bill.billStatus || "-",
    paymentStatus: paymentStatus(bill),
  }));

  const billTotal = billRows.reduce((sum, row) => sum + money(row.grandTotal), 0);
  const billPaid = billRows.reduce((sum, row) => sum + money(row.totalPaid), 0);
  const billDue = billRows.reduce((sum, row) => sum + money(row.balanceDue), 0);

  addSheet({
    workbook,
    sheetName: "Bills",
    title: "TableSpot - Billing Performance",
    subtitle,
    columns: billColumns,
    rows: billRows,
    summary: [
      { label: "Total Bills", value: billRows.length, type: "int" },
      { label: "Total Billed", value: billTotal, type: "money" },
      { label: "Total Paid", value: billPaid, type: "money" },
      { label: "Total Balance Due", value: billDue, type: "money" },
    ],
  });

  // 6. Bill Items
  const itemColumns = [
    { header: "Bill Code", key: "billCode", width: 16 },
    { header: "Item Name", key: "foodName", width: 26 },
    { header: "Variant", key: "variantName", width: 14 },
    { header: "Order Source", key: "orderSource", width: 14 },
    { header: "Quantity", key: "quantity", type: "int", width: 10 },
    { header: "Unit Price", key: "unitPrice", type: "money", width: 12 },
    { header: "Offer Price", key: "offerPrice", type: "money", width: 12 },
    { header: "Tax %", key: "gstRate", type: "number", width: 10 },
    { header: "Total", key: "totalPrice", type: "money", width: 14 },
  ];

  const itemRows = [];
  (details?.bills || []).forEach((bill) => {
    (bill.orderedItems || []).forEach((item) => {
      itemRows.push({
        billCode: bill.billCode || bill._id || "-",
        foodName: item.foodName || item.foodId?.foodName || "-",
        variantName: item.variantName || "Regular",
        orderSource: item.orderSource || "Spot Order",
        quantity: item.quantity,
        unitPrice: money(item.unitPrice),
        offerPrice: money(item.offerPrice),
        gstRate: Number(item.gstRate) || 0,
        totalPrice: money(item.totalPrice),
      });
    });
  });

  addSheet({
    workbook,
    sheetName: "Bill Items",
    title: "TableSpot - Bill Line Items",
    subtitle,
    columns: itemColumns,
    rows: itemRows,
    summary: [
      { label: "Total Line Items", value: itemRows.length, type: "int" },
      {
        label: "Total Item Value",
        value: itemRows.reduce((sum, row) => sum + money(row.totalPrice), 0),
        type: "money",
      },
    ],
  });

  // 7. Payments
  const paymentColumns = [
    { header: "Bill Code", key: "billCode", width: 16 },
    { header: "Payment Date", key: "paidAt", type: "datetime", width: 18 },
    { header: "Amount", key: "amount", type: "money", width: 14 },
    { header: "Method", key: "paymentMethod", width: 14 },
    { header: "Transaction ID", key: "transactionId", width: 22 },
    { header: "Notes", key: "notes", width: 24 },
  ];

  const paymentRows = [];
  (details?.bills || []).forEach((bill) => {
    (bill.payment?.payments || []).forEach((payment) => {
      paymentRows.push({
        billCode: bill.billCode || bill._id || "-",
        paidAt: payment.paidAt,
        amount: money(payment.amount),
        paymentMethod: payment.paymentMethod || "-",
        transactionId: payment.transactionId || "-",
        notes: payment.notes || "-",
      });
    });
  });

  addSheet({
    workbook,
    sheetName: "Payments",
    title: "TableSpot - Bill Payments",
    subtitle,
    columns: paymentColumns,
    rows: paymentRows,
    summary: [
      { label: "Total Transactions", value: paymentRows.length, type: "int" },
      {
        label: "Total Payment Amount",
        value: paymentRows.reduce((sum, row) => sum + money(row.amount), 0),
        type: "money",
      },
    ],
  });

  // 8. Refunds
  const refundColumns = [
    { header: "Refund Code", key: "refundCode", width: 16 },
    { header: "Booking", key: "bookingCode", width: 16 },
    { header: "Date", key: "createdAt", type: "datetime", width: 18 },
    { header: "Amount", key: "amount", type: "money", width: 14 },
    { header: "Reason", key: "reason", width: 24 },
    { header: "Method", key: "refundMethod", width: 14 },
    { header: "Status", key: "refundStatus", width: 20 },
    { header: "Remarks", key: "remarks", width: 26 },
  ];

  const refundRows = (details?.refunds || []).map((refund) => ({
    refundCode: refund.refundCode || refund._id || "-",
    bookingCode: refund.bookingId?.bookingCode || "-",
    createdAt: refund.createdAt,
    amount: money(refund.amount),
    reason: refund.reason || "-",
    refundMethod: refund.refundMethod || "-",
    refundStatus: refund.refundStatus || "-",
    remarks: refund.remarks || "-",
  }));

  addSheet({
    workbook,
    sheetName: "Refunds",
    title: "TableSpot - Refunds",
    subtitle,
    columns: refundColumns,
    rows: refundRows,
    summary: [
      { label: "Total Refunds", value: refundRows.length, type: "int" },
      {
        label: "Total Refund Amount",
        value: refundRows.reduce((sum, row) => sum + money(row.amount), 0),
        type: "money",
      },
    ],
  });

  // 9. Customers
  const customerRows = [
    { label: "Total Customers", value: sCustomers.total, type: "int" },
    { label: "New Customers", value: sCustomers.newCustomers, type: "int" },
    { label: "Returning Customers", value: sCustomers.returning, type: "int" },
    { label: "Loyal Customers", value: sCustomers.loyal, type: "int" },
    { label: "Repeat Rate", value: sCustomers.repeatRate, type: "percentage" },
    { label: "Average Bookings / Customer", value: sCustomers.avgBookingsPerCustomer, type: "number" },
    { label: "Average Spend / Customer", value: sCustomers.avgSpendPerCustomer, type: "money" },
  ];

  (report?.customers?.distribution || []).forEach((segment) => {
    customerRows.push({
      label: `Segment: ${segment.segment}`,
      value: segment.count,
      type: "int",
    });
  });

  const topCustomerColumns = [
    { header: "Customer", key: "name", width: 24 },
    { header: "Email", key: "email", width: 26 },
    { header: "Bills", key: "bills", type: "int", width: 10 },
    { header: "Spent", key: "spent", type: "money", width: 14 },
  ];

  addSheet({
    workbook,
    sheetName: "Customers",
    title: "TableSpot - Customer Insights",
    subtitle,
    columns: [
      { header: "Metric", key: "label", width: 34 },
      { header: "Value", key: "value", width: 20 },
    ],
    rows: customerRows,
  });

  addSheet({
    workbook,
    sheetName: "Top Customers",
    title: "TableSpot - Highest Spending Customers",
    subtitle,
    columns: topCustomerColumns,
    rows: (report?.customers?.topSpenders || []).map((customer) => ({
      name: customer.name || "Guest",
      email: customer.email || "-",
      bills: customer.bills,
      spent: money(customer.spent),
    })),
  });

  // 10. Food Performance
  const foodColumns = [
    { header: "Rank", key: "rank", type: "int", width: 8 },
    { header: "Food Item", key: "foodName", width: 30 },
    { header: "Quantity Sold", key: "qty", type: "int", width: 16 },
    { header: "Revenue", key: "revenue", type: "money", width: 16 },
    { header: "Average Price", key: "avgPrice", type: "money", width: 14 },
  ];

  addSheet({
    workbook,
    sheetName: "Food Performance",
    title: "TableSpot - Top Selling Items",
    subtitle,
    columns: foodColumns,
    rows: (report?.food?.top || []).map((item) => ({
      rank: item.rank,
      foodName: item.foodName || "-",
      qty: item.qty,
      revenue: money(item.revenue),
      avgPrice: money(item.avgPrice),
    })),
  });

  // 11. Table Performance
  const tableColumns = [
    { header: "Table Code", key: "tableCode", width: 16 },
    { header: "Table Name", key: "tableName", width: 22 },
    { header: "Capacity", key: "capacity", type: "int", width: 12 },
    { header: "Bookings", key: "bookings", type: "int", width: 14 },
  ];

  addSheet({
    workbook,
    sheetName: "Table Performance",
    title: "TableSpot - Table Performance",
    subtitle,
    columns: tableColumns,
    rows: (report?.tables?.tableStats || []).map((table) => ({
      tableCode: table.tableCode || "-",
      tableName: table.tableName || "-",
      capacity: table.capacity,
      bookings: table.bookings,
    })),
    summary: [
      { label: "Total Tables", value: report?.tables?.total || 0, type: "int" },
      { label: "Active Tables", value: report?.tables?.active || 0, type: "int" },
    ],
  });

  // 12. Offers
  const offerColumns = [
    { header: "Offer Code", key: "offerCode", width: 16 },
    { header: "Offer", key: "title", width: 28 },
    { header: "Used", key: "used", type: "int", width: 10 },
    { header: "Discount Given", key: "discount", type: "money", width: 16 },
    { header: "Revenue Generated", key: "revenueGenerated", type: "money", width: 18 },
  ];

  addSheet({
    workbook,
    sheetName: "Offers",
    title: "TableSpot - Offers Performance",
    subtitle,
    columns: offerColumns,
    rows: (report?.offers?.top || []).map((offer) => ({
      offerCode: offer.offerCode || "-",
      title: offer.title || "-",
      used: offer.used,
      discount: money(offer.discount),
      revenueGenerated: payLabel(offer.revenueGenerated),
    })),
    summary: [
      { label: "Total Offers", value: sOffers.total, type: "int" },
      { label: "Active Offers", value: sOffers.active, type: "int" },
      { label: "Claimed", value: sOffers.claimed, type: "int" },
      { label: "Used", value: sOffers.used, type: "int" },
      { label: "Discount Given", value: sOffers.discountGiven, type: "money" },
    ],
  });

  // 13. Reviews
  const reviewColumns = [
    { header: "Type", key: "type", width: 14 },
    { header: "Rating", key: "rating", type: "int", width: 8 },
    { header: "Title", key: "title", width: 28 },
    { header: "Status", key: "status", width: 12 },
    { header: "Replied", key: "replied", width: 10 },
    { header: "Customer", key: "customer", width: 22 },
    { header: "Date", key: "createdAt", type: "datetime", width: 18 },
  ];

  const reviewRows = [];
  (details?.restaurantReviews || []).forEach((review) => {
    reviewRows.push({
      type: "Restaurant",
      rating: review.rating,
      title: review.title || review.comment || "-",
      status: review.status || "-",
      replied: review.ownerReply ? "Yes" : "No",
      customer: typeof review.userId === "object" && review.userId ? review.userId.fullName || "Guest" : "Guest",
      createdAt: review.createdAt,
    });
  });
  (details?.foodReviews || []).forEach((review) => {
    reviewRows.push({
      type: "Food",
      rating: review.rating,
      title: review.title || review.comment || "-",
      status: review.status || "-",
      replied: review.ownerReply ? "Yes" : "No",
      customer: typeof review.userId === "object" && review.userId ? review.userId.fullName || "Guest" : "Guest",
      createdAt: review.createdAt,
    });
  });

  addSheet({
    workbook,
    sheetName: "Reviews",
    title: "TableSpot - Customer Reviews",
    subtitle,
    columns: reviewColumns,
    rows: reviewRows,
    summary: [
      { label: "Restaurant Reviews", value: sReviews.restaurant?.count || 0, type: "int" },
      { label: "Food Reviews", value: sReviews.food?.count || 0, type: "int" },
      { label: "Avg Restaurant Rating", value: sReviews.restaurant?.avgRating || 0, type: "number" },
      { label: "Avg Food Rating", value: sReviews.food?.avgRating || 0, type: "number" },
    ],
  });

  const generatedOn = formatDate(new Date());
  await saveWorkbook(workbook, exportFilename(`AnalyticsReport_${generatedOn}`));
}

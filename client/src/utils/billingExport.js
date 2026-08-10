// Excel export for the Owner Billing page - 3 sheets: Bills, Bill Items, Payments.
// Uses the shared ExcelJS builder (utils/excel) with TableSpot brand styling.
import { addSheet, createWorkbook, exportFilename, saveWorkbook } from "./excel/excelExport.js";
import { toNumber } from "./excel/excelFormatters.js";

const money = (value) => toNumber(value) ?? 0;

const restaurantName = (bill) =>
  bill?.restaurantId?.restaurantName || bill?.bookingId?.restaurantId?.restaurantName || "-";

const tableLabel = (bill) =>
  bill?.tableId?.tableCode ||
  bill?.tableId?.tableNumber ||
  bill?.bookingId?.tableId?.tableCode ||
  bill?.bookingId?.tableId?.tableNumber ||
  "-";

const customerName = (bill) => bill?.customerName || bill?.bookingId?.userId?.fullName || "Guest";

const bookingCode = (bill) => bill?.bookingId?.bookingCode || "Walk-in";

const paymentStatus = (bill) => bill?.payment?.paymentStatus || bill?.paymentStatus || "Pending";

const totalPaid = (bill) => money(bill?.payment?.totalPaid);

const balanceDue = (bill) => {
  if (Number.isFinite(Number(bill?.payment?.balanceDue))) {
    return money(bill?.payment?.balanceDue);
  }
  const grand = money(bill?.grandTotal);
  const paid = totalPaid(bill);
  return Math.max(0, grand - paid);
};

export const billColumns = [
  { header: "Bill Code", key: "billCode", width: 16 },
  { header: "Type", key: "billType", width: 12 },
  { header: "Restaurant", key: "restaurant", width: 26 },
  { header: "Table", key: "table", width: 14 },
  { header: "Customer Code", key: "customerCode", width: 16 },
  { header: "Customer", key: "customer", width: 22 },
  { header: "Booking Ref", key: "bookingCode", width: 16 },
  { header: "Date", key: "createdAt", type: "datetime", width: 18 },
  { header: "Subtotal", key: "subTotal", type: "money", width: 14 },
  { header: "Discount", key: "discountAmount", type: "money", width: 14 },
  { header: "Offer", key: "offerCode", width: 16 },
  { header: "Offer Discount", key: "offerDiscountAmount", type: "money", width: 14 },
  { header: "Taxable", key: "taxableAmount", type: "money", width: 14 },
  { header: "Tax %", key: "taxPercentage", type: "number", width: 10 },
  { header: "Tax Amount", key: "taxAmount", type: "money", width: 14 },
  { header: "Grand Total", key: "grandTotal", type: "money", width: 14 },
  { header: "Advance", key: "advancePaid", type: "money", width: 14 },
  { header: "Total Paid", key: "totalPaid", type: "money", width: 14 },
  { header: "Balance Due", key: "balanceDue", type: "money", width: 14 },
  { header: "Status", key: "paymentStatus", width: 16 },
];

const mapBill = (bill) => ({
  billCode: bill?.billCode || bill?._id || "-",
  billType: bill?.billType === "WALK_IN" ? "Walk-in" : "Online",
  restaurant: restaurantName(bill),
  table: tableLabel(bill),
  customerCode: bill?.bookingId?.userId?.userCode || "-",
  customer: customerName(bill),
  bookingCode: bookingCode(bill),
  createdAt: bill?.createdAt,
  subTotal: money(bill?.subTotal),
  discountAmount: money(bill?.discount?.value),
  offerCode: bill?.offer?.offerCode || "-",
  offerDiscountAmount: money(bill?.offerDiscountAmount),
  taxableAmount: money(bill?.taxableAmount),
  taxPercentage: Number(bill?.taxPercentage) || 0,
  taxAmount: money(bill?.taxAmount),
  grandTotal: money(bill?.grandTotal),
  advancePaid: money(bill?.payment?.advancePaid),
  totalPaid: totalPaid(bill),
  balanceDue: balanceDue(bill),
  paymentStatus: paymentStatus(bill),
});

export const billItemColumns = [
  { header: "Bill Code", key: "billCode", width: 16 },
  { header: "Item Code", key: "foodCode", width: 14 },
  { header: "Item Name", key: "foodName", width: 26 },
  { header: "Variant", key: "variantName", width: 14 },
  { header: "Order Source", key: "orderSource", width: 14 },
  { header: "Quantity", key: "quantity", type: "int", width: 10 },
  { header: "Unit Price", key: "unitPrice", type: "money", width: 12 },
  { header: "Offer Price", key: "offerPrice", type: "money", width: 12 },
  { header: "Tax %", key: "gstRate", type: "number", width: 10 },
  { header: "Total", key: "totalPrice", type: "money", width: 14 },
];

const mapBillItem = (bill, item) => ({
  billCode: bill?.billCode || bill?._id || "-",
  foodCode: item?.foodId?.foodCode || item?.foodCode || "-",
  foodName: item?.foodName || item?.foodId?.foodName || "-",
  variantName: item?.variantName || "Regular",
  orderSource: item?.orderSource || "Spot Order",
  quantity: item?.quantity,
  unitPrice: money(item?.unitPrice),
  offerPrice: money(item?.offerPrice),
  gstRate: Number(item?.gstRate) || 0,
  totalPrice: money(item?.totalPrice),
});

export const billPaymentColumns = [
  { header: "Bill Code", key: "billCode", width: 16 },
  { header: "Booking Ref", key: "bookingCode", width: 16 },
  { header: "Payment Date", key: "paidAt", type: "datetime", width: 18 },
  { header: "Amount", key: "amount", type: "money", width: 14 },
  { header: "Method", key: "paymentMethod", width: 14 },
  { header: "Transaction ID", key: "transactionId", width: 22 },
  { header: "Notes", key: "notes", width: 24 },
];

const mapBillPayment = (bill, payment) => ({
  billCode: bill?.billCode || bill?._id || "-",
  bookingCode: bookingCode(bill),
  paidAt: payment?.paidAt,
  amount: money(payment?.amount),
  paymentMethod: payment?.paymentMethod || "-",
  transactionId: payment?.transactionId || "-",
  notes: payment?.notes || "-",
});

export async function exportBillsToExcel(bills) {
  const list = Array.isArray(bills) ? bills : [];
  const billRows = list.map(mapBill);
  const itemRows = [];
  const paymentRows = [];

  list.forEach((bill) => {
    (bill?.orderedItems || []).forEach((item) => itemRows.push(mapBillItem(bill, item)));
    (bill?.payment?.payments || []).forEach((payment) => paymentRows.push(mapBillPayment(bill, payment)));
  });

  const totalAmount = billRows.reduce((sum, r) => sum + money(r.grandTotal), 0);
  const totalCollected = billRows.reduce((sum, r) => sum + money(r.totalPaid), 0);
  const totalDue = billRows.reduce((sum, r) => sum + money(r.balanceDue), 0);

  const workbook = createWorkbook();
  const subtitle = `Exported ${new Date().toLocaleString()}`;

  addSheet({
    workbook,
    sheetName: "Bills",
    title: "TableSpot - Billing History",
    subtitle,
    columns: billColumns,
    rows: billRows,
    summary: [
      { label: "Total Bills", value: billRows.length, type: "int" },
      { label: "Total Billed Amount", value: totalAmount, type: "money" },
      { label: "Total Paid", value: totalCollected, type: "money" },
      { label: "Total Balance Due", value: totalDue, type: "money" },
    ],
  });

  addSheet({
    workbook,
    sheetName: "Bill Items",
    title: "TableSpot - Bill Items",
    subtitle,
    columns: billItemColumns,
    rows: itemRows,
    summary: [
      { label: "Total Line Items", value: itemRows.length, type: "int" },
      { label: "Total Item Value", value: itemRows.reduce((sum, r) => sum + money(r.totalPrice), 0), type: "money" },
    ],
  });

  addSheet({
    workbook,
    sheetName: "Payments",
    title: "TableSpot - Bill Payments",
    subtitle,
    columns: billPaymentColumns,
    rows: paymentRows,
    summary: [
      { label: "Total Transactions", value: paymentRows.length, type: "int" },
      { label: "Total Payment Amount", value: paymentRows.reduce((sum, r) => sum + money(r.amount), 0), type: "money" },
    ],
  });

  await saveWorkbook(workbook, exportFilename("Billing"));
}

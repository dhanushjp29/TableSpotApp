// Excel export for the Owner Refunds page.
import { addSheet, createWorkbook, exportFilename, saveWorkbook } from "./excel/excelExport.js";
import { toNumber } from "./excel/excelFormatters.js";

const money = (value) => toNumber(value) ?? 0;

export const refundColumns = [
  { header: "Refund Code", key: "refundCode", width: 16 },
  { header: "Booking Code", key: "bookingCode", width: 16 },
  { header: "Booking Status", key: "bookingStatus", width: 14 },
  { header: "Customer Code", key: "customerCode", width: 16 },
  { header: "Customer", key: "customer", width: 22 },
  { header: "Restaurant", key: "restaurant", width: 26 },
  { header: "Amount", key: "amount", type: "money", width: 14 },
  { header: "Method", key: "method", width: 14 },
  { header: "Status", key: "refundStatus", width: 24 },
  { header: "Reason", key: "reason", width: 22 },
  { header: "Remarks", key: "remarks", width: 26 },
  { header: "Requested Date", key: "requestedAt", type: "datetime", width: 18 },
  { header: "Completed Date", key: "completedAt", type: "datetime", width: 18 },
];

const mapRefund = (refund) => ({
  refundCode: refund?.refundCode || refund?._id || "-",
  bookingCode: refund?.bookingId?.bookingCode || "-",
  bookingStatus: refund?.bookingId?.bookingStatus || "-",
  customerCode: refund?.customerId?.userCode || "-",
  customer: refund?.customerId?.fullName || "-",
  restaurant: refund?.restaurantId?.restaurantName || "-",
  amount: money(refund?.amount),
  method: refund?.refundMethod || "-",
  refundStatus: refund?.refundStatus || "-",
  reason: refund?.reason || "-",
  remarks: refund?.remarks || "-",
  requestedAt: refund?.requestedAt || refund?.createdAt,
  completedAt: refund?.completedAt || "-",
});

export async function exportRefundsToExcel(refunds) {
  const list = Array.isArray(refunds) ? refunds : [];
  const rows = list.map(mapRefund);

  const completed = rows.filter((r) => r.refundStatus === "REFUNDED").length;
  const pending = rows.length - completed;

  const workbook = createWorkbook();
  const subtitle = `Exported ${new Date().toLocaleString()}`;

  addSheet({
    workbook,
    sheetName: "Refunds",
    title: "TableSpot - Refunds",
    subtitle,
    columns: refundColumns,
    rows,
    summary: [
      { label: "Total Refunds", value: rows.length, type: "int" },
      { label: "Total Refund Amount", value: rows.reduce((sum, r) => sum + money(r.amount), 0), type: "money" },
      { label: "Completed", value: completed, type: "int" },
      { label: "Pending / In Progress", value: pending, type: "int" },
    ],
  });

  await saveWorkbook(workbook, exportFilename("Refunds"));
}

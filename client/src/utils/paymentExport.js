// Excel export for the Payment History panel - Transactions sheet + Summary sheet.
import { addSheet, createWorkbook, exportFilename, saveWorkbook } from "./excel/excelExport.js";
import { toNumber } from "./excel/excelFormatters.js";

const money = (value) => toNumber(value) ?? 0;

export const transactionColumns = [
  { header: "Date", key: "date", type: "datetime", width: 18 },
  { header: "Booking Code", key: "bookingCode", width: 16 },
  { header: "Restaurant", key: "restaurantName", width: 26 },
  { header: "Purpose", key: "purpose", width: 18 },
  { header: "Method", key: "method", width: 14 },
  { header: "Status", key: "status", width: 12 },
  { header: "Transaction ID", key: "transactionId", width: 24 },
  { header: "Type", key: "type", width: 12 },
  { header: "Amount", key: "amount", type: "money", width: 14 },
];

const mapTransaction = (t) => ({
  date: t?.date || t?.createdAt,
  bookingCode: t?.bookingCode || "-",
  restaurantName: t?.restaurantName || "-",
  purpose: t?.purpose || "-",
  method: t?.method || "-",
  status: t?.status || "-",
  transactionId: t?.transactionId || "-",
  type: t?.type === "refund" ? "Refund" : "Payment",
  amount: t?.type === "refund" ? -Math.abs(money(t?.amount)) : money(t?.amount),
});

export async function exportPaymentsToExcel(transactions) {
  const list = Array.isArray(transactions) ? transactions : [];
  const rows = list.map(mapTransaction);

  const totalCollected = rows
    .filter((r) => r.type === "Payment")
    .reduce((sum, r) => sum + money(r.amount), 0);
  const totalRefunded = rows
    .filter((r) => r.type === "Refund")
    .reduce((sum, r) => sum + Math.abs(money(r.amount)), 0);

  const workbook = createWorkbook();
  const subtitle = `Exported ${new Date().toLocaleString()}`;

  addSheet({
    workbook,
    sheetName: "Transactions",
    title: "TableSpot - Payment History",
    subtitle,
    columns: transactionColumns,
    rows,
    summary: [
      { label: "Total Transactions", value: rows.length, type: "int" },
      { label: "Total Collected", value: totalCollected, type: "money" },
      { label: "Total Refunded", value: totalRefunded, type: "money" },
      { label: "Net Amount", value: totalCollected - totalRefunded, type: "money" },
    ],
  });

  await saveWorkbook(workbook, exportFilename("Payments"));
}

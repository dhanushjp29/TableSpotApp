// Excel export for the Owner Reservations page - main sheet + Pre-Order Items sheet.
import { addSheet, createWorkbook, exportFilename, saveWorkbook } from "./excel/excelExport.js";
import { toNumber } from "./excel/excelFormatters.js";

const money = (value) => toNumber(value) ?? 0;

const tableLabel = (booking) => {
  const single =
    booking?.tableId?.tableCode || booking?.tableId?.tableNumber || booking?.tableId?.tableLabel || "";
  if (single) return single;
  const many = (booking?.tables || []).map((t) => t?.tableId?.tableCode || t?.tableId?.tableNumber || "").filter(Boolean);
  return many.length ? many.join(", ") : "-";
};

const preOrderTotal = (booking) =>
  (booking?.preOrderedFoods || []).reduce((sum, item) => sum + money(item?.price) * money(item?.quantity), 0);

const refundStatus = (booking) => booking?.refundStatus || booking?.refundId?.refundStatus || "-";

export const reservationColumns = [
  { header: "Booking Code", key: "bookingCode", width: 16 },
  { header: "Status", key: "bookingStatus", width: 14 },
  { header: "Booking Date", key: "bookingDateTime", type: "datetime", width: 18 },
  { header: "Guests", key: "numberOfGuests", type: "int", width: 10 },
  { header: "Table", key: "table", width: 18 },
  { header: "Restaurant", key: "restaurant", width: 26 },
  { header: "Customer Code", key: "customerCode", width: 16 },
  { header: "Customer", key: "customer", width: 22 },
  { header: "Phone", key: "phone", width: 16 },
  { header: "Total Amount", key: "totalAmount", type: "money", width: 14 },
  { header: "Advance Amount", key: "advanceAmount", type: "money", width: 14 },
  { header: "Payment Status", key: "paymentStatus", width: 16 },
  { header: "Refund Code", key: "refundCode", width: 16 },
  { header: "Refund Status", key: "refundStatus", width: 22 },
  { header: "Refund Amount", key: "refundAmount", type: "money", width: 14 },
  { header: "Bill Code", key: "billCode", width: 16 },
  { header: "Pre-Order Total", key: "preOrderTotal", type: "money", width: 14 },
  { header: "Notes", key: "notes", width: 28 },
];

const mapReservation = (booking) => ({
  bookingCode: booking?.bookingCode || booking?._id || "-",
  bookingStatus: booking?.bookingStatus || "-",
  bookingDateTime: booking?.bookingDateTime,
  numberOfGuests: booking?.numberOfGuests,
  table: tableLabel(booking),
  restaurant: booking?.restaurantId?.restaurantName || "-",
  customerCode: booking?.userId?.userCode || "-",
  customer: booking?.userId?.fullName || "-",
  phone: booking?.userId?.phoneNumber || "-",
  totalAmount: money(booking?.totalAmount),
  advanceAmount: money(booking?.advanceAmount),
  paymentStatus: booking?.paymentStatus || "Pending",
  refundCode: booking?.refundId?.refundCode || "-",
  refundStatus: refundStatus(booking),
  refundAmount: money(booking?.refundId?.amount),
  billCode: booking?.billId?.billCode || "-",
  preOrderTotal: preOrderTotal(booking),
  notes: booking?.specialRequest || "-",
});

export const preOrderColumns = [
  { header: "Booking Code", key: "bookingCode", width: 16 },
  { header: "Item Code", key: "foodCode", width: 14 },
  { header: "Item Name", key: "foodName", width: 26 },
  { header: "Variant", key: "variantName", width: 14 },
  { header: "Quantity", key: "quantity", type: "int", width: 10 },
  { header: "Price", key: "price", type: "money", width: 12 },
  { header: "Total", key: "itemTotal", type: "money", width: 14 },
];

const mapPreOrder = (booking, item) => ({
  bookingCode: booking?.bookingCode || booking?._id || "-",
  foodCode: item?.foodId?.foodCode || "-",
  foodName: item?.foodId?.foodName || "-",
  variantName: item?.variantName || "Regular",
  quantity: item?.quantity,
  price: money(item?.price),
  itemTotal: money(item?.price) * money(item?.quantity),
});

export async function exportReservationsToExcel(bookings) {
  const list = Array.isArray(bookings) ? bookings : [];
  const rows = list.map(mapReservation);
  const itemRows = [];
  list.forEach((booking) =>
    (booking?.preOrderedFoods || []).forEach((item) => itemRows.push(mapPreOrder(booking, item)))
  );

  const workbook = createWorkbook();
  const subtitle = `Exported ${new Date().toLocaleString()}`;

  addSheet({
    workbook,
    sheetName: "Reservations",
    title: "TableSpot - Reservations",
    subtitle,
    columns: reservationColumns,
    rows,
    summary: [
      { label: "Total Reservations", value: rows.length, type: "int" },
      { label: "Total Booking Value", value: rows.reduce((sum, r) => sum + money(r.totalAmount), 0), type: "money" },
      { label: "Total Advance Collected", value: rows.reduce((sum, r) => sum + money(r.advanceAmount), 0), type: "money" },
      { label: "Pre-Order Value", value: itemRows.reduce((sum, r) => sum + money(r.itemTotal), 0), type: "money" },
    ],
  });

  addSheet({
    workbook,
    sheetName: "Pre-Order Items",
    title: "TableSpot - Pre-Order Items",
    subtitle,
    columns: preOrderColumns,
    rows: itemRows,
    summary: [
      { label: "Total Pre-Order Items", value: itemRows.length, type: "int" },
      { label: "Total Pre-Order Value", value: itemRows.reduce((sum, r) => sum + money(r.itemTotal), 0), type: "money" },
    ],
  });

  await saveWorkbook(workbook, exportFilename("Reservations"));
}

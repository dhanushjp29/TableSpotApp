const safe = (value) => value ?? "";

export async function exportBillsToExcel(bills) {
  const XLSX = await import("xlsx");
  const rows = bills.map((bill) => ({
    "Bill ID": bill.billCode || bill._id,
    Type: bill.billType === "WALK_IN" ? "Walk-in" : "Online",
    Restaurant: bill.restaurantId?.restaurantName || bill.bookingId?.restaurantId?.restaurantName || "",
    Table: bill.tableId?.tableCode || bill.tableId?.tableNumber || bill.bookingId?.tableId?.tableCode || "",
    Customer: bill.customerName || bill.bookingId?.userId?.fullName || "Guest",
    "Booking Ref": bill.bookingId?.bookingCode || "Walk-in",
    Date: bill.createdAt ? new Date(bill.createdAt).toLocaleString() : "",
    Subtotal: safe(bill.subTotal),
    "Taxable Amount": safe(bill.taxableAmount),
    "Tax %": safe(bill.taxPercentage),
    "Tax Amount": safe(bill.taxAmount),
    "Grand Total": safe(bill.grandTotal),
    "Total Paid": safe(bill.payment?.totalPaid),
    "Balance Due": safe(bill.payment?.balanceDue),
    Status: bill.payment?.paymentStatus || bill.billStatus || "Pending",
  }));
  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet["!cols"] = Object.keys(rows[0] || {}).map((key) => ({ wch: Math.max(14, key.length + 2) }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Bills");
  XLSX.writeFile(workbook, `tablespot-bills-${new Date().toISOString().slice(0, 10)}.xlsx`);
}


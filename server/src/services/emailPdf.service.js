import PDFDocument from "pdfkit";
import { buildBillReceiptData, buildBookingReceiptData, buildPaymentReceiptData, buildRefundReceiptData, receiptRows } from "./receiptData.service.js";

const PAGE = { width: 595.28, height: 841.89, margin: 48 };
const COLORS = {
  red: "#b91c1c",
  redDark: "#991b1b",
  redSoft: "#fef2f2",
  redBorder: "#fecaca",
  text: "#172033",
  muted: "#6b7280",
  border: "#e5e7eb",
  emerald: "#047857",
  amber: "#b45309",
  amberSoft: "#fffbeb",
  blue: "#1d4ed8",
  blueSoft: "#eff6ff",
};

const money = (input) => `INR ${Number(input || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const value = (input, fallback = "—") => input === undefined || input === null || input === "" ? fallback : String(input);
const dateTime = (input) => input ? new Date(input).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true }) : undefined;
const nonEmpty = (rows = []) => rows.filter(([, content]) => content !== undefined && content !== null && content !== "");
const tableLabel = (table) => table?.tableName || (table?.tableNumber ? `Table ${table.tableNumber}` : undefined) || table?.tableCode || table?.tableLabel;
const tableSummary = (booking) => {
  const entries = booking?.tables?.length ? booking.tables.map((entry) => entry.tableId).filter(Boolean) : booking?.tableId ? [booking.tableId] : [];
  return entries.map(tableLabel).filter(Boolean).join(", ") || undefined;
};
const address = (restaurant = {}) => [restaurant.address, restaurant.city, restaurant.state, restaurant.pincode, restaurant.country].filter(Boolean).join(", ");

// Canonical data rows. These are also consumed by the email DETAILS block.
const formatReceiptRows = (rows) => rows.map(([label, content]) => [label, content instanceof Date ? dateTime(content) : typeof content === "number" ? money(content) : content]);
export const bookingReceiptRows = (bookingOrData) => formatReceiptRows(bookingOrData?.receipt?.receiptType ? receiptRows(bookingOrData) : receiptRows(buildBookingReceiptData({ booking: bookingOrData })));
export const billReceiptRows = (bill, booking) => formatReceiptRows(bill?.receipt?.receiptType ? receiptRows(bill) : receiptRows(buildBillReceiptData({ bill, booking })));
export const paymentReceiptRows = (payment, booking, bill) => formatReceiptRows(payment?.receipt?.receiptType ? receiptRows(payment) : receiptRows(buildPaymentReceiptData({ payment, booking, bill })));
export const refundReceiptRows = (refund, booking, bill, payment = null) => formatReceiptRows(refund?.receipt?.receiptType ? receiptRows(refund) : receiptRows(buildRefundReceiptData({ refund, booking, bill, payment })));

const titleCase = (input) => value(input).replaceAll("_", " ");

const drawHeader = (doc, { eyebrow, title, subtitle, codeLabel, code }) => {
  const height = 146;
  doc.save().fillColor(COLORS.red).rect(0, 0, PAGE.width, height).fill().restore();
  doc.fillColor("#fee2e2").font("Helvetica-Bold").fontSize(10).text("TABLESPOT", PAGE.margin, 30, { characterSpacing: 1.5 });
  doc.fillColor("#fee2e2").fontSize(9).text(eyebrow.toUpperCase(), PAGE.margin, 49, { characterSpacing: 1.1 });
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(24).text(title, PAGE.margin, 66, { width: 320 });
  if (subtitle) doc.fillColor("#fee2e2").font("Helvetica").fontSize(11).text(subtitle, PAGE.margin, 106, { width: 320 });
  if (codeLabel) {
    const x = PAGE.width - PAGE.margin - 145;
    doc.save().fillColor("#ffffff").opacity(0.12).roundedRect(x, 35, 145, 66, 10).fill().restore();
    doc.fillColor("#fee2e2").font("Helvetica-Bold").fontSize(8).text(codeLabel.toUpperCase(), x + 12, 47, { width: 121, align: "right", characterSpacing: 1 });
    doc.fillColor("#ffffff").font("Courier-Bold").fontSize(11).text(value(code), x + 12, 68, { width: 121, align: "right" });
  }
  doc.y = height + 20;
};

const drawInfoGrid = (doc, items) => {
  const gap = 10;
  const width = (PAGE.width - PAGE.margin * 2 - gap * 2) / 3;
  const y = doc.y;
  items.forEach((item, index) => {
    const x = PAGE.margin + index * (width + gap);
    const tone = item.tone === "red" ? [COLORS.redSoft, COLORS.redBorder, COLORS.red] : item.tone === "amber" ? [COLORS.amberSoft, "#fde68a", COLORS.amber] : item.tone === "emerald" ? ["#ecfdf5", "#d1fae5", COLORS.emerald] : ["#f9fafb", COLORS.border, COLORS.muted];
    doc.save().fillColor(tone[0]).strokeColor(tone[1]).roundedRect(x, y, width, 58, 10).fillAndStroke().restore();
    doc.fillColor(tone[2]).font("Helvetica-Bold").fontSize(7.5).text(item.label.toUpperCase(), x + 10, y + 11, { width: width - 20, characterSpacing: 0.8 });
    doc.fillColor(COLORS.text).font("Helvetica-Bold").fontSize(10).text(value(item.value), x + 10, y + 29, { width: width - 20, height: 24, ellipsis: true });
  });
  doc.y = y + 70;
};

const drawSection = (doc, title, rows, { right = null } = {}) => {
  const clean = nonEmpty(rows);
  if (!clean.length) return;
  const start = doc.y;
  // Allow wrapped values such as restaurant addresses without colliding with
  // the following row; the historical two-column sections remain compact.
  const lineHeight = 30;
  const height = 42 + Math.ceil(clean.length / 2) * lineHeight + 18;
  if (start + height > PAGE.height - 68) doc.addPage();
  const y = doc.y;
  doc.strokeColor(COLORS.border).lineWidth(1).roundedRect(PAGE.margin, y, PAGE.width - PAGE.margin * 2, height, 10).stroke();
  doc.fillColor(COLORS.muted).font("Helvetica-Bold").fontSize(8).text(title.toUpperCase(), PAGE.margin + 18, y + 15, { characterSpacing: 1 });
  if (right) doc.fillColor(COLORS.red).font("Helvetica-Bold").fontSize(9).text(right, PAGE.width - PAGE.margin - 150, y + 14, { width: 132, align: "right" });
  const col = (PAGE.width - PAGE.margin * 2 - 52) / 2;
  clean.forEach(([label, content], index) => {
    const x = PAGE.margin + 18 + (index % 2) * (col + 16);
    const rowY = y + 36 + Math.floor(index / 2) * lineHeight;
    doc.fillColor(COLORS.muted).font("Helvetica").fontSize(8.5).text(label, x, rowY, { width: col * 0.42 });
    doc.fillColor(COLORS.text).font("Helvetica-Bold").fontSize(8.5).text(value(content), x + col * 0.42, rowY, { width: col * 0.58, align: "right", ellipsis: true });
  });
  doc.y = y + height + 14;
};

const drawTable = (doc, title, columns, rows) => {
  if (!rows?.length) return;
  const headerHeight = 28;
  const rowHeight = 22;
  const height = headerHeight + rows.length * rowHeight + 24;
  if (doc.y + height > PAGE.height - 68) doc.addPage();
  const y = doc.y;
  doc.strokeColor(COLORS.border).lineWidth(1).roundedRect(PAGE.margin, y, PAGE.width - PAGE.margin * 2, height, 10).stroke();
  doc.fillColor(COLORS.muted).font("Helvetica-Bold").fontSize(8).text(title.toUpperCase(), PAGE.margin + 18, y + 15, { characterSpacing: 1 });
  const tableY = y + 38;
  const inner = PAGE.width - PAGE.margin * 2 - 36;
  let x = PAGE.margin + 18;
  columns.forEach((column) => { column.x = x; column.width = inner * column.share; x += column.width; });
  doc.save().fillColor(COLORS.redSoft).rect(PAGE.margin + 1, tableY - 5, PAGE.width - PAGE.margin * 2 - 2, 22).fill().restore();
  columns.forEach((column) => doc.fillColor(COLORS.redDark).font("Helvetica-Bold").fontSize(7.5).text(column.label.toUpperCase(), column.x, tableY + 2, { width: column.width, align: column.align || "left" }));
  rows.forEach((row, rowIndex) => {
    const rowY = tableY + 25 + rowIndex * rowHeight;
    if (rowIndex) doc.strokeColor(COLORS.border).moveTo(PAGE.margin + 18, rowY - 5).lineTo(PAGE.width - PAGE.margin - 18, rowY - 5).stroke();
    columns.forEach((column) => doc.fillColor(COLORS.text).font(column.bold ? "Helvetica-Bold" : "Helvetica").fontSize(8.5).text(value(column.render ? column.render(row) : row[column.key]), column.x, rowY, { width: column.width, align: column.align || "left", ellipsis: true }));
  });
  doc.y = y + height + 14;
};

const drawSummary = (doc, rows) => {
  const clean = nonEmpty(rows);
  if (!clean.length) return;
  const width = 270;
  const height = 28 + clean.length * 20;
  if (doc.y + height > PAGE.height - 68) doc.addPage();
  const x = PAGE.width - PAGE.margin - width;
  const y = doc.y;
  doc.save().fillColor("#f9fafb").roundedRect(x, y, width, height, 10).fill().restore();
  clean.forEach(([label, content], index) => {
    const rowY = y + 14 + index * 20;
    const bold = index === clean.length - 1;
    doc.fillColor(bold ? COLORS.text : COLORS.muted).font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? 10.5 : 9).text(label, x + 16, rowY, { width: 130 });
    doc.fillColor(bold ? COLORS.red : COLORS.text).font("Helvetica-Bold").fontSize(bold ? 10.5 : 9).text(value(content), x + 146, rowY, { width: 108, align: "right" });
  });
  doc.y = y + height + 14;
};

const drawFooter = (doc, note) => {
  const y = Math.min(doc.y + 8, PAGE.height - 45);
  doc.strokeColor(COLORS.border).moveTo(PAGE.margin, y).lineTo(PAGE.width - PAGE.margin, y).stroke();
  doc.fillColor(COLORS.muted).font("Helvetica").fontSize(8).text(note, PAGE.margin, y + 10, { width: PAGE.width - PAGE.margin * 2, align: "center" });
};

const renderPdf = ({ eyebrow, title, subtitle, codeLabel, code, info, sections, tables, summary, note }) => new Promise((resolve, reject) => {
  const document = new PDFDocument({ size: "A4", margin: PAGE.margin });
  const chunks = [];
  document.on("data", (chunk) => chunks.push(chunk));
  document.on("end", () => resolve(Buffer.concat(chunks)));
  document.on("error", reject);
  drawHeader(document, { eyebrow, title, subtitle, codeLabel, code });
  drawInfoGrid(document, info);
  sections.forEach((section) => drawSection(document, section.title, section.rows, { right: section.right }));
  tables.forEach((table) => drawTable(document, table.title, table.columns, table.rows));
  drawSummary(document, summary);
  drawFooter(document, note);
  document.end();
});

export const createBookingPdf = ({ booking, receiptData = buildBookingReceiptData({ booking }) }) => {
  const refund = typeof booking?.refundId === "object" ? booking.refundId : null;
  const sections = [{ title: "Reservation details", rows: bookingReceiptRows(receiptData) }];
  if (refund) sections.push({ title: "Refund", rows: refundReceiptRows(receiptData) });
  if (booking?.specialRequest) sections.push({ title: "Special request", rows: [["Request", booking.specialRequest]] });
  return renderPdf({
    eyebrow: "Booking", title: "Booking Confirmation", subtitle: booking?.restaurantId?.restaurantName || "TableSpot Booking", codeLabel: "Booking number", code: booking?.bookingCode,
    info: [{ label: "Restaurant", value: booking?.restaurantId?.restaurantName, tone: "red" }, { label: "Status", value: titleCase(booking?.bookingStatus), tone: "emerald" }, { label: "Date & time", value: dateTime(booking?.bookingDateTime || booking?.bookingDate), tone: "amber" }],
    sections,
    tables: booking?.preOrderedFoods?.length ? [{ title: "Pre-ordered items", columns: [{ key: "food", label: "Item", share: 0.36, render: (item) => item.foodId?.foodName || "Food item" }, { key: "variant", label: "Variant", share: 0.22, render: (item) => item.variantName || "Regular" }, { key: "quantity", label: "Qty", share: 0.12, align: "center" }, { key: "price", label: "Unit price", share: 0.15, align: "right", render: (item) => money(item.price) }, { key: "total", label: "Amount", share: 0.15, align: "right", bold: true, render: (item) => money(Number(item.price || 0) * Number(item.quantity || 0)) }], rows: booking.preOrderedFoods }] : [],
    summary: [["Advance paid", money(booking?.advanceAmount)], ["Total amount", money(booking?.totalAmount)]],
    note: "Keep this confirmation for your records. Thank you for choosing TableSpot.",
  });
};

export const createBillPdf = ({ bill, booking, receiptData = buildBillReceiptData({ bill, booking }) }) => renderPdf({
  eyebrow: "Bill", title: "Invoice receipt", subtitle: bill?.billType === "WALK_IN" ? "Walk-in bill" : "Online booking bill", codeLabel: "Invoice", code: bill?.billCode || booking?.bookingCode,
  info: [{ label: "Restaurant", value: bill?.restaurantId?.restaurantName || booking?.restaurantId?.restaurantName, tone: "red" }, { label: "Date", value: dateTime(bill?.createdAt), tone: "amber" }, { label: "Status", value: titleCase(bill?.payment?.paymentStatus || bill?.billStatus), tone: "emerald" }],
  sections: [{ title: "Bill details", rows: billReceiptRows(receiptData) }],
  tables: [
    ...(bill?.orderedItems?.length ? [{ title: "Bill items", columns: [{ key: "foodName", label: "Item", share: 0.64, render: (item) => item.variantName && item.variantName !== "Regular" ? `${item.foodName || "Food item"} (${item.variantName})` : item.foodName || "Food item" }, { key: "quantity", label: "Qty", share: 0.16, align: "center" }, { key: "totalPrice", label: "Amount", share: 0.20, align: "right", bold: true, render: (item) => money(item.totalPrice) }], rows: bill.orderedItems }] : []),
    ...(bill?.payment?.payments?.length ? [{ title: "Payment history", columns: [{ key: "paymentMethod", label: "Method", share: 0.25 }, { key: "transactionId", label: "Reference", share: 0.33 }, { key: "paidAt", label: "Date", share: 0.25, render: (row) => dateTime(row.paidAt) }, { key: "amount", label: "Amount", share: 0.17, align: "right", bold: true, render: (row) => money(row.amount) }], rows: bill.payment.payments }] : []),
  ],
  summary: [["Subtotal", money(bill?.subTotal)], ["Discount", Number(bill?.discount?.value) > 0 ? `-${money(bill.discount.value)}` : undefined], ["Taxable amount", money(bill?.taxableAmount)], ["Tax", money(bill?.taxAmount)], ["Service charge", Number(bill?.serviceCharge) > 0 ? money(bill.serviceCharge) : undefined], ["Delivery charge", Number(bill?.deliveryCharge) > 0 ? money(bill.deliveryCharge) : undefined], ["Grand total", money(bill?.grandTotal)], ["Total paid", money(bill?.payment?.totalPaid)], ["Balance due", money(bill?.payment?.balanceDue)]],
  note: "This is your bill record. Please retain this receipt for reference.",
});

export const createPaymentPdf = ({ payment, booking, bill, receiptData = buildPaymentReceiptData({ payment, booking, bill }) }) => renderPdf({
  eyebrow: "Payment", title: "Payment Receipt", subtitle: payment?.restaurantId?.restaurantName || booking?.restaurantId?.restaurantName || "TableSpot", codeLabel: "Transaction reference", code: payment?.transactionId || payment?.razorpayPaymentId || payment?.razorpayOrderId,
  info: [{ label: "Restaurant", value: payment?.restaurantId?.restaurantName || booking?.restaurantId?.restaurantName, tone: "red" }, { label: "Amount", value: money(payment?.amount), tone: "amber" }, { label: "Status", value: titleCase(payment?.paymentStatus), tone: payment?.paymentStatus === "SUCCESS" ? "emerald" : "blue" }],
  sections: [{ title: "Payment details", rows: paymentReceiptRows(receiptData) }, { title: "Booking", rows: [["Customer", receiptData.customer?.customerName], ["Email", receiptData.customer?.customerEmail], ["Phone", receiptData.customer?.customerPhone], ["Guests", receiptData.booking?.numberOfGuests], ["Table(s)", receiptData.booking?.tables?.map((table) => table.label).filter(Boolean).join(", ")], ["Booking date", dateTime(receiptData.booking?.bookingDate)], ["Status", receiptData.booking?.bookingStatus]] }],
  tables: [
    ...(bill?.orderedItems?.length ? [{ title: "Bill items", columns: [{ key: "foodName", label: "Item", share: 0.64, render: (item) => item.variantName && item.variantName !== "Regular" ? `${item.foodName || "Food item"} (${item.variantName})` : item.foodName || "Food item" }, { key: "quantity", label: "Qty", share: 0.16, align: "center" }, { key: "totalPrice", label: "Amount", share: 0.20, align: "right", bold: true, render: (item) => money(item.totalPrice) }], rows: bill.orderedItems }] : []),
    ...(bill?.payment?.payments?.length ? [{ title: "Payment history", columns: [{ key: "paymentMethod", label: "Method", share: 0.25 }, { key: "transactionId", label: "Reference", share: 0.33 }, { key: "paidAt", label: "Date", share: 0.25, render: (row) => dateTime(row.paidAt) }, { key: "amount", label: "Amount", share: 0.17, align: "right", bold: true, render: (row) => money(row.amount) }], rows: bill.payment.payments }] : []),
  ],
  summary: [["Subtotal", bill?.subTotal !== undefined ? money(bill.subTotal) : undefined], ["Discount", Number(bill?.discount?.value) > 0 ? `-${money(bill.discount.value)}` : undefined], ["Taxable amount", bill?.taxableAmount !== undefined ? money(bill.taxableAmount) : undefined], ["Tax", bill?.taxAmount !== undefined ? money(bill.taxAmount) : undefined], ["Grand total", bill?.grandTotal !== undefined ? money(bill.grandTotal) : undefined], ["Total paid", bill?.payment?.totalPaid !== undefined ? money(bill.payment.totalPaid) : money(payment?.amount)], ["Balance due", bill?.payment?.balanceDue !== undefined ? money(bill.payment.balanceDue) : undefined]],
  note: "This is your payment record. Please retain this receipt for reference.",
});

export const createRefundPdf = ({ refund, booking, bill, payment = null, receiptData = buildRefundReceiptData({ refund, booking, bill, payment }) }) => {
  const source = { ...refund?.toObject?.(), ...refund, paymentId: payment || refund?.paymentId };
  const sections = [
    { title: "Refund details", rows: refundReceiptRows(receiptData) },
    { title: "Customer", rows: [["Name", receiptData.customer?.customerName], ["Email", receiptData.customer?.customerEmail], ["Phone", receiptData.customer?.customerPhone]] },
  ];
  if (source?.ownerId && typeof source.ownerId === "object") {
    sections.push({ title: "Processed by", rows: [["Name", source.ownerId.fullName], ["Email", source.ownerId.email]] });
  }
  sections.push({ title: "Booking", rows: [["Booking number", booking?.bookingCode], ["Status", booking?.bookingStatus], ["Booking date", dateTime(booking?.bookingDateTime)], ["Guests", booking?.numberOfGuests], ["Table(s)", tableSummary(booking)], ["Total amount", money(booking?.totalAmount)], ["Advance paid", money(booking?.advanceAmount)], ["Restaurant", address(source?.restaurantId || booking?.restaurantId)]] });
  return renderPdf({
    eyebrow: "Refund", title: "Refund Receipt", subtitle: source?.restaurantId?.restaurantName || booking?.restaurantId?.restaurantName || "TableSpot Refund", codeLabel: "Refund number", code: source?.refundCode || source?.transactionId,
    info: [{ label: "Restaurant", value: source?.restaurantId?.restaurantName || booking?.restaurantId?.restaurantName, tone: "red" }, { label: "Amount", value: money(source?.amount), tone: "amber" }, { label: "Status", value: titleCase(source?.refundStatus), tone: source?.refundStatus === "REFUNDED" ? "emerald" : "blue" }],
    sections,
    tables: [],
    summary: [["Bill total", money(bill?.grandTotal)], ["Total paid", money(bill?.payment?.totalPaid)], ["Refunded amount", money(source?.amount)]],
    note: "Keep this receipt for your records. Thank you for choosing TableSpot.",
  });
};

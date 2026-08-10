// Payment / refund receipt PDF — always rendered in light mode.

import { formatDateTime } from "../../utils/formatDate.js";
import {
  money,
  dash,
  refundStatusLabel,
  refundMethodLabel,
  tableLabel,
} from "../../utils/pdf/pdfTheme.js";
import {
  PdfRoot,
  PdfHeader,
  PdfInfoGrid,
  PdfSection,
  PdfKeyValueRow,
  PdfTable,
  PdfSummaryBox,
  PdfSummaryRow,
  PdfFooter,
} from "./PdfDocument.jsx";

export default function PaymentPdf({ transaction = {}, booking = null, bill = null, refund = null, view = "owner" }) {
  const isRefund = transaction.type === "refund";
  const restaurant =
    transaction.restaurantName ||
    booking?.restaurantId?.restaurantName ||
    (typeof refund?.restaurantId === "object" ? refund.restaurantId?.restaurantName : null) ||
    "TableSpot";
  const reference =
    transaction.transactionId ||
    refund?.transactionId ||
    refund?.gatewayRefundId ||
    transaction.refundCode ||
    (transaction.paymentId ? String(transaction.paymentId).slice(-8) : "N/A");
  const transactionDate = transaction.date ? new Date(transaction.date) : null;
  const billItems = bill?.orderedItems || [];
  const billPayments = bill?.payment?.payments || [];
  const status = transaction.status || "Pending";

  return (
    <PdfRoot>
      <PdfHeader
        eyebrow={isRefund ? "Refund" : "Payment"}
        title={isRefund ? "Refund Receipt" : "Payment Receipt"}
        subtitle={restaurant}
        codeLabel={isRefund ? "Refund reference" : "Transaction reference"}
        codeValue={reference}
      />

      <div style={{ padding: "20px 24px" }}>
        <PdfInfoGrid
          columns={3}
          items={[
            { label: "Restaurant", value: dash(restaurant), tone: "red" },
            { label: "Amount", value: money(transaction.amount), tone: "amber" },
            {
              label: "Status",
              value: dash(status),
              tone: String(status).toLowerCase() === "success" ? "emerald" : "blue",
            },
          ]}
        />

        <PdfSection title={isRefund ? "Refund details" : "Payment details"}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 28px" }}>
            <PdfKeyValueRow label="Purpose" value={dash(transaction.purpose)} />
            <PdfKeyValueRow label="Method" value={dash(transaction.method)} />
            <PdfKeyValueRow label="Reference" value={dash(reference)} />
            <PdfKeyValueRow label="Booking number" value={dash(transaction.bookingCode || booking?.bookingCode)} />
            <PdfKeyValueRow label="Source" value={dash(transaction.source)} />
            <PdfKeyValueRow
              label="Date"
              value={transactionDate ? formatDateTime(transactionDate) : "—"}
            />
            {transaction.notes && (
              <PdfKeyValueRow label="Notes" value={transaction.notes} />
            )}
          </div>
        </PdfSection>

        {isRefund && refund && (
          <PdfSection title="Refund information">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 28px" }}>
              <PdfKeyValueRow label="Refund code" value={dash(refund.refundCode)} />
              <PdfKeyValueRow label="Status" value={refundStatusLabel(refund.refundStatus)} />
              <PdfKeyValueRow label="Amount" value={money(refund.amount)} />
              <PdfKeyValueRow label="Method" value={refundMethodLabel(refund.refundMethod)} />
              {refund.remarks && (
                <PdfKeyValueRow label="Remarks" value={refund.remarks} />
              )}
              {refund.completedAt && (
                <PdfKeyValueRow
                  label="Completed"
                  value={formatDateTime(refund.completedAt)}
                />
              )}
            </div>
          </PdfSection>
        )}

        {booking && (
          <PdfSection title="Booking">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 28px" }}>
              <PdfKeyValueRow label="Guest" value={dash(booking.userId?.fullName || booking.userId?.name)} />
              <PdfKeyValueRow label="Booking number" value={dash(booking.bookingCode)} />
              <PdfKeyValueRow label="Email" value={dash(booking.userId?.email)} />
              <PdfKeyValueRow label="Phone" value={dash(booking.userId?.phoneNumber)} />
              <PdfKeyValueRow label="Guests" value={dash(booking.numberOfGuests)} />
              <PdfKeyValueRow label="Table(s)" value={bookingTableSummary(booking)} />
              <PdfKeyValueRow
                label="Booking date"
                value={
                  booking.bookingDateTime
                    ? formatDateTime(booking.bookingDateTime)
                    : "—"
                }
              />
              <PdfKeyValueRow label="Status" value={dash(booking.bookingStatus)} />
            </div>
          </PdfSection>
        )}

        {bill && billItems.length > 0 && (
          <PdfSection title="Bill items">
            <PdfTable
              columns={[
                {
                  key: "item",
                  label: "Item",
                  render: (item) =>
                    item.variantName && item.variantName !== "Regular"
                      ? `${item.foodName || "Food item"} (${item.variantName})`
                      : item.foodName || "Food item",
                },
                {
                  key: "qty",
                  label: "Qty",
                  align: "center",
                  render: (item) => item.quantity,
                },
                {
                  key: "price",
                  label: "Unit price",
                  align: "right",
                  render: (item) => money(item.unitPrice),
                },
                {
                  key: "amount",
                  label: "Amount",
                  align: "right",
                  bold: true,
                  render: (item) => money(item.totalPrice),
                },
              ]}
              rows={billItems}
              emptyText="No bill items"
            />
          </PdfSection>
        )}

        {bill && (
          <div style={{ marginTop: 20 }}>
            <PdfSummaryBox>
              <PdfSummaryRow label="Bill number" value={dash(bill.billCode)} />
              {bill.subTotal !== undefined && (
                <PdfSummaryRow label="Subtotal" value={money(bill.subTotal)} />
              )}
              {Number(bill.discount?.value) > 0 && (
                <PdfSummaryRow
                  label="Discount"
                  value={`-${money(bill.discount.value)}`}
                  color="#047857"
                />
              )}
              {bill.taxAmount !== undefined && (
                <PdfSummaryRow
                  label={`Tax (${bill.taxPercentage || 0}%)`}
                  value={money(bill.taxAmount)}
                />
              )}
              {bill.grandTotal !== undefined && (
                <PdfSummaryRow
                  label="Grand total"
                  value={money(bill.grandTotal)}
                  bold
                  color="#b91c1c"
                />
              )}
              {bill.payment?.totalPaid !== undefined && (
                <PdfSummaryRow
                  label="Total paid"
                  value={money(bill.payment.totalPaid)}
                  color="#047857"
                />
              )}
              {bill.payment?.balanceDue !== undefined && (
                <PdfSummaryRow
                  label="Balance due"
                  value={money(bill.payment.balanceDue)}
                />
              )}
            </PdfSummaryBox>
          </div>
        )}

        {billPayments.length > 0 && (
          <PdfSection title="Payment history">
            <PdfTable
              columns={[
                {
                  key: "method",
                  label: "Method",
                  render: (p) => p.paymentMethod || "—",
                },
                {
                  key: "ref",
                  label: "Reference",
                  render: (p) => p.transactionId || "—",
                },
                {
                  key: "date",
                  label: "Date",
                  render: (p) => (p.paidAt ? formatDateTime(p.paidAt) : "—"),
                },
                {
                  key: "amount",
                  label: "Amount",
                  align: "right",
                  bold: true,
                  render: (p) => money(p.amount),
                },
              ]}
              rows={billPayments}
              emptyText="No payments recorded"
            />
          </PdfSection>
        )}

        <PdfFooter
          generatedAt={formatDateTime(new Date())}
          note={
            view === "customer"
              ? "This is your payment record. Please retain this receipt for reference."
              : "Payment ledger record from TableSpot."
          }
        />
      </div>
    </PdfRoot>
  );
}

function bookingTableSummary(booking) {
  const tables =
    booking.tables && booking.tables.length > 0
      ? booking.tables.map((entry) => entry.tableId).filter(Boolean)
      : booking.tableId
        ? [booking.tableId]
        : [];
  const names = tables.map((table) => tableLabel(table)).filter(Boolean);
  return names.length ? names.join(", ") : "—";
}

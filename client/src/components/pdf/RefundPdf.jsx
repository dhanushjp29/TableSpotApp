// Refund receipt PDF — always rendered in light mode.

import { formatDateTime } from "../../utils/formatDate.js";
import {
  money,
  dash,
  refundStatusLabel,
  refundReasonLabel,
  refundMethodLabel,
  restaurantAddress,
  tableLabel,
} from "../../utils/pdf/pdfTheme.js";
import {
  PdfRoot,
  PdfHeader,
  PdfInfoGrid,
  PdfSection,
  PdfKeyValueRow,
  PdfSummaryBox,
  PdfSummaryRow,
  PdfFooter,
} from "./PdfDocument.jsx";

export default function RefundPdf({ refund = {}, booking = null, bill = null, view = "owner" }) {
  const customer = typeof refund.customerId === "object" ? refund.customerId : null;
  const owner = typeof refund.ownerId === "object" ? refund.ownerId : null;
  const restaurant =
    typeof refund.restaurantId === "object"
      ? refund.restaurantId
      : booking?.restaurantId
        ? booking.restaurantId
        : null;
  const reference = refund.refundCode || refund.transactionId || "N/A";

  return (
    <PdfRoot>
      <PdfHeader
        eyebrow="Refund"
        title="Refund Receipt"
        subtitle={restaurant?.restaurantName || "TableSpot Refund"}
        codeLabel="Refund number"
        codeValue={reference}
      />

      <div style={{ padding: "20px 24px" }}>
        <PdfInfoGrid
          columns={3}
          items={[
            { label: "Restaurant", value: dash(restaurant?.restaurantName), tone: "red" },
            { label: "Amount", value: money(refund.amount), tone: "amber" },
            {
              label: "Status",
              value: refundStatusLabel(refund.refundStatus),
              tone: refund.refundStatus === "REFUNDED" ? "emerald" : "blue",
            },
          ]}
        />

        <PdfSection title="Refund details">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 28px" }}>
            <PdfKeyValueRow label="Reason" value={refundReasonLabel(refund.reason)} />
            <PdfKeyValueRow label="Method" value={refundMethodLabel(refund.refundMethod)} />
            <PdfKeyValueRow
              label="Requested"
              value={refund.requestedAt ? formatDateTime(refund.requestedAt) : "—"}
            />
            <PdfKeyValueRow
              label="Deadline"
              value={refund.deadlineAt ? formatDateTime(refund.deadlineAt) : "—"}
            />
            <PdfKeyValueRow
              label="Completed"
              value={refund.completedAt ? formatDateTime(refund.completedAt) : "—"}
            />
            <PdfKeyValueRow label="Reference" value={dash(refund.transactionId || refund.gatewayRefundId)} />
            {refund.remarks && (
              <PdfKeyValueRow label="Remarks" value={refund.remarks} />
            )}
            {refund.disputeReason && (
              <PdfKeyValueRow label="Dispute reason" value={refund.disputeReason} />
            )}
          </div>
        </PdfSection>

        <PdfSection title="Customer">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 28px" }}>
            <PdfKeyValueRow label="Name" value={dash(customer?.fullName)} />
            <PdfKeyValueRow label="Email" value={dash(customer?.email)} />
            <PdfKeyValueRow label="Phone" value={dash(customer?.phoneNumber)} />
          </div>
        </PdfSection>

        {view === "owner" && owner && (
          <PdfSection title="Processed by">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 28px" }}>
              <PdfKeyValueRow label="Name" value={dash(owner.fullName)} />
              <PdfKeyValueRow label="Email" value={dash(owner.email)} />
            </div>
          </PdfSection>
        )}

        {booking && (
          <PdfSection title="Booking">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 28px" }}>
              <PdfKeyValueRow label="Booking number" value={dash(booking.bookingCode)} />
              <PdfKeyValueRow label="Status" value={dash(booking.bookingStatus)} />
              <PdfKeyValueRow
                label="Booking date"
                value={
                  booking.bookingDateTime
                    ? formatDateTime(booking.bookingDateTime)
                    : "—"
                }
              />
              <PdfKeyValueRow label="Guests" value={dash(booking.numberOfGuests)} />
              <PdfKeyValueRow label="Table(s)" value={bookingTableSummary(booking)} />
              <PdfKeyValueRow label="Total amount" value={money(booking.totalAmount)} />
              <PdfKeyValueRow label="Advance paid" value={money(booking.advanceAmount)} />
              <PdfKeyValueRow label="Restaurant" value={restaurantAddress(restaurant) || "—"} />
            </div>
          </PdfSection>
        )}

        {bill && (
          <div style={{ marginTop: 20 }}>
            <PdfSummaryBox>
              <PdfSummaryRow label="Bill number" value={dash(bill.billCode)} />
              <PdfSummaryRow label="Bill total" value={money(bill.grandTotal)} />
              <PdfSummaryRow
                label="Total paid on bill"
                value={money(bill.payment?.totalPaid)}
                color="#047857"
              />
              <PdfSummaryRow
                label="Refunded amount"
                value={money(refund.amount)}
                bold
                color="#b91c1c"
              />
            </PdfSummaryBox>
          </div>
        )}

        <PdfFooter
          generatedAt={formatDateTime(new Date())}
          note={
            view === "customer"
              ? "Keep this receipt for your records. Thank you for choosing TableSpot."
              : "Internal refund record from TableSpot."
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

// Booking confirmation PDF — always rendered in light mode.

import { formatDateTime } from "../../utils/formatDate.js";
import {
  money,
  dash,
  restaurantAddress,
  tableLabel,
  refundStatusLabel,
  refundReasonLabel,
  refundMethodLabel,
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

export default function BookingPdf({ booking, view = "owner" }) {
  const restaurant =
    typeof booking?.restaurantId === "object" ? booking.restaurantId : null;
  const customer = typeof booking?.userId === "object" ? booking.userId : null;
  const primaryTable =
    typeof booking?.tableId === "object" ? booking.tableId : null;
  const tableEntries =
    booking?.tables && booking.tables.length > 0
      ? booking.tables.map((entry) => entry.tableId).filter(Boolean)
      : primaryTable
        ? [primaryTable]
        : [];
  const tableNames = tableEntries.map(tableLabel).filter(Boolean).join(", ");
  const bookingDateTime = booking?.bookingDateTime
    ? new Date(booking.bookingDateTime)
    : null;
  const orderedItems = booking?.preOrderedFoods || [];
  const orderedTotal = orderedItems.reduce(
    (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0),
    0
  );
  const refund =
    typeof booking?.refundId === "object" ? booking.refundId : null;
  const totalAmount = Number(booking?.totalAmount || 0);

  return (
    <PdfRoot>
      <PdfHeader
        eyebrow="Booking"
        title="Booking Confirmation"
        subtitle={
          restaurant?.restaurantName ||
          booking?.restaurantId?.restaurantName ||
          "TableSpot Booking"
        }
        codeLabel="Booking number"
        codeValue={booking?.bookingCode}
      />

      <div style={{ padding: "20px 24px" }}>
        <PdfInfoGrid
          columns={3}
          items={[
            {
              label: "Restaurant",
              value: dash(restaurant?.restaurantName),
              tone: "red",
            },
            {
              label: "Status",
              value: dash(booking?.bookingStatus),
              tone: "emerald",
            },
            {
              label: "Date & time",
              value: bookingDateTime
                ? formatDateTime(bookingDateTime)
                : "—",
              tone: "amber",
            },
          ]}
        />

        <PdfSection title="Reservation details">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 28px" }}>
            <PdfKeyValueRow label="Customer" value={dash(customer?.fullName)} />
            <PdfKeyValueRow label="Booking type" value={dash(booking?.bookingType)} />
            <PdfKeyValueRow label="Email" value={dash(customer?.email)} />
            <PdfKeyValueRow label="Phone" value={dash(customer?.phoneNumber)} />
            <PdfKeyValueRow label="Guests" value={dash(booking?.numberOfGuests)} />
            <PdfKeyValueRow label="Table(s)" value={tableNames || "—"} />
            <PdfKeyValueRow label="Duration" value={`${dash(booking?.expectedDuration)} min`} />
            <PdfKeyValueRow label="Payment" value={dash(booking?.paymentStatus)} />
            <PdfKeyValueRow label="Payment method" value={dash(booking?.paymentMethod)} />
            <PdfKeyValueRow label="Restaurant" value={restaurantAddress(restaurant) || "—"} />
          </div>
        </PdfSection>

        {orderedItems.length > 0 && (
          <PdfSection title="Pre-ordered items">
            <PdfTable
              columns={[
                {
                  key: "item",
                  label: "Item",
                  render: (item) => item.foodId?.foodName || "Food item",
                },
                {
                  key: "variant",
                  label: "Variant",
                  render: (item) => item.variantName || "Regular",
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
                  render: (item) => money(item.price),
                },
                {
                  key: "amount",
                  label: "Amount",
                  align: "right",
                  bold: true,
                  render: (item) => money(item.price * item.quantity),
                },
              ]}
              rows={orderedItems}
              emptyText="No pre-ordered items"
            />
          </PdfSection>
        )}

        <div style={{ marginTop: 20 }}>
          <PdfSummaryBox>
            {orderedTotal > 0 && (
              <PdfSummaryRow
                label="Pre-order total"
                value={money(orderedTotal)}
              />
            )}
            <PdfSummaryRow
              label="Advance paid"
              value={money(booking?.advanceAmount)}
            />
            <PdfSummaryRow
              label="Total amount"
              value={money(totalAmount)}
              bold
              color="#b91c1c"
            />
          </PdfSummaryBox>
        </div>

        {refund && (
          <PdfSection title="Refund">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 28px" }}>
              <PdfKeyValueRow label="Refund code" value={dash(refund.refundCode)} />
              <PdfKeyValueRow label="Status" value={refundStatusLabel(refund.refundStatus)} />
              <PdfKeyValueRow label="Amount" value={money(refund.amount)} />
              <PdfKeyValueRow label="Method" value={refundMethodLabel(refund.refundMethod)} />
              {refund.reason && (
                <PdfKeyValueRow
                  label="Reason"
                  value={refundReasonLabel(refund.reason)}
                />
              )}
            </div>
          </PdfSection>
        )}

        {booking?.specialRequest && (
          <div
            style={{
              marginTop: 20,
              border: "1px solid #fde68a",
              background: "#fffbeb",
              borderRadius: 12,
              padding: "12px 16px",
            }}
          >
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "#b45309" }}>
              Special request
            </p>
            <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "#78350f" }}>
              {booking.specialRequest}
            </p>
          </div>
        )}

        <PdfFooter
          generatedAt={formatDateTime(new Date())}
          note={
            view === "customer"
              ? "Keep this confirmation for your records. Thank you for choosing TableSpot."
              : "Internal reservation record from TableSpot."
          }
        />
      </div>
    </PdfRoot>
  );
}

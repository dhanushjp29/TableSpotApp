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
import { getBookingFoodItems } from "../../utils/foodItems.js";
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
  const bill = typeof booking?.billId === "object" ? booking.billId : null;
  const orderedItems = getBookingFoodItems(booking);
  const orderedTotal = orderedItems.reduce(
    (sum, item) => sum + Number(item.totalPrice || 0),
    0
  );
  const refund =
    typeof booking?.refundId === "object" ? booking.refundId : null;
  const totalAmount = Number(booking?.totalAmount || 0);
  const offer = booking?.offerId && typeof booking.offerId === "object"
    ? booking.offerId
    : bill?.offer?.offerCode
      ? bill.offer
      : null;

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
          <PdfSection title="Food items">
            <PdfTable
              columns={[
                {
                  key: "item",
                  label: "Item",
                  render: (item) => item.foodName,
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
                  render: (item) => money(item.unitPrice),
                },
                {
                  key: "offer",
                  label: "Offer price",
                  align: "right",
                  render: (item) =>
                    item.offerPrice > 0 ? money(item.offerPrice) : "—",
                },
                {
                  key: "source",
                  label: "Source",
                  render: (item) => item.orderSource || "—",
                },
                {
                  key: "amount",
                  label: "Amount",
                  align: "right",
                  bold: true,
                  render: (item) => money(item.totalPrice),
                },
              ]}
              rows={orderedItems}
              emptyText="No food items"
            />
          </PdfSection>
        )}

        {offer && (
          <PdfSection title="Offer">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 28px" }}>
              <PdfKeyValueRow label="Offer code" value={dash(offer.offerCode)} />
              <PdfKeyValueRow label="Offer title" value={dash(offer.title)} />
              <PdfKeyValueRow label="Discount" value={`${offer.discountType || ""} ${offer.discountValue ?? ""}`} />
              <PdfKeyValueRow label="Discount amount" value={money(bill?.offer?.discountAmount || 0)} />
              <PdfKeyValueRow label="Offer status" value={dash(booking?.offerRecipient?.status)} />
            </div>
          </PdfSection>
        )}

        <PdfSection title="Payment and bill">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 28px" }}>
            <PdfKeyValueRow label="Advance required" value={money(booking?.advanceAmount)} />
            <PdfKeyValueRow label="Booking payment status" value={dash(booking?.paymentStatus)} />
            <PdfKeyValueRow label="Bill number" value={dash(bill?.billCode)} />
            <PdfKeyValueRow label="Bill status" value={dash(bill?.billStatus)} />
            <PdfKeyValueRow label="Bill subtotal" value={money(bill?.subTotal)} />
            <PdfKeyValueRow label="Bill discount" value={money(bill?.discount?.value)} />
            <PdfKeyValueRow label="Taxable amount" value={money(bill?.taxableAmount)} />
            <PdfKeyValueRow label="Tax" value={money(bill?.taxAmount)} />
            <PdfKeyValueRow label="Service charge" value={money(bill?.serviceCharge)} />
            <PdfKeyValueRow label="Grand total" value={money(bill?.grandTotal || totalAmount)} />
            <PdfKeyValueRow label="Total paid" value={money(bill?.payment?.totalPaid)} />
            <PdfKeyValueRow label="Balance due" value={money(bill?.payment?.balanceDue)} />
          </div>
          {bill?.payment?.payments?.length > 0 && (
            <PdfTable
              columns={[
                { key: "method", label: "Payment", render: (item) => item.paymentMethod || "Payment" },
                { key: "transaction", label: "Transaction", render: (item) => item.transactionId || "—" },
                { key: "amount", label: "Amount", align: "right", render: (item) => money(item.amount) },
              ]}
              rows={bill.payment.payments}
            />
          )}
        </PdfSection>

        <div style={{ marginTop: 20 }}>
          <PdfSummaryBox>
            {orderedTotal > 0 && (
              <PdfSummaryRow
                label="Food items total"
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

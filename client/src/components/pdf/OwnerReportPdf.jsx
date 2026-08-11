// Owner analytics report PDF - always rendered in light mode using the shared
// PdfDocument building blocks. Data comes from the /reports/owner payload.

import { formatDateTime } from "../../utils/formatDate.js";
import { money } from "../../utils/pdf/pdfTheme.js";
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
import { PDF_COLORS } from "../../utils/pdf/pdfTheme.js";

const pct = (value) => (value === null || value === undefined ? "—" : `${value}%`);

const dash = (value) => value ?? "—";

function BarRow({ label, value, max, color = "#b91c1c" }) {
  const width = max > 0 ? `${Math.max(2, (value / max) * 100)}%` : "0%";
  return (
    <div style={{ display: "grid", gridTemplateColumns: "150px 1fr 70px", gap: 8, alignItems: "center", padding: "3px 0" }}>
      <span style={{ fontSize: 11, color: PDF_COLORS.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
      <div style={{ height: 10, background: "#f3f4f6", borderRadius: 5 }}>
        <div style={{ width, height: 10, background: color, borderRadius: 5 }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, textAlign: "right", color: PDF_COLORS.text }}>{value}</span>
    </div>
  );
}

export default function OwnerReportPdf({ report }) {
  const meta = report?.meta || {};
  const summary = report?.summary || {};
  const bookings = summary.bookings || {};
  const revenue = summary.revenue || {};
  const bills = summary.bills || {};
  const customers = summary.customers || {};
  const refunds = summary.refunds || {};
  const offers = summary.offers || {};
  const reviews = summary.reviews || {};
  const restaurantReviews = reviews.restaurant || {};
  const foodReviews = reviews.food || {};

  const peakMax = Math.max(1, ...(report?.peakHours || []).map((h) => h.count));

  return (
    <PdfRoot>
      <PdfHeader
        eyebrow="Owner Analytics"
        title="Restaurant Analytics Report"
        subtitle={`${meta.restaurantName || "All Restaurants"}  •  ${meta.range?.label || ""}`}
        codeLabel="Generated at"
        codeValue={meta.generatedAt ? formatDateTime(meta.generatedAt) : "—"}
      />

      <div style={{ padding: "20px 24px" }}>
        <PdfSection title="Executive Summary">
          <PdfInfoGrid
            columns={3}
            items={[
              { label: "Gross Revenue", value: money(revenue.gross), tone: "emerald" },
              { label: "Total Bookings", value: dash(bookings.total), tone: "red" },
              { label: "Total Customers", value: dash(customers.total), tone: "blue" },
              { label: "Total Bills", value: dash(bills.total), tone: "red" },
              { label: "Refund Amount", value: money(refunds.amount), tone: "amber" },
              { label: "Avg Restaurant Rating", value: dash(restaurantReviews.avgRating), tone: "blue" },
            ]}
          />
        </PdfSection>

        <PdfSection title="Booking Analytics">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 28px" }}>
            <PdfKeyValueRow label="Confirmed" value={dash(bookings.confirmed)} />
            <PdfKeyValueRow label="Completed" value={dash(bookings.completed)} />
            <PdfKeyValueRow label="Cancelled" value={dash(bookings.cancelled)} />
            <PdfKeyValueRow label="No Show" value={dash(bookings.noShow)} />
            <PdfKeyValueRow label="Online / Walk-in" value={`${bookings.online} / ${bookings.walkIn}`} />
            <PdfKeyValueRow label="Completion Rate" value={pct(bookings.completionRate)} />
            <PdfKeyValueRow label="Avg Guests" value={dash(bookings.avgGuests)} />
            <PdfKeyValueRow label="Avg Duration (min)" value={dash(bookings.avgDuration)} />
            <PdfKeyValueRow label="Busiest Day" value={dash(report?.bookings?.busiestDay)} />
            <PdfKeyValueRow label="Peak Hour" value={report?.bookings?.peakHour !== null ? `${report.bookings.peakHour}:00` : "—"} />
          </div>
        </PdfSection>

        <PdfSection title="Peak Hours">
          {(report?.peakHours || []).slice(0, 12).map((row) => (
            <BarRow key={row.hour} label={`${row.hour}:00`} value={row.count} max={peakMax} color="#b91c1c" />
          ))}
        </PdfSection>

        <PdfSection title="Revenue Analytics">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 28px" }}>
            <PdfKeyValueRow label="Gross Revenue" value={money(revenue.gross)} />
            <PdfKeyValueRow label="Manual Discounts" value={money(revenue.manualDiscount)} />
            <PdfKeyValueRow label="Offer Discounts" value={money(revenue.offerDiscount)} />
            <PdfKeyValueRow label="Tax" value={money(revenue.tax)} />
            <PdfKeyValueRow label="Service Charges" value={money(revenue.serviceCharge)} />
            <PdfKeyValueRow label="Delivery Charges" value={money(revenue.deliveryCharge)} />
            <PdfKeyValueRow label="Refunds" value={money(revenue.refunds)} />
            <PdfKeyValueRow label="Refund Rate" value={pct(revenue.refundRate)} />
          </div>
          <div style={{ marginTop: 14 }}>
            <PdfSummaryBox>
              <PdfSummaryRow label="Gross Revenue" value={money(revenue.gross)} />
              <PdfSummaryRow label="Refunds" value={money(revenue.refunds)} />
              <PdfSummaryRow label="Net Revenue" value={money(revenue.net)} bold color="#047857" divider />
              <PdfSummaryRow label="Avg Bill Value" value={money(bills.avgBill)} />
              <PdfSummaryRow label="Balance Due" value={money(bills.balanceDue)} />
            </PdfSummaryBox>
          </div>
        </PdfSection>

        <PdfSection title="Payment Analytics">
          <PdfTable
            columns={[
              { key: "method", label: "Method", bold: true },
              { key: "count", label: "Transactions", align: "right" },
              { key: "amount", label: "Amount", align: "right" },
              { key: "share", label: "Share", align: "right" },
            ]}
            rows={(report?.payments?.methods || []).map((method) => ({
              method: method.method || "Other",
              count: method.count,
              amount: money(method.amount),
              share: pct(report.payments.total ? (method.amount / report.payments.total) * 100 : 0),
            }))}
            emptyText="No payment records for this period."
          />
          <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 28px" }}>
            <PdfKeyValueRow label="Online Payments" value={money(report?.payments?.onlineAmount)} />
            <PdfKeyValueRow label="Offline Payments" value={money(report?.payments?.offlineAmount)} />
          </div>
        </PdfSection>

        <PdfSection title="Billing Performance">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 28px" }}>
            <PdfKeyValueRow label="Total Bills" value={dash(bills.total)} />
            <PdfKeyValueRow label="Paid Bills" value={dash(bills.paid)} />
            <PdfKeyValueRow label="Partially Paid" value={dash(bills.partial)} />
            <PdfKeyValueRow label="Pending" value={dash(bills.pending)} />
            <PdfKeyValueRow label="Total Billed" value={money(bills.totalBilled)} />
            <PdfKeyValueRow label="Total Paid" value={money(bills.totalPaid)} />
            <PdfKeyValueRow label="Max Bill" value={money(bills.maxBill)} />
            <PdfKeyValueRow label="Min Bill" value={money(bills.minBill)} />
            <PdfKeyValueRow label="Collection Rate" value={pct(bills.collectionRate)} />
          </div>
        </PdfSection>

        <PdfSection title="Customer Analytics">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 28px" }}>
            <PdfKeyValueRow label="Total Customers" value={dash(customers.total)} />
            <PdfKeyValueRow label="New / Returning" value={`${customers.newCustomers} / ${customers.returning}`} />
            <PdfKeyValueRow label="Repeat Rate" value={pct(customers.repeatRate)} />
            <PdfKeyValueRow label="Avg Spend / Customer" value={money(customers.avgSpendPerCustomer)} />
          </div>
          <div style={{ marginTop: 12 }}>
            <PdfTable
              columns={[
                { key: "name", label: "Customer", bold: true },
                { key: "bills", label: "Bills", align: "right" },
                { key: "spent", label: "Spent", align: "right" },
              ]}
              rows={(customers.topSpenders || []).map((customer) => ({
                name: customer.name || "Guest",
                bills: customer.bills,
                spent: money(customer.spent),
              }))}
              emptyText="No customer spend data for this period."
            />
          </div>
        </PdfSection>

        <PdfSection title="Food Performance">
          <PdfTable
            columns={[
              { key: "rank", label: "Rank", align: "right" },
              { key: "foodName", label: "Item", bold: true },
              { key: "qty", label: "Sold", align: "right" },
              { key: "revenue", label: "Revenue", align: "right" },
            ]}
            rows={(report?.food?.top || []).slice(0, 10).map((item) => ({
              rank: item.rank,
              foodName: item.foodName || "-",
              qty: item.qty,
              revenue: money(item.revenue),
            }))}
            emptyText="No billed items for this period."
          />
        </PdfSection>

        <PdfSection title="Offers Performance">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 28px" }}>
            <PdfKeyValueRow label="Total Offers" value={dash(offers.total)} />
            <PdfKeyValueRow label="Active Offers" value={dash(offers.active)} />
            <PdfKeyValueRow label="Claims" value={dash(offers.claimed)} />
            <PdfKeyValueRow label="Redemptions" value={dash(offers.used)} />
            <PdfKeyValueRow label="Discount Given" value={money(offers.discountGiven)} />
            <PdfKeyValueRow label="Redemption Rate" value={pct(offers.redemptionRate)} />
          </div>
          <div style={{ marginTop: 12 }}>
            <PdfTable
              columns={[
                { key: "offerCode", label: "Code", bold: true },
                { key: "title", label: "Offer" },
                { key: "used", label: "Used", align: "right" },
                { key: "discount", label: "Discount", align: "right" },
              ]}
              rows={(offers.top || []).slice(0, 5).map((offer) => ({
                offerCode: offer.offerCode || "-",
                title: offer.title || "-",
                used: offer.used,
                discount: money(offer.discount),
              }))}
              emptyText="No offer usage for this period."
            />
          </div>
        </PdfSection>

        <PdfSection title="Reviews & Customer Experience">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 28px" }}>
            <PdfKeyValueRow label="Restaurant Reviews" value={dash(restaurantReviews.count)} />
            <PdfKeyValueRow label="Food Reviews" value={dash(foodReviews.count)} />
            <PdfKeyValueRow label="Avg Restaurant Rating" value={dash(restaurantReviews.avgRating)} />
            <PdfKeyValueRow label="Avg Food Rating" value={dash(foodReviews.avgRating)} />
            <PdfKeyValueRow label="Replied" value={dash(restaurantReviews.replied)} />
            <PdfKeyValueRow label="Reply Rate" value={pct(restaurantReviews.replyRate)} />
          </div>
        </PdfSection>

        <PdfFooter generatedAt={formatDateTime(new Date())} note="Internal analytics report generated from TableSpot." />
      </div>
    </PdfRoot>
  );
}

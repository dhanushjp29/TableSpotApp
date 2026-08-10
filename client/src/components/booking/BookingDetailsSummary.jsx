import {
  Armchair,
  CheckCircle2,
  Clock3,
  CreditCard,
  MapPin,
  ReceiptText,
  Ticket,
  UtensilsCrossed,
  Users,
} from "lucide-react";

import Badge from "../ui/Badge.jsx";
import { OFFER_RECIPIENT_STATUS_META } from "../../constants/offer.js";
import { formatDate, formatDateTime, formatTime } from "../../utils/formatDate.js";
import { formatCurrency } from "../../utils/formatCurrency.js";

const STATUS_VARIANT = {
  Pending: "warning",
  Confirmed: "success",
  Completed: "info",
  Cancelled: "error",
  "No Show": "error",
};

const display = (value, fallback = "—") =>
  value === undefined || value === null || value === "" ? fallback : value;

const Section = ({ icon: Icon, title, children }) => (
  <section className="card-theme rounded-2xl border border-border p-5 shadow-sm">
    <div className="mb-4 flex items-center gap-2">
      <Icon size={18} className="text-primary" />
      <h2 className="text-base font-bold text-text">{title}</h2>
    </div>
    {children}
  </section>
);

const Row = ({ label, value }) => (
  <div className="flex items-start justify-between gap-4 border-b border-border/70 py-2 last:border-0">
    <span className="text-sm text-muted">{label}</span>
    <span className="text-right text-sm font-medium text-text">{display(value)}</span>
  </div>
);

function tableEntries(booking) {
  const primary = typeof booking.tableId === "object" ? booking.tableId : null;
  const entries = booking.tables?.length
    ? booking.tables
    : [{ tableId: primary, seatLabels: booking.seatLabels || [] }];
  return entries.map((entry) => ({
    ...entry,
    table: typeof entry.tableId === "object" ? entry.tableId : primary,
  }));
}

export default function BookingDetailsSummary({ booking, offerRecipient = null }) {
  const restaurant = typeof booking.restaurantId === "object" ? booking.restaurantId : null;
  const customer = typeof booking.userId === "object" ? booking.userId : null;
  const date = booking.bookingDateTime ? new Date(booking.bookingDateTime) : null;
  const bill = typeof booking.billId === "object" ? booking.billId : null;
  const foods = booking.preOrderedFoods || [];
  const payments = bill?.payment?.payments?.length
    ? bill.payment.payments
    : booking.sourcePaymentId?.amount
      ? [booking.sourcePaymentId]
      : [];
  const offer = booking.offerId && typeof booking.offerId === "object" ? booking.offerId : null;
  const offerStatus = offerRecipient?.status || (offer ? "CLAIMED" : null);
  const tables = tableEntries(booking);

  return (
    <div className="space-y-5">
      <section className="rounded-3xl bg-gradient-to-br from-primary to-primary-dark p-6 text-white shadow-lg">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/70">Booking overview</p>
            <h1 className="mt-2 text-2xl font-black">{display(booking.bookingCode, "Booking")}</h1>
            <p className="mt-1 text-sm text-white/80">{restaurant?.restaurantName || "Restaurant reservation"}</p>
          </div>
          <Badge variant={STATUS_VARIANT[booking.bookingStatus] || "primary"}>{display(booking.bookingStatus)}</Badge>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div><p className="text-xs text-white/70">Date</p><p className="mt-1 font-semibold">{date ? formatDate(date) : "—"}</p></div>
          <div><p className="text-xs text-white/70">Time</p><p className="mt-1 font-semibold">{date ? formatTime(date) : "—"}</p></div>
          <div><p className="text-xs text-white/70">Guests</p><p className="mt-1 font-semibold">{display(booking.numberOfGuests)}</p></div>
          <div><p className="text-xs text-white/70">Duration</p><p className="mt-1 font-semibold">{display(booking.expectedDuration, 120)} min</p></div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Section icon={MapPin} title="Restaurant">
          <div className="flex gap-4">
            {restaurant?.coverImage && <img src={restaurant.coverImage} alt="" className="h-20 w-20 rounded-xl object-cover" />}
            <div className="min-w-0 flex-1">
              <p className="font-bold text-text">{display(restaurant?.restaurantName)}</p>
              <p className="mt-1 text-sm text-muted">{display(restaurant?.restaurantCode)}</p>
              <p className="mt-1 text-sm text-muted">{[restaurant?.address, restaurant?.city, restaurant?.state, restaurant?.country].filter(Boolean).join(", ") || "Address unavailable"}</p>
              {restaurant?.phoneNumber && <p className="mt-1 text-sm text-muted">{restaurant.phoneNumber}</p>}
            </div>
          </div>
        </Section>

        <Section icon={Users} title="Customer">
          <Row label="Name" value={customer?.fullName} />
          <Row label="Email" value={customer?.email} />
          <Row label="Phone" value={customer?.phoneNumber} />
          <Row label="Booking type" value={booking.bookingType} />
          <Row label="Created" value={booking.createdAt ? formatDateTime(booking.createdAt) : null} />
        </Section>

        <Section icon={Armchair} title={`Tables: ${tables.length}`}>
          <div className="space-y-3">
            {tables.map((entry, index) => {
              const table = entry.table || {};
              return <div key={`${table._id || index}`} className="rounded-xl border border-border bg-surface-secondary/50 p-3">
                <p className="font-semibold text-text">Table {index + 1} · {display(table.tableName || table.tableLabel || table.tableCode)}</p>
                <p className="mt-1 text-xs text-muted">Code: {display(table.tableCode)} · Capacity: {display(table.capacity)} · Minimum: {display(table.minimumCapacity)}</p>
                <p className="mt-1 text-xs text-muted">Type: {display(table.tableType)} · Location: {display(table.floor || table.tableLocation)}</p>
                {entry.seatLabels?.length > 0 && <p className="mt-1 text-xs text-muted">Seats: {entry.seatLabels.join(", ")}</p>}
              </div>;
            })}
          </div>
        </Section>

        <Section icon={UtensilsCrossed} title="Pre-ordered food">
          {foods.length === 0 ? <p className="text-sm text-muted">No pre-ordered food.</p> : <div className="space-y-3">
            {foods.map((item, index) => {
              const food = typeof item.foodId === "object" ? item.foodId : null;
              const unit = item.unitPrice ?? item.price ?? item.offerPrice ?? 0;
              const lineTotal = item.totalPrice ?? (Number(unit) * Number(item.quantity || 0));
              return <div key={index} className="flex items-center justify-between gap-3 border-b border-border/70 pb-3 last:border-0 last:pb-0">
                <div><p className="font-semibold text-text">{food?.foodName || item.foodName || "Food item"}</p><p className="text-xs text-muted">Variant: {display(item.variantName, "Regular")} · Qty: {item.quantity} · {formatCurrency(unit)} × {item.quantity}</p></div>
                <span className="font-semibold text-text">{formatCurrency(lineTotal)}</span>
              </div>;
            })}
          </div>}
          {bill && <div className="mt-4 border-t border-border pt-3"><Row label="Pre-order subtotal" value={formatCurrency(bill.subTotal)} /><Row label="Offer discount" value={bill.offer?.discountAmount ? `-${formatCurrency(bill.offer.discountAmount)}` : "—"} /></div>}
        </Section>

        {offer && <Section icon={Ticket} title="Offer">
          <div className="flex items-start justify-between gap-3"><div><p className="font-bold text-text">{offer.title || "Offer"}</p><p className="mt-1 font-mono text-sm text-primary">{offer.offerCode}</p></div>{offerStatus && <Badge variant={OFFER_RECIPIENT_STATUS_META[offerStatus]?.variant || "neutral"}>{OFFER_RECIPIENT_STATUS_META[offerStatus]?.label || offerStatus}</Badge>}</div>
          <Row label="Discount" value={`${offer.discountType}: ${offer.discountValue}`} />
          <Row label="Applied amount" value={offerRecipient?.discountAmount ? `-${formatCurrency(offerRecipient.discountAmount)}` : bill?.offer?.discountAmount ? `-${formatCurrency(bill.offer.discountAmount)}` : "Not applied yet"} />
        </Section>}

        <Section icon={CreditCard} title="Payment">
          <Row label="Total booking amount" value={formatCurrency(booking.totalAmount)} />
          <Row label="Advance required" value={formatCurrency(booking.advanceAmount)} />
          <Row label="Advance paid" value={bill ? formatCurrency(bill.payment?.advancePaid) : booking.paymentStatus === "Paid" ? formatCurrency(booking.advanceAmount) : "—"} />
          <Row label="Remaining" value={bill ? formatCurrency(bill.payment?.balanceDue) : "—"} />
          <Row label="Payment status" value={bill?.payment?.paymentStatus || booking.paymentStatus} />
          {payments.length > 0 && <div className="mt-3 border-t border-border pt-2"><p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted">Payments</p>{payments.map((payment, index) => <div key={index} className="flex justify-between gap-3 py-2 text-sm"><span className="text-muted">{payment.paymentMethod || "Payment"}{payment.transactionId ? ` · ${payment.transactionId}` : ""}</span><span className="font-semibold text-text">{formatCurrency(payment.amount)}</span></div>)}</div>}
        </Section>

        <Section icon={ReceiptText} title="Bill summary">
          {!bill ? <p className="text-sm text-muted">Bill not generated yet.</p> : <><Row label="Bill number" value={bill.billCode} /><Row label="Bill type" value={bill.billType} /><Row label="Subtotal" value={formatCurrency(bill.subTotal)} /><Row label="Discount" value={formatCurrency(bill.discount?.value)} /><Row label="Offer discount" value={bill.offer?.discountAmount ? `-${formatCurrency(bill.offer.discountAmount)}` : "—"} /><Row label="Taxable amount" value={formatCurrency(bill.taxableAmount)} /><Row label="Tax" value={formatCurrency(bill.taxAmount)} /><Row label="Service charge" value={formatCurrency(bill.serviceCharge)} /><Row label="Delivery charge" value={formatCurrency(bill.deliveryCharge)} /><Row label="Grand total" value={formatCurrency(bill.grandTotal)} /><Row label="Balance due" value={formatCurrency(bill.payment?.balanceDue)} /><Row label="Bill status" value={bill.billStatus} /></>}
        </Section>
      </div>

      {booking.specialRequest && <Section icon={CheckCircle2} title="Special requests"><p className="whitespace-pre-wrap text-sm text-text">{booking.specialRequest}</p></Section>}
      <Section icon={Clock3} title="Timeline"><div className="grid gap-3 sm:grid-cols-2"><Row label="Booking created" value={booking.createdAt ? formatDateTime(booking.createdAt) : null} />{booking.sourcePaymentId?.createdAt && <Row label="Payment created" value={formatDateTime(booking.sourcePaymentId.createdAt)} />}{booking.billId && <Row label="Bill generated" value={bill?.generatedAt ? formatDateTime(bill.generatedAt) : "Available"} />}{bill?.payment?.paymentStatus === "Paid" && <Row label="Bill paid" value="Completed" />}{booking.completedAt && <Row label="Completed" value={formatDateTime(booking.completedAt)} />}</div></Section>
    </div>
  );
}

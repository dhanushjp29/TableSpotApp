import { Receipt } from "lucide-react";
import Select from "../ui/Select.jsx";

const display = (value) => value || "—";

export default function BillInformation({ bill, billType, draft, restaurants, tables, editable, onChange, onRestaurantChange }) {
  const booking = bill?.bookingId || {};
  const date = bill?.createdAt ? new Date(bill.createdAt) : null;
  const bookingDate = booking.bookingDateTime ? new Date(booking.bookingDateTime) : null;
  return <section className="rounded-2xl border border-border bg-surface-secondary/40 p-4 sm:p-5">
    <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-text"><Receipt size={16} className="text-primary" />Bill Information</h3>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm">
      <div><span className="text-xs text-muted">Bill Number</span><p className="font-semibold text-text">{display(bill?.billCode || "New bill")}</p></div>
      <div><span className="text-xs text-muted">Bill Type</span><p className="font-semibold text-text">{billType === "ONLINE" ? "ONLINE BOOKING" : "WALK-IN"}</p></div>
      <div><span className="text-xs text-muted">Bill Date</span><p className="font-semibold text-text">{date ? date.toLocaleDateString() : "Today"}</p></div>
      <div><span className="text-xs text-muted">Bill Time</span><p className="font-semibold text-text">{date ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Now"}</p></div>
    </div>
    <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {editable ? <Select label="Restaurant" value={draft.restaurantId} onChange={(event) => { onChange("restaurantId", event.target.value); onRestaurantChange?.(event.target.value); }}><option value="">-- Select Restaurant --</option>{restaurants.map((restaurant) => <option key={restaurant._id} value={restaurant._id}>{restaurant.restaurantName}</option>)}</Select> : <div><span className="text-xs text-muted">Restaurant</span><p className="font-medium text-text">{display(bill?.restaurantId?.restaurantName || booking.restaurantId?.restaurantName)}</p></div>}
      {editable ? <Select label="Table" value={draft.tableId} onChange={(event) => onChange("tableId", event.target.value)}><option value="">-- Select Table --</option>{tables.map((table) => <option key={table._id} value={table._id}>{table.tableCode || table.tableNumber}{table.tableName ? ` — ${table.tableName}` : ""}</option>)}</Select> : <div><span className="text-xs text-muted">Table</span><p className="font-medium text-text">{display(bill?.tableId?.tableCode || bill?.tableId?.tableNumber || booking.tableId?.tableCode || booking.tableId?.tableNumber)}</p></div>}
      {[["Customer Name", "customerName"], ["Customer Phone", "customerPhone"], ["Customer Email", "customerEmail"]].map(([label, key]) => editable ? <label key={key} className="text-sm"><span className="input-label">{label}</span><input className="input-field w-full" value={draft[key]} onChange={(event) => onChange(key, event.target.value)} /></label> : <div key={key}><span className="text-xs text-muted">{label}</span><p className="font-medium text-text">{display(draft[key])}</p></div>)}
      {billType === "ONLINE" && <><div><span className="text-xs text-muted">Booking Number</span><p className="font-medium text-text">{display(booking.bookingCode)}</p></div><div><span className="text-xs text-muted">Booking Date/Time</span><p className="font-medium text-text">{bookingDate ? bookingDate.toLocaleString() : "—"}</p></div></>}
    </div>
  </section>;
}

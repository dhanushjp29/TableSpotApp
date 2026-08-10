import { useState } from "react";
import { ArrowLeft, FileDown, FileText, Plus, Printer, ReceiptText } from "lucide-react";
import Button from "../ui/Button.jsx";
import Badge from "../ui/Badge.jsx";
import Select from "../ui/Select.jsx";
import BillEditor from "./BillEditor.jsx";
import BillReceiptView from "./BillReceiptView.jsx";

function OnlineBillStarter({ bookings, onCancel, onCreate, submitting }) {
  const [bookingId, setBookingId] = useState("");
  const eligibleBookings = bookings.filter((booking) => !booking.billId && booking.bookingStatus === "Confirmed");

  return <div className="mx-auto max-w-xl rounded-2xl border border-red-100 bg-red-50/40 p-5 dark:border-red-900/40 dark:bg-[#17131a] sm:p-8">
    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">New online bill</p>
    <h2 className="mt-2 text-2xl font-bold text-text">Select a booking</h2>
    <p className="mt-2 text-sm text-muted">The booking, customer, table, pre-ordered items, and advance payment will be loaded into the invoice editor.</p>
    <div className="mt-5"><Select label="Confirmed booking" value={bookingId} onChange={(event) => setBookingId(event.target.value)}><option value="">-- Select booking --</option>{eligibleBookings.map((booking) => <option key={booking._id} value={booking._id}>{booking.bookingCode || booking._id.slice(-6)} · {booking.userId?.fullName || "Guest"}</option>)}</Select></div>
    <div className="mt-5 flex justify-end gap-3"><Button type="button" variant="outline" onClick={onCancel}>Cancel</Button><Button type="button" variant="primary" disabled={!bookingId} isLoading={submitting} onClick={() => onCreate(bookingId)}>Continue to Bill</Button></div>
  </div>;
}

export default function BillingWorkspace({ bill, billType, bookings = [], bills, initialTab = "editor",   restaurants, tables, foods, offers = [], loading, submitting, applying = false, onBack, onNew, onNewOnline, onSelectBill, onRestaurantChange, onApplyOffer, onSave, onCreateOnline, onPrint, onDownloadPdf }) {
  const [tab, setTab] = useState(initialTab);
  const isOnlineCreate = !bill && billType === "ONLINE_CREATE";

  return <div className="min-h-[calc(100vh-8rem)] rounded-3xl border border-red-100 bg-red-50/30 p-3 transition-colors dark:border-white/[0.07] dark:bg-[#0d1015] sm:p-5">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-100 bg-white p-3 shadow-sm transition-colors dark:border-white/[0.08] dark:bg-[#171b23] dark:shadow-black/20">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="primary" onClick={onNew}><Plus size={15} className="mr-1" />New Walk-in Bill</Button>
        <Button size="sm" variant="outline" onClick={onNewOnline}><Plus size={15} className="mr-1" />New Online Bill</Button>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {tab === "editor" && <><Button size="sm" variant="outline" onClick={onBack}>Cancel</Button><Button size="sm" variant="primary" type="submit" form="bill-editor-form" isLoading={submitting}>{bill ? "Update Bill" : "Create Walk-in Bill"}</Button></>}
        {bill && tab === "receipt" && <><Button size="sm" variant="outline" onClick={onPrint}><Printer size={15} className="mr-1" />Print</Button><Button size="sm" variant="secondary" onClick={onDownloadPdf}><FileDown size={15} className="mr-1" />Receipt PDF</Button></>}
      </div>
    </div>

    <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="rounded-2xl border border-red-100 bg-white p-3 shadow-sm transition-colors dark:border-white/[0.08] dark:bg-[#151920] dark:shadow-black/20">
        <div className="mb-3"><button type="button" className="group flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-semibold text-primary transition-all hover:bg-red-50 hover:pl-3 dark:hover:bg-red-950/30" onClick={onBack}><ArrowLeft size={15} className="transition-transform group-hover:-translate-x-1" />All Bills</button></div>
        <div className="mb-3 rounded-xl bg-gradient-to-br from-red-700 to-red-500 p-3 text-white shadow-lg shadow-red-900/20"><p className="text-xs uppercase tracking-wide text-red-100">Billing workspace</p><p className="mt-1 text-lg font-bold">{bills.length} invoices</p></div>
        <div className="max-h-[calc(100vh-16rem)] space-y-1 overflow-y-auto pr-1">
          {bills.map((item) => <button type="button" key={item._id} onClick={() => onSelectBill(item, tab)} className={`group w-full rounded-xl border p-3 text-left transition-all duration-200 hover:-translate-y-px hover:shadow-md ${item._id === bill?._id ? "border-red-500 bg-red-50 shadow-sm dark:border-red-500/80 dark:bg-red-950/35 dark:shadow-red-950/20" : "border-transparent hover:border-red-200 hover:bg-red-50/70 dark:hover:border-white/10 dark:hover:bg-[#1d222b]"}`}><div className="flex items-center justify-between gap-2"><span className="font-mono text-xs font-bold text-primary">{item.billCode || item._id?.slice(-6)}</span><Badge variant={item.billType === "WALK_IN" ? "neutral" : "primary"}>{item.billType === "WALK_IN" ? "Walk-in" : "Online"}</Badge></div><p className="mt-1 text-sm font-semibold text-text">₹{Number(item.grandTotal || 0).toFixed(2)}</p><p className="truncate text-xs text-muted">{item.customerName || item.bookingId?.userId?.fullName || "Guest"}</p></button>)}
        </div>
      </aside>

      <main className="rounded-2xl border border-red-100 bg-white p-4 shadow-sm transition-colors dark:border-white/[0.08] dark:bg-[#151920] dark:shadow-black/20 sm:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Invoice workspace</p><h1 className="mt-1 text-xl font-bold text-text">{bill ? bill.billCode : isOnlineCreate ? "New Online Bill" : "New Walk-in Bill"}</h1></div><div className="flex flex-wrap items-center justify-end gap-2">{bill && <div className="flex items-center gap-1 rounded-xl border border-red-100 bg-red-50 p-1 shadow-sm dark:border-red-800/60 dark:bg-[#21181d] dark:shadow-black/30"><button type="button" aria-pressed={tab === "editor"} onClick={() => setTab("editor")} className={`flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold transition-all duration-200 hover:-translate-y-px hover:shadow-sm ${tab === "editor" ? "bg-white text-primary shadow-sm dark:bg-red-500/20 dark:text-red-200 dark:ring-1 dark:ring-red-400/30" : "text-gray-600 hover:bg-white/80 hover:text-red-700 dark:text-slate-300 dark:hover:bg-white/[0.10] dark:hover:text-red-200"}`}><FileText size={15} />Edit</button><button type="button" aria-pressed={tab === "receipt"} onClick={() => setTab("receipt")} className={`flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold transition-all duration-200 hover:-translate-y-px hover:shadow-sm ${tab === "receipt" ? "bg-white text-primary shadow-sm dark:bg-red-500/20 dark:text-red-200 dark:ring-1 dark:ring-red-400/30" : "text-gray-600 hover:bg-white/80 hover:text-red-700 dark:text-slate-300 dark:hover:bg-white/[0.10] dark:hover:text-red-200"}`}><ReceiptText size={15} />Receipt</button></div>}</div></div>
        {isOnlineCreate ? <OnlineBillStarter bookings={bookings} onCancel={onBack} onCreate={onCreateOnline} submitting={submitting} /> : tab === "receipt" && bill ? <BillReceiptView bill={bill} /> : <BillEditor bill={bill} billType={bill?.billType || "WALK_IN"} restaurants={restaurants} tables={tables} foods={foods} offers={offers} loading={loading} submitting={submitting} applying={applying} onRestaurantChange={onRestaurantChange} onApplyOffer={onApplyOffer} onSubmit={onSave} />}
      </main>
    </div>
  </div>;
}

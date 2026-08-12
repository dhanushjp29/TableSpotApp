import { useState } from "react";
import { useSelector } from "react-redux";
import toast from "react-hot-toast";
import { Download, Receipt, Sparkles } from "lucide-react";
import { formatDate, formatDateTime } from "../../utils/formatDate.js";
import { renderPdfBlob, downloadBlob } from "../../utils/pdf/pdfGenerator.js";
import BillReceiptPrint from "./BillReceiptPrint.jsx";
import Button from "../ui/Button.jsx";
import { useDownloadLoader } from "../../hooks/useDownloadLoader.js";

const money = (value) => `₹${Number(value || 0).toFixed(2)}`;

export default function BillReceiptView({ bill, id = "receipt-print-area" }) {
  const user = useSelector((state) => state.auth.user);
  const isOwner = user?.role === "owner";
  const booking = bill?.bookingId || {};
  const payments = bill?.payment?.payments || [];
  const status = bill?.payment?.paymentStatus || bill?.billStatus || "Pending";
  const isPaid = String(status).toLowerCase() === "paid";
  const [downloading, setDownloading] = useState(false);
  const { runDownload } = useDownloadLoader();

  const downloadReceiptPdf = async () => {
    const element = document.getElementById(`${id}-print`);
    if (!element) return;
    setDownloading(true);
    try {
      await runDownload(async () => {
        const filename = `${bill?.billCode || "tablespot-receipt"}.pdf`;
        const blob = await renderPdfBlob({ element, filename });
        downloadBlob(blob, filename);
        toast.success("Receipt PDF downloaded.");
      });
    } catch {
      toast.error("Unable to generate the receipt PDF.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary dark:text-red-300">Invoice receipt</p>
          <p className="mt-1 text-sm text-muted dark:text-slate-300">Light, print-ready payment and tax summary</p>
        </div>
        <div className="flex items-center gap-2">
          {!isOwner && (
            <Button
              variant="outline"
              size="sm"
              onClick={downloadReceiptPdf}
              disabled={downloading}
            >
              <Download size={14} className="mr-1" />
              {downloading ? "Downloading..." : "Download PDF"}
            </Button>
          )}
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-100 text-red-700">
            <Receipt size={24} className="dark:text-red-600" />
          </div>
        </div>
      </div>

      <div
        id={id}
        data-receipt-theme="light"
        className="overflow-hidden rounded-3xl border border-red-200 bg-white text-gray-900 shadow-[0_18px_55px_rgba(127,29,29,0.12)] dark:border-red-900/60 dark:bg-[#171b23] dark:text-slate-100"
      >
        <div className="relative overflow-hidden bg-linear-to-br from-red-700 via-red-600 to-orange-500 px-5 py-6 text-white sm:px-8">
          <div className="absolute -right-10 -top-14 h-40 w-40 rounded-full bg-white/10" />
          <div className="absolute -bottom-24 right-24 h-44 w-44 rounded-full bg-orange-300/20" />
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold tracking-wide text-red-50"><Sparkles size={16} /> TableSpot</div>
              <h2 className="mt-5 text-3xl font-black tracking-tight">Invoice receipt</h2>
              <p className="mt-1 text-sm text-red-100">Thank you for dining with us</p>
            </div>
            <div className="rounded-2xl border border-white/25 bg-white/15 px-3 py-2 text-right backdrop-blur-sm">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-red-100">Invoice</p>
              <p className="mt-1 font-mono text-sm font-bold">{bill?.billCode || "Receipt"}</p>
            </div>
          </div>
        </div>

        <div className="p-5 sm:p-8 dark:bg-[#171b23]">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-red-100 bg-red-50/70 p-4 dark:border-red-900/50 dark:bg-red-950/30"><p className="text-[10px] font-bold uppercase tracking-widest text-red-600 dark:text-red-300">Restaurant</p><p className="mt-1 font-semibold text-gray-900 dark:text-slate-100">{bill?.restaurantId?.restaurantName || booking.restaurantId?.restaurantName || "Restaurant"}</p></div>
            <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-4 dark:border-amber-900/50 dark:bg-amber-950/25"><p className="text-[10px] font-bold uppercase tracking-widest text-amber-700 dark:text-amber-300">Date</p><p className="mt-1 font-semibold text-gray-900 dark:text-slate-100">{bill?.createdAt ? formatDate(new Date(bill.createdAt)) : "—"}</p></div>
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/25"><p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-300">Status</p><p className="mt-1 font-semibold text-gray-900 dark:text-slate-100">{status}</p></div>
          </div>

          <div className="mt-6 grid gap-x-6 gap-y-3 border-y border-gray-200 py-5 text-sm dark:border-white/10 sm:grid-cols-2">
            <p><span className="font-semibold text-gray-700 dark:text-slate-300">Customer:</span> <span className="font-bold text-gray-950 dark:text-slate-100">{bill?.customerName || booking.userId?.fullName || "Guest"}</span></p>
            <p><span className="font-semibold text-gray-700 dark:text-slate-300">Email:</span> <span className="font-bold text-gray-950 dark:text-slate-100">{bill?.customerEmail || booking.userId?.email || "—"}</span></p>
            <p><span className="font-semibold text-gray-700 dark:text-slate-300">Booking number:</span> <span className="font-bold text-gray-950 dark:text-slate-100">{booking.bookingCode || "Walk-in"}</span></p>
            <p><span className="font-semibold text-gray-700 dark:text-slate-300">Phone:</span> <span className="font-bold text-gray-950 dark:text-slate-100">{bill?.customerPhone || booking.userId?.phoneNumber || "—"}</span></p>
            <p><span className="font-semibold text-gray-700 dark:text-slate-300">Table:</span> <span className="font-bold text-gray-950 dark:text-slate-100">{bill?.tableId?.tableCode || booking.tableId?.tableCode || bill?.tableId?.tableNumber || "—"}</span></p>
            <p><span className="font-semibold text-gray-700 dark:text-slate-300">Booking date/time:</span> <span className="font-bold text-gray-950 dark:text-slate-100">{booking.bookingDateTime ? formatDateTime(new Date(booking.bookingDateTime)) : "—"}</span></p>
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-130 text-left text-sm">
              <thead><tr className="border-b-2 border-red-200 text-[10px] uppercase tracking-widest text-red-800 dark:border-red-800/70 dark:text-red-300"><th className="pb-3">Item</th><th className="pb-3">Qty</th><th className="pb-3 text-right">Amount</th></tr></thead>
              <tbody className="divide-y divide-gray-200 dark:divide-white/10">{(bill?.orderedItems || []).map((item, index) => <tr key={`${item.foodId}-${index}`}><td className="py-3 font-bold text-gray-950 dark:text-slate-100">{item.foodName} <span className="text-xs font-semibold text-gray-600 dark:text-slate-300">({item.variantName || "Regular"})</span></td><td className="py-3 font-semibold text-gray-800 dark:text-slate-200">{item.quantity}</td><td className="py-3 text-right font-bold text-gray-950 dark:text-slate-100">{money(item.totalPrice)}</td></tr>)}</tbody>
            </table>
          </div>

          <div className="mt-6 ml-auto max-w-sm rounded-2xl bg-gray-50 p-4 text-sm ring-1 ring-gray-100 dark:bg-[#11151b] dark:ring-white/10">
            <div className="flex justify-between py-1"><span className="font-semibold text-gray-700 dark:text-slate-300">Subtotal</span><span className="font-semibold text-gray-950 dark:text-slate-100">{money(bill?.subTotal)}</span></div>
            <div className="flex justify-between py-1"><span className="font-semibold text-gray-700">Discount</span><span className="font-bold text-emerald-700">-{money(bill?.discount?.value)}</span></div>{Number(bill?.offerDiscountAmount || 0) > 0 && (<div className="flex justify-between py-1"><span className="font-semibold text-gray-700 dark:text-slate-300">Offer ({(bill.offer?.offerCode || "").toUpperCase()})</span><span className="font-bold text-emerald-700 dark:text-emerald-300">-{money(bill.offerDiscountAmount)}</span></div>)}
            <div className="flex justify-between py-1"><span className="font-semibold text-gray-700 dark:text-slate-300">Taxable Amount</span><span className="font-semibold text-gray-950 dark:text-slate-100">{money(bill?.taxableAmount)}</span></div>
            <div className="flex justify-between py-1"><span className="font-semibold text-gray-700 dark:text-slate-300">Tax ({bill?.taxPercentage || 0}%)</span><span className="font-semibold text-gray-950 dark:text-slate-100">{money(bill?.taxAmount)}</span></div>
            <div className="mt-2 flex justify-between border-t border-gray-200 pt-3 text-lg font-black dark:border-white/10"><span className="dark:text-slate-100">Grand Total</span><span className="text-red-700 dark:text-red-300">{money(bill?.grandTotal)}</span></div>
            <div className="mt-3 flex justify-between border-t border-dashed border-gray-300 pt-3 dark:border-white/10"><span className="font-semibold text-gray-700 dark:text-slate-300">Total Paid</span><span className="font-bold text-emerald-700 dark:text-emerald-300">{money(bill?.payment?.totalPaid)}</span></div>
            <div className="flex justify-between font-bold"><span className="font-semibold text-gray-700 dark:text-slate-300">Balance Due</span><span className={isPaid ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"}>{money(bill?.payment?.balanceDue)}</span></div>
          </div>

          {payments.length > 0 && <div className="mt-6 rounded-2xl border border-gray-300 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#11151b]"><p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-gray-700 dark:text-slate-300">Payment history</p>{payments.map((payment, index) => <div key={`${payment.transactionId || index}`} className="flex justify-between border-b border-gray-200 py-2 text-sm last:border-0 dark:border-white/10"><span className="font-bold text-gray-900 dark:text-slate-100">{payment.paymentMethod}{payment.transactionId ? ` · ${payment.transactionId}` : ""}</span><span className="font-bold text-gray-950 dark:text-slate-100">{money(payment.amount)}</span></div>)}</div>}
        </div>
      </div>
      <div className="pointer-events-none absolute left-[-10000px] top-0 w-198.5" aria-hidden="true"><BillReceiptPrint bill={bill} id={`${id}-print`} /></div>
    </div>
  );
}

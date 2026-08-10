import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  CalendarClock,
  CircleDollarSign,
  CreditCard,
  FileX,
  Landmark,
  ReceiptText,
  RefreshCw,
  Search,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";

import { fetchRestaurants } from "../../store/slices/restaurantSlice.js";
import { fetchPaymentHistory } from "../../store/slices/paymentSlice.js";
import RestaurantFilter from "../owner/RestaurantFilter.jsx";
import Card from "../ui/Card.jsx";
import Badge from "../ui/Badge.jsx";
import Select from "../ui/Select.jsx";
import { SkeletonText } from "../ui/Skeleton.jsx";
import ErrorState from "../ui/ErrorState.jsx";
import EmptyState from "../ui/EmptyState.jsx";
import { formatDateTime } from "../../utils/formatDate.js";
import { formatCurrency } from "../../utils/formatCurrency.js";
import InvoiceDatePicker from "../common/InvoiceDatePicker.jsx";
import ExportButton from "../common/ExportButton.jsx";
import { useExcelExport } from "../../hooks/useExcelExport.js";
import { exportPaymentsToExcel } from "../../utils/paymentExport.js";
import PdfDownloadButton from "../pdf/PdfDownloadButton.jsx";
import PaymentPdf from "../pdf/PaymentPdf.jsx";
import RefundPdf from "../pdf/RefundPdf.jsx";
import {
  fetchPaymentReceiptData,
  paymentReceiptFilename,
  refundReceiptFilename,
} from "../../utils/pdf/pdfData.js";

const PURPOSE_ICONS = {
  "Booking Advance": CreditCard,
  "Pre-Order Payment": UtensilsCrossed,
  "Spot Order Payment": UtensilsCrossed,
  "Bill Payment": ReceiptText,
  Refund: ArrowUpRight,
};

const STATUS_VARIANT = {
  Success: "success",
  Pending: "warning",
  Failed: "error",
  Refunded: "info",
};

const STATUS_ICONS = {
  Success: CircleDollarSign,
  Pending: CalendarClock,
  Failed: FileX,
  Refunded: ArrowDownLeft,
};

const METHOD_ICONS = {
  Cash: Banknote,
  UPI: Landmark,
  Card: CreditCard,
  "Net Banking": Landmark,
  Wallet: Wallet,
  Online: RefreshCw,
};

const PURPOSE_OPTIONS = [
  "Booking Advance",
  "Pre-Order Payment",
  "Spot Order Payment",
  "Bill Payment",
  "Refund",
];

const METHOD_OPTIONS = ["Online", "Cash", "UPI", "Card", "Net Banking", "Wallet"];

const STATUS_OPTIONS = ["Success", "Pending", "Failed", "Refunded"];

function SummaryCard({
  icon: Icon,
  label,
  value,
  hint,
  iconClass = "bg-primary/10 text-primary",
  valueClass = "text-text",
}) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconClass}`}>
          <Icon size={20} aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-muted">
            {label}
          </p>
          <p className={`truncate text-lg font-bold sm:text-xl ${valueClass}`}>
            {value}
          </p>
          {hint && <p className="text-[11px] text-muted">{hint}</p>}
        </div>
      </div>
    </Card>
  );
}

function TransactionRow({ transaction, role }) {
  const Icon =
    PURPOSE_ICONS[transaction.purpose] ||
    (transaction.type === "refund" ? ArrowUpRight : ReceiptText);
  const MethodIcon = METHOD_ICONS[transaction.method] || Wallet;
  const StatusIcon = STATUS_ICONS[transaction.status] || CircleDollarSign;

  const isRefund = transaction.type === "refund";
  const moneyIn = role === "owner" ? !isRefund : isRefund;
  const sign = moneyIn ? "+" : "-";

  return (
    <li className="flex items-start gap-3 border-b border-border/70 px-4 py-4 transition-colors hover:bg-primary/[0.03] last:border-0 dark:hover:bg-white/[0.03] sm:px-5">
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
          isRefund ? "bg-blue-50 text-blue-600" : "bg-primary/10 text-primary"
        }`}
      >
        <Icon size={18} aria-hidden="true" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="text-sm font-semibold text-text">{transaction.purpose}</p>
          {transaction.status === "Success" && !isRefund && (
            <Badge variant="success">{transaction.method}</Badge>
          )}
          {isRefund && <Badge variant="info">{transaction.method}</Badge>}
          {transaction.status !== "Success" && (
            <Badge variant={STATUS_VARIANT[transaction.status] || "neutral"}>
              {transaction.status}
            </Badge>
          )}
        </div>

        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted">
          {transaction.restaurantName && (
            <span className="font-medium text-text">
              {transaction.restaurantName}
            </span>
          )}
          {transaction.bookingCode && (
            <span className="font-mono">{transaction.bookingCode}</span>
          )}
          {transaction.date && (
            <span>{formatDateTime(transaction.date)}</span>
          )}
        </p>

        {transaction.transactionId && (
        <p className="mt-0.5 truncate font-mono text-[10px] text-muted">
            Txn: {transaction.transactionId}
          </p>
        )}
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        <p
          className={`text-sm font-bold sm:text-base ${
            isRefund ? "text-blue-600" : "text-text"
          }`}
        >
          <span className={moneyIn ? "text-success" : ""}>
            {sign}
            {formatCurrency(transaction.amount)}
          </span>
        </p>
        <span className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted">
          <MethodIcon size={12} aria-hidden="true" />
          {transaction.method}
        </span>
        <span
          className={`flex items-center gap-1 text-[10px] font-semibold ${
            isRefund ? "text-blue-600" : "text-success"
          }`}
        >
          <StatusIcon size={12} aria-hidden="true" />
          {transaction.status}
        </span>
        <PdfDownloadButton
          variant="ghost"
          size="sm"
          className="text-primary"
          label="PDF"
          loadingLabel="..."
          successMessage={
            isRefund ? "Refund receipt PDF downloaded." : "Payment receipt PDF downloaded."
          }
          filename={isRefund ? refundReceiptFilename : paymentReceiptFilename}
          fetchData={() => fetchPaymentReceiptData(transaction)}
          renderDocument={({ transaction: t, booking, bill, refund }) =>
            isRefund ? (
              <RefundPdf refund={refund} booking={booking} bill={bill} view={role} />
            ) : (
              <PaymentPdf transaction={t} booking={booking} bill={bill} view={role} />
            )
          }
        />
      </div>
    </li>
  );
}

function FilterSelect({ label, value, options, onChange, allLabel, className }) {
  return (
    <Select
      className={className}
      label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{allLabel}</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </Select>
  );
}

function PaymentHistoryPanel({ role = "customer", title, subtitle }) {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const restaurants = useSelector((state) => state.restaurant.restaurants);
  const transactions = useSelector((state) => state.payment.transactions);
  const summary = useSelector((state) => state.payment.summary);
  const isLoading = useSelector((state) => state.payment.isLoading);
  const error = useSelector((state) => state.payment.error);

  const [search, setSearch] = useState("");
  const [purpose, setPurpose] = useState("");
  const [method, setMethod] = useState("");
  const [status, setStatus] = useState("");
  const [selectedRestaurant, setSelectedRestaurant] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const fetchHistory = async () => {
    await dispatch(
      fetchPaymentHistory({
        ...(role === "owner" && selectedRestaurant ? { restaurantId: selectedRestaurant } : {}),
      })
    ).catch(() => {});
  };

  useEffect(() => {
    fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, selectedRestaurant, role]);

  useEffect(() => {
    if (role !== "owner") return;
    const userId = user?._id || user?.id;
    if (!userId) return;
    dispatch(fetchRestaurants({ ownerId: userId, isActive: true })).catch(() => {});
  }, [dispatch, role, user?._id, user?.id]);

  const filteredTransactions = useMemo(() => {
    const term = search.trim().toLowerCase();
    return transactions.filter((t) => {
      if (purpose && t.purpose !== purpose) return false;
      if (method && t.method !== method) return false;
      if (status && t.status !== status) return false;
      const transactionDate = t.date ? new Date(t.date).toISOString().slice(0, 10) : "";
      if (dateFrom && transactionDate < dateFrom) return false;
      if (dateTo && transactionDate > dateTo) return false;
      if (!term) return true;
      return (
        (t.bookingCode || "").toLowerCase().includes(term) ||
        (t.restaurantName || "").toLowerCase().includes(term) ||
        (t.transactionId || "").toLowerCase().includes(term) ||
        (t.notes || "").toLowerCase().includes(term)
      );
    });
  }, [transactions, search, purpose, method, status, dateFrom, dateTo]);

  const hasFilters = search || purpose || method || status || dateFrom || dateTo;

  const { isExporting, handleExport } = useExcelExport({
    data: filteredTransactions,
    exportFn: exportPaymentsToExcel,
    emptyMessage: "No transactions available to export.",
    successMessage: "Payment history exported to Excel.",
  });

  const moneyInLabel =
    role === "owner" ? "Net Collected" : "Net Spent";

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="p-5">
              <SkeletonText lines={2} />
            </Card>
          ))}
        </div>
        <Card className="p-4">
          <SkeletonText lines={6} />
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Unable to load payment history"
        description={error}
        onRetry={fetchHistory}
      />
    );
  }

  return (
    <div className="space-y-6">
      {title && (
        <div>
          <h1 className="text-2xl font-bold text-text">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <SummaryCard
          icon={CircleDollarSign}
          label="Total Paid"
          value={formatCurrency(summary.totalPaid)}
          iconClass="bg-primary/10 text-primary"
        />
        <SummaryCard
          icon={CreditCard}
          label="Paid Online"
          value={formatCurrency(summary.totalPaidOnline)}
          iconClass="bg-blue-50 text-blue-600"
        />
        <SummaryCard
          icon={Banknote}
          label="Paid Offline"
          value={formatCurrency(summary.totalPaidOffline)}
          iconClass="bg-amber-50 text-accent"
        />
        <SummaryCard
          icon={ArrowDownLeft}
          label="Total Refunded"
          value={formatCurrency(summary.totalRefunded)}
          iconClass="bg-green-50 text-success"
        />
        <SummaryCard
          icon={ArrowUpRight}
          label={moneyInLabel}
          value={formatCurrency(summary.netAmount)}
          iconClass="bg-violet-50 text-violet-600"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="relative w-full sm:w-90">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by restaurant, booking code or transaction ID..."
            className="input-field w-full pl-9"
          />
        </div>
        {role === "owner" && (
          <RestaurantFilter
            className="w-full sm:w-52"
            restaurants={restaurants}
            value={selectedRestaurant}
            onChange={setSelectedRestaurant}
          />
        )}
        <FilterSelect
          className="w-full sm:w-40"
          label="Purpose"
          value={purpose}
          options={PURPOSE_OPTIONS}
          onChange={setPurpose}
          allLabel="All purposes"
        />
        <FilterSelect
          className="w-full sm:w-40"
          label="Method"
          value={method}
          options={METHOD_OPTIONS}
          onChange={setMethod}
          allLabel="All methods"
        />
        <FilterSelect
          className="w-full sm:w-40"
          label="Status"
          value={status}
          options={STATUS_OPTIONS}
          onChange={setStatus}
          allLabel="All statuses"
        />
        <div className="w-full sm:w-40"><InvoiceDatePicker label="From date" value={dateFrom} onChange={setDateFrom} /></div>
        <div className="w-full sm:w-40"><InvoiceDatePicker label="To date" value={dateTo} onChange={setDateTo} /></div>
        <ExportButton isExporting={isExporting} onClick={handleExport} />
      </div>

      {/* Transaction list */}
      {filteredTransactions.length === 0 ? (
        <Card className="p-6">
          <EmptyState
            title={hasFilters ? "No matching transactions" : "No transactions yet"}
            description={
              hasFilters
                ? "Try adjusting your search or filters."
                : "Payments you make for bookings and bill payments will appear here as a clean transaction history."
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-5">
            <p className="text-sm font-semibold text-text">
              Transaction History
            </p>
            <p className="text-xs text-muted">
              {filteredTransactions.length}{" "}
              {filteredTransactions.length === 1 ? "transaction" : "transactions"}
            </p>
          </div>
          <ul>
            {filteredTransactions.map((transaction, index) => (
              <TransactionRow
                key={`${transaction.paymentId || ""}-${index}`}
                transaction={transaction}
                role={role}
              />
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

export default PaymentHistoryPanel;

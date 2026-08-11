import { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import toast from "react-hot-toast";
import {
  BarChart2,
  Calendar,
  CalendarCheck,
  CalendarClock,
  Calculator,
  CheckCircle2,
  IndianRupee,
  Receipt,
  RefreshCw,
  Repeat,
  Star,
  TrendingUp,
  UserX,
  Users,
  XCircle,
  ClipboardList,
  CreditCard,
  RotateCcw,
  Utensils,
  Armchair,
  Tag,
  MessageSquare,
  HeartPulse,
  Clock,
  Building2,
  Download,
  FileSpreadsheet,
} from "lucide-react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Filler,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar, Doughnut, Line } from "react-chartjs-2";

import { fetchRestaurants } from "../../store/slices/restaurantSlice.js";
import RestaurantFilter from "../../components/owner/RestaurantFilter.jsx";
import Card from "../../components/ui/Card.jsx";
import Button from "../../components/ui/Button.jsx";
import Select from "../../components/ui/Select.jsx";
import Skeleton, { SkeletonCard, SkeletonTable, SkeletonText } from "../../components/ui/Skeleton.jsx";
import InvoiceDatePicker from "../../components/common/InvoiceDatePicker.jsx";
import { ownerReportApi } from "../../api/analytics.api.js";
import { exportOwnerReportToExcel } from "../../utils/ownerReportExcel.js";
import { formatCurrency } from "../../utils/formatCurrency.js";
import { formatDateTime } from "../../utils/formatDate.js";
import PdfDownloadButton from "../../components/pdf/PdfDownloadButton.jsx";
import OwnerReportPdf from "../../components/pdf/OwnerReportPdf.jsx";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Filler,
  Title,
  Tooltip,
  Legend
);

const PRESETS = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "last7", label: "Last 7 Days" },
  { key: "last30", label: "Last 30 Days" },
  { key: "thisMonth", label: "This Month" },
  { key: "lastMonth", label: "Last Month" },
  { key: "custom", label: "Custom Range" },
];

const localISO = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

const shiftDays = (date, days) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

const presetRange = (key, customStart, customEnd) => {
  const today = new Date();
  const from = (d) => localISO(d);
  const to = (d) => localISO(d);
  switch (key) {
    case "today":
      return { start: from(today), end: to(today) };
    case "yesterday": {
      const y = shiftDays(today, -1);
      return { start: from(y), end: to(y) };
    }
    case "last7":
      return { start: from(shiftDays(today, -6)), end: to(today) };
    case "last30":
      return { start: from(shiftDays(today, -29)), end: to(today) };
    case "thisMonth":
      return { start: from(new Date(today.getFullYear(), today.getMonth(), 1)), end: to(today) };
    case "lastMonth": {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 0);
      return { start: from(start), end: to(end) };
    }
    case "custom":
    default:
      return {
        start: customStart || from(shiftDays(today, -29)),
        end: customEnd || to(today),
      };
  }
};

const fmtPct = (value) =>
  value === null || value === undefined ? "—" : `${Number(value).toFixed(1)}%`;

const round = (value, digits = 2) => {
  const n = Number(value || 0);
  const factor = 10 ** digits;
  return Math.round((n + Number.EPSILON) * factor) / factor;
};

const useChartTheme = () =>
  useMemo(() => {
    const style = getComputedStyle(document.documentElement);
    const text = style.getPropertyValue("--color-text").trim() || "#171717";
    const muted = style.getPropertyValue("--color-muted").trim() || "#737373";
    const border = style.getPropertyValue("--color-border").trim() || "#e5e5e0";
    return { text, muted, border };
  }, []);

const STATUS_COLORS = {
  Pending: "#f59e0b",
  Confirmed: "#3b82f6",
  Completed: "#22c55e",
  Cancelled: "#ef4444",
  "No Show": "#9ca3af",
};

const METHOD_COLORS = {
  Cash: "#10b981",
  UPI: "#6366f1",
  Card: "#3b82f6",
  "Net Banking": "#f59e0b",
  Wallet: "#8b5cf6",
};

function ChangeBadge({ value }) {
  if (value === null || value === undefined) return null;
  const positive = value > 0;
  const isGood = positive;
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-bold ${
        isGood ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600"
      }`}
    >
      {positive ? "↑" : "↓"} {Math.abs(value).toFixed(1)}%
    </span>
  );
}

function KpiCard({ label, value, sub, icon, tone, change }) {
  const tones = {
    bookings: "bg-orange-500/10 text-orange-600 border-orange-500",
    revenue: "bg-green-500/10 text-green-600 border-green-500",
    blue: "bg-blue-500/10 text-blue-600 border-blue-500",
    red: "bg-red-500/10 text-red-600 border-red-500",
    purple: "bg-purple-500/10 text-purple-600 border-purple-500",
    cyan: "bg-cyan-500/10 text-cyan-600 border-cyan-500",
    amber: "bg-amber-500/10 text-amber-600 border-amber-500",
    emerald: "bg-emerald-500/10 text-emerald-600 border-emerald-500",
    indigo: "bg-indigo-500/10 text-indigo-600 border-indigo-500",
  };
  const toneClass = tones[tone] || tones.blue;
  const [iconWrap, iconText, border] = toneClass.split(" ");
  return (
    <Card className={`relative overflow-hidden border-l-4 ${border} p-5`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-muted">
            {label}
          </p>
          <p className="mt-1 truncate text-2xl font-extrabold text-text">{value}</p>
          {sub && <p className="mt-1 text-xs font-medium text-muted">{sub}</p>}
        </div>
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconWrap}`}>
          <span className={iconText}>{icon}</span>
        </div>
      </div>
      {change !== undefined && (
        <div className="mt-3 flex items-center gap-2 border-t border-border/70 pt-3">
          <ChangeBadge value={change} />
          <span className="text-[11px] text-muted">vs previous period</span>
        </div>
      )}
    </Card>
  );
}

function SectionHeading({ title, subtitle, right }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-bold text-text">{title}</h2>
        {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

function SectionCard({ title, subtitle, icon, right, children, className = "" }) {
  return (
    <Card className={`overflow-hidden ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 bg-surface-secondary/35 px-5 py-4">
        <div className="flex items-center gap-2">
          {icon}
          <div>
            <h3 className="text-sm font-bold text-text">{title}</h3>
            {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
          </div>
        </div>
        {right}
      </div>
      <div className="p-5">{children}</div>
    </Card>
  );
}

function ChartSkeleton() {
  return (
    <div className="space-y-3">
      <SkeletonText lines={2} />
      <Skeleton className="block h-40 w-full rounded-xl" />
    </div>
  );
}

function StatTile({ label, value, accent = "text-text" }) {
  return (
    <div className="rounded-xl bg-surface-secondary/60 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-0.5 text-base font-bold ${accent}`}>{value}</p>
    </div>
  );
}

export default function OwnerReportsPage() {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const restaurants = useSelector((state) => state.restaurant.restaurants);

  const [selectedRestaurant, setSelectedRestaurant] = useState("");
  const [preset, setPreset] = useState("last30");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [trendGroupBy, setTrendGroupBy] = useState("");
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [revenueMetric, setRevenueMetric] = useState("revenue");
  const [foodLimit, setFoodLimit] = useState(5);
  const [isExcelExporting, setIsExcelExporting] = useState(false);
  const chartTheme = useChartTheme();

  const range = useMemo(
    () => presetRange(preset, customStart, customEnd),
    [preset, customStart, customEnd]
  );

  const buildParams = useCallback(
    (groupBy) => ({
      restaurantId: selectedRestaurant || "all",
      startDate: range.start,
      endDate: range.end,
      ...(groupBy ? { groupBy } : {}),
    }),
    [selectedRestaurant, range.start, range.end]
  );

  const loadReport = useCallback(
    async (groupBy) => {
      setLoading(true);
      setError(false);
      try {
        const res = await ownerReportApi.getReport(buildParams(groupBy));
        setReport(res?.data || null);
        setLastUpdated(new Date());
      } catch (err) {
        console.error("[OwnerReportsPage] Failed to load report:", err);
        setReport(null);
        setError(true);
      } finally {
        setLoading(false);
      }
    },
    [buildParams]
  );

  useEffect(() => {
    const userId = user?._id || user?.id;
    if (userId) {
      dispatch(fetchRestaurants({ ownerId: userId, isActive: true })).catch(() => {});
    }
  }, [dispatch, user?._id, user?.id]);

  useEffect(() => {
    loadReport(trendGroupBy);
  }, [loadReport, trendGroupBy]);

  const refresh = () => loadReport(trendGroupBy);

  const handleExcelExport = async () => {
    if (!report) {
      toast.error("No report data to export.");
      return;
    }
    setIsExcelExporting(true);
    try {
      const params = {
        restaurantId: report.meta?.restaurantId || "all",
        startDate: report.meta?.range?.start,
        endDate: report.meta?.range?.end,
      };
      const res = await ownerReportApi.getExportData(params);
      const details = res?.data || {};
      await exportOwnerReportToExcel({ report, details });
      toast.success("Excel file downloaded successfully.");
    } catch (err) {
      console.error("[OwnerReportsPage] Excel export failed:", err);
      toast.error("Export failed. Please try again.");
    } finally {
      setIsExcelExporting(false);
    }
  };

  const summary = report?.summary || {};
  const bookings = summary.bookings || {};
  const revenue = summary.revenue || {};
  const bills = summary.bills || {};
  const customers = summary.customers || {};
  const refunds = summary.refunds || {};
  const offers = summary.offers || {};
  const reviews = summary.reviews || {};

  const isEmptyReport =
    report &&
    bookings.total === 0 &&
    (revenue.gross || 0) === 0 &&
    bills.total === 0 &&
    customers.total === 0;

  const chartOptions = useMemo(() => {
    const base = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: chartTheme.text, usePointStyle: true, boxWidth: 8 } },
        tooltip: { mode: "index", intersect: false },
      },
      scales: {
        x: { ticks: { color: chartTheme.muted, maxTicksLimit: 10 }, grid: { color: chartTheme.border } },
        y: { ticks: { color: chartTheme.muted }, grid: { color: chartTheme.border } },
      },
    };
    return base;
  }, [chartTheme]);

  const donutOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      cutout: "62%",
      plugins: {
        legend: { position: "right", labels: { color: chartTheme.text, usePointStyle: true, boxWidth: 8 } },
      },
    }),
    [chartTheme]
  );

  const statusData = useMemo(() => {
    const byStatus = report?.bookings?.byStatus || [];
    const labels = [];
    const values = [];
    const colors = [];
    const order = ["Pending", "Confirmed", "Completed", "Cancelled", "No Show"];
    order.forEach((key) => {
      const row = byStatus.find((r) => r.status === key);
      labels.push(key);
      values.push(row?.count || 0);
      colors.push(STATUS_COLORS[key]);
    });
    return {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: colors,
          borderWidth: 0,
        },
      ],
    };
  }, [report]);

  const revenueTrend = report?.revenue?.trend || [];
  const billTrend = report?.revenue?.billTrend || [];
  const revenueChart = useMemo(() => {
    const labels = revenueTrend.map((p) => p.period);
    let data;
    let label = "Revenue";
    if (revenueMetric === "bills") {
      data = billTrend.map((p) => p.value);
      label = "Bills";
    } else if (revenueMetric === "avgBill") {
      data = revenueTrend.map((p, i) => (billTrend[i]?.value ? round(p.value / billTrend[i].value) : 0));
      label = "Average Bill";
    } else {
      data = revenueTrend.map((p) => p.value);
    }
    return {
      labels,
      datasets: [
        {
          label,
          data,
          borderColor: "#16a34a",
          backgroundColor: "rgba(22, 163, 74, 0.12)",
          fill: true,
          tension: 0.35,
          pointRadius: 2,
          pointHoverRadius: 5,
        },
      ],
    };
  }, [revenueTrend, billTrend, revenueMetric]);

  const bookingTrendData = useMemo(() => {
    const trend = report?.bookings?.trend || [];
    return {
      labels: trend.map((p) => p.period),
      datasets: [
        {
          label: "Bookings",
          data: trend.map((p) => p.value),
          backgroundColor: "rgba(249, 115, 22, 0.2)",
          borderColor: "#f97316",
          borderRadius: 6,
        },
      ],
    };
  }, [report]);

  const paymentMethods = report?.payments?.methods || [];
  const paymentTotal = report?.payments?.total || 0;
  const paymentChart = useMemo(() => {
    const colorFor = (m) => METHOD_COLORS[m] || "#9ca3af";
    return {
      labels: paymentMethods.map((m) => m.method || "Other"),
      datasets: [
        {
          data: paymentMethods.map((m) => m.amount),
          backgroundColor: paymentMethods.map((m) => colorFor(m.method)),
          borderWidth: 0,
        },
      ],
    };
  }, [paymentMethods]);

  const billingStatusChart = useMemo(() => {
    const order = ["Paid", "Partially Paid", "Pending", "Refunded", "Cancelled"];
    const byPaymentStatus = report?.billing?.byPaymentStatus || [];
    const labels = [];
    const values = [];
    const colors = {
      Paid: "#22c55e",
      "Partially Paid": "#f59e0b",
      Pending: "#ef4444",
      Refunded: "#8b5cf6",
      Cancelled: "#9ca3af",
    };
    order.forEach((key) => {
      const row = byPaymentStatus.find((r) => r._id === key);
      labels.push(key);
      values.push(row?.count || 0);
      colors && colors[key];
    });
    return {
      labels,
      datasets: [
        {
          label: "Bills",
          data: values,
          backgroundColor: order.map((k) => colors[k]),
          borderRadius: 6,
        },
      ],
    };
  }, [report]);

  const ratingChart = useMemo(() => {
    const distribution = reviews.restaurant?.distribution || [];
    const labels = distribution.map((d) => `${d.star} Star`);
    return {
      labels,
      datasets: [
        {
          label: "Reviews",
          data: distribution.map((d) => d.count),
          backgroundColor: ["#22c55e", "#84cc16", "#f59e0b", "#f97316", "#ef4444"],
          borderRadius: 6,
        },
      ],
    };
  }, [reviews]);

  const peakHoursData = useMemo(() => {
    const map = {};
    (report?.peakHours || []).forEach((row) => {
      map[row.hour] = row.count;
    });
    const labels = [];
    const values = [];
    for (let hour = 0; hour < 24; hour += 1) {
      labels.push(hour === 0 ? "12 AM" : hour < 12 ? `${hour} AM` : hour === 12 ? "12 PM" : `${hour - 12} PM`);
      values.push(map[hour] || 0);
    }
    return {
      labels,
      datasets: [
        {
          label: "Bookings",
          data: values,
          backgroundColor: values.map((v) => (v > 0 ? "#f97316" : "rgba(156, 163, 175, 0.25)")),
          borderRadius: 4,
        },
      ],
    };
  }, [report]);

  const customerSegmentData = useMemo(() => {
    const distribution = customers.distribution || [];
    return {
      labels: distribution.map((d) => d.segment),
      datasets: [
        {
          data: distribution.map((d) => d.count),
          backgroundColor: distribution.map((d) => d.color || "#3b82f6"),
          borderWidth: 0,
        },
      ],
    };
  }, [customers]);

  const healthMetrics = report?.businessHealth || {};

  const reportFilename = report?.meta
    ? `TableSpot_Analytics_${report.meta.range?.start}_to_${report.meta.range?.end}.pdf`
    : "TableSpot_Analytics.pdf";

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-text">
            <BarChart2 className="text-primary" size={26} />
            Analytics &amp; Performance
          </h1>
          <p className="mt-1 text-sm text-muted">
            Track reservations, revenue, customers, payments and restaurant performance.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw size={15} className={`mr-1 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
            Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            isLoading={isExcelExporting}
            loadingText="Exporting..."
            onClick={handleExcelExport}
            disabled={!report}
            className="inline-flex items-center gap-2"
          >
            <FileSpreadsheet size={15} aria-hidden="true" />
            Excel
          </Button>
          <PdfDownloadButton
            size="sm"
            variant="outline"
            label="PDF"
            loadingLabel="Generating..."
            filename={reportFilename}
            disabled={!report}
            fetchData={async () => ({ report })}
            renderDocument={({ report: data }) => <OwnerReportPdf report={data} />}
          />
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <RestaurantFilter
            restaurants={restaurants}
            value={selectedRestaurant}
            onChange={setSelectedRestaurant}
            className="w-full"
          />
          <Select label="Date Range" value={preset} onChange={(e) => setPreset(e.target.value)} className="w-full">
            {PRESETS.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </Select>
          {preset === "custom" ? (
            <div className="flex gap-3 lg:col-span-2">
              <div className="w-full sm:w-44">
                <InvoiceDatePicker label="From date" value={customStart} onChange={setCustomStart} />
              </div>
              <div className="w-full sm:w-44">
                <InvoiceDatePicker label="To date" value={customEnd} onChange={setCustomEnd} />
              </div>
            </div>
          ) : (
            <div className="flex items-end gap-3 lg:col-span-2">
              <StatTile label="From" value={range.start} accent="text-primary" />
              <StatTile label="To" value={range.end} accent="text-primary" />
              {lastUpdated && (
                <p className="ml-auto hidden pb-2 text-xs text-muted sm:block">
                  Last updated {formatDateTime(lastUpdated)}
                </p>
              )}
            </div>
          )}
        </div>
        {lastUpdated && preset === "custom" && (
          <p className="mt-3 text-xs text-muted">Last updated {formatDateTime(lastUpdated)}</p>
        )}
      </Card>

      {/* Loading state */}
      {loading && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <SkeletonCard />
            <SkeletonCard />
          </div>
          <SkeletonTable rows={6} columns={5} />
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <Card className="p-10 text-center">
          <p className="text-2xl font-bold text-error">Unable to load reports</p>
          <p className="mt-2 text-sm text-muted">Something went wrong while fetching your analytics. Please try again.</p>
          <Button variant="primary" size="sm" className="mt-5" onClick={refresh}>
            <RefreshCw size={15} className="mr-1" aria-hidden="true" />
            Try again
          </Button>
        </Card>
      )}

      {!loading && !error && report && (
        <>
          {isEmptyReport && (
            <Card className="border-amber-300 bg-amber-50 p-4 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
              <p className="text-sm font-semibold">No report data for this period.</p>
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                Try a wider date range or a different restaurant. Zeros below are actual values for the selected period.
              </p>
            </Card>
          )}

          {/* KPI Grid */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <KpiCard
              label="Total Bookings"
              value={bookings.total}
              sub={`${bookings.online} online · ${bookings.walkIn} walk-in`}
              icon={<Calendar size={20} />}
              tone="bookings"
              change={bookings.change?.total}
            />
            <KpiCard
              label="Confirmed Bookings"
              value={bookings.confirmed}
              sub="Awaiting completion"
              icon={<CheckCircle2 size={20} />}
              tone="blue"
            />
            <KpiCard
              label="Completed Bookings"
              value={bookings.completed}
              icon={<CalendarCheck size={20} />}
              tone="emerald"
              change={bookings.change?.completed}
            />
            <KpiCard
              label="Cancelled Bookings"
              value={bookings.cancelled}
              icon={<XCircle size={20} />}
              tone="red"
            />
            <KpiCard
              label="No-Show Bookings"
              value={bookings.noShow}
              icon={<UserX size={20} />}
              tone="amber"
            />
            <KpiCard
              label="Total Revenue"
              value={formatCurrency(revenue.gross)}
              sub={`Net ${formatCurrency(revenue.net)}`}
              icon={<IndianRupee size={20} />}
              tone="revenue"
              change={revenue.change}
            />
            <KpiCard
              label="Total Bills"
              value={bills.total}
              sub={`${bills.paid} paid · ${bills.pending} pending`}
              icon={<Receipt size={20} />}
              tone="cyan"
            />
            <KpiCard
              label="Average Bill Value"
              value={formatCurrency(bills.avgBill)}
              icon={<Calculator size={20} />}
              tone="indigo"
            />
            <KpiCard
              label="Total Customers"
              value={customers.total}
              sub={`${customers.newCustomers} new · ${customers.returning} returning`}
              icon={<Users size={20} />}
              tone="purple"
            />
            <KpiCard
              label="Returning Customers"
              value={customers.returning}
              sub={`Repeat rate ${fmtPct(customers.repeatRate)}`}
              icon={<Repeat size={20} />}
              tone="indigo"
            />
            <KpiCard
              label="Average Party Size"
              value={`${bookings.avgGuests} guests`}
              icon={<Users size={20} />}
              tone="blue"
            />
            <KpiCard
              label="Completion Rate"
              value={fmtPct(bookings.completionRate)}
              icon={<TrendingUp size={20} />}
              tone="emerald"
            />
          </div>

          {/* Revenue Overview */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <SectionCard
              className="lg:col-span-2"
              title="Revenue Overview"
              subtitle={report.meta?.range?.label}
              icon={<IndianRupee size={18} className="text-green-600" />}
              right={
                <div className="flex flex-wrap gap-1 rounded-lg bg-surface-secondary p-1">
                  {[
                    { key: "revenue", label: "Revenue" },
                    { key: "bills", label: "Bills" },
                    { key: "avgBill", label: "Average Bill" },
                  ].map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setRevenueMetric(opt.key)}
                      className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                        revenueMetric === opt.key
                          ? "bg-primary text-white shadow-sm"
                          : "text-muted hover:text-text"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              }
            >
              <div className="h-72">
                <Line data={revenueChart} options={chartOptions} />
              </div>
            </SectionCard>

            <SectionCard
              title="Revenue Breakdown"
              subtitle="Actual billing & refund data"
              icon={<ClipboardList size={18} className="text-emerald-600" />}
            >
              <div className="space-y-2">
                {revenue.breakdown?.map((row) => (
                  <div
                    key={row.key}
                    className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
                      row.type === "net"
                        ? "bg-green-500/10 font-bold text-green-700 dark:text-green-400"
                        : row.type === "refund"
                          ? "bg-red-500/10 text-red-600 dark:text-red-400"
                          : row.type === "discount"
                            ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                            : "bg-surface-secondary/60 text-text"
                    }`}
                  >
                    <span className="font-medium">{row.label}</span>
                    <span className="tabular-nums">{formatCurrency(row.value)}</span>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>

          {/* Reservation Performance + Trend */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <SectionCard
              title="Reservation Performance"
              subtitle="Status & source breakdown"
              icon={<CalendarClock size={18} className="text-orange-600" />}
            >
              <div className="h-56">
                <Doughnut data={statusData} options={donutOptions} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-blue-500/10 px-4 py-3 text-blue-700 dark:text-blue-300">
                  <p className="text-[11px] font-semibold uppercase tracking-wide">Online</p>
                  <p className="text-lg font-extrabold">{bookings.online}</p>
                  <p className="text-xs font-medium">{fmtPct(bookings.onlinePct)}</p>
                </div>
                <div className="rounded-xl bg-purple-500/10 px-4 py-3 text-purple-700 dark:text-purple-300">
                  <p className="text-[11px] font-semibold uppercase tracking-wide">Walk-in</p>
                  <p className="text-lg font-extrabold">{bookings.walkIn}</p>
                  <p className="text-xs font-medium">{fmtPct(bookings.walkInPct)}</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <StatTile label="Avg Guests" value={`${bookings.avgGuests}`} />
                <StatTile label="Avg Duration" value={`${bookings.avgDuration} min`} />
                <StatTile label="Peak Hour" value={report.bookings?.peakHour !== null ? `${report.bookings?.peakHour}:00` : "—"} />
                <StatTile label="Busiest Day" value={report.bookings?.busiestDay || "—"} />
              </div>
            </SectionCard>

            <SectionCard
              className="lg:col-span-2"
              title="Reservation Trend"
              subtitle={`${report.meta?.range?.label}  ·  ${trendGroupBy ? `${trendGroupBy}ly` : "auto"} grouping`}
              icon={<TrendingUp size={18} className="text-blue-600" />}
              right={
                <div className="flex flex-wrap gap-1 rounded-lg bg-surface-secondary p-1">
                  {[
                    { key: "day", label: "Daily" },
                    { key: "week", label: "Weekly" },
                    { key: "month", label: "Monthly" },
                  ].map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setTrendGroupBy((current) => (current === opt.key ? "" : opt.key))}
                      className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                        (trendGroupBy || "day") === opt.key
                          ? "bg-primary text-white shadow-sm"
                          : "text-muted hover:text-text"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              }
            >
              <div className="h-72">
                <Bar data={bookingTrendData} options={chartOptions} />
              </div>
            </SectionCard>
          </div>

          {/* Billing Performance */}
          <SectionCard
            title="Billing Performance"
            subtitle="Bills, payments and collection status"
            icon={<Receipt size={18} className="text-cyan-600" />}
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <StatTile label="Total Bills" value={bills.total} />
              <StatTile label="Paid" value={bills.paid} accent="text-green-600 dark:text-green-400" />
              <StatTile label="Partially Paid" value={bills.partial} accent="text-amber-600 dark:text-amber-400" />
              <StatTile label="Pending" value={bills.pending} accent="text-red-600 dark:text-red-400" />
              <StatTile label="Cancelled" value={bills.cancelled} accent="text-muted" />
              <StatTile label="Total Billed" value={formatCurrency(bills.totalBilled)} />
              <StatTile label="Total Paid" value={formatCurrency(bills.totalPaid)} accent="text-green-600 dark:text-green-400" />
              <StatTile label="Balance Due" value={formatCurrency(bills.balanceDue)} accent="text-red-600 dark:text-red-400" />
              <StatTile label="Max Bill" value={formatCurrency(bills.maxBill)} />
              <StatTile label="Min Bill" value={formatCurrency(bills.minBill)} />
            </div>
            <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Payment Status Distribution</p>
                <div className="h-56">
                  <Bar data={billingStatusChart} options={chartOptions} />
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-wide text-muted">Bill Sources</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-blue-500/10 px-4 py-3 text-blue-700 dark:text-blue-300">
                    <p className="text-[11px] font-semibold uppercase tracking-wide">Online</p>
                    <p className="text-lg font-extrabold">{bills.online}</p>
                  </div>
                  <div className="rounded-xl bg-purple-500/10 px-4 py-3 text-purple-700 dark:text-purple-300">
                    <p className="text-[11px] font-semibold uppercase tracking-wide">Walk-in</p>
                    <p className="text-lg font-extrabold">{bills.walkIn}</p>
                  </div>
                </div>
                <StatTile label="Payment Collection Rate" value={fmtPct(bills.collectionRate)} accent="text-emerald-600 dark:text-emerald-400" />
                <div className="rounded-xl bg-surface-secondary/60 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Avg · Max · Min</p>
                  <p className="mt-1 text-sm font-semibold text-text tabular-nums">
                    {formatCurrency(bills.avgBill)} · {formatCurrency(bills.maxBill)} · {formatCurrency(bills.minBill)}
                  </p>
                </div>
              </div>
            </div>
          </SectionCard>

          {/* Payment Methods + Refunds */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <SectionCard
              title="Payment Methods"
              subtitle="Collected via actual bill payment records"
              icon={<CreditCard size={18} className="text-indigo-600" />}
            >
              <div className="h-52">
                <Doughnut data={paymentChart} options={donutOptions} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <StatTile label="Online" value={formatCurrency(report.payments?.onlineAmount)} accent="text-blue-600 dark:text-blue-400" />
                <StatTile label="Offline" value={formatCurrency(report.payments?.offlineAmount)} accent="text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-[11px] font-bold uppercase tracking-wide text-muted">
                      <th className="pb-2">Method</th>
                      <th className="pb-2 text-right">Txns</th>
                      <th className="pb-2 text-right">Amount</th>
                      <th className="pb-2 text-right">Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paymentMethods.map((m) => (
                      <tr key={m.method} className="border-b border-border-subtle">
                        <td className="flex items-center gap-2 py-2 font-medium text-text">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ background: METHOD_COLORS[m.method] || "#9ca3af" }} />
                          {m.method || "Other"}
                        </td>
                        <td className="py-2 text-right tabular-nums text-text">{m.count}</td>
                        <td className="py-2 text-right tabular-nums text-text">{formatCurrency(m.amount)}</td>
                        <td className="py-2 text-right tabular-nums text-text">
                          {paymentTotal ? fmtPct((m.amount / paymentTotal) * 100) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>

            <SectionCard
              title="Refunds"
              subtitle="Refund amount is separated from revenue"
              icon={<RotateCcw size={18} className="text-orange-600" />}
            >
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <StatTile label="Total Refunds" value={refunds.count} />
                <StatTile label="Refund Amount" value={formatCurrency(refunds.amount)} accent="text-orange-600 dark:text-orange-400" />
                <StatTile label="Refund Rate" value={fmtPct(refunds.rate)} accent="text-red-600 dark:text-red-400" />
              </div>
              <div className="mt-4 space-y-2">
                {(report?.refunds?.byStatus || []).slice(0, 6).map((row) => (
                  <div key={row.status} className="flex items-center justify-between rounded-lg bg-surface-secondary/60 px-3 py-2 text-sm">
                    <span className="font-medium text-text">{row.label || row.status}</span>
                    <span className="text-xs text-muted tabular-nums">
                      {row.count} · {formatCurrency(row.amount)}
                    </span>
                  </div>
                ))}
                {!report?.refunds?.count && (
                  <p className="text-sm text-muted">No refunds for this period.</p>
                )}
              </div>
              {report?.refunds?.byMethod?.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">By Method</p>
                  <div className="flex flex-wrap gap-2">
                    {report.refunds.byMethod.map((m) => (
                      <span key={m.method} className="rounded-full bg-orange-500/10 px-3 py-1 text-xs font-semibold text-orange-700 dark:text-orange-300">
                        {m.method}: {formatCurrency(m.amount)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </SectionCard>
          </div>

          {/* Customer Insights + Food Performance */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <SectionCard
              title="Customer Insights"
              subtitle="New, returning and loyal customers"
              icon={<Users size={18} className="text-purple-600" />}
            >
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <StatTile label="Total Customers" value={customers.total} accent="text-purple-600 dark:text-purple-400" />
                <StatTile label="New" value={customers.newCustomers} />
                <StatTile label="Returning" value={customers.returning} />
                <StatTile label="Loyal" value={customers.loyal} accent="text-pink-600 dark:text-pink-400" />
                <StatTile label="Repeat Rate" value={fmtPct(customers.repeatRate)} />
                <StatTile label="Avg Bookings/Customer" value={customers.avgBookingsPerCustomer} />
              </div>
              <div className="mt-4">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Segmentation</p>
                <div className="h-44">
                  <Doughnut data={customerSegmentData} options={donutOptions} />
                </div>
              </div>
              <div className="mt-4">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Top Customers by Spend</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-[11px] font-bold uppercase tracking-wide text-muted">
                        <th className="pb-2">Customer</th>
                        <th className="pb-2 text-right">Bills</th>
                        <th className="pb-2 text-right">Spent</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(customers.topSpenders || []).slice(0, 5).map((c) => (
                        <tr key={c.customerId || c.name} className="border-b border-border-subtle">
                          <td className="py-2 font-medium text-text">{c.name || "Guest"}</td>
                          <td className="py-2 text-right tabular-nums text-text">{c.bills}</td>
                          <td className="py-2 text-right tabular-nums text-text">{formatCurrency(c.spent)}</td>
                        </tr>
                      ))}
                      {!customers.topSpenders?.length && (
                        <tr>
                          <td colSpan={3} className="py-2 text-sm text-muted">No customer spend data.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Food Performance"
              subtitle="From actual billed line items"
              icon={<Utensils size={18} className="text-amber-600" />}
              right={
                <div className="flex gap-1 rounded-lg bg-surface-secondary p-1">
                  {[5, 10].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setFoodLimit(n)}
                      className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                        foodLimit === n ? "bg-primary text-white shadow-sm" : "text-muted hover:text-text"
                      }`}
                    >
                      Top {n}
                    </button>
                  ))}
                </div>
              }
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-[11px] font-bold uppercase tracking-wide text-muted">
                      <th className="pb-2">Rank</th>
                      <th className="pb-2">Item</th>
                      <th className="pb-2 text-right">Sold</th>
                      <th className="pb-2 text-right">Revenue</th>
                      <th className="pb-2 text-right">Avg Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(report.food?.top || []).slice(0, foodLimit).map((item) => (
                      <tr key={item.foodName} className="border-b border-border-subtle">
                        <td className="py-2 font-bold text-muted">#{item.rank}</td>
                        <td className="py-2 font-medium text-text">{item.foodName}</td>
                        <td className="py-2 text-right tabular-nums text-text">{item.qty}</td>
                        <td className="py-2 text-right tabular-nums text-text">{formatCurrency(item.revenue)}</td>
                        <td className="py-2 text-right tabular-nums text-muted">{formatCurrency(item.avgPrice)}</td>
                      </tr>
                    ))}
                    {!report.food?.top?.length && (
                      <tr>
                        <td colSpan={5} className="py-3 text-sm text-muted">No billed items in this period.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </div>

          {/* Peak Hours + Table Performance */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <SectionCard
              title="Peak Hours"
              subtitle="Booking distribution by hour of day"
              icon={<Clock size={18} className="text-orange-600" />}
            >
              <div className="h-64">
                <Bar data={peakHoursData} options={chartOptions} />
              </div>
            </SectionCard>

            <SectionCard
              title="Table Performance"
              subtitle="Inventory & bookings per table"
              icon={<Armchair size={18} className="text-blue-600" />}
            >
              <div className="grid grid-cols-2 gap-3">
                <StatTile label="Total Tables" value={report.tables?.total || 0} />
                <StatTile label="Active Tables" value={report.tables?.active || 0} accent="text-green-600 dark:text-green-400" />
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-[11px] font-bold uppercase tracking-wide text-muted">
                      <th className="pb-2">Table</th>
                      <th className="pb-2 text-right">Capacity</th>
                      <th className="pb-2 text-right">Bookings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(report.tables?.tableStats || []).slice(0, 8).map((t) => (
                      <tr key={t.tableId} className="border-b border-border-subtle">
                        <td className="py-2 font-medium text-text">{t.tableCode || t.tableName || "-"}</td>
                        <td className="py-2 text-right tabular-nums text-text">{t.capacity || "-"}</td>
                        <td className="py-2 text-right tabular-nums text-text">{t.bookings}</td>
                      </tr>
                    ))}
                    {!report.tables?.tableStats?.length && (
                      <tr>
                        <td colSpan={3} className="py-3 text-sm text-muted">No tables configured.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </div>

          {/* Offers + Reviews */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <SectionCard
              title="Offers Performance"
              subtitle="Claims, redemptions and discount given"
              icon={<Tag size={18} className="text-pink-600" />}
            >
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatTile label="Total" value={offers.total} />
                <StatTile label="Active" value={offers.active} accent="text-green-600 dark:text-green-400" />
                <StatTile label="Expired" value={offers.expired} accent="text-muted" />
                <StatTile label="Redemption Rate" value={fmtPct(offers.redemptionRate)} />
                <StatTile label="Claimed" value={offers.claimed} />
                <StatTile label="Used" value={offers.used} accent="text-pink-600 dark:text-pink-400" />
                <div className="col-span-2">
                  <StatTile label="Discount Given" value={formatCurrency(offers.discountGiven)} />
                </div>
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-[11px] font-bold uppercase tracking-wide text-muted">
                      <th className="pb-2">Offer</th>
                      <th className="pb-2 text-right">Used</th>
                      <th className="pb-2 text-right">Discount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(offers.top || []).slice(0, 5).map((o) => (
                      <tr key={o.offerId} className="border-b border-border-subtle">
                        <td className="py-2">
                          <p className="font-medium text-text">{o.title || o.offerCode || "-"}</p>
                          <p className="text-[11px] text-muted">{o.offerCode}</p>
                        </td>
                        <td className="py-2 text-right tabular-nums text-text">{o.used}</td>
                        <td className="py-2 text-right tabular-nums text-text">{formatCurrency(o.discount)}</td>
                      </tr>
                    ))}
                    {!offers.top?.length && (
                      <tr>
                        <td colSpan={3} className="py-3 text-sm text-muted">No offer usage in this period.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {(report?.offers?.bySource || []).length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {report.offers.bySource.map((s) => (
                    <span key={s.source} className="rounded-full bg-pink-500/10 px-3 py-1 text-xs font-semibold text-pink-700 dark:text-pink-300">
                      {s.source}: {s.used} used · {formatCurrency(s.discount)}
                    </span>
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard
              title="Customer Experience"
              subtitle="Reviews & reply rates"
              icon={<MessageSquare size={18} className="text-amber-600" />}
            >
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatTile label="Restaurant Reviews" value={reviews.restaurant?.count || 0} />
                <StatTile label="Food Reviews" value={reviews.food?.count || 0} />
                <StatTile label="Avg Restaurant" value={reviews.restaurant?.avgRating || "—"} accent="text-amber-600 dark:text-amber-400" />
                <StatTile label="Avg Food" value={reviews.food?.avgRating || "—"} />
                <StatTile label="Replied" value={reviews.restaurant?.replied || 0} accent="text-green-600 dark:text-green-400" />
                <StatTile label="Not Replied" value={reviews.restaurant?.notReplied || 0} accent="text-red-600 dark:text-red-400" />
                <div className="col-span-2">
                  <StatTile label="Reply Rate" value={fmtPct(reviews.restaurant?.replyRate)} />
                </div>
              </div>
              <div className="mt-4">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Rating Distribution (Restaurant)</p>
                <div className="h-44">
                  <Bar data={ratingChart} options={chartOptions} />
                </div>
              </div>
            </SectionCard>
          </div>

          {/* Business Health */}
          <SectionCard
            title="Business Health"
            subtitle="Key performance metrics"
            icon={<HeartPulse size={18} className="text-rose-600" />}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "Booking Completion Rate", value: healthMetrics.bookingCompletionRate, color: "#3b82f6" },
                { label: "Repeat Customer Rate", value: healthMetrics.repeatCustomerRate, color: "#8b5cf6" },
                { label: "Average Bill Value", value: healthMetrics.averageBillValue, color: "#06b6d4", money: true },
                { label: "Refund Rate", value: healthMetrics.refundRate, color: "#f97316" },
                { label: "Offer Redemption Rate", value: healthMetrics.offerRedemptionRate, color: "#ec4899" },
                { label: "Average Rating", value: healthMetrics.averageRating, color: "#f59e0b", max: 5 },
                { label: "Payment Collection Rate", value: healthMetrics.paymentCollectionRate, color: "#22c55e" },
                { label: "Cancellation Rate", value: healthMetrics.cancellationRate, color: "#ef4444" },
              ].map((metric) => {
                const raw = Number(metric.value || 0);
                const max = metric.max || 100;
                const display =
                  metric.money && metric.value != null
                    ? formatCurrency(metric.value)
                    : metric.value === null || metric.value === undefined
                      ? "—"
                      : metric.value !== 0
                        ? `${Number(metric.value).toFixed(1)}%`
                        : "0%";
                const width = `${Math.min(100, (raw / max) * 100)}%`;
                return (
                  <div key={metric.label} className="rounded-xl bg-surface-secondary/60 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{metric.label}</p>
                    <p className="mt-1 text-lg font-extrabold text-text">{display}</p>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface">
                      <div className="h-full rounded-full transition-all" style={{ width, background: metric.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>

          {/* Restaurant Comparison */}
          {report.comparison?.length > 0 && (
            <SectionCard
              title="Restaurant Performance Comparison"
              subtitle="Side-by-side across your restaurants"
              icon={<Building2 size={18} className="text-primary" />}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-[11px] font-bold uppercase tracking-wide text-muted">
                      <th className="pb-2">Restaurant</th>
                      <th className="pb-2 text-right">Bookings</th>
                      <th className="pb-2 text-right">Completed</th>
                      <th className="pb-2 text-right">Customers</th>
                      <th className="pb-2 text-right">Bills</th>
                      <th className="pb-2 text-right">Revenue</th>
                      <th className="pb-2 text-right">Avg Bill</th>
                      <th className="pb-2 text-right">Refunds</th>
                      <th className="pb-2 text-right">Rating</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.comparison.map((r) => (
                      <tr key={r.restaurantId} className="border-b border-border-subtle">
                        <td className="py-2 font-semibold text-text">{r.restaurantName}</td>
                        <td className="py-2 text-right tabular-nums text-text">{r.bookings}</td>
                        <td className="py-2 text-right tabular-nums text-green-600 dark:text-green-400">{r.completed}</td>
                        <td className="py-2 text-right tabular-nums text-text">{r.customers}</td>
                        <td className="py-2 text-right tabular-nums text-text">{r.bills}</td>
                        <td className="py-2 text-right tabular-nums font-semibold text-text">{formatCurrency(r.revenue)}</td>
                        <td className="py-2 text-right tabular-nums text-text">{formatCurrency(r.avgBill)}</td>
                        <td className="py-2 text-right tabular-nums text-orange-600 dark:text-orange-400">{formatCurrency(r.refundAmount)}</td>
                        <td className="py-2 text-right tabular-nums text-amber-600 dark:text-amber-400">{r.rating || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}
        </>
      )}
    </div>
  );
}

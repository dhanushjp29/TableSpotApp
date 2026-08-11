import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useDispatch, useSelector } from "react-redux";
import {
  CheckCircle,
  Eye,
  FileWarning,
  Search,
  ShieldAlert,
  XCircle,
} from "lucide-react";

import {
  fetchReports,
  updateReportStatus,
} from "../../store/slices/reportSlice.js";

import Badge from "../ui/Badge.jsx";
import Button from "../ui/Button.jsx";
import Card from "../ui/Card.jsx";
import EmptyState from "../ui/EmptyState.jsx";
import ErrorState from "../ui/ErrorState.jsx";
import Select from "../ui/Select.jsx";
import { SkeletonText } from "../ui/Skeleton.jsx";
import Modal from "../ui/Modal.jsx";
import WarningIssueModal from "./WarningIssueModal.jsx";

const STATUS_VARIANT = {
  PENDING: "warning",
  UNDER_REVIEW: "info",
  RESOLVED: "success",
  REJECTED: "danger",
};

const SEVERITY_VARIANT = {
  Low: "default",
  Medium: "warning",
  High: "danger",
};

const STATUS_TABS = [
  { key: "", label: "All" },
  { key: "PENDING", label: "Pending" },
  { key: "UNDER_REVIEW", label: "Under Review" },
  { key: "RESOLVED", label: "Resolved" },
  { key: "REJECTED", label: "Rejected" },
];

export default function ReportsModeration() {
  const dispatch = useDispatch();
  const reports = useSelector((state) => state.report.reports);
  const reportCounts = useSelector((state) => state.report.reportCounts);
  const isLoading = useSelector((state) => state.report.isLoading);
  const error = useSelector((state) => state.report.error);

  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [severity, setSeverity] = useState("");
  const [search, setSearch] = useState("");
  const [viewReport, setViewReport] = useState(null);
  const [warnTarget, setWarnTarget] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const loadReports = async () => {
    const params = { limit: 50 };
    if (status) params.status = status;
    if (category) params.category = category;
    if (severity) params.severity = severity;
    if (search.trim()) params.search = search.trim();
    dispatch(fetchReports(params)).catch(() => {});
  };

  useEffect(() => {
    loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, category, severity]);

  const categories = useMemo(
    () => ["Food Quality", "Hygiene", "Wrong Billing", "Staff Behaviour", "Service Delay", "Fake Information", "Safety Issue", "Other"],
    []
  );

  const handleStatusChange = async (report, nextStatus) => {
    setIsSaving(true);
    try {
      await dispatch(
        updateReportStatus(report._id, { status: nextStatus })
      );
      toast.success("Report updated.");
      setViewReport(null);
      loadReports();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to update report.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-text flex items-center gap-2">
            <ShieldAlert className="text-primary" size={22} />
            Restaurant Reports Moderation
          </h2>
          <p className="text-sm text-muted">
            Moderate customer reports, resolve disputes, reject invalid reports,
            or issue formal warnings
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="relative w-full xl:max-w-sm">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Search by restaurant, city or report code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") loadReports();
            }}
            className="input-field w-full pl-10"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            className="w-full sm:w-40"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </Select>
          <Select
            className="w-full sm:w-36"
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
          >
            <option value="">All Severity</option>
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatus(tab.key)}
            className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-semibold transition-all ${
              status === tab.key
                ? "border-primary/20 bg-primary text-white shadow-md shadow-primary/20"
                : "border-border bg-muted/40 text-muted hover:border-primary/20 hover:text-text"
            }`}
          >
            {tab.label}
            {tab.key && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  status === tab.key
                    ? "bg-white/20 text-white"
                    : "bg-background/70 text-muted"
                }`}
              >
                {reportCounts?.[tab.key] ?? 0}
              </span>
            )}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="p-4">
              <SkeletonText lines={3} />
            </Card>
          ))}
        </div>
      ) : error ? (
        <ErrorState title="Unable to load reports" description={error} />
      ) : reports.length === 0 ? (
        <Card className="p-8">
          <EmptyState
            title="No reports found"
            description="No restaurant reports match the current filters."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => (
            <Card key={report._id} className="p-5 transition-shadow hover:shadow-md">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-text">
                      {report.category}
                    </h3>
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted">
                      {report.reportCode}
                    </span>
                    <Badge variant={SEVERITY_VARIANT[report.severity] || "default"}>
                      {report.severity}
                    </Badge>
                    <Badge variant={STATUS_VARIANT[report.status] || "default"}>
                      {report.status === "UNDER_REVIEW"
                        ? "Under Review"
                        : report.status === "RESOLVED"
                          ? "Resolved"
                          : report.status === "REJECTED"
                            ? "Rejected"
                            : "Pending"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-text">
                    <span className="font-semibold">
                      {report.restaurantId?.restaurantName || "Restaurant"}
                    </span>{" "}
                    <span className="text-muted">
                      ({report.restaurantId?.city || "-"})
                    </span>{" "}
                    <span className="text-xs text-muted">
                      reported by {report.userId?.fullName || "Customer"}
                    </span>
                  </p>
                  {report.title && (
                    <p className="mt-1 text-sm font-medium text-text/90">
                      {report.title}
                    </p>
                  )}
                  <p className="mt-1 line-clamp-2 text-sm text-muted">
                    {report.description}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setViewReport(report)}
                  >
                    <Eye size={14} className="mr-1" /> View
                  </Button>
                  {report.status === "PENDING" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleStatusChange(report, "UNDER_REVIEW")}
                      disabled={isSaving}
                    >
                      Under Review
                    </Button>
                  )}
                  {(report.status === "PENDING" || report.status === "UNDER_REVIEW") && (
                    <>
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => handleStatusChange(report, "RESOLVED")}
                        disabled={isSaving}
                      >
                        <CheckCircle size={14} className="mr-1" /> Resolve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 border-red-200 hover:bg-red-50"
                        onClick={() => handleStatusChange(report, "REJECTED")}
                        disabled={isSaving}
                      >
                        <XCircle size={14} className="mr-1" /> Reject
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-amber-600 border-amber-200 hover:bg-amber-50"
                        onClick={() => setWarnTarget(report)}
                        disabled={isSaving}
                      >
                        <FileWarning size={14} className="mr-1" /> Warn
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Report details modal */}
      <Modal
        isOpen={Boolean(viewReport)}
        onClose={() => setViewReport(null)}
        title="Report Details"
        size="lg"
      >
        {viewReport && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="primary">{viewReport.category}</Badge>
              <Badge variant={SEVERITY_VARIANT[viewReport.severity] || "default"}>
                {viewReport.severity}
              </Badge>
              <Badge variant={STATUS_VARIANT[viewReport.status] || "default"}>
                {viewReport.status === "UNDER_REVIEW"
                  ? "Under Review"
                  : viewReport.status.charAt(0) + viewReport.status.slice(1).toLowerCase()}
              </Badge>
            </div>

            <div className="grid grid-cols-1 gap-3 rounded-xl border border-border bg-muted/20 p-4 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Report
                </p>
                <p className="font-mono text-text">{viewReport.reportCode}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Restaurant
                </p>
                <p className="font-medium text-text">
                  {viewReport.restaurantId?.restaurantName || "-"}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Reported by
                </p>
                <p className="font-medium text-text">
                  {viewReport.userId?.fullName || "-"} (
                  {viewReport.userId?.email || "-"})
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Booking
                </p>
                <p className="font-mono text-text">
                  {viewReport.bookingId?.bookingCode || "-"}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Submitted
                </p>
                <p className="font-medium text-text">
                  {viewReport.createdAt
                    ? new Date(viewReport.createdAt).toLocaleString()
                    : "-"}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Warning
                </p>
                <p className="font-mono text-text">
                  {viewReport.warningId?.warningCode || "-"}
                </p>
              </div>
            </div>

            {viewReport.title && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Title
                </p>
                <p className="font-medium text-text">{viewReport.title}</p>
              </div>
            )}

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                Description
              </p>
              <p className="text-sm leading-6 text-text/90">
                {viewReport.description}
              </p>
            </div>

            {viewReport.adminNotes && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                <p className="text-xs font-bold uppercase tracking-wider">
                  Admin notes
                </p>
                <p className="mt-1">{viewReport.adminNotes}</p>
              </div>
            )}

            {viewReport.images?.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Evidence
                </p>
                <div className="mt-2 flex flex-wrap gap-3">
                  {viewReport.images.map((img, idx) => (
                    <img
                      key={idx}
                      src={img}
                      alt={`Evidence ${idx + 1}`}
                      className="h-28 w-28 rounded-lg border border-border object-cover"
                      loading="lazy"
                    />
                  ))}
                </div>
              </div>
            )}

            {(viewReport.status === "PENDING" || viewReport.status === "UNDER_REVIEW") && (
              <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleStatusChange(viewReport, "UNDER_REVIEW")}
                  disabled={isSaving || viewReport.status === "UNDER_REVIEW"}
                >
                  Under Review
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-amber-600 border-amber-200 hover:bg-amber-50"
                  onClick={() => {
                    setWarnTarget(viewReport);
                    setViewReport(null);
                  }}
                  disabled={isSaving}
                >
                  <FileWarning size={14} className="mr-1" /> Issue Warning
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-600 border-red-200 hover:bg-red-50"
                  onClick={() => handleStatusChange(viewReport, "REJECTED")}
                  disabled={isSaving}
                >
                  <XCircle size={14} className="mr-1" /> Reject
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => handleStatusChange(viewReport, "RESOLVED")}
                  disabled={isSaving}
                >
                  <CheckCircle size={14} className="mr-1" /> Resolve
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Issue warning modal */}
      <WarningIssueModal
        isOpen={Boolean(warnTarget)}
        onClose={() => setWarnTarget(null)}
        relatedReportId={warnTarget}
        onIssued={() => {
          setWarnTarget(null);
          loadReports();
        }}
      />
    </div>
  );
}
import { ScrollText } from "lucide-react";

const REPORT_STATUS_LABEL = {
  PENDING: "Pending",
  UNDER_REVIEW: "Under Review",
  RESOLVED: "Resolved",
  REJECTED: "Rejected",
};

export default function WarningReportPanel({ report }) {
  if (!report) return null;

  return (
    <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <ScrollText size={14} className="text-primary" />
        <span className="text-xs font-semibold uppercase tracking-wider text-primary">
          Linked customer report
        </span>
        <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-primary">
          {report.reportCode}
        </span>
      </div>

      {report.title && (
        <p className="mt-1.5 text-sm font-medium text-text">{report.title}</p>
      )}
      {report.description && (
        <p className="mt-0.5 text-sm text-text/70">{report.description}</p>
      )}

      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        <span>Category: {report.category || "-"}</span>
        <span>Severity: {report.severity || "-"}</span>
        <span>
          Status: {REPORT_STATUS_LABEL[report.status] || report.status || "-"}
        </span>
      </div>

      <p className="mt-1 text-xs text-muted">
        Reported by {report.userId?.fullName || "Customer"} on{" "}
        {report.createdAt ? new Date(report.createdAt).toLocaleDateString() : "-"}
      </p>
    </div>
  );
}

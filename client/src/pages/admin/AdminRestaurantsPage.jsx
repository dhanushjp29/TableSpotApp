import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router-dom";
import {
  CheckCircle,
  FileWarning,
  History,
  Search,
  ShieldAlert,
  XCircle,
} from "lucide-react";

import { fetchRestaurants, verifyRestaurant } from "../../store/slices/restaurantSlice.js";
import {
  fetchReports,
  fetchWarnings,
  updateWarning,
} from "../../store/slices/reportSlice.js";
import refundApi from "../../api/refund.api.js";

import Badge from "../../components/ui/Badge.jsx";
import Button from "../../components/ui/Button.jsx";
import Card from "../../components/ui/Card.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import ErrorState from "../../components/ui/ErrorState.jsx";
import { SkeletonText } from "../../components/ui/Skeleton.jsx";
import Modal from "../../components/ui/Modal.jsx";
import WarningIssueModal from "../../components/admin/WarningIssueModal.jsx";
import ExportButton from "../../components/common/ExportButton.jsx";
import { useExcelExport } from "../../hooks/useExcelExport.js";
import { exportRestaurantsToExcel } from "../../utils/restaurantExport.js";

const WARNING_STATUS_VARIANT = {
  ACTIVE: "danger",
  EXPIRED: "default",
  CLEARED: "success",
};

const LEVEL_VARIANT = {
  "Level 1": "warning",
  "Level 2": "info",
  "Final Warning": "danger",
};

const NOT_REFUNDED_STATUSES = new Set([
  "REFUND_PENDING",
  "REFUND_PROCESSING",
  "REFUND_AWAITING_CUSTOMER_CONFIRMATION",
  "REFUND_OVERDUE",
  "REFUND_FAILED",
  "REFUND_DISPUTED",
]);

export default function AdminRestaurantsPage() {
  const dispatch = useDispatch();
  const restaurants = useSelector((state) => state.restaurant.restaurants);
  const warnings = useSelector((state) => state.report.warnings);
  const reports = useSelector((state) => state.report.reports);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [warnTarget, setWarnTarget] = useState(null);
  const [historyTarget, setHistoryTarget] = useState(null);
  const [refundStats, setRefundStats] = useState({});

  const reloadAll = async () => {
    try {
      await Promise.all([
        dispatch(fetchRestaurants()),
        dispatch(fetchWarnings({ limit: 100 })),
        dispatch(fetchReports({ limit: 100 })),
      ]);
      setError(null);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load data.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      dispatch(fetchRestaurants()).catch(() => null),
      dispatch(fetchWarnings({ limit: 100 })).catch(() => null),
      dispatch(fetchReports({ limit: 100 })).catch(() => null),
    ]).then(() => {
      if (isMounted) {
        setError(null);
        setIsLoading(false);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [dispatch]);

  useEffect(() => {
    if (restaurants.length === 0) return;
    let isMounted = true;
    const loadRefundStats = async () => {
      const index = {};
      try {
        let page = 1;
        let total = Infinity;
        while (page <= Math.max(Math.ceil(total / 100), 1)) {
          const res = await refundApi.getAll({ page, limit: 100 });
          const refunds = res?.data?.refunds || [];
          total = res?.data?.meta?.total ?? total;
          if (refunds.length === 0) break;
          for (const refund of refunds) {
            const key = String(refund.restaurantId?._id || refund.restaurantId);
            if (!index[key]) index[key] = [];
            index[key].push(refund);
          }
          if (refunds.length < 100) break;
          page += 1;
        }
      } catch {
        // non-fatal — leave counts at zero
      }
      if (isMounted) {
        const result = {};
        for (const [rid, list] of Object.entries(index)) {
          result[rid] = {
            refunded: list.filter((f) => f.refundStatus === "REFUNDED").length,
            notRefunded: list.filter((f) => NOT_REFUNDED_STATUSES.has(f.refundStatus)).length,
          };
        }
        setRefundStats(result);
      }
    };
    loadRefundStats();
    return () => {
      isMounted = false;
    };
  }, [restaurants.length]);

  const warningIndex = useMemo(() => {
    const index = {};
    for (const warning of warnings) {
      const key = String(warning.restaurantId?._id || warning.restaurantId);
      if (!index[key]) index[key] = [];
      index[key].push(warning);
    }
    return index;
  }, [warnings]);

  const reportIndex = useMemo(() => {
    const index = {};
    for (const report of reports) {
      const key = String(report.restaurantId?._id || report.restaurantId);
      if (!index[key]) index[key] = [];
      index[key].push(report);
    }
    return index;
  }, [reports]);

  const handleVerifyRestaurant = async (restaurantId, status) => {
    try {
      await dispatch(verifyRestaurant(restaurantId, { verificationStatus: status }));
      toast.success(`Restaurant ${status}!`);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to update restaurant verification.");
    } finally {
      reloadAll();
    }
  };

  const handleClearWarning = async (warning) => {
    try {
      await dispatch(updateWarning(warning._id, { status: "CLEARED" }));
      toast.success("Warning cleared.");
      reloadAll();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to clear warning.");
    }
  };

  const filteredRestaurants = restaurants.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.restaurantName?.toLowerCase().includes(q) ||
      r.city?.toLowerCase().includes(q) ||
      r.restaurantCode?.toLowerCase().includes(q)
    );
  });

  const { isExporting, handleExport } = useExcelExport({
    data: filteredRestaurants,
    exportFn: exportRestaurantsToExcel,
    emptyMessage: "No restaurants available to export.",
    successMessage: "Restaurants exported to Excel.",
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text flex items-center gap-2">
          <ShieldAlert className="text-primary" size={24} />
          Restaurant Management & Moderation
        </h1>
        <p className="text-sm text-muted">
          Review listings, issue warnings, and monitor restaurant health
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Search by restaurant name, city or code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-10 w-full"
          />
        </div>
        <ExportButton isExporting={isExporting} onClick={handleExport} />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-4">
              <SkeletonText lines={3} />
            </Card>
          ))}
        </div>
      ) : error ? (
        <ErrorState title="Unable to load restaurants" description={error} onRetry={reloadAll} />
      ) : filteredRestaurants.length === 0 ? (
        <EmptyState title="No restaurants found" description="No restaurant listings match your query." />
      ) : (
        <div className="space-y-4">
          {filteredRestaurants.map((r) => {
            const restaurantWarnings = warningIndex[String(r._id)] || [];
            const restaurantReports = reportIndex[String(r._id)] || [];
            const activeWarnings = restaurantWarnings.filter((w) => w.status === "ACTIVE");
            const pendingReports = restaurantReports.filter((rep) => rep.status === "PENDING");
            const lastWarning = restaurantWarnings[0];
            const refundStatsForRestaurant = refundStats[String(r._id)] || {
              refunded: 0,
              notRefunded: 0,
            };

            return (
              <Card key={r._id} className="p-5 transition-shadow hover:shadow-md">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-bold text-text">{r.restaurantName}</h3>
                      {r.restaurantCode && (
                        <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted">
                          {r.restaurantCode}
                        </span>
                      )}
                      <Badge
                        variant={
                          r.verificationStatus === "Verified"
                            ? "success"
                            : r.verificationStatus === "Rejected"
                              ? "danger"
                              : "warning"
                        }
                      >
                        {r.verificationStatus || "Pending"}
                      </Badge>
                      <Badge variant={r.isActive !== false ? "success" : "danger"}>
                        {r.isActive !== false ? "Active" : "Inactive"}
                      </Badge>
                      {activeWarnings.length > 0 && (
                        <Badge variant="danger">
                          <ShieldAlert size={12} className="mr-1" />
                          {activeWarnings.length} active warning
                          {activeWarnings.length > 1 ? "s" : ""} (
                          {activeWarnings.map((w) => w.level).join(", ")})
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted mt-1">
                      Location: {r.city}, {r.state} | Cuisine:{" "}
                      {r.cuisineTypes?.join(", ") || "General"}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-red-50 px-2.5 py-1 font-medium text-red-700 dark:bg-red-500/10 dark:text-red-300">
                        {restaurantWarnings.length} warning
                        {restaurantWarnings.length !== 1 ? "s" : ""} total
                      </span>
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                        {pendingReports.length} pending report
                        {pendingReports.length !== 1 ? "s" : ""}
                      </span>
                      <span className="rounded-full bg-blue-50 px-2.5 py-1 font-medium text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                        {restaurantReports.length} report
                        {restaurantReports.length !== 1 ? "s" : ""} total
                      </span>
                      <span className="rounded-full bg-green-50 px-2.5 py-1 font-medium text-green-700 dark:bg-green-500/10 dark:text-green-300">
                        {refundStatsForRestaurant.refunded} refunded
                      </span>
                      <span className="rounded-full bg-rose-50 px-2.5 py-1 font-medium text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
                        {refundStatsForRestaurant.notRefunded} not refunded
                      </span>
                      {lastWarning && (
                        <span className="rounded-full bg-gray-100 px-2.5 py-1 font-medium text-gray-600 dark:bg-white/10 dark:text-gray-300">
                          Last warning:{" "}
                          {new Date(lastWarning.issuedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {r.verificationStatus !== "Verified" && (
                      <Button size="sm" variant="primary" onClick={() => handleVerifyRestaurant(r._id, "Verified")}>
                        <CheckCircle size={15} className="mr-1" /> Approve
                      </Button>
                    )}
                    {r.verificationStatus !== "Rejected" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 border-red-200 hover:bg-red-50"
                        onClick={() => handleVerifyRestaurant(r._id, "Rejected")}
                      >
                        <XCircle size={15} className="mr-1" /> Reject
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-amber-600 border-amber-200 hover:bg-amber-50"
                      onClick={() => setWarnTarget(r)}
                    >
                      <FileWarning size={15} className="mr-1" /> Issue Warning
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setHistoryTarget(r)}
                    >
                      <History size={15} className="mr-1" /> Warning History
                    </Button>
                    <Link
                      to={`/restaurants/${r._id}`}
                      className="inline-flex items-center gap-1 rounded-full border border-border/70 px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:border-primary/30 hover:text-primary"
                    >
                      View Restaurant
                    </Link>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <WarningIssueModal
        isOpen={Boolean(warnTarget)}
        onClose={() => setWarnTarget(null)}
        restaurant={warnTarget}
        onIssued={() => {
          setWarnTarget(null);
          reloadAll();
        }}
      />

      <Modal
        isOpen={Boolean(historyTarget)}
        onClose={() => setHistoryTarget(null)}
        title={`Warning History — ${historyTarget?.restaurantName || ""}`}
        size="lg"
      >
        {historyTarget && (() => {
          const history = warningIndex[String(historyTarget._id)] || [];
          return (
            <div className="space-y-4 pt-2">
              {history.length === 0 ? (
                <EmptyState
                  title="No warnings issued"
                  description="This restaurant has never received a warning."
                />
              ) : (
                history.map((warning) => (
                  <div
                    key={warning._id}
                    className="rounded-xl border border-border p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[10px] font-semibold text-muted">
                          {warning.warningCode}
                        </span>
                        <Badge variant={LEVEL_VARIANT[warning.level] || "default"}>
                          {warning.level}
                        </Badge>
                        <Badge
                          variant={WARNING_STATUS_VARIANT[warning.status] || "default"}
                          className="capitalize"
                        >
                          {warning.status === "ACTIVE"
                            ? "Active"
                            : warning.status === "EXPIRED"
                              ? "Expired"
                              : "Cleared"}
                        </Badge>
                      </div>
                      {warning.status === "ACTIVE" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleClearWarning(warning)}
                        >
                          Clear Warning
                        </Button>
                      )}
                    </div>
                    <p className="mt-2 text-sm font-medium text-text">{warning.title}</p>
                    <p className="mt-1 text-sm text-muted">{warning.reason}</p>
                    <p className="mt-2 text-xs text-muted">
                      Issued{" "}
                      {warning.issuedAt
                        ? new Date(warning.issuedAt).toLocaleString()
                        : "-"}{" "}
                      • Expires{" "}
                      {warning.expiresAt
                        ? new Date(warning.expiresAt).toLocaleString()
                        : "-"}
                      {warning.relatedReportId && (
                        <>
                          {" "}
                          • Report{" "}
                          <span className="font-mono">
                            {warning.relatedReportId.reportCode}
                          </span>{" "}
                          ({warning.relatedReportId.category})
                        </>
                      )}
                    </p>
                    {warning.clearedReason && (
                      <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                        Cleared: {warning.clearedReason}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { RefreshCw, RotateCcw, ShieldAlert, XCircle } from "lucide-react";
import toast from "react-hot-toast";

import {
  fetchReconciliations,
  fetchReconciliationStatus,
  runReconciliationAction,
} from "../../store/slices/reconciliationSlice.js";
import {
  ensureSocketConnected,
  subscribeToReconciliationUpdates,
} from "../../services/socket/socketService.js";

import Badge from "../../components/ui/Badge.jsx";
import Button from "../../components/ui/Button.jsx";
import Card from "../../components/ui/Card.jsx";
import ConfirmDialog from "../../components/ui/ConfirmDialog.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import ErrorState from "../../components/ui/ErrorState.jsx";
import { SkeletonText } from "../../components/ui/Skeleton.jsx";
import { formatCurrency } from "../../utils/formatCurrency.js";

const STATUS_META = {
  PENDING: { label: "Pending", variant: "default" },
  PROCESSING: { label: "Processing", variant: "info" },
  RESOLVED_BOOKING: { label: "Resolved — Booking", variant: "success" },
  RESOLVED_REFUND: { label: "Resolved — Refund", variant: "success" },
  MANUAL_REVIEW: { label: "Manual Review", variant: "danger" },
  FAILED_RETRYABLE: { label: "Retryable", variant: "warning" },
};

const RESOLUTION_LABEL = {
  BOOKING_CREATED: "Booking created",
  BOOKING_REUSED: "Existing booking linked",
  REFUND_INITIATED: "Refund initiated",
  REFUND_COMPLETED: "Refund completed",
  CLOSED_MANUALLY: "Closed manually",
};

const statusMeta = (status) => STATUS_META[status] || { label: status, variant: "default" };

const formatDate = (date) => {
  if (!date) return "—";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function AdminReconciliationPage() {
  const dispatch = useDispatch();
  const reconciliations = useSelector((state) => state.reconciliation.reconciliations);
  const worker = useSelector((state) => state.reconciliation.worker);
  const counts = useSelector((state) => state.reconciliation.counts);
  const meta = useSelector((state) => state.reconciliation.meta);
  const isLoading = useSelector((state) => state.reconciliation.isLoading);
  const actionLoadingId = useSelector((state) => state.reconciliation.actionLoadingId);
  const error = useSelector((state) => state.reconciliation.error);

  const [statusFilter, setStatusFilter] = useState("");
  const [refundTarget, setRefundTarget] = useState(null);
  const [closeTarget, setCloseTarget] = useState(null);

  const loadAll = async () => {
    const results = await Promise.allSettled([
      dispatch(
        fetchReconciliations(statusFilter ? { status: statusFilter } : {})
      ),
      dispatch(fetchReconciliationStatus()),
    ]);
    if (results[0].status === "rejected") {
      toast.error("Failed to load reconciliation records.");
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  // Live reconciliation updates: the backend emits `payment:reconciliationUpdated`
  // to the `restaurant_<id>` and `user_<id>` rooms. Admins may join any
  // restaurant room, so we join the rooms for the reconciliations currently
  // displayed and refresh the list when an update arrives. Duplicate listeners
  // are de-duplicated by the socket service.
  useEffect(() => {
    const socket = ensureSocketConnected();
    const unsubscribe = subscribeToReconciliationUpdates(() => {
      loadAll();
    });

    const restaurantIds = [
      ...new Set(
        reconciliations
          .map((r) => r.restaurantId?._id || r.restaurantId)
          .filter(Boolean)
          .map(String)
      ),
    ];
    restaurantIds.forEach((restaurantId) => {
      socket.emit("subscribe:bookings", { restaurantId });
    });

    return () => {
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reconciliations]);

  const openRecords = useMemo(
    () =>
      reconciliations.filter(
        (r) => r.status === "PENDING" || r.status === "MANUAL_REVIEW" || r.status === "FAILED_RETRYABLE"
      ),
    [reconciliations]
  );

  const handleRefund = async () => {
    if (!refundTarget) return;
    try {
      await dispatch(runReconciliationAction({ id: refundTarget._id, action: "refund" }));
      toast.success("Refund action completed.");
      setRefundTarget(null);
      loadAll();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Refund action failed.");
    }
  };

  const handleClose = async () => {
    if (!closeTarget) return;
    try {
      await dispatch(
        runReconciliationAction({
          id: closeTarget._id,
          action: "close",
        })
      );
      toast.success("Reconciliation closed for manual review.");
      setCloseTarget(null);
      loadAll();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Close failed.");
    }
  };

  const handleRetry = async (id) => {
    try {
      await dispatch(runReconciliationAction({ id, action: "retry" }));
      toast.success("Re-queued for the worker.");
      loadAll();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Retry failed.");
    }
  };

  const statCards = [
    { label: "Pending", value: counts?.pending ?? "—", tone: "bg-primary/10 text-primary" },
    { label: "Processing", value: counts?.processing ?? "—", tone: "bg-blue-500/10 text-blue-600" },
    { label: "Manual Review", value: counts?.manualReview ?? "—", tone: "bg-red-500/10 text-red-600" },
    { label: "Retryable", value: counts?.retryable ?? "—", tone: "bg-amber-500/10 text-amber-600" },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="rounded-3xl border border-border bg-surface/90 p-6 shadow-lg shadow-black/5 backdrop-blur-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              <RotateCcw size={12} />
              Payment Recovery
            </div>
            <div className="space-y-1">
              <h1 className="text-3xl font-bold tracking-tight text-text sm:text-4xl">
                Payment Reconciliation
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-muted sm:text-base">
                Captured payments without a confirmed booking are reconciled
                automatically. Manual review rows need an operator decision —
                amounts are always derived server-side.
              </p>
            </div>
          </div>

          <Button variant="outline" size="sm" onClick={() => loadAll()}>
            <RefreshCw size={15} className="mr-1" /> Refresh
          </Button>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {statCards.map((stat) => (
            <Card key={stat.label} className="border-border/80 bg-white/70 p-4 shadow-sm dark:bg-surface/90">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">{stat.label}</p>
              <p className={`mt-2 text-2xl font-bold tracking-tight ${stat.tone.split(" ")[1]}`}>{stat.value}</p>
            </Card>
          ))}
        </div>

        <p className="mt-4 text-xs text-muted">
          Worker {worker?.enabled ? "running" : "stopped"}
          {worker?.lastRunAt ? ` — last run ${formatDate(worker.lastRunAt)}` : ""} ·
          batch {worker?.batchSize ?? "—"} · interval {(worker?.intervalMs ?? 0) / 1000}s
          {worker?.lastRunResult ? ` · last cycle: ${worker.lastRunResult.processed ?? 0} processed, ${worker.lastRunResult.enqueued ?? 0} enqueued` : ""}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm font-semibold text-muted">Status:</label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input-field w-56"
        >
          <option value="">All statuses</option>
          {Object.entries(STATUS_META).map(([value, s]) => (
            <option key={value} value={value}>
              {s.label}
            </option>
          ))}
        </select>
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
        <ErrorState title="Unable to load reconciliations" description={error} onRetry={() => loadAll()} />
      ) : reconciliations.length === 0 ? (
        <Card className="p-8">
          <EmptyState
            title="No reconciliation records"
            description="Payments without a booking will appear here when the worker finds them."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {reconciliations.map((r) => {
            const metaBadge = statusMeta(r.status);
            const payment = r.paymentId || {};
            const customer = r.customerId || {};
            const restaurant = r.restaurantId || {};
            return (
              <Card key={r._id} className="p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={metaBadge.variant}>{metaBadge.label}</Badge>
                      {r.resolution && (
                        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-muted">
                          {RESOLUTION_LABEL[r.resolution] || r.resolution}
                        </span>
                      )}
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted">
                        #{String(r._id).slice(-8)}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wider text-muted">Amount</p>
                        <p className="text-sm font-bold text-text">
                          {formatCurrency(payment.amount)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wider text-muted">Payment</p>
                        <p className="text-sm text-text truncate">
                          {payment.razorpayPaymentId || payment.razorpayOrderId || String(r.paymentId || "").slice(-8) || "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wider text-muted">Customer</p>
                        <p className="text-sm text-text truncate">{customer.fullName || "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wider text-muted">Restaurant</p>
                        <p className="text-sm text-text truncate">{restaurant.restaurantName || "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wider text-muted">Attempts</p>
                        <p className="text-sm text-text">{r.attempts ?? 0}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wider text-muted">Captured</p>
                        <p className="text-sm text-text">{formatDate(r.createdAt)}</p>
                      </div>
                    </div>

                    {r.resolutionReason && (
                      <p className="mt-3 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted">
                        {r.resolutionReason}
                      </p>
                    )}
                  </div>

                  {r.status === "MANUAL_REVIEW" && (
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => handleRetry(r._id)}
                        disabled={actionLoadingId === r._id}
                      >
                        <RefreshCw size={14} className="mr-1" /> Retry
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setRefundTarget(r)}
                        disabled={actionLoadingId === r._id}
                      >
                        <RotateCcw size={14} className="mr-1" /> Refund
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-muted hover:text-red-600"
                        onClick={() => {
                          setCloseTarget(r);
                        }}
                        disabled={actionLoadingId === r._id}
                      >
                        <XCircle size={14} className="mr-1" /> Close
                      </Button>
                    </div>
                  )}

                  {r.status === "FAILED_RETRYABLE" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRetry(r._id)}
                      disabled={actionLoadingId === r._id}
                    >
                      <RefreshCw size={14} className="mr-1" /> Retry now
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}

          <div className="flex items-center justify-between text-xs text-muted">
            <span>
              {reconciliations.length} of {meta?.total ?? reconciliations.length} record
              {(meta?.total ?? 0) === 1 ? "" : "s"}
            </span>
            <div className="flex items-center gap-2">
              {openRecords.length > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 font-semibold text-red-600">
                  <ShieldAlert size={12} />
                  {openRecords.length} open
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={Boolean(refundTarget)}
        onClose={() => setRefundTarget(null)}
        onConfirm={handleRefund}
        title="Refund this payment?"
        description={
          refundTarget
            ? `A refund for ${formatCurrency(refundTarget.paymentId?.amount)} will be initiated against the captured payment. The amount is computed server-side. This cannot be undone.`
            : ""
        }
        confirmText="Refund payment"
        cancelText="Cancel"
        variant="danger"
        isLoading={actionLoadingId === refundTarget?._id}
      />

      <ConfirmDialog
        isOpen={Boolean(closeTarget)}
        onClose={() => setCloseTarget(null)}
        onConfirm={handleClose}
        title="Close for manual review?"
        description={`The worker will no longer touch this record. An operator can retry or refund it later.`}
        confirmText="Close"
        cancelText="Cancel"
        variant="secondary"
        isLoading={actionLoadingId === closeTarget?._id}
      />
    </div>
  );
}

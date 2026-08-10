import { useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import toast from "react-hot-toast";
import {
  HandCoins,
  Banknote,
  AlertTriangle,
  MessageSquareWarning,
} from "lucide-react";

import {
  confirmRefundReceipt,
  disputeRefund,
  fetchRefunds,
  processRefund,
} from "../../store/slices/refundSlice.js";
import { REFUND_METHOD, REFUND_METHOD_LABELS } from "../../constants/refund.js";
import RefundMethodSelector from "./RefundMethodSelector.jsx";
import { useAuth } from "../../hooks/useAuth.js";
import Card from "../ui/Card.jsx";
import Badge from "../ui/Badge.jsx";
import Button from "../ui/Button.jsx";
import Modal from "../ui/Modal.jsx";
import EmptyState from "../ui/EmptyState.jsx";
import ErrorState from "../ui/ErrorState.jsx";
import { SkeletonCard } from "../ui/Skeleton.jsx";
import { formatCurrency } from "../../utils/formatCurrency.js";
import { formatDateTime } from "../../utils/formatDate.js";
import { fetchRestaurants } from "../../store/slices/restaurantSlice.js";
import RestaurantFilter from "../owner/RestaurantFilter.jsx";
import InvoiceDatePicker from "../common/InvoiceDatePicker.jsx";
import ExportButton from "../common/ExportButton.jsx";
import { useExcelExport } from "../../hooks/useExcelExport.js";
import { exportRefundsToExcel } from "../../utils/refundExport.js";
import PdfDownloadButton from "../pdf/PdfDownloadButton.jsx";
import RefundPdf from "../pdf/RefundPdf.jsx";
import {
  fetchRefundReceiptData,
  refundReceiptFilename,
} from "../../utils/pdf/pdfData.js";

const REASON_LABELS = {
  CUSTOMER_CANCELLED: "Customer cancellation",
  CUSTOMER_NO_SHOW: "Customer no-show",
  EXCESS_ADVANCE_PAYMENT: "Excess advance payment",
  BILL_ADJUSTMENT: "Bill adjustment",
  OTHER_APPROVED_REASON: "Approved reason",
};

const STATUS_META = {
  REFUND_PENDING: { label: "Pending", variant: "warning" },
  REFUND_PROCESSING: { label: "Processing", variant: "info" },
  REFUND_AWAITING_CUSTOMER_CONFIRMATION: {
    label: "Awaiting customer confirmation",
    variant: "warning",
  },
  REFUNDED: { label: "Refunded", variant: "success" },
  REFUND_OVERDUE: { label: "Overdue", variant: "error" },
  REFUND_FAILED: { label: "Failed", variant: "error" },
  REFUND_DISPUTED: { label: "Disputed", variant: "error" },
};

const OWNER_TABS = ["ALL", "PENDING", "OVERDUE", "COMPLETED", "DISPUTED"];
const CUSTOMER_TABS = ["ALL", "PENDING", "AWAITING", "COMPLETED", "DISPUTED"];

const matchesTab = (refund, tab) => {
  if (tab === "ALL") return true;
  const status = refund.refundStatus;
  switch (tab) {
    case "PENDING":
      return ["REFUND_PENDING", "REFUND_PROCESSING"].includes(status);
    case "OVERDUE":
      return status === "REFUND_OVERDUE";
    case "AWAITING":
      return status === "REFUND_AWAITING_CUSTOMER_CONFIRMATION";
    case "COMPLETED":
      return status === "REFUNDED";
    case "DISPUTED":
      return status === "REFUND_DISPUTED";
    default:
      return true;
  }
};

function RefundsPanel({ role = "owner", title, subtitle }) {
  const tabs = role === "owner" ? OWNER_TABS : CUSTOMER_TABS;
  const { user } = useAuth();
  const dispatch = useDispatch();
  const restaurants = useSelector((state) => state.restaurant.restaurants);
  const refunds = useSelector((state) => state.refund.refunds);
  const isLoading = useSelector((state) => state.refund.isLoading);
  const error = useSelector((state) => state.refund.error);
  const [activeTab, setActiveTab] = useState("ALL");
  const [actionId, setActionId] = useState("");
  const [processTarget, setProcessTarget] = useState(null);
  const [selectedMethod, setSelectedMethod] = useState(REFUND_METHOD.CASH);
  const [processBusy, setProcessBusy] = useState(false);
  const [processError, setProcessError] = useState("");
  const [selectedRestaurant, setSelectedRestaurant] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Confirm-receipt modal state
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  // Dispute modal state
  const [disputeTarget, setDisputeTarget] = useState(null);
  const [disputeReason, setDisputeReason] = useState("");
  const [disputeBusy, setDisputeBusy] = useState(false);
  const disputeReasonRef = useRef(null);

  const fetchRefundsData = async () => {
    await Promise.all([
      dispatch(fetchRestaurants({ ownerId: user?.id, isActive: true })),
      dispatch(fetchRefunds({
        page: 1,
        limit: 100,
        ...(selectedRestaurant ? { restaurantId: selectedRestaurant } : {}),
      })),
    ]).catch(() => {});
  };

  const openProcessDialog = (refund) => {
    setProcessError("");
    setSelectedMethod(
      refund.refundMethod && refund.refundMethod !== REFUND_METHOD.RAZORPAY
        ? refund.refundMethod
        : REFUND_METHOD.CASH
    );
    setProcessTarget(refund);
  };

  const closeProcessDialog = () => {
    if (processBusy) return;
    setProcessTarget(null);
    setProcessError("");
  };

  useEffect(() => {
    fetchRefundsData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, selectedRestaurant]);

  const filtered = useMemo(
    () => refunds.filter((r) => {
      if (!matchesTab(r, activeTab)) return false;
      const refundDate = r.createdAt ? new Date(r.createdAt).toISOString().slice(0, 10) : "";
      if (dateFrom && refundDate < dateFrom) return false;
      if (dateTo && refundDate > dateTo) return false;
      return true;
    }),
    [refunds, activeTab, dateFrom, dateTo]
  );

  const { isExporting, handleExport } = useExcelExport({
    data: filtered,
    exportFn: exportRefundsToExcel,
    emptyMessage: "No refunds available to export.",
    successMessage: "Refunds exported to Excel.",
  });

  const handleProcess = async (refund, method) => {
    setProcessError("");
    setProcessBusy(true);
    try {
      await dispatch(processRefund(refund._id, method));
      toast.success(
        method === REFUND_METHOD.CASH
          ? "Refund marked as issued in cash."
          : "Refund processed successfully."
      );
      closeProcessDialog();
      fetchRefundsData();
    } catch (err) {
      setProcessError(
        err?.response?.data?.message || "Failed to process refund."
      );
      toast.error(err?.response?.data?.message || "Failed to process refund.");
    } finally {
      setProcessBusy(false);
    }
  };

  const handleConfirm = (refund) => {
    setConfirmTarget(refund);
  };

  const submitConfirm = async () => {
    if (!confirmTarget) return;
    setConfirmBusy(true);
    setActionId(confirmTarget._id);
    try {
      await dispatch(confirmRefundReceipt(confirmTarget._id));
      toast.success("Refund receipt confirmed. Thank you!");
      setConfirmTarget(null);
      fetchRefundsData();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to confirm refund.");
    } finally {
      setConfirmBusy(false);
      setActionId("");
    }
  };

  const handleDispute = (refund) => {
    setDisputeReason("");
    setDisputeTarget(refund);
    // focus textarea after render
    setTimeout(() => disputeReasonRef.current?.focus(), 50);
  };

  const submitDispute = async () => {
    if (!disputeTarget) return;
    const trimmed = disputeReason.trim();
    if (trimmed.length < 5) {
      toast.error("A dispute reason of at least 5 characters is required.");
      return;
    }
    setDisputeBusy(true);
    setActionId(disputeTarget._id);
    try {
      await dispatch(disputeRefund(disputeTarget._id, trimmed));
      toast.success("Refund disputed. The restaurant has been notified.");
      setDisputeTarget(null);
      setDisputeReason("");
      fetchRefundsData();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to dispute refund.");
    } finally {
      setDisputeBusy(false);
      setActionId("");
    }
  };

  const renderActions = (refund) => {
    if (role === "owner") {
      if (["REFUND_PENDING", "REFUND_OVERDUE"].includes(refund.refundStatus)) {
        return (
          <>
            <Button
              size="sm"
              variant="primary"
              onClick={() => openProcessDialog(refund)}
            >
              <HandCoins size={15} className="mr-1" />
              Process Refund
            </Button>
          </>
        );
      }

      return null;
    }

    if (
      ["REFUND_AWAITING_CUSTOMER_CONFIRMATION", "REFUND_OVERDUE"].includes(
        refund.refundStatus
      )
    ) {
      const methodLabel =
        refund.refundMethod && refund.refundMethod !== REFUND_METHOD.RAZORPAY
          ? REFUND_METHOD_LABELS[refund.refundMethod] || refund.refundMethod
          : "Refund";
      return (
        <>
          <Button
            size="sm"
            variant="primary"
            isLoading={actionId === refund._id}
            onClick={() => handleConfirm(refund)}
          >
            <Banknote size={15} className="mr-1" />
            I Received the {methodLabel}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-red-600 border-red-200 hover:bg-red-50"
            isLoading={actionId === refund._id}
            onClick={() => handleDispute(refund)}
          >
            <MessageSquareWarning size={15} className="mr-1" />
            Report a Problem
          </Button>
        </>
      );
    }

    return null;
  };

  return (
    <div className="space-y-6">
      {role === "owner" && (
        <div className="max-w-xs">
          <RestaurantFilter
            restaurants={restaurants}
            value={selectedRestaurant}
            onChange={setSelectedRestaurant}
          />
        </div>
      )}
      {role === "owner" && user?.bookingStatus === "BOOKING_RESTRICTED" && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">New bookings are restricted</p>
            <p className="text-red-700">
              Your restaurant is not accepting new bookings until all
              unresolved refunds are settled. Process the refunds below to lift
              the restriction automatically.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text">{title}</h1>
          {subtitle && <p className="text-sm text-muted mt-1">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg shrink-0 transition-all ${
              activeTab === tab
                ? "bg-primary text-white"
                : "border border-border bg-surface-secondary/70 text-muted hover:bg-surface-hover hover:text-text"
            }`}
          >
            {tab.charAt(0) + tab.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="w-full sm:w-44"><InvoiceDatePicker label="From date" value={dateFrom} onChange={setDateFrom} /></div>
        <div className="w-full sm:w-44"><InvoiceDatePicker label="To date" value={dateTo} onChange={setDateTo} /></div>
        <ExportButton isExporting={isExporting} onClick={handleExport} />
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : error ? (
        <ErrorState title="Unable to load refunds" description={error} onRetry={fetchRefundsData} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No refunds found"
          description="No refund records match the selected filter."
        />
      ) : (
        <div className="space-y-4">
          {filtered.map((refund) => {
            const meta = STATUS_META[refund.refundStatus] || {
              label: refund.refundStatus || "Unknown",
              variant: "neutral",
            };
            const customer =
              typeof refund.customerId === "object" ? refund.customerId : null;
            const owner = typeof refund.ownerId === "object" ? refund.ownerId : null;
            const booking =
              typeof refund.bookingId === "object" ? refund.bookingId : null;
            const restaurant =
              typeof refund.restaurantId === "object" ? refund.restaurantId : null;

            return (
              <Card key={refund._id} className="overflow-hidden p-0 transition-all hover:-translate-y-px hover:shadow-md">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-2 min-w-0 p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-bold text-text">
                        {formatCurrency(refund.amount)}
                      </span>
                      {refund.refundCode && (
                        <span className="rounded bg-surface-secondary/70 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted">
                          {refund.refundCode}
                        </span>
                      )}
                      <Badge variant={meta.variant}>{meta.label}</Badge>
                      {refund.refundMethod && (
                        <Badge variant="neutral">{refund.refundMethod}</Badge>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm text-muted">
                      {booking?.bookingCode && (
                        <span>Booking: {booking.bookingCode}</span>
                      )}
                      {role === "owner"
                        ? customer && <span>Customer: {customer.fullName}</span>
                        : owner && <span>Restaurant: {owner.fullName}</span>}
                      {restaurant?.restaurantName && (
                        <span>{restaurant.restaurantName}</span>
                      )}
                      {refund.createdAt && (
                        <span>{formatDateTime(refund.createdAt)}</span>
                      )}
                    </div>

                    {refund.remarks && (
                      <p className="text-xs text-muted truncate max-w-xl">
                        {refund.remarks}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 border-t border-border/70 px-5 py-4 lg:border-l lg:border-t-0 lg:px-4 lg:py-5">
                    <PdfDownloadButton
                      size="sm"
                      variant="outline"
                      successMessage="Refund receipt PDF downloaded."
                      filename={refundReceiptFilename}
                      fetchData={() => fetchRefundReceiptData(refund._id, refund)}
                      renderDocument={({ refund: r, booking, bill }) => (
                        <RefundPdf refund={r} booking={booking} bill={bill} view={role} />
                      )}
                    />
                    {renderActions(refund)}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Owner — Process Refund dialog */}
      <Modal
        isOpen={Boolean(processTarget)}
        onClose={closeProcessDialog}
        title={
          processTarget?.refundCode
            ? `Process Refund ${processTarget.refundCode}`
            : "Process Refund"
        }
        size="lg"
      >
        {processTarget && (
          <div className="space-y-5">
            {(() => {
              const customer =
                typeof processTarget.customerId === "object"
                  ? processTarget.customerId
                  : null;
              const booking =
                typeof processTarget.bookingId === "object"
                  ? processTarget.bookingId
                  : null;
              const restaurant =
                typeof processTarget.restaurantId === "object"
                  ? processTarget.restaurantId
                  : null;
              const statusMeta = STATUS_META[processTarget.refundStatus] || {
                label: processTarget.refundStatus || "Unknown",
                variant: "neutral",
              };
              return (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-border bg-surface-secondary/55 p-4 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Refund Amount</p>
                      <p className="mt-1 text-lg font-bold text-text">
                        {formatCurrency(processTarget.amount)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-border bg-surface-secondary/55 p-4 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Current Refund Status</p>
                      <div className="mt-1.5">
                        <Badge variant={statusMeta.variant}>
                          {statusMeta.label}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border bg-surface-secondary/65 p-4 text-sm text-text space-y-2 shadow-sm">
                    <div className="flex justify-between gap-4">
                      <span className="text-muted">Refund Reason</span>
                      <span className="font-medium">
                        {REASON_LABELS[processTarget.reason] || processTarget.reason || "N/A"}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted">Booking Number</span>
                      <span className="font-medium">{booking?.bookingCode || "N/A"}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted">Bill Number</span>
                      <span className="font-medium">
                        {processTarget.billId ? String(processTarget.billId).slice(-6) : "N/A"}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted">Customer</span>
                      <span className="font-medium">{customer?.fullName || "N/A"}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted">Restaurant</span>
                      <span className="font-medium">
                        {restaurant?.restaurantName || "N/A"}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted">Refund Deadline</span>
                      <span className="font-medium">
                        {processTarget.deadlineAt
                          ? formatDateTime(processTarget.deadlineAt)
                          : "N/A"}
                      </span>
                    </div>
                    {processTarget.remarks && (
                      <div className="flex justify-between gap-4">
                        <span className="text-muted">Remarks</span>
                        <span className="font-medium truncate max-w-[60%]">
                          {processTarget.remarks}
                        </span>
                      </div>
                    )}
                  </div>

                  <RefundMethodSelector
                    value={selectedMethod}
                    onChange={setSelectedMethod}
                    disabled={processBusy}
                  />

                  {processTarget.refundMethod === REFUND_METHOD.RAZORPAY &&
                    processTarget.refundStatus === "REFUND_PENDING" && (
                      <p className="text-xs text-muted">
                        Razorpay refunds use the original captured payment. If no
                        captured payment exists, the backend will reject it with an
                        error and the refund is marked as failed.
                      </p>
                    )}

                  {processError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                      {processError}
                    </div>
                  )}

                  <div className="flex justify-end gap-3 pt-1">
                    <Button
                      variant="outline"
                      onClick={closeProcessDialog}
                      disabled={processBusy}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      onClick={() => handleProcess(processTarget, selectedMethod)}
                      isLoading={processBusy}
                      loadingText="Processing..."
                      disabled={!selectedMethod}
                    >
                      Confirm Refund via {REFUND_METHOD_LABELS[selectedMethod] || selectedMethod}
                    </Button>
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </Modal>

      {/* Customer — Confirm Receipt modal */}
      <Modal
        isOpen={Boolean(confirmTarget)}
        onClose={() => !confirmBusy && setConfirmTarget(null)}
        title="Confirm Refund Receipt"
        size="sm"
      >
        {confirmTarget && (
          <div className="space-y-4">
            <p className="text-sm text-muted">
              Please confirm that you have received the{" "}
              <strong>
                {REFUND_METHOD_LABELS[confirmTarget.refundMethod] ||
                  confirmTarget.refundMethod ||"refund"}
              </strong>{" "}
              refund of{" "}
              <strong>{formatCurrency(confirmTarget.amount)}</strong> for booking{" "}
              <strong>
                {typeof confirmTarget.bookingId === "object"
                  ? confirmTarget.bookingId.bookingCode
                  : confirmTarget.refundCode}
              </strong>.
            </p>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setConfirmTarget(null)}
                disabled={confirmBusy}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={submitConfirm}
                isLoading={confirmBusy}
                loadingText="Confirming..."
              >
                Yes, I Received It
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Customer — Dispute modal */}
      <Modal
        isOpen={Boolean(disputeTarget)}
        onClose={() => !disputeBusy && (setDisputeTarget(null), setDisputeReason(""))}
        title="Report a Problem"
        size="sm"
      >
        {disputeTarget && (
          <div className="space-y-4">
            <p className="text-sm text-muted">
              Tell us why you did not receive the{" "}
              <strong>
                {REFUND_METHOD_LABELS[disputeTarget.refundMethod] ||
                  disputeTarget.refundMethod || "refund"}
              </strong>{" "}
              of <strong>{formatCurrency(disputeTarget.amount)}</strong>.
            </p>
            <textarea
              ref={disputeReasonRef}
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              placeholder="Describe the issue (min. 5 characters)…"
              rows={4}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              disabled={disputeBusy}
            />
            <p className="text-xs text-muted">
              {disputeReason.trim().length} / 500 characters
            </p>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => { setDisputeTarget(null); setDisputeReason(""); }}
                disabled={disputeBusy}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={submitDispute}
                isLoading={disputeBusy}
                loadingText="Submitting..."
                disabled={disputeReason.trim().length < 5}
              >
                Submit Dispute
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default RefundsPanel;

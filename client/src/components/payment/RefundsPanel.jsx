import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  HandCoins,
  Banknote,
  AlertTriangle,
  MessageSquareWarning,
} from "lucide-react";

import { refundApi } from "../../api/refund.api.js";
import { useAuth } from "../../hooks/useAuth.js";
import Card from "../ui/Card.jsx";
import Badge from "../ui/Badge.jsx";
import Button from "../ui/Button.jsx";
import EmptyState from "../ui/EmptyState.jsx";
import ErrorState from "../ui/ErrorState.jsx";
import { SkeletonText } from "../ui/Skeleton.jsx";
import { formatCurrency } from "../../utils/formatCurrency.js";
import { formatDateTime } from "../../utils/formatDate.js";

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
  const [activeTab, setActiveTab] = useState("ALL");
  const [refunds, setRefunds] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionId, setActionId] = useState("");

  const fetchRefunds = async () => {
    try {
      const res = await refundApi.getAll({ page: 1, limit: 100 });
      setRefunds(res?.data?.refunds || res?.refunds || []);
      setError(null);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load refunds.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    refundApi
      .getAll({ page: 1, limit: 100 })
      .then((res) => {
        if (!isMounted) return;
        setRefunds(res?.data?.refunds || res?.refunds || []);
        setError(null);
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err?.response?.data?.message || "Failed to load refunds.");
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const filtered = useMemo(
    () => refunds.filter((r) => matchesTab(r, activeTab)),
    [refunds, activeTab]
  );

  const handleProcess = async (refund, method) => {
    const isCash = method === "Cash";
    const message = isCash
      ? "Mark this refund as issued in cash? The customer will be asked to confirm receipt."
      : "Process this refund to the customer's payment method (Razorpay)?";
    if (!window.confirm(message)) return;
    setActionId(refund._id);
    try {
      await refundApi.process(refund._id, method);
      toast.success(isCash ? "Refund marked as issued in cash." : "Refund processed successfully.");
      fetchRefunds();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to process refund.");
    } finally {
      setActionId("");
    }
  };

  const handleConfirm = async (refund) => {
    if (!window.confirm("I received the refund in cash. Confirm receipt?")) return;
    setActionId(refund._id);
    try {
      await refundApi.confirmReceipt(refund._id);
      toast.success("Refund receipt confirmed. Thank you!");
      fetchRefunds();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to confirm refund.");
    } finally {
      setActionId("");
    }
  };

  const handleDispute = async (refund) => {
    const reason = window.prompt(
      "Please tell us why you did not receive this refund (at least 5 characters):"
    );
    if (!reason || reason.trim().length < 5) {
      toast.error("A dispute reason of at least 5 characters is required.");
      return;
    }
    setActionId(refund._id);
    try {
      await refundApi.dispute(refund._id, reason.trim());
      toast.success("Refund disputed. The restaurant has been notified.");
      fetchRefunds();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to dispute refund.");
    } finally {
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
              variant="secondary"
              isLoading={actionId === refund._id}
              onClick={() => handleProcess(refund, "Cash")}
            >
              <Banknote size={15} className="mr-1" />
              Refund in Cash
            </Button>
            <Button
              size="sm"
              variant="primary"
              isLoading={actionId === refund._id}
              onClick={() => handleProcess(refund, "RAZORPAY")}
            >
              <HandCoins size={15} className="mr-1" />
              Refund Online
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
      return (
        <>
          <Button
            size="sm"
            variant="primary"
            isLoading={actionId === refund._id}
            onClick={() => handleConfirm(refund)}
          >
            <Banknote size={15} className="mr-1" />
            I Received the Cash
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
                : "bg-gray-100 text-muted hover:bg-gray-200"
            }`}
          >
            {tab.charAt(0) + tab.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-5">
              <SkeletonText lines={3} />
            </Card>
          ))}
        </div>
      ) : error ? (
        <ErrorState title="Unable to load refunds" description={error} onRetry={fetchRefunds} />
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
              <Card key={refund._id} className="p-5 hover:shadow-md transition-shadow border border-gray-100">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-2 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-bold text-text">
                        {formatCurrency(refund.amount)}
                      </span>
                      {refund.refundCode && (
                        <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted">
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

                  <div className="flex flex-wrap items-center gap-2 pt-2 lg:pt-0 border-t lg:border-t-0 border-gray-100">
                    {renderActions(refund)}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default RefundsPanel;

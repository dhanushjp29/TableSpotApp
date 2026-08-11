import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { FileWarning, RotateCcw } from "lucide-react";

import { fetchRefunds } from "../../store/slices/refundSlice.js";
import { fetchRestaurants } from "../../store/slices/restaurantSlice.js";

import Badge from "../ui/Badge.jsx";
import Button from "../ui/Button.jsx";
import Card from "../ui/Card.jsx";
import EmptyState from "../ui/EmptyState.jsx";
import ErrorState from "../ui/ErrorState.jsx";
import { SkeletonText } from "../ui/Skeleton.jsx";
import RestaurantFilter from "../owner/RestaurantFilter.jsx";
import WarningIssueModal from "./WarningIssueModal.jsx";
import { formatCurrency } from "../../utils/formatCurrency.js";

const DAY_MS = 24 * 60 * 60 * 1000;

const STATUS_VARIANT = {
  REFUND_PENDING: "warning",
  REFUND_PROCESSING: "info",
  REFUND_AWAITING_CUSTOMER_CONFIRMATION: "info",
  REFUND_OVERDUE: "danger",
  REFUND_FAILED: "danger",
  REFUND_DISPUTED: "danger",
};

const STATUS_LABEL = {
  REFUND_PENDING: "Pending",
  REFUND_PROCESSING: "Processing",
  REFUND_AWAITING_CUSTOMER_CONFIRMATION: "Awaiting Confirmation",
  REFUND_OVERDUE: "Overdue",
  REFUND_FAILED: "Failed",
  REFUND_DISPUTED: "Disputed",
};

const daysPending = (date) =>
  date
    ? Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / DAY_MS))
    : 0;

export default function AdminRefundsSection() {
  const dispatch = useDispatch();
  const refunds = useSelector((state) => state.refund.refunds);
  const isLoading = useSelector((state) => state.refund.isLoading);
  const error = useSelector((state) => state.refund.error);
  const restaurants = useSelector((state) => state.restaurant.restaurants);
  const [selectedRestaurant, setSelectedRestaurant] = useState("");
  const [warnTarget, setWarnTarget] = useState(null);

  useEffect(() => {
    dispatch(fetchRestaurants({ limit: 100 })).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    dispatch(
      fetchRefunds({
        limit: 100,
        notRefunded: true,
        ...(selectedRestaurant ? { restaurantId: selectedRestaurant } : {}),
      })
    ).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRestaurant]);

  const reloadRefunds = () =>
    dispatch(
      fetchRefunds({
        limit: 100,
        notRefunded: true,
        ...(selectedRestaurant ? { restaurantId: selectedRestaurant } : {}),
      })
    ).catch(() => {});

  const totalPendingAmount = useMemo(
    () => refunds.reduce((sum, r) => sum + Number(r.amount || 0), 0),
    [refunds]
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-text flex items-center gap-2">
          <RotateCcw className="text-blue-600" size={22} />
          Refund Monitoring
        </h2>
        <p className="text-sm text-muted">
          Pending / un-refunded amounts with days pending — issue a warning
          against a restaurant that is not refunding customers
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <RestaurantFilter
          restaurants={restaurants}
          value={selectedRestaurant}
          onChange={setSelectedRestaurant}
          className="w-full sm:w-72"
        />
        <Card className="p-4 border-l-4 border-l-blue-500">
          <p className="text-xs uppercase font-medium tracking-wider text-muted">
            Total Pending Refunds
          </p>
          <p className="text-2xl font-bold text-text">
            {formatCurrency(totalPendingAmount)}
          </p>
          <p className="text-xs text-muted">
            {refunds.length} record{refunds.length === 1 ? "" : "s"} not yet
            refunded
          </p>
        </Card>
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
        <ErrorState title="Unable to load refunds" description={error} />
      ) : refunds.length === 0 ? (
        <Card className="p-8">
          <EmptyState
            title="No pending refunds"
            description="All refunds have been settled for the selected filter."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {refunds.map((refund) => {
            const status = refund.refundStatus;
            const days = daysPending(refund.requestedAt || refund.createdAt);
            return (
              <Card key={refund._id} className="p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted">
                        {refund.refundCode}
                      </span>
                      <Badge variant={STATUS_VARIANT[status] || "warning"}>
                        {STATUS_LABEL[status] || status}
                      </Badge>
                      <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                        {days} day{days === 1 ? "" : "s"} pending
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-text">
                      {refund.restaurantId?.restaurantName || "Restaurant"}
                      {refund.restaurantId?.city
                        ? ` (${refund.restaurantId.city})`
                        : ""}
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      {formatCurrency(refund.amount)} • {refund.reason || "Refund"}
                    </p>
                    <p className="text-xs text-muted">
                      Booking {refund.bookingId?.bookingCode || "-"} • Customer:{" "}
                      {refund.customerId?.fullName || "-"} • Requested{" "}
                      {refund.requestedAt
                        ? new Date(refund.requestedAt).toLocaleDateString()
                        : "-"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-amber-600 border-amber-200 hover:bg-amber-50"
                      onClick={() => setWarnTarget(refund)}
                    >
                      <FileWarning size={14} className="mr-1" /> Warn
                    </Button>
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
        restaurant={warnTarget?.restaurantId}
        onIssued={() => {
          setWarnTarget(null);
          reloadRefunds();
        }}
      />
    </div>
  );
}

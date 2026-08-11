import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useDispatch, useSelector } from "react-redux";
import { FileWarning, ShieldAlert, ShieldCheck } from "lucide-react";

import {
  fetchWarnings,
  replyToWarning,
  updateWarning,
} from "../../store/slices/reportSlice.js";
import { fetchRestaurants } from "../../store/slices/restaurantSlice.js";

import Badge from "../ui/Badge.jsx";
import Button from "../ui/Button.jsx";
import Card from "../ui/Card.jsx";
import EmptyState from "../ui/EmptyState.jsx";
import ErrorState from "../ui/ErrorState.jsx";
import { SkeletonText } from "../ui/Skeleton.jsx";
import RestaurantFilter from "../owner/RestaurantFilter.jsx";
import WarningReportPanel from "../warning/WarningReportPanel.jsx";

const STATUS_VARIANT = {
  ACTIVE: "danger",
  EXPIRED: "default",
  CLEARED: "success",
};

const LEVEL_VARIANT = {
  "Level 1": "warning",
  "Level 2": "info",
  "Final Warning": "danger",
};

export default function AdminWarningsSection() {
  const dispatch = useDispatch();
  const warnings = useSelector((state) => state.report.warnings);
  const isLoading = useSelector((state) => state.report.isLoading);
  const error = useSelector((state) => state.report.error);
  const restaurants = useSelector((state) => state.restaurant.restaurants);
  const [selectedRestaurant, setSelectedRestaurant] = useState("");
  const [replyText, setReplyText] = useState({});
  const [sendingReply, setSendingReply] = useState(null);
  const [clearing, setClearing] = useState(null);

  useEffect(() => {
    dispatch(fetchRestaurants({ limit: 100 })).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    dispatch(
      fetchWarnings({
        ...(selectedRestaurant ? { restaurantId: selectedRestaurant } : {}),
        limit: 100,
      })
    ).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRestaurant]);

  const visibleWarnings = useMemo(() => {
    if (!selectedRestaurant) return warnings;
    return warnings.filter(
      (w) => String(w.restaurantId?._id) === selectedRestaurant
    );
  }, [warnings, selectedRestaurant]);

  const reloadWarnings = () =>
    dispatch(
      fetchWarnings({
        ...(selectedRestaurant ? { restaurantId: selectedRestaurant } : {}),
        limit: 100,
      })
    ).catch(() => {});

  const handleReply = async (warning) => {
    const message = (replyText[warning._id] || "").trim();
    if (!message) {
      toast.error("Type a reply first.");
      return;
    }
    setSendingReply(warning._id);
    try {
      await dispatch(replyToWarning(warning._id, message));
      toast.success("Reply sent to the owner.");
      setReplyText((prev) => ({ ...prev, [warning._id]: "" }));
      reloadWarnings();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to send reply.");
    } finally {
      setSendingReply(null);
    }
  };

  const handleClear = async (warning) => {
    setClearing(warning._id);
    try {
      await dispatch(
        updateWarning(warning._id, {
          status: "CLEARED",
          clearedReason: "Closed by admin",
        })
      );
      toast.success("Warning cleared.");
      reloadWarnings();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to clear warning.");
    } finally {
      setClearing(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-text flex items-center gap-2">
          <FileWarning className="text-amber-600" size={22} />
          Restaurant Warnings
        </h2>
        <p className="text-sm text-muted">
          Track issued warnings, read owner replies, reply back, or clear a
          warning early
        </p>
      </div>

      <RestaurantFilter
        restaurants={restaurants}
        value={selectedRestaurant}
        onChange={setSelectedRestaurant}
        className="w-full sm:w-72"
      />

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-4">
              <SkeletonText lines={3} />
            </Card>
          ))}
        </div>
      ) : error ? (
        <ErrorState title="Unable to load warnings" description={error} />
      ) : visibleWarnings.length === 0 ? (
        <Card className="p-8">
          <EmptyState
            title="No warnings"
            description="No restaurant warnings match the current filter."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {visibleWarnings.map((warning) => (
            <Card key={warning._id} className="p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-text">
                      {warning.title || warning.warningCode}
                    </h3>
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted">
                      {warning.warningCode}
                    </span>
                    <Badge variant={LEVEL_VARIANT[warning.level] || "default"}>
                      {warning.level}
                    </Badge>
                    <Badge
                      variant={STATUS_VARIANT[warning.status] || "default"}
                      className="capitalize"
                    >
                      {warning.status === "ACTIVE"
                        ? "Active"
                        : warning.status === "EXPIRED"
                          ? "Expired"
                          : "Cleared"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted">
                    Restaurant: {warning.restaurantId?.restaurantName || "-"}
                    {warning.restaurantId?.city ? ` (${warning.restaurantId.city})` : ""}
                  </p>
                  {warning.reason && (
                    <p className="text-sm text-text/80">{warning.reason}</p>
                  )}
                  <p className="text-xs text-muted">
                    Issued{" "}
                    {warning.issuedAt
                      ? new Date(warning.issuedAt).toLocaleDateString()
                      : "-"}{" "}
                    • Expires{" "}
                    {warning.expiresAt
                      ? new Date(warning.expiresAt).toLocaleDateString()
                      : "-"}
                  </p>
                </div>
                {warning.status === "ACTIVE" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-green-600 border-green-200 hover:bg-green-50"
                    onClick={() => handleClear(warning)}
                    isLoading={clearing === warning._id}
                  >
                    <ShieldCheck size={14} className="mr-1" /> Clear
                  </Button>
                )}
              </div>

              <WarningReportPanel report={warning.relatedReportId} />

              <div className="mt-4 border-t border-border pt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
                  Conversation ({(warning.replies || []).length})
                </p>
                {(warning.replies || []).length === 0 ? (
                  <p className="text-sm text-muted">No replies yet.</p>
                ) : (
                  <div className="space-y-2">
                    {(warning.replies || []).map((reply) => (
                      <div
                        key={reply._id || reply.createdAt}
                        className={`rounded-lg border p-3 text-sm ${
                          reply.role === "owner"
                            ? "border-border bg-muted/20"
                            : "border-primary/20 bg-primary/5"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-text">
                            {reply.fullName ||
                              (reply.role === "owner"
                                ? "Restaurant Owner"
                                : reply.role === "customer"
                                  ? "Customer"
                                  : "TableSpot Admin")}
                            <span className="ml-2 text-xs font-medium text-muted capitalize">
                              {reply.role}
                            </span>
                          </p>
                          <p className="text-xs text-muted">
                            {reply.createdAt
                              ? new Date(reply.createdAt).toLocaleString()
                              : ""}
                          </p>
                        </div>
                        <p className="mt-1 text-text/80">{reply.message}</p>
                      </div>
                    ))}
                  </div>
                )}

                {warning.status === "ACTIVE" && (
                  <div className="mt-3 flex gap-2">
                    <textarea
                      rows={2}
                      value={replyText[warning._id] || ""}
                      onChange={(e) =>
                        setReplyText((prev) => ({
                          ...prev,
                          [warning._id]: e.target.value,
                        }))
                      }
                      placeholder="Reply to the restaurant owner..."
                      maxLength={1000}
                      className="input-field w-full"
                    />
                    <Button
                      type="button"
                      size="sm"
                      className="self-end"
                      onClick={() => handleReply(warning)}
                      isLoading={sendingReply === warning._id}
                    >
                      <ShieldAlert size={14} className="mr-1" /> Reply
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

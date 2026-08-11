import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import toast from "react-hot-toast";
import { FileWarning, ShieldAlert, ShieldCheck, XCircle } from "lucide-react";

import { fetchWarnings, replyToWarning } from "../../store/slices/reportSlice.js";
import { fetchRestaurants } from "../../store/slices/restaurantSlice.js";

import Badge from "../../components/ui/Badge.jsx";
import Card from "../../components/ui/Card.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import ErrorState from "../../components/ui/ErrorState.jsx";
import { SkeletonText } from "../../components/ui/Skeleton.jsx";
import RestaurantFilter from "../../components/owner/RestaurantFilter.jsx";
import WarningConversation from "../../components/warning/WarningConversation.jsx";
import WarningReportPanel from "../../components/warning/WarningReportPanel.jsx";

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

export default function OwnerWarningsPage() {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const warnings = useSelector((state) => state.report.warnings);
  const warningCounts = useSelector((state) => state.report.warningCounts);
  const isLoading = useSelector((state) => state.report.isLoading);
  const error = useSelector((state) => state.report.error);
  const restaurants = useSelector((state) => state.restaurant.restaurants);
  const [selectedRestaurant, setSelectedRestaurant] = useState("");

  const userId = user?._id || user?.id;

  useEffect(() => {
    if (userId) {
      dispatch(fetchRestaurants({ ownerId: userId, isActive: true })).catch(
        () => {}
      );
    }
    dispatch(
      fetchWarnings({
        ...(selectedRestaurant ? { restaurantId: selectedRestaurant } : {}),
        limit: 50,
      })
    ).catch(() => {});
  }, [dispatch, userId, selectedRestaurant]);

  const activeCount = useMemo(
    () =>
      warnings.filter((w) => w.status === "ACTIVE").length,
    [warnings]
  );

  const reloadWarnings = () =>
    dispatch(
      fetchWarnings({
        ...(selectedRestaurant ? { restaurantId: selectedRestaurant } : {}),
        limit: 50,
      })
    ).catch(() => {});

  const handleReply = async (warning, message) => {
    await dispatch(replyToWarning(warning._id, message));
    toast.success("Reply sent to the admin.");
    reloadWarnings();
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text flex items-center gap-2">
          <ShieldAlert className="text-primary" size={24} />
          Restaurant Warnings
        </h1>
        <p className="text-sm text-muted">
          Warnings issued against your restaurants by the TableSpot admin team
        </p>
      </div>

      <RestaurantFilter
        restaurants={restaurants}
        value={selectedRestaurant}
        onChange={setSelectedRestaurant}
      />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="p-5 flex items-center gap-4 border-l-4 border-l-red-500">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/10 text-red-600">
            <ShieldAlert size={24} />
          </div>
          <div>
            <p className="text-xs uppercase font-medium tracking-wider text-muted">
              Active Warnings
            </p>
            <p className="text-2xl font-bold text-text">
              {warningCounts?.ACTIVE ?? activeCount}
            </p>
          </div>
        </Card>
        <Card className="p-5 flex items-center gap-4 border-l-4 border-l-amber-500">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
            <XCircle size={24} />
          </div>
          <div>
            <p className="text-xs uppercase font-medium tracking-wider text-muted">
              Expired
            </p>
            <p className="text-2xl font-bold text-text">
              {warningCounts?.EXPIRED ?? 0}
            </p>
          </div>
        </Card>
        <Card className="p-5 flex items-center gap-4 border-l-4 border-l-green-500">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-500/10 text-green-600">
            <ShieldCheck size={24} />
          </div>
          <div>
            <p className="text-xs uppercase font-medium tracking-wider text-muted">
              Cleared
            </p>
            <p className="text-2xl font-bold text-text">
              {warningCounts?.CLEARED ?? 0}
            </p>
          </div>
        </Card>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-4">
              <SkeletonText lines={2} />
            </Card>
          ))}
        </div>
      ) : error ? (
        <ErrorState title="Unable to load warnings" description={error} />
      ) : warnings.length === 0 ? (
        <Card className="p-8">
          <EmptyState
            title="No warnings issued"
            description="Your restaurants are in good standing with the platform."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {warnings.map((warning) => (
            <Card
              key={warning._id}
              className="p-5 transition-shadow hover:shadow-md"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <FileWarning
                      size={16}
                      className="text-amber-600"
                    />
                    <h3 className="font-bold text-text">
                      {warning.title || warning.warningCode}
                    </h3>
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted">
                      {warning.warningCode}
                    </span>
                  </div>
                  <p className="text-sm text-muted">
                    Restaurant: {warning.restaurantId?.restaurantName || "-"}
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
                <div className="flex items-center gap-2">
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
              </div>

              <WarningReportPanel report={warning.relatedReportId} />

              <WarningConversation
                warning={warning}
                canReply={warning.status === "ACTIVE"}
                onReply={(message) => handleReply(warning, message)}
              />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
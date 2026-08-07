import { useEffect, useState } from "react";
import { Bell, BellRing, CheckCheck, HandCoins, MessageSquareWarning } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import toast from "react-hot-toast";

import {
  fetchNotifications,
  fetchNotificationsMore,
  fetchUnreadCount,
  markAllAsRead,
  markAsReadNotification,
} from "../../store/slices/notificationSlice.js";
import { confirmRefundReceipt, disputeRefund, fetchRefundById } from "../../store/slices/refundSlice.js";
import Card from "../../components/ui/Card.jsx";
import Button from "../../components/ui/Button.jsx";
import Badge from "../../components/ui/Badge.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import ErrorState from "../../components/ui/ErrorState.jsx";
import { SkeletonText } from "../../components/ui/Skeleton.jsx";

const REFUND_AWAITING = "REFUND_AWAITING_CUSTOMER_CONFIRMATION";

const TYPE_VARIANT = {
  System: "info",
  Booking: "primary",
  Offer: "success",
  "Restaurant Review": "warning",
  "Food Review": "warning",
  Payment: "success",
  Alert: "warning",
};

const timeAgo = (date) => {
  if (!date) return "";
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min${minutes > 1 ? "s" : ""} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr${hours > 1 ? "s" : ""} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days > 1 ? "s" : ""} ago`;
  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const notifyLayout = () => {
  window.dispatchEvent(new Event("notifications-updated"));
};

function NotificationsPage() {
  const dispatch = useDispatch();
  const notifications = useSelector((state) => state.notification.notifications);
  const meta = useSelector((state) => state.notification.meta) || {
    page: 1,
    totalPages: 1,
    total: 0,
  };
  const unreadCount = useSelector((state) => state.notification.unreadCount);
  const error = useSelector((state) => state.notification.error);
  const [filter, setFilter] = useState("all");
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [refundStatuses, setRefundStatuses] = useState({});
  const [processingRefund, setProcessingRefund] = useState("");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        await dispatch(
          fetchNotifications({
            page: 1,
            limit: 15,
            unreadOnly: filter === "unread",
          })
        );
      } catch {
        // error surfaces via state.notification.error
      } finally {
        if (!cancelled) setIsInitialLoading(false);
      }
    };

    load();
    dispatch(fetchUnreadCount()).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [dispatch, filter]);

  useEffect(() => {
    let cancelled = false;

    const refundNotifications = notifications.filter(
      (item) => item.linkModel === "Refund" && item.linkId
    );

    refundNotifications.forEach(async (item) => {
      try {
        const res = await dispatch(fetchRefundById(item.linkId));
        if (!cancelled) {
          setRefundStatuses((prev) => ({
            ...prev,
            [item._id]: res?.data?.refund?.refundStatus || "",
          }));
        }
      } catch {
        // Refund may be deleted or inaccessible; leave status unknown.
      }
    });

    return () => {
      cancelled = true;
    };
  }, [dispatch, notifications]);

  const handleMarkRead = async (notification) => {
    if (notification.isRead) return;

    try {
      await dispatch(markAsReadNotification(notification._id));
      notifyLayout();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to update notification.");
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await dispatch(markAllAsRead());
      notifyLayout();
      toast.success("All notifications marked as read.");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to mark notifications as read.");
    }
  };

  const handleConfirmRefund = async (notification) => {
    if (!window.confirm("I received the refund in cash. Confirm receipt?")) return;
    setProcessingRefund(notification._id);
    try {
      await dispatch(confirmRefundReceipt(notification.linkId));
      setRefundStatuses((prev) => ({ ...prev, [notification._id]: "REFUNDED" }));
      toast.success("Refund receipt confirmed. Thank you!");
      if (!notification.isRead) {
        await dispatch(markAsReadNotification(notification._id));
        notifyLayout();
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to confirm refund.");
    } finally {
      setProcessingRefund("");
    }
  };

  const handleDisputeRefund = async (notification) => {
    const reason = window.prompt(
      "Please tell us why you did not receive this refund (at least 5 characters):"
    );
    if (reason === null) return;
    const trimmed = String(reason || "").trim();
    if (trimmed.length < 5) {
      toast.error("A dispute reason of at least 5 characters is required.");
      return;
    }
    setProcessingRefund(notification._id);
    try {
      await dispatch(disputeRefund(notification.linkId, trimmed));
      setRefundStatuses((prev) => ({ ...prev, [notification._id]: "REFUND_DISPUTED" }));
      toast.success("Refund disputed. The restaurant has been notified.");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to dispute refund.");
    } finally {
      setProcessingRefund("");
    }
  };

  const handleLoadMore = async () => {
    setIsLoadingMore(true);
    try {
      await dispatch(
        fetchNotificationsMore({
          page: meta.page + 1,
          limit: 15,
          unreadOnly: filter === "unread",
        })
      );
    } catch {
      // error surfaces via state.notification.error
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleFilterChange = (nextFilter) => {
    setFilter(nextFilter);
    setIsInitialLoading(true);
  };

  if (isInitialLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="p-4">
              <SkeletonText lines={2} />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error && notifications.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
        <ErrorState title="Unable to load notifications" description={error} />
      </div>
    );
  }

  const hasUnread = notifications.some((item) => !item.isRead);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text flex items-center gap-2">
            <Bell size={24} className="text-primary" />
            Notifications
            {unreadCount > 0 && (
              <Badge variant="error" className="ml-1">
                {unreadCount} new
              </Badge>
            )}
          </h1>
          <p className="text-sm text-muted">Stay updated with role-based activity</p>
        </div>

        {hasUnread && (
          <Button variant="outline" size="sm" onClick={handleMarkAllRead}>
            <CheckCheck size={16} className="mr-1.5" />
            Mark all as read
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2">
        {[
          { value: "all", label: "All" },
          { value: "unread", label: "Unread" },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => handleFilterChange(tab.value)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === tab.value
                ? "bg-primary text-white"
                : "bg-gray-100 text-muted hover:bg-gray-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {notifications.length === 0 ? (
        <EmptyState
          title={filter === "unread" ? "No unread notifications" : "No notifications yet"}
          description={
            filter === "unread"
              ? "You have read all your notifications."
              : "Notifications about bookings, approvals and reviews will appear here."
          }
        />
      ) : (
        <>
          <div className="space-y-3">
            {notifications.map((notification) => (
              <Card
                key={notification._id}
                className={`p-4 flex items-start gap-4 transition-colors cursor-pointer ${
                  notification.isRead ? "hover:bg-gray-50" : "bg-primary/[0.03] hover:bg-primary/[0.06]"
                }`}
                onClick={() => handleMarkRead(notification)}
              >
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                    notification.isRead
                      ? "bg-gray-100 text-muted"
                      : "bg-primary/10 text-primary"
                  }`}
                >
                  {notification.isRead ? <Bell size={18} /> : <BellRing size={18} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-semibold text-text text-sm truncate">
                      {notification.title}
                    </h4>
                    <span className="text-xs text-muted whitespace-nowrap">
                      {timeAgo(notification.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs text-muted mt-1">{notification.message}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge variant={TYPE_VARIANT[notification.type] || "neutral"}>
                      {notification.type}
                    </Badge>
                    {!notification.isRead && (
                      <Badge variant="primary">New</Badge>
                    )}
                  </div>

                  {notification.linkModel === "Refund" &&
                    refundStatuses[notification._id] === REFUND_AWAITING && (
                      <div
                        className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <div className="flex-1 min-w-[220px]">
                          <p className="text-xs font-semibold text-amber-800">
                            Confirm your refund receipt
                          </p>
                          <p className="text-[11px] text-amber-700">
                            Did you receive the refund? Your confirmation closes
                            this request.
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="primary"
                            isLoading={processingRefund === notification._id}
                            onClick={() => handleConfirmRefund(notification)}
                          >
                            <HandCoins size={14} className="mr-1" />
                            I received it in cash
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 border-red-200 hover:bg-red-50"
                            onClick={() => handleDisputeRefund(notification)}
                          >
                            <MessageSquareWarning size={14} className="mr-1" />
                            I didn't receive it
                          </Button>
                        </div>
                      </div>
                    )}

                  {notification.linkModel === "Refund" &&
                    refundStatuses[notification._id] &&
                    refundStatuses[notification._id] !== REFUND_AWAITING && (
                      <div className="mt-3">
                        <Badge variant="info">
                          Refund status: {refundStatuses[notification._id]}
                        </Badge>
                      </div>
                    )}
                </div>
              </Card>
            ))}
          </div>

          {meta.page < meta.totalPages && (
            <div className="flex justify-center pt-2">
              <Button variant="outline" isLoading={isLoadingMore} onClick={handleLoadMore}>
                Load more
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default NotificationsPage;

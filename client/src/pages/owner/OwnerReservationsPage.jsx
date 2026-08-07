import { useEffect, useState } from "react";
import {
  Calendar,
  Users,
  Search,
  CheckCircle,
  XCircle,
  UserCheck,
  Utensils,
  Filter,
  HandCoins,
  Banknote,
  UserX,
  ReceiptText,
} from "lucide-react";
import toast from "react-hot-toast";

import { bookingApi } from "../../api/booking.api.js";
import { billApi } from "../../api/bill.api.js";
import { refundApi } from "../../api/refund.api.js";
import { useAuth } from "../../hooks/useAuth.js";
import Card from "../../components/ui/Card.jsx";
import Badge from "../../components/ui/Badge.jsx";
import Button from "../../components/ui/Button.jsx";
import { SkeletonText } from "../../components/ui/Skeleton.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import ErrorState from "../../components/ui/ErrorState.jsx";
import { formatDate, formatTime } from "../../utils/formatDate.js";

const REFUND_BADGE = {
  REFUND_PENDING: { label: "Refund pending", variant: "warning" },
  REFUND_PROCESSING: { label: "Refund processing", variant: "info" },
  REFUND_AWAITING_CUSTOMER_CONFIRMATION: {
    label: "Awaiting customer confirmation",
    variant: "warning",
  },
  REFUNDED: { label: "Refunded", variant: "success" },
  REFUND_OVERDUE: { label: "Refund overdue", variant: "error" },
  REFUND_FAILED: { label: "Refund failed", variant: "error" },
  REFUND_DISPUTED: { label: "Refund disputed", variant: "error" },
};

export default function OwnerReservationsPage() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [processingRefundId, setProcessingRefundId] = useState("");

  const fetchReservations = async () => {
    try {
      const res = await bookingApi.getAll();
      setBookings(res?.data?.bookings || res?.bookings || []);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load reservations.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    bookingApi
      .getAll()
      .then((res) => {
        if (isMounted) {
          setBookings(res?.data?.bookings || res?.bookings || []);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err?.response?.data?.message || "Failed to load reservations.");
          setIsLoading(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleUpdateStatus = async (bookingId, status) => {
    try {
      if (status === "Confirmed") {
        await bookingApi.updateStatus(bookingId, { bookingStatus: "Confirmed" });
      } else if (status === "Checked-In") {
        await bookingApi.checkIn(bookingId);
      } else if (status === "Completed") {
        await bookingApi.complete(bookingId);
      } else if (status === "Cancelled") {
        await bookingApi.cancel(bookingId);
      }
      toast.success(`Reservation marked as ${status}`);
      fetchReservations();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to update reservation status.");
    }
  };

  const handleProcessRefund = async (booking, refundMethod) => {
    setProcessingRefundId(booking._id);
    const isCash = refundMethod === "Cash";
    const confirmMessage = isCash
      ? "Mark this refund as issued in cash? The customer will be asked to confirm receipt."
      : "Process this refund to the customer's payment method (Razorpay)?";
    if (!window.confirm(confirmMessage)) {
      setProcessingRefundId("");
      return;
    }
    try {
      await refundApi.process(booking.refundId, refundMethod);
      toast.success(isCash ? "Refund marked as issued in cash." : "Refund processed successfully.");
      fetchReservations();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to process refund.");
    } finally {
      setProcessingRefundId("");
    }
  };

  const handleConvertToBill = async (booking) => {
    if (
      !window.confirm(
        `Convert ${booking.bookingCode || "this booking"} to a bill?\nPre-ordered items and the online advance will be carried over.`
      )
    ) {
      return;
    }
    try {
      await billApi.convertToBill(booking._id);
      toast.success("Bill created from booking successfully.");
      fetchReservations();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to create bill.");
    }
  };

  const handleMarkNoShow = async (booking) => {
    const remarks = window.prompt(
      `Mark ${booking.bookingCode || "this booking"} as No-Show?\nPlease enter mandatory remarks (at least 5 characters):`
    );
    if (remarks === null) return;
    if (!remarks || remarks.trim().length < 5) {
      toast.error("Remarks are required (minimum 5 characters).");
      return;
    }
    try {
      await bookingApi.markNoShow(booking._id, remarks.trim());
      toast.success("Booking marked as no-show.");
      fetchReservations();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to mark booking as no-show.");
    }
  };

  const filteredBookings = bookings.filter((b) => {
    if (statusFilter !== "ALL" && b.bookingStatus !== statusFilter) return false;
    if (search) {
      const customerName = b.userId?.fullName?.toLowerCase() || "";
      const bookingId = b._id?.toLowerCase() || "";
      return customerName.includes(search.toLowerCase()) || bookingId.includes(search.toLowerCase());
    }
    return true;
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
      {user?.bookingStatus === "BOOKING_RESTRICTED" && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <span className="mt-0.5 shrink-0 font-bold">!</span>
          <div>
            <p className="font-semibold">New bookings are restricted</p>
            <p className="text-red-700">
              Your restaurant is not accepting new bookings until all unresolved
              refunds are settled. You can still manage existing bookings.
              Process refunds under{" "}
              <span className="font-semibold">Refunds</span> to lift the
              restriction.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text">Reservation Management</h1>
          <p className="text-sm text-muted">View, accept, and update incoming customer table bookings</p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-surface p-4 rounded-xl border border-gray-100 shadow-sm">
        <div className="relative flex-1 w-full">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Search by customer name or Booking ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-10 w-full"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          <Filter size={16} className="text-muted shrink-0 ml-1" />
          {["ALL", "Pending", "Confirmed", "Checked-In", "Completed", "Cancelled"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg shrink-0 transition-all ${
                statusFilter === st
                  ? "bg-primary text-white"
                  : "bg-gray-100 text-muted hover:bg-gray-200"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Reservations List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-5">
              <SkeletonText lines={3} />
            </Card>
          ))}
        </div>
      ) : error ? (
        <ErrorState title="Unable to load reservations" description={error} onRetry={fetchReservations} />
      ) : filteredBookings.length === 0 ? (
        <EmptyState title="No reservations found" description="No customer bookings match your current criteria." />
      ) : (
        <div className="space-y-4">
          {filteredBookings.map((b) => {
            const bDate = b.bookingDateTime ? new Date(b.bookingDateTime) : null;
            const customer = typeof b.userId === "object" ? b.userId : null;
            const table = typeof b.tableId === "object" ? b.tableId : null;
            const bookingTableDocs =
              Array.isArray(b.tables) && b.tables.length
                ? b.tables.map((entry) => entry.tableId).filter(Boolean)
                : table
                  ? [table]
                  : [];

            return (
              <Card key={b._id} className="p-5 hover:shadow-md transition-shadow border border-gray-100">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-bold text-text">
                        {customer?.name || "Guest Customer"}
                      </h3>
                      {b.bookingCode && (
                        <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted">
                          {b.bookingCode}
                        </span>
                      )}
                      <Badge
                        variant={
                          b.bookingStatus === "Confirmed"
                            ? "success"
                            : b.bookingStatus === "Checked-In"
                            ? "info"
                            : b.bookingStatus === "Completed"
                            ? "success"
                            : b.bookingStatus === "Cancelled"
                            ? "danger"
                            : "warning"
                        }
                      >
                        {b.bookingStatus}
                      </Badge>
                      {b.refundId &&
                        b.refundStatus &&
                        REFUND_BADGE[b.refundStatus] && (
                          <Badge variant={REFUND_BADGE[b.refundStatus].variant}>
                            {REFUND_BADGE[b.refundStatus].label}
                          </Badge>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm text-muted">
                      {bDate && (
                        <div className="flex items-center gap-1.5">
                          <Calendar size={15} className="text-primary" />
                          <span>{formatDate(bDate)} at {formatTime(bDate)}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5">
                        <Users size={15} className="text-primary" />
                        <span>{b.numberOfGuests} Guests</span>
                      </div>
                      {bookingTableDocs.length > 0 && (
                        <div className="flex items-center gap-1.5 font-medium text-text">
                          <Utensils size={15} className="text-primary" />
                          <span>
                            {bookingTableDocs
                              .map(
                                (t) =>
                                  `${t.tableCode || `Table #${t.tableNumber || t._id?.slice(-4)}`}${t.tableCode && t.tableNumber ? ` (Table ${t.tableNumber})` : ""}`
                              )
                              .join(", ")}
                          </span>
                        </div>
                      )}
                    </div>

                    {customer?.phone && (
                      <p className="text-xs text-muted">Contact: {customer.phone} | Email: {customer.email}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2 pt-2 lg:pt-0 border-t lg:border-t-0 border-gray-100">
                    {b.bookingStatus === "Pending" && (
                      <>
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => handleUpdateStatus(b._id, "Confirmed")}
                        >
                          <CheckCircle size={15} className="mr-1" />
                          Confirm
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => handleUpdateStatus(b._id, "Cancelled")}
                        >
                          <XCircle size={15} className="mr-1" />
                          Reject
                        </Button>
                      </>
                    )}

                    {b.bookingStatus === "Confirmed" && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleUpdateStatus(b._id, "Checked-In")}
                      >
                        <UserCheck size={15} className="mr-1" />
                        Check In
                      </Button>
                    )}

                    {(b.bookingStatus === "Confirmed" ||
                      b.bookingStatus === "Pending") && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 border-red-200 hover:bg-red-50"
                        onClick={() => handleMarkNoShow(b)}
                      >
                        <UserX size={15} className="mr-1" />
                        Mark No-Show
                      </Button>
                    )}

                    {b.bookingStatus === "Checked-In" && (
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => handleUpdateStatus(b._id, "Completed")}
                      >
                        <CheckCircle size={15} className="mr-1" />
                        Mark Complete
                      </Button>
                    )}

                    {(b.bookingStatus === "Confirmed" ||
                      b.bookingStatus === "Checked-In") && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleConvertToBill(b)}
                      >
                        <ReceiptText size={15} className="mr-1" />
                        Convert to Bill
                      </Button>
                    )}

                    {b.refundId &&
                      b.refundStatus === "REFUND_PENDING" && (
                        <>
                          <Button
                            size="sm"
                            variant="secondary"
                            isLoading={processingRefundId === b._id}
                            onClick={() => handleProcessRefund(b, "Cash")}
                          >
                            <Banknote size={15} className="mr-1" />
                            Refund in Cash
                          </Button>
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => handleProcessRefund(b, "RAZORPAY")}
                          >
                            <HandCoins size={15} className="mr-1" />
                            Refund Online
                          </Button>
                        </>
                      )}

                    {b.refundId &&
                      b.refundStatus === "REFUND_AWAITING_CUSTOMER_CONFIRMATION" && (
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-700">
                          <Banknote size={14} />
                          Cash refund — awaiting customer confirmation
                        </span>
                      )}
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

import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Calendar,
  Users,
  Search,
  Filter,
  HandCoins,
  Banknote,
  UserX,
  ReceiptText,
  CheckCircle2,
  CircleDollarSign,
  RotateCcw,
  Building2,
  Armchair,
} from "lucide-react";
import toast from "react-hot-toast";

import { fetchBookings, markNoShow } from "../../store/slices/reservationSlice.js";
import {
  convertBookingToBill,
} from "../../store/slices/billSlice.js";
import {
  fetchRefundById,
  processRefund,
} from "../../store/slices/refundSlice.js";
import { REFUND_METHOD, REFUND_METHOD_LABELS } from "../../constants/refund.js";
import RefundMethodSelector from "../../components/payment/RefundMethodSelector.jsx";
import { useAuth } from "../../hooks/useAuth.js";
import { subscribeToBookingUpdates } from "../../services/socket/socketService.js";
import Card from "../../components/ui/Card.jsx";
import Badge from "../../components/ui/Badge.jsx";
import Button from "../../components/ui/Button.jsx";
import Modal from "../../components/ui/Modal.jsx";
import { SkeletonCard } from "../../components/ui/Skeleton.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import ErrorState from "../../components/ui/ErrorState.jsx";
import { formatDate, formatDateTime, formatTime } from "../../utils/formatDate.js";
import { formatCurrency } from "../../utils/formatCurrency.js";
import RestaurantFilter from "../../components/owner/RestaurantFilter.jsx";
import { fetchRestaurants } from "../../store/slices/restaurantSlice.js";

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

const SUMMARY_CARDS = [
  { key: "total", label: "Total reservations", icon: Calendar, tone: "text-primary bg-primary/10" },
  { key: "confirmed", label: "Confirmed", icon: CheckCircle2, tone: "text-emerald-600 bg-emerald-500/10" },
  { key: "completed", label: "Completed", icon: CircleDollarSign, tone: "text-sky-600 bg-sky-500/10" },
  { key: "refunds", label: "Refunds linked", icon: RotateCcw, tone: "text-amber-600 bg-amber-500/10" },
];

export default function OwnerReservationsPage() {
  const { user } = useAuth();
  const dispatch = useDispatch();
  const bookings = useSelector((state) => state.reservation.bookings);
  const isLoading = useSelector((state) => state.reservation.isLoading);
  const loadError = useSelector((state) => state.reservation.error);
  const refundPreview = useSelector((state) => state.refund.currentRefund);
  const refundPreviewLoading = useSelector((state) => state.refund.isLoading);
  const restaurants = useSelector((state) => state.restaurant.restaurants);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [actionDialog, setActionDialog] = useState(null);
  const [actionNotes, setActionNotes] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [actionRefundMethod, setActionRefundMethod] = useState(REFUND_METHOD.CASH);
  const [selectedRestaurant, setSelectedRestaurant] = useState("");

  // No-Show requires mandatory remarks — captured in a Modal, never a
  // window.prompt.
  const [noShowBooking, setNoShowBooking] = useState(null);
  const [noShowRemarks, setNoShowRemarks] = useState("");
  const [noShowBusy, setNoShowBusy] = useState(false);

  // Rich reservation details (tables, pre-ordered items, advance, refund).
  const [detailsBooking, setDetailsBooking] = useState(null);

  // Re-armed "now" so the Convert-to-Bill time gate stays pure (no Date.now
  // during render) while still auto-unlocking when the booking time arrives.
  const [now, setNow] = useState(0);

  const fetchReservations = () => {
    dispatch(fetchBookings({
      ...(selectedRestaurant ? { restaurantId: selectedRestaurant } : {}),
    }));
  };

  useEffect(() => {
    dispatch(fetchRestaurants({ ownerId: user?.id, isActive: true })).catch(() => {});
    fetchReservations();

    const unsubscribe = subscribeToBookingUpdates(selectedRestaurant || "all", () => {
      fetchReservations();
    });
    return unsubscribe;
  }, [dispatch, selectedRestaurant]);

  useEffect(() => {
    const update = () => setNow(Date.now());
    update();
    const interval = setInterval(update, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleMarkNoShow = async (e) => {
    e.preventDefault();
    if (!noShowBooking) return;
    const remarks = noShowRemarks.trim();
    if (remarks.length < 5) {
      toast.error("Remarks are required (minimum 5 characters).");
      return;
    }
    setNoShowBusy(true);
    try {
      await dispatch(markNoShow(noShowBooking._id, remarks));
      toast.success("Booking marked as no-show.");
      setNoShowBooking(null);
      setNoShowRemarks("");
      fetchReservations();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to mark booking as no-show.");
    } finally {
      setNoShowBusy(false);
    }
  };

  const openRefundDialog = async (booking) => {
    setActionNotes("");
    setActionRefundMethod(REFUND_METHOD.CASH);
    setActionDialog({
      type: "refund",
      booking,
    });

    if (!booking?.refundId) return;

    try {
      await dispatch(fetchRefundById(booking.refundId));
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to load refund details.");
    }
  };

  const openConvertDialog = (booking) => {
    setActionNotes("");
    setActionDialog({
      type: "convert",
      booking,
    });
  };

  const closeActionDialog = () => {
    setActionDialog(null);
    setActionNotes("");
    setActionRefundMethod(REFUND_METHOD.CASH);
    setActionBusy(false);
  };

  const openNoShowDialog = (booking) => {
    setNoShowRemarks("");
    setNoShowBooking(booking);
  };

  const closeNoShowDialog = () => {
    setNoShowBooking(null);
    setNoShowRemarks("");
  };

  const handleActionConfirm = async () => {
    if (!actionDialog?.booking) return;

    const { booking, type } = actionDialog;
    const refundMethod = actionRefundMethod;
    setActionBusy(true);

    try {
      if (type === "refund") {
        await dispatch(processRefund(booking.refundId, refundMethod));
        toast.success(
          refundMethod === "Cash"
            ? "Refund marked as issued in cash."
            : "Refund processed successfully."
        );
      } else if (type === "convert") {
        await dispatch(
          convertBookingToBill(booking._id, {
            notes: actionNotes.trim(),
          })
        );
        toast.success("Bill created from booking successfully.");
      }
      closeActionDialog();
      fetchReservations();
    } catch (err) {
      toast.error(
        err?.response?.data?.message ||
          (type === "refund" ? "Failed to process refund." : "Failed to create bill.")
      );
    } finally {
      setActionBusy(false);
    }
  };

  const visibleBookings = bookings.filter(
    (b) => b.bookingStatus !== "Pending"
  );

  const filteredBookings = visibleBookings.filter((b) => {
    if (statusFilter !== "ALL" && b.bookingStatus !== statusFilter) return false;
    if (search) {
      const customerName = b.userId?.fullName?.toLowerCase() || "";
      const bookingId = b._id?.toLowerCase() || "";
      return customerName.includes(search.toLowerCase()) || bookingId.includes(search.toLowerCase());
    }
    return true;
  });

  const reservationStats = {
    total: visibleBookings.length,
    confirmed: visibleBookings.filter((b) => b.bookingStatus === "Confirmed").length,
    completed: visibleBookings.filter((b) => b.bookingStatus === "Completed").length,
    refunds: visibleBookings.filter((b) => !!b.refundId).length,
  };

  const canConvert = (b) =>
    b.bookingStatus === "Confirmed" &&
    new Date(b.bookingDateTime).getTime() <= now;

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
          <p className="text-sm text-muted">View and manage incoming customer table bookings</p>
        </div>
      </div>
      <div className="max-w-xs">
        <RestaurantFilter
          restaurants={restaurants}
          value={selectedRestaurant}
          onChange={setSelectedRestaurant}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {SUMMARY_CARDS.map(({ key, label, icon: Icon, tone }) => (
          <Card key={key} className="group overflow-hidden p-4 transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
                <p className="mt-2 text-3xl font-bold tracking-tight text-text">{reservationStats[key]}</p>
              </div>
              <div className={`rounded-xl p-2.5 ${tone}`}><Icon size={20} /></div>
            </div>
          </Card>
        ))}
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-border bg-surface/90 p-4 shadow-sm">
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
          {["ALL", "Confirmed", "Completed", "Cancelled", "No Show"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg shrink-0 transition-all ${
                statusFilter === st
                  ? "bg-primary text-white"
                  : "border border-border bg-surface-secondary/70 text-muted hover:bg-surface-hover hover:text-text"
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
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : loadError ? (
        <ErrorState title="Unable to load reservations" description={loadError} onRetry={fetchReservations} />
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
            const orderedCount = Array.isArray(b.preOrderedFoods)
              ? b.preOrderedFoods.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
              : 0;

            return (
              <Card key={b._id} className="overflow-hidden p-5 transition-all hover:-translate-y-px hover:shadow-md border border-border">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-bold text-text">
                        {customer?.fullName || customer?.name || "Guest Customer"}
                      </h3>
                      {b.bookingCode && (
                        <span className="rounded bg-surface-secondary/70 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted">
                          {b.bookingCode}
                        </span>
                      )}
                      <Badge
                        variant={
                          b.bookingStatus === "Completed"
                            ? "success"
                            : b.bookingStatus === "Cancelled"
                            ? "danger"
                            : b.bookingStatus === "No Show"
                            ? "info"
                            : "success"
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

                    <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                      <Building2 size={14} />
                      <span>{b.restaurantId?.restaurantName || "Restaurant"}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-muted">
                      {bDate && (
                        <div className="flex items-center gap-1.5 rounded-lg bg-surface-secondary/60 px-2.5 py-1.5">
                          <Calendar size={15} className="text-primary" />
                          <span>{formatDate(bDate)} at {formatTime(bDate)}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 rounded-lg bg-surface-secondary/60 px-2.5 py-1.5">
                        <Users size={15} className="text-primary" />
                        <span>{b.numberOfGuests} Guests</span>
                      </div>
                      {bookingTableDocs.length > 0 && (
                        <div className="flex items-center gap-1.5 rounded-lg bg-surface-secondary/60 px-2.5 py-1.5 font-medium text-text">
                          <Armchair size={15} className="text-primary" />
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
                      <div className="flex items-center gap-1.5 rounded-lg bg-surface-secondary/60 px-2.5 py-1.5">
                        <ReceiptText size={15} className="text-primary" />
                        <span>{b.bookingType || "Online"} booking</span>
                      </div>
                      <div className="flex items-center gap-1.5 rounded-lg bg-surface-secondary/60 px-2.5 py-1.5">
                        <span className="rounded-full border border-border bg-surface-secondary/70 px-2 py-0.5 text-[11px] font-semibold text-muted">
                          {b.paymentStatus || "Pending"}
                        </span>
                        <span>{formatCurrency(b.totalAmount || 0)} total</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 text-xs text-muted">
                      {customer?.phone && <span>Contact: {customer.phone}</span>}
                      {customer?.email && <span>Email: {customer.email}</span>}
                      {typeof b.advanceAmount === "number" && (
                        <span>Advance: {formatCurrency(b.advanceAmount)}</span>
                      )}
                      <span>Pre-order items: {orderedCount}</span>
                      {b.specialRequest && (
                        <span className="max-w-2xl truncate">Request: {b.specialRequest}</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2 pt-2 lg:pt-0 border-t lg:border-t-0 border-border">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDetailsBooking(b)}
                    >
                      Details
                    </Button>

                    {b.bookingStatus === "Confirmed" &&
                      bDate &&
                      bDate.getTime() <= now && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 border-red-200 hover:bg-red-50"
                        onClick={() => openNoShowDialog(b)}
                      >
                        <UserX size={15} className="mr-1" />
                        Mark No-Show
                      </Button>
                    )}

                    {canConvert(b) && (
                      <Button
                        size="sm"
                        variant="secondary"
                        isLoading={
                          actionBusy &&
                          actionDialog?.type === "convert" &&
                          actionDialog?.booking?._id === b._id
                        }
                        onClick={() => openConvertDialog(b)}
                      >
                        <ReceiptText size={15} className="mr-1" />
                        Convert to Bill
                      </Button>
                    )}

                    {b.refundId &&
                      ["REFUND_PENDING", "REFUND_OVERDUE"].includes(
                        b.refundStatus
                      ) && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => openRefundDialog(b)}
                        >
                          <HandCoins size={15} className="mr-1" />
                          Process Refund
                        </Button>
                      )}

                    {b.refundId &&
                      b.refundStatus === "REFUND_AWAITING_CUSTOMER_CONFIRMATION" && (
                        <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-200/70 bg-amber-50/70 px-2.5 py-1.5 text-xs font-medium text-amber-700">
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

      <Modal
        isOpen={Boolean(actionDialog)}
        onClose={closeActionDialog}
        title={
          actionDialog?.type === "refund"
            ? `Confirm refund for ${actionDialog?.booking?.bookingCode || "reservation"}`
            : `Convert ${actionDialog?.booking?.bookingCode || "reservation"} to bill`
        }
        size="lg"
      >
        {actionDialog?.booking && (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <Card className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Reservation</p>
                <div className="mt-3 space-y-2 text-sm text-text">
                  <div className="flex justify-between gap-4">
                    <span className="text-muted">Guest</span>
                    <span className="font-medium">{actionDialog.booking.userId?.fullName || "Guest Customer"}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted">Date & time</span>
                    <span className="font-medium">
                      {actionDialog.booking.bookingDateTime
                        ? formatDateTime(actionDialog.booking.bookingDateTime)
                        : "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted">Guests</span>
                    <span className="font-medium">{actionDialog.booking.numberOfGuests}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted">Status</span>
                    <span className="font-medium">{actionDialog.booking.bookingStatus}</span>
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Payment snapshot</p>
                <div className="mt-3 space-y-2 text-sm text-text">
                  <div className="flex justify-between gap-4">
                    <span className="text-muted">Booking type</span>
                    <span className="font-medium">{actionDialog.booking.bookingType || "Online"}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted">Total amount</span>
                    <span className="font-medium">{formatCurrency(actionDialog.booking.totalAmount || 0)}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted">Advance amount</span>
                    <span className="font-medium">{formatCurrency(actionDialog.booking.advanceAmount || 0)}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted">Payment status</span>
                    <span className="font-medium">{actionDialog.booking.paymentStatus || "Pending"}</span>
                  </div>
                </div>
              </Card>
            </div>

            <Card className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">What will be posted</p>
              {actionDialog.type === "convert" ? (
                <div className="mt-3 space-y-3 text-sm text-text">
                  <p className="text-muted">
                    The server will create the bill from this booking's current model values. It will carry the
                    confirmed booking, pre-ordered foods, and any online advance into the bill ledger.
                  </p>
                  <div className="rounded-xl border border-border bg-surface-secondary/60 p-3 text-xs text-muted">
                    <div className="flex justify-between gap-4">
                      <span>Pre-ordered items</span>
                      <span>{Array.isArray(actionDialog.booking.preOrderedFoods) ? actionDialog.booking.preOrderedFoods.length : 0}</span>
                    </div>
                    <div className="mt-1 flex justify-between gap-4">
                      <span>Tables</span>
                      <span>{Array.isArray(actionDialog.booking.tables) ? actionDialog.booking.tables.length : actionDialog.booking.tableId ? 1 : 0}</span>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-text">Bill notes</label>
                    <textarea
                      value={actionNotes}
                      onChange={(e) => setActionNotes(e.target.value)}
                      placeholder="Optional internal notes for the bill"
                      rows={4}
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>
              ) : (
                <div className="mt-3 space-y-3 text-sm text-text">
                  <p className="text-muted">
                    The refundable amount below is calculated by the backend.
                    Choose the refund method, then confirm.
                  </p>

                  {refundPreviewLoading ? (
                    <p className="text-muted">Loading refund details...</p>
                  ) : refundPreview ? (
                    <div className="rounded-xl border border-border bg-surface-secondary/60 p-3 text-xs text-muted">
                      <div className="flex justify-between gap-4">
                        <span>Refund amount</span>
                        <span className="font-semibold text-text">{formatCurrency(refundPreview.amount || 0)}</span>
                      </div>
                      <div className="mt-1 flex justify-between gap-4">
                        <span>Refund status</span>
                        <span className="font-medium text-text">{refundPreview.refundStatus || "Pending"}</span>
                      </div>
                      <div className="mt-1 flex justify-between gap-4">
                        <span>Refund reason</span>
                        <span className="font-medium text-text">{refundPreview.reason || "N/A"}</span>
                      </div>
                      <div className="mt-1 flex justify-between gap-4">
                        <span>Refund code</span>
                        <span className="font-medium text-text">{refundPreview.refundCode || "N/A"}</span>
                      </div>
                      <div className="mt-1 flex justify-between gap-4">
                        <span>Refund deadline</span>
                        <span className="font-medium text-text">
                          {refundPreview.deadlineAt ? formatDateTime(refundPreview.deadlineAt) : "N/A"}
                        </span>
                      </div>
                      <div className="mt-1 flex justify-between gap-4">
                        <span>Booking number</span>
                        <span className="font-medium text-text">
                          {typeof refundPreview.bookingId === "object"
                            ? refundPreview.bookingId.bookingCode || "N/A"
                            : "N/A"}
                        </span>
                      </div>
                      <div className="mt-1 flex justify-between gap-4">
                        <span>Customer</span>
                        <span className="font-medium text-text">
                          {typeof refundPreview.customerId === "object"
                            ? refundPreview.customerId.fullName || "N/A"
                            : "N/A"}
                        </span>
                      </div>
                      <div className="mt-1 flex justify-between gap-4">
                        <span>Restaurant</span>
                        <span className="font-medium text-text">
                          {actionDialog.booking.restaurantId?.restaurantName || "N/A"}
                        </span>
                      </div>
                    </div>
                  ) : null}

                  <RefundMethodSelector
                    value={actionRefundMethod}
                    onChange={setActionRefundMethod}
                    disabled={actionBusy}
                  />
                </div>
              )}
            </Card>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={closeActionDialog} disabled={actionBusy}>
                Cancel
              </Button>
              <Button
                variant={actionDialog.type === "refund" ? "secondary" : "primary"}
                onClick={handleActionConfirm}
                isLoading={actionBusy}
                loadingText="Processing..."
                disabled={!actionRefundMethod}
              >
                {actionDialog.type === "refund"
                  ? `Confirm Refund via ${REFUND_METHOD_LABELS[actionRefundMethod] || actionRefundMethod}`
                  : "Convert to Bill"}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* No-Show dialog with mandatory remarks */}
      <Modal
        isOpen={Boolean(noShowBooking)}
        onClose={closeNoShowDialog}
        title={`Mark ${noShowBooking?.bookingCode || "reservation"} as No-Show`}
        size="sm"
      >
        <form onSubmit={handleMarkNoShow} className="space-y-4 pt-2">
          <p className="text-sm text-muted">
            The guest did not arrive for their reservation. A remark is required
            to record why this booking was marked as a no-show.
          </p>
          <div>
            <label className="mb-1 block text-sm font-medium text-text">Remarks (required)</label>
            <textarea
              value={noShowRemarks}
              onChange={(e) => setNoShowRemarks(e.target.value)}
              placeholder="e.g. Guest never arrived, no response on call"
              rows={4}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={closeNoShowDialog} disabled={noShowBusy}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" isLoading={noShowBusy}>
              Mark No-Show
            </Button>
          </div>
        </form>
      </Modal>

      {/* Reservation details modal */}
      <Modal
        isOpen={Boolean(detailsBooking)}
        onClose={() => setDetailsBooking(null)}
        title={`Reservation ${detailsBooking?.bookingCode || ""}`}
        size="lg"
      >
        {detailsBooking && (
          <div className="space-y-5 pt-2">
            <div className="grid gap-3 sm:grid-cols-2">
              <Card className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Reservation</p>
                <div className="mt-3 space-y-2 text-sm text-text">
                  <div className="flex justify-between gap-4">
                    <span className="text-muted">Guest</span>
                    <span className="font-medium">
                      {detailsBooking.userId?.fullName || detailsBooking.userId?.name || "Guest Customer"}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted">Date & time</span>
                    <span className="font-medium">
                      {detailsBooking.bookingDateTime ? formatDateTime(detailsBooking.bookingDateTime) : "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted">Guests</span>
                    <span className="font-medium">{detailsBooking.numberOfGuests}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted">Type</span>
                    <span className="font-medium">{detailsBooking.bookingType || "Online"}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted">Status</span>
                    <span className="font-medium">{detailsBooking.bookingStatus}</span>
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Payment</p>
                <div className="mt-3 space-y-2 text-sm text-text">
                  <div className="flex justify-between gap-4">
                    <span className="text-muted">Total amount</span>
                    <span className="font-medium">{formatCurrency(detailsBooking.totalAmount || 0)}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted">Advance amount</span>
                    <span className="font-medium">{formatCurrency(detailsBooking.advanceAmount || 0)}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted">Payment status</span>
                    <span className="font-medium">{detailsBooking.paymentStatus || "Pending"}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted">Payment method</span>
                    <span className="font-medium">{detailsBooking.paymentMethod || "Cash"}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted">Bill</span>
                    <span className="font-medium">
                      {detailsBooking.billId?.billCode || (detailsBooking.billId ? "Linked" : "None")}
                    </span>
                  </div>
                </div>
              </Card>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Card className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Tables</p>
                <div className="mt-3 space-y-1 text-sm text-text">
                  {detailsBooking.tables?.length > 0 ? (
                    detailsBooking.tables.map((entry, idx) => (
                      <p key={idx} className="font-medium">
                        {entry.tableId?.tableCode || `Table ${entry.tableId?.tableNumber || entry.tableId?._id?.slice(-4)}`}
                        {entry.seatIds?.length ? ` — ${entry.seatIds.length} seat(s)` : ""}
                      </p>
                    ))
                  ) : detailsBooking.tableId ? (
                    <p className="font-medium">
                      {detailsBooking.tableId.tableCode || `Table ${detailsBooking.tableId.tableNumber || ""}`}
                    </p>
                  ) : (
                    <p className="text-muted">No table assigned</p>
                  )}
                </div>
              </Card>

              <Card className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Refund</p>
                <div className="mt-3 space-y-2 text-sm text-text">
                  {detailsBooking.refundId ? (
                    <>
                      <div className="flex justify-between gap-4">
                        <span className="text-muted">Refund code</span>
                        <span className="font-medium">{detailsBooking.refundId.refundCode || "N/A"}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-muted">Amount</span>
                        <span className="font-medium">{formatCurrency(detailsBooking.refundId.amount || 0)}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-muted">Status</span>
                        <span className="font-medium">{detailsBooking.refundId.refundStatus || "N/A"}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-muted">Method</span>
                        <span className="font-medium">{detailsBooking.refundId.refundMethod || "N/A"}</span>
                      </div>
                    </>
                  ) : (
                    <p className="text-muted">No refund linked</p>
                  )}
                </div>
              </Card>
            </div>

            {(detailsBooking.preOrderedFoods?.length > 0) && (
              <Card className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Pre-ordered items</p>
                <div className="mt-3 space-y-1.5 text-sm text-text">
                  {detailsBooking.preOrderedFoods.map((item, idx) => (
                    <div key={idx} className="flex justify-between gap-4">
                      <span className="font-medium">
                        {item.foodId?.foodName || "Item"} ({item.variantName || "Regular"})
                      </span>
                      <span>
                        x{item.quantity}
                        {typeof item.price === "number" && item.price > 0 && (
                          <span className="text-muted"> — {formatCurrency(item.price * item.quantity)}</span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {detailsBooking.specialRequest && (
              <div className="rounded-xl border border-amber-200/60 bg-amber-50/60 p-3 text-sm text-amber-800">
                <p className="font-semibold">Special request</p>
                <p className="mt-1">{detailsBooking.specialRequest}</p>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setDetailsBooking(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

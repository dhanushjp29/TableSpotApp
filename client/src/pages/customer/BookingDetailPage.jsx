import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  Calendar,
  Clock,
  Users,
  MapPin,
  Armchair,
  UtensilsCrossed,
  ChevronLeft,
  CheckCircle,
  Clock4,
  Info,
  CreditCard,
  HandCoins,
  MessageSquareWarning,
} from "lucide-react";
import toast from "react-hot-toast";

import {
  cancelBooking,
  fetchBookingById,
  setCurrentBooking,
} from "../../store/slices/reservationSlice.js";
import {
  clearCurrentRefund,
  confirmRefundReceipt,
  disputeRefund,
  fetchRefundById,
} from "../../store/slices/refundSlice.js";
import { subscribeToBookingUpdates } from "../../services/socket/socketService.js";
import { useBookingAdvancePayment } from "../../hooks/useBookingAdvancePayment.js";

import Button from "../../components/ui/Button.jsx";
import Badge from "../../components/ui/Badge.jsx";
import { SkeletonText } from "../../components/ui/Skeleton.jsx";
import ErrorState from "../../components/ui/ErrorState.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import { formatDate, formatTime } from "../../utils/formatDate.js";
import { formatCurrency } from "../../utils/formatCurrency.js";
import { SEAT_SELECTION_MODE } from "../../constants/table.js";
import PdfDownloadButton from "../../components/pdf/PdfDownloadButton.jsx";
import BookingPdf from "../../components/pdf/BookingPdf.jsx";
import { bookingReceiptFilename } from "../../utils/pdf/pdfData.js";

const STATUS_VARIANT = {
  Pending: "warning",
  Confirmed: "success",
  Completed: "info",
  Cancelled: "error",
  "No Show": "error",
};

const PAYMENT_STATUS_VARIANT = {
  Pending: "warning",
  "Partially Paid": "warning",
  Paid: "success",
  Refunded: "info",
};

const REFUND_STATUS_META = {
  NOT_REQUIRED: { label: "Not required", variant: "neutral" },
  REFUND_PENDING: { label: "Pending owner processing", variant: "warning" },
  REFUND_PROCESSING: { label: "Processing", variant: "info" },
  REFUND_AWAITING_CUSTOMER_CONFIRMATION: {
    label: "Awaiting your confirmation",
    variant: "warning",
  },
  REFUNDED: { label: "Refunded", variant: "success" },
  REFUND_OVERDUE: { label: "Overdue", variant: "error" },
  REFUND_FAILED: { label: "Failed", variant: "error" },
  REFUND_DISPUTED: { label: "Disputed", variant: "error" },
};

function StatusBanner({ status }) {
  if (status === "Pending") {
    return (
      <div className="mt-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
        <Clock4 size={18} className="mt-0.5 shrink-0 text-amber-600" />
        <div>
          <p className="text-sm font-semibold text-amber-800">
            Awaiting approval
          </p>
          <p className="mt-0.5 text-xs text-amber-700">
            The restaurant has received your booking request and will confirm
            it shortly. This page updates automatically once it is approved.
          </p>
        </div>
      </div>
    );
  }

  if (status === "Confirmed") {
    return (
      <div className="mt-4 flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4">
        <CheckCircle size={18} className="mt-0.5 shrink-0 text-success" />
        <div>
          <p className="text-sm font-semibold text-green-800">
            Booking confirmed
          </p>
          <p className="mt-0.5 text-xs text-green-700">
            Your table has been reserved. We look forward to seeing you!
          </p>
        </div>
      </div>
    );
  }

  if (status === "Completed") {
    return (
      <div className="mt-4 flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
        <CheckCircle size={18} className="mt-0.5 shrink-0 text-primary" />
        <div>
          <p className="text-sm font-semibold text-blue-800">
            Booking completed
          </p>
          <p className="mt-0.5 text-xs text-blue-700">
            This visit has been completed. Thank you for dining with us!
          </p>
        </div>
      </div>
    );
  }

  if (status === "Cancelled" || status === "No Show") {
    return (
      <div className="mt-4 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
        <Info size={18} className="mt-0.5 shrink-0 text-error" />
        <div>
          <p className="text-sm font-semibold text-red-800">
            Booking {status === "No Show" ? "marked as no show" : "cancelled"}
          </p>
          <p className="mt-0.5 text-xs text-red-700">
            {status === "No Show"
              ? "You did not arrive for this reservation."
              : "This reservation is no longer active."}
          </p>
        </div>
      </div>
    );
  }

  return null;
}

function BookingDetailPage() {
  const { bookingId } = useParams();
  const dispatch = useDispatch();
  const booking = useSelector((state) => state.reservation.currentBooking);
  const isLoading = useSelector((state) => state.reservation.isLoading);
  const error = useSelector((state) => state.reservation.error);
  const refund = useSelector((state) => state.refund.currentRefund);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isRefundAction, setIsRefundAction] = useState(false);
  const { isPaying, payAdvance } = useBookingAdvancePayment();

  const fetchBooking = async () => {
    await dispatch(fetchBookingById(bookingId)).catch(() => {});
  };

  useEffect(() => {
    fetchBooking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, bookingId]);

  useEffect(() => {
    if (
      !booking?.refundId ||
      !booking.refundStatus ||
      booking.refundStatus === "NOT_REQUIRED"
    ) {
      dispatch(clearCurrentRefund());
      return;
    }
    dispatch(fetchRefundById(booking.refundId)).catch(() => {});
  }, [dispatch, booking?.refundId, booking?.refundStatus]);

  const handleConfirmRefund = async () => {
    if (!window.confirm("I received the refund in cash. Confirm receipt?")) return;
    setIsRefundAction(true);
    try {
      await dispatch(confirmRefundReceipt(booking.refundId));
      toast.success("Refund receipt confirmed. Thank you!");
      fetchBooking();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to confirm refund.");
    } finally {
      setIsRefundAction(false);
    }
  };

  const handleDisputeRefund = async () => {
    const reason = window.prompt(
      "Please tell us why you did not receive this refund (at least 5 characters):"
    );
    if (reason === null) return;
    const trimmed = String(reason || "").trim();
    if (trimmed.length < 5) {
      toast.error("A dispute reason of at least 5 characters is required.");
      return;
    }
    setIsRefundAction(true);
    try {
      await dispatch(disputeRefund(booking.refundId, trimmed));
      toast.success("Refund disputed. The restaurant has been notified.");
      fetchBooking();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to dispute refund.");
    } finally {
      setIsRefundAction(false);
    }
  };

  useEffect(() => {
    const unsubscribe = subscribeToBookingUpdates("all", (updatedBooking) => {
      if (String(updatedBooking._id) === String(bookingId)) {
        dispatch(setCurrentBooking(updatedBooking));
      }
    });
    return unsubscribe;
  }, [dispatch, bookingId]);

  const handleCancel = async () => {
    if (!window.confirm("Are you sure you want to cancel this booking?")) return;
    setIsCancelling(true);
    try {
      await dispatch(cancelBooking(bookingId));
      toast.success("Booking cancelled.");
      fetchBooking();
    } catch (err) {
      toast.error(
        err?.response?.data?.message || "Failed to cancel booking."
      );
    } finally {
      setIsCancelling(false);
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="card p-6">
          <SkeletonText lines={8} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
        <ErrorState
          title="Unable to load booking"
          description={error}
          onRetry={fetchBooking}
        />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
        <EmptyState title="Booking not found" />
      </div>
    );
  }

  const restaurant =
    typeof booking.restaurantId === "object" ? booking.restaurantId : null;
  const table = typeof booking.tableId === "object" ? booking.tableId : null;
  const bookingDate = booking.bookingDateTime
    ? new Date(booking.bookingDateTime)
    : null;
  const status = booking.bookingStatus || "Pending";
  const tableEntries = (
    booking.tables && booking.tables.length > 0
      ? booking.tables
      : [
          {
            tableId: booking.tableId,
            seatSelectionMode: booking.bookingMode,
            seatLabels: booking.seatLabels || [],
          },
        ]
  ).map((entry) => ({
    table: typeof entry.tableId === "object" ? entry.tableId : table,
    isSeatMode:
      entry.seatSelectionMode === SEAT_SELECTION_MODE.INDIVIDUAL_SEATS,
    seatLabels: entry.seatLabels || [],
  }));
  const canCancel = !["Cancelled", "Completed", "No Show"].includes(status);
  const advanceAmount = Number(booking.advanceAmount) > 0 ? Number(booking.advanceAmount) : 0;
  const paymentStatus = booking.paymentStatus || "Pending";
  const paymentActive =
    canCancel && ["Pending", "Partially Paid"].includes(paymentStatus);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
      <Link
        to="/customer/bookings"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-primary"
      >
        <ChevronLeft size={16} />
        Back to My Bookings
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text">Booking Details</h1>
          <p className="mt-1 text-sm text-muted">
            {restaurant?.restaurantName || "Restaurant Booking"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PdfDownloadButton
            size="sm"
            variant="outline"
            successMessage="Booking confirmation PDF downloaded."
            filename={bookingReceiptFilename}
            fetchData={async () => ({ booking })}
            renderDocument={({ booking: b }) => (
              <BookingPdf booking={b} view="customer" />
            )}
          />
          <Badge variant="primary">
            {booking.bookingCode || booking._id?.slice(-6) || "N/A"}
          </Badge>
          <Badge variant={STATUS_VARIANT[status] || "warning"}>{status}</Badge>
        </div>
      </div>

      <StatusBanner status={status} />

      <div className="mt-6 card p-6">
        <h2 className="text-lg font-semibold text-text">Reservation</h2>
        <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
          {bookingDate && (
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-muted" />
              <span className="text-sm text-text">
                <span className="font-medium">Date:</span>{" "}
                {formatDate(bookingDate)} at {formatTime(bookingDate)}
              </span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-muted" />
            <span className="text-sm text-text">
              <span className="font-medium">Expected duration:</span>{" "}
              {booking.expectedDuration || 120} minutes
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Users size={16} className="text-muted" />
            <span className="text-sm text-text">
              <span className="font-medium">Guests:</span>{" "}
              {booking.numberOfGuests}
            </span>
          </div>
          {restaurant && (
            <>
              <div className="flex items-center gap-2">
                <MapPin size={16} className="text-muted" />
                <span className="text-sm text-text">
                  <span className="font-medium">Restaurant:</span>{" "}
                  {restaurant.restaurantCode
                    ? `${restaurant.restaurantCode} - `
                    : ""}
                  {restaurant.restaurantName}
                </span>
              </div>
              {tableEntries.length > 0 && (
                <div className="space-y-2">
                  {tableEntries.map((entry, index) => (
                    <div key={index}>
                      <div className="flex items-center gap-2">
                        <Armchair size={16} className="text-muted" />
                        <span className="text-sm text-text">
                          <span className="font-medium">
                            {tableEntries.length > 1 ? `Table ${index + 1}:` : "Table:"}
                          </span>{" "}
                          {entry.table?.tableName ||
                            (entry.table?.tableNumber
                              ? `Table ${entry.table.tableNumber}`
                              : entry.table?.tableCode ||
                                entry.table?.tableLabel ||
                                "N/A")}
                          {entry.isSeatMode
                            ? " (book by seat)"
                            : " (whole table)"}
                        </span>
                      </div>
                      {entry.seatLabels.length > 0 && (
                        <div className="flex items-start gap-2 pl-6">
                          <span className="text-sm text-text">
                            <span className="font-medium">Seats:</span>{" "}
                            {entry.seatLabels.join(", ")}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
          {booking.bookingType && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-text">
                <span className="font-medium">Booking type:</span>{" "}
                {booking.bookingType}
              </span>
            </div>
          )}
          {booking.paymentStatus && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-text">
                <span className="font-medium">Payment:</span>{" "}
                {booking.paymentStatus}
              </span>
            </div>
          )}
          {booking.specialRequest && (
            <div className="flex items-start gap-2">
              <span className="mt-0.5 text-sm text-text">
                <span className="font-medium">Special Request:</span>{" "}
                {booking.specialRequest}
              </span>
            </div>
          )}
        </div>
      </div>

      {advanceAmount > 0 && (
        <div className="mt-6 card p-6">
          <div className="flex items-center gap-2">
            <CreditCard size={18} className="text-primary" />
            <h2 className="text-lg font-semibold text-text">Advance Payment</h2>
            <Badge variant={PAYMENT_STATUS_VARIANT[paymentStatus] || "warning"}>
              {paymentStatus}
            </Badge>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4">
            <span className="text-sm text-text">
              <span className="font-medium">Advance due:</span>{" "}
              {formatCurrency(advanceAmount)}
            </span>
          </div>
          {paymentActive && (
            <Button
              type="button"
              className="mt-4 w-full sm:w-auto"
              isLoading={isPaying}
              loadingText="Opening Payment..."
              onClick={() =>
                payAdvance({
                  bookingId,
                  onSuccess: fetchBooking,
                  onDismiss: fetchBooking,
                })
              }
            >
              Pay Advance of {formatCurrency(advanceAmount)}
            </Button>
          )}
          {paymentStatus === "Paid" && (
            <p className="mt-2 text-xs text-muted">
              Your advance payment has been received. The booking is confirmed.
            </p>
          )}
        </div>
      )}

      {booking.refundId &&
        booking.refundStatus &&
        booking.refundStatus !== "NOT_REQUIRED" && (
          <div className="mt-6 card p-6">
            <div className="flex items-center gap-2">
              <HandCoins size={18} className="text-primary" />
              <h2 className="text-lg font-semibold text-text">Refund</h2>
              <Badge
                variant={
                  REFUND_STATUS_META[booking.refundStatus]?.variant ||
                  "warning"
                }
              >
                {REFUND_STATUS_META[booking.refundStatus]?.label ||
                  booking.refundStatus}
              </Badge>
            </div>
            <div className="mt-4 space-y-2 border-t border-gray-100 pt-4">
              {refund?.refundAmount > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text">
                    <span className="font-medium">Refund amount:</span>
                  </span>
                  <span className="text-sm font-semibold text-text">
                    {formatCurrency(refund.refundAmount)}
                  </span>
                </div>
              )}
              {refund?.refundMethod && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text">
                    <span className="font-medium">Refund method:</span>
                  </span>
                  <span className="text-sm text-muted">
                    {refund.refundMethod}
                  </span>
                </div>
              )}
              {refund?.refundCode && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text">
                    <span className="font-medium">Refund code:</span>
                  </span>
                  <span className="text-sm text-muted">
                    {refund.refundCode}
                  </span>
                </div>
              )}
              {booking.refundStatus ===
                "REFUND_AWAITING_CUSTOMER_CONFIRMATION" && (
                <>
                  <p className="pt-2 text-xs text-muted">
                    The restaurant says your refund was issued in cash. Please
                    confirm you have received it so this request can be closed.
                  </p>
                  <div className="flex flex-col gap-2 pt-2 sm:flex-row">
                    <Button
                      size="sm"
                      variant="primary"
                      isLoading={isRefundAction}
                      onClick={handleConfirmRefund}
                    >
                      <HandCoins size={14} className="mr-1" />
                      I received it in cash
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 border-red-200 hover:bg-red-50"
                      onClick={handleDisputeRefund}
                    >
                      <MessageSquareWarning size={14} className="mr-1" />
                      I didn't receive it
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

      {booking.preOrderedFoods?.length > 0 && (
        <div className="mt-6 card p-6">
          <div className="flex items-center gap-2">
            <UtensilsCrossed size={18} className="text-primary" />
            <h2 className="text-lg font-semibold text-text">Pre-Ordered Food</h2>
          </div>
          <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
            {booking.preOrderedFoods.map((item, index) => {
              const food =
                typeof item.foodId === "object" ? item.foodId : null;
              return (
                <div
                  key={index}
                  className="flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2">
                    {food?.coverImage && (
                      <img
                        src={food.coverImage}
                        alt={food.foodName || "Food"}
                        className="h-10 w-10 flex-shrink-0 rounded-md bg-gray-100 object-cover"
                      />
                    )}
                    <span className="text-sm text-text">
                      {food?.foodName || "Food item"}
                      {item.variantName && item.variantName !== "Regular"
                        ? ` (${item.variantName})`
                        : ""}
                      <span className="text-muted"> x {item.quantity}</span>
                    </span>
                  </div>
                  <span className="text-sm font-medium text-text">
                    {formatCurrency(item.price * item.quantity)}
                  </span>
                </div>
              );
            })}
          </div>
          {booking.totalAmount > 0 && (
            <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
              <span className="text-sm font-semibold text-text">
                Total Amount
              </span>
              <span className="text-sm font-bold text-primary">
                {formatCurrency(booking.totalAmount)}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-between">
        <Link to="/customer/bookings">
          <Button variant="secondary">Back to My Bookings</Button>
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row">
          {canCancel && (
            <Button
              variant="outline"
              className="text-red-600 border-red-200 hover:bg-red-50"
              isLoading={isCancelling}
              onClick={handleCancel}
            >
              Cancel Booking
            </Button>
          )}
          {restaurant?._id && (
            <Link to={"/restaurants/" + restaurant._id}>
              <Button>View Restaurant</Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export default BookingDetailPage;

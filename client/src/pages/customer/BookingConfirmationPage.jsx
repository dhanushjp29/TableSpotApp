import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { CheckCircle, Calendar, Clock, Users, MapPin, Armchair, Share2, UtensilsCrossed, CreditCard } from "lucide-react";
import toast from "react-hot-toast";

import { bookingApi } from "../../api/booking.api.js";
import { useBookingAdvancePayment } from "../../hooks/useBookingAdvancePayment.js";

import Button from "../../components/ui/Button.jsx";
import Badge from "../../components/ui/Badge.jsx";
import { SkeletonText } from "../../components/ui/Skeleton.jsx";
import ErrorState from "../../components/ui/ErrorState.jsx";
import { formatDate, formatTime } from "../../utils/formatDate.js";
import { formatCurrency } from "../../utils/formatCurrency.js";

const PAYMENT_STATUS_VARIANT = {
  Pending: "warning",
  "Partially Paid": "warning",
  Paid: "success",
  Refunded: "info",
};

function BookingConfirmationPage() {
  const { bookingId } = useParams();
  const [booking, setBooking] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const { isPaying, payAdvance } = useBookingAdvancePayment();

  const fetchBooking = async () => {
    try {
      const response = await bookingApi.getById(bookingId);
      setBooking(response.data?.booking || response.data);
      setError(null);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load booking details.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchBooking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: "TableSpot Booking",
        text: "Booking confirmed at " + (booking?.restaurantId?.restaurantName || "Restaurant"),
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success("Booking link copied to clipboard!");
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
        <ErrorState title="Unable to load booking" description={error} onRetry={() => window.location.reload()} />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
        <ErrorState title="Booking not found" />
      </div>
    );
  }

  const restaurant = typeof booking.restaurantId === "object" ? booking.restaurantId : null;
  const table = typeof booking.tableId === "object" ? booking.tableId : null;
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
    seatLabels: entry.seatLabels || [],
  }));
  const bookingDate = booking.bookingDateTime ? new Date(booking.bookingDateTime) : null;
  const advanceAmount = Number(booking.advanceAmount) > 0 ? Number(booking.advanceAmount) : 0;
  const paymentStatus = booking.paymentStatus || "Pending";
  const paymentActive =
    !["Cancelled", "Completed", "No Show"].includes(booking.bookingStatus) &&
    ["Pending", "Partially Paid"].includes(paymentStatus);
  const needsPayment = advanceAmount > 0 && paymentActive;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="text-center">
        <CheckCircle size={48} className="mx-auto text-success" />
        <h1 className="mt-4 text-2xl font-bold text-text">
          {needsPayment ? "Booking Requested!" : "Booking Confirmed!"}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {needsPayment
            ? "Complete the advance payment below to confirm your reservation."
            : "Your reservation has been successfully created."}
        </p>
      </div>

      <div className="mt-6 card p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text">Booking</h2>
          <Badge variant="primary">{booking.bookingCode || booking._id?.slice(-6) || "N/A"}</Badge>
        </div>

        <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-muted" />
            <span className="text-sm text-text"><span className="font-medium">Date:</span> {bookingDate ? formatDate(bookingDate) : "N/A"}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-muted" />
            <span className="text-sm text-text"><span className="font-medium">Time:</span> {bookingDate ? formatTime(bookingDate) : "N/A"}</span>
          </div>
          <div className="flex items-center gap-2">
            <Users size={16} className="text-muted" />
            <span className="text-sm text-text"><span className="font-medium">Guests:</span> {booking.numberOfGuests}</span>
          </div>
          {restaurant && (
            <>
              <div className="flex items-center gap-2">
                <MapPin size={16} className="text-muted" />
                <span className="text-sm text-text"><span className="font-medium">Restaurant:</span> {restaurant.restaurantCode ? `${restaurant.restaurantCode} - ` : ""}{restaurant.restaurantName}</span>
              </div>
              {tableEntries.length > 0 && (
                <div className="space-y-2">
                  {tableEntries.map((entry, index) => (
                    <div key={index}>
                      <div className="flex items-center gap-2">
                        <Armchair size={16} className="text-muted" />
                        <span className="text-sm text-text">
                          <span className="font-medium">
                            {tableEntries.length > 1
                              ? `Table ${index + 1}:`
                              : "Table:"}
                          </span>{" "}
                          {entry.table?.tableLabel
                            ? `Table ${entry.table.tableLabel}`
                            : entry.table?.tableCode ||
                              `Table ${entry.table?.tableNumber || entry.table?.name}`}
                        </span>
                      </div>
                      {entry.seatLabels.length > 0 && (
                        <div className="flex items-start gap-2 pl-6">
                          <Armchair size={16} className="mt-0.5 text-muted" />
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
          {booking.specialRequest && (
            <div className="flex items-start gap-2">
              <span className="text-sm text-text mt-0.5"><span className="font-medium">Special Request:</span> {booking.specialRequest}</span>
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
            <span className="text-sm text-text"><span className="font-medium">Advance due:</span> {formatCurrency(advanceAmount)}</span>
          </div>
          {paymentActive && (
            <Button
              type="button"
              className="mt-4 w-full"
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
              <span className="text-sm font-semibold text-text">Total</span>
              <span className="text-sm font-bold text-primary">
                {formatCurrency(booking.totalAmount)}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-between">
        <Link to="/customer/bookings">
          <Button variant="secondary">View All My Bookings</Button>
        </Link>
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleShare}>
            <Share2 size={16} /> Share
          </Button>
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

export default BookingConfirmationPage;

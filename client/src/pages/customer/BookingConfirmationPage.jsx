import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { CheckCircle, Calendar, Clock, Users, MapPin, Share2 } from "lucide-react";
import toast from "react-hot-toast";

import { bookingApi } from "../../api/booking.api.js";

import Button from "../../components/ui/Button.jsx";
import Badge from "../../components/ui/Badge.jsx";
import { SkeletonText } from "../../components/ui/Skeleton.jsx";
import ErrorState from "../../components/ui/ErrorState.jsx";
import { formatDate, formatTime } from "../../utils/formatDate.js";

function BookingConfirmationPage() {
  const { bookingId } = useParams();
  const [booking, setBooking] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchBooking = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await bookingApi.getById(bookingId);
        setBooking(response.data?.booking || response.data);
      } catch (err) {
        setError(err?.response?.data?.message || "Failed to load booking details.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchBooking();
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
  const bookingDate = booking.bookingDateTime ? new Date(booking.bookingDateTime) : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="text-center">
        <CheckCircle size={48} className="mx-auto text-success" />
        <h1 className="mt-4 text-2xl font-bold text-text">Booking Confirmed!</h1>
        <p className="mt-1 text-sm text-muted">Your reservation has been successfully created.</p>
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
              {table && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-text"><span className="font-medium">Table:</span> {table.tableCode || `Table ${table.tableNumber || table.name}`}</span>
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

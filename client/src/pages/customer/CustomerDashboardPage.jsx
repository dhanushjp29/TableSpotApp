import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Utensils,
  Heart,
  UserCheck,
  ChevronRight,
  PlusCircle,
} from "lucide-react";
import toast from "react-hot-toast";

import { bookingApi } from "../../api/booking.api.js";
import { ROUTES } from "../../routes/routeConstants.js";
import Card from "../../components/ui/Card.jsx";
import Badge from "../../components/ui/Badge.jsx";
import Button from "../../components/ui/Button.jsx";
import { SkeletonText } from "../../components/ui/Skeleton.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import { formatDate, formatTime } from "../../utils/formatDate.js";
import ReviewModal from "../../components/ui/ReviewModal.jsx";

export default function CustomerDashboardPage() {
  const { user } = useSelector((state) => state.auth);
  const [bookings, setBookings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [reviewModalState, setReviewModalState] = useState({
    isOpen: false,
    restaurantId: null,
    restaurantName: "",
  });

  const refreshBookings = () => {
    bookingApi
      .getAll()
      .then((res) => setBookings(res?.bookings || []))
      .catch((err) => console.error(err));
  };

  useEffect(() => {
    let isMounted = true;
    bookingApi
      .getAll()
      .then((res) => {
        if (isMounted) {
          setBookings(res?.bookings || []);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error("Failed to load dashboard bookings", err);
          setIsLoading(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleCancelBooking = async (bookingId) => {
    if (!window.confirm("Are you sure you want to cancel this booking?")) return;
    try {
      await bookingApi.cancel(bookingId);
      toast.success("Booking cancelled successfully.");
      refreshBookings();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to cancel booking.");
    }
  };

  const upcomingBookings = bookings.filter(
    (b) => b.bookingStatus === "Pending" || b.bookingStatus === "Confirmed"
  );
  const completedBookings = bookings.filter((b) => b.bookingStatus === "Completed");

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary via-primary/90 to-amber-600 p-6 sm:p-8 text-white shadow-xl">
        <div className="relative z-10 max-w-2xl">
          <h1 className="text-3xl font-extrabold sm:text-4xl">
            Welcome back, {user?.name || "Gourmet Guest"}!
          </h1>
          <p className="mt-2 text-white/90 text-sm sm:text-base">
            Ready for your next dining experience? Book tables at top restaurants and order your favorite dishes in seconds.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link to={ROUTES.RESTAURANTS}>
              <Button variant="secondary" className="font-semibold shadow-md">
                <PlusCircle size={18} className="mr-2" />
                Book a Table
              </Button>
            </Link>
            <Link to={ROUTES.CUSTOMER_BOOKINGS}>
              <Button variant="outline" className="border-white text-white hover:bg-white/10">
                View All Bookings
              </Button>
            </Link>
          </div>
        </div>
        <div className="absolute -right-8 -bottom-8 opacity-20 pointer-events-none">
          <Utensils size={240} />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5 flex items-center gap-4 border-l-4 border-l-primary">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Calendar size={24} />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted">Total Bookings</p>
            <p className="text-2xl font-bold text-text">{bookings.length}</p>
          </div>
        </Card>

        <Card className="p-5 flex items-center gap-4 border-l-4 border-l-amber-500">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted">Upcoming</p>
            <p className="text-2xl font-bold text-text">{upcomingBookings.length}</p>
          </div>
        </Card>

        <Card className="p-5 flex items-center gap-4 border-l-4 border-l-green-500">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-500/10 text-green-600">
            <UserCheck size={24} />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted">Completed</p>
            <p className="text-2xl font-bold text-text">{completedBookings.length}</p>
          </div>
        </Card>

        <Card className="p-5 flex items-center gap-4 border-l-4 border-l-rose-500">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600">
            <Heart size={24} />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted">Quick Access</p>
            <Link to={ROUTES.CUSTOMER_FAVORITES} className="text-sm font-semibold text-primary hover:underline flex items-center gap-1">
              Favorites <ChevronRight size={14} />
            </Link>
          </div>
        </Card>
      </div>

      {/* Active & Upcoming Bookings Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-text">Upcoming Reservations</h2>
            <p className="text-xs text-muted">Your active table reservations and status</p>
          </div>
          <Link to={ROUTES.CUSTOMER_BOOKINGS} className="text-sm font-medium text-primary hover:underline flex items-center">
            View All <ChevronRight size={16} />
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <Card key={i} className="p-5">
                <SkeletonText lines={2} />
              </Card>
            ))}
          </div>
        ) : upcomingBookings.length === 0 ? (
          <Card className="p-8 text-center">
            <EmptyState
              title="No upcoming reservations"
              description="Explore popular restaurants around you and book your spot now."
              action={
                <Link to={ROUTES.RESTAURANTS}>
                  <Button variant="primary">Explore Restaurants</Button>
                </Link>
              }
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {upcomingBookings.map((booking) => {
              const bDate = booking.bookingDateTime ? new Date(booking.bookingDateTime) : null;
              const restaurant = typeof booking.restaurantId === "object" ? booking.restaurantId : null;

              return (
                <Card key={booking._id} className="p-5 hover:shadow-lg transition-all border border-gray-100">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold text-text">
                          {restaurant?.restaurantName || "Restaurant Reservation"}
                        </h3>
                        {restaurant?.restaurantCode && (
                          <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted">
                            {restaurant.restaurantCode}
                          </span>
                        )}
                      </div>
                      <div className="mt-3 space-y-1.5 text-sm text-muted">
                        {bDate && (
                          <div className="flex items-center gap-2">
                            <Calendar size={16} className="text-primary" />
                            <span>{formatDate(bDate)} at {formatTime(bDate)}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <Users size={16} className="text-primary" />
                          <span>{booking.numberOfGuests} Guests</span>
                        </div>
                        {restaurant && (
                          <div className="flex items-center gap-2">
                            <MapPin size={16} className="text-primary" />
                            <span>{restaurant.city}, {restaurant.state}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <Badge
                      variant={
                        booking.bookingStatus === "Confirmed"
                          ? "success"
                          : booking.bookingStatus === "Cancelled"
                          ? "danger"
                          : "warning"
                      }
                    >
                      {booking.bookingStatus}
                    </Badge>
                  </div>

                  <div className="mt-5 flex items-center justify-between border-t border-gray-100 pt-4">
                    <span className="text-xs font-mono text-muted">{booking.bookingCode || `ID: ${booking._id.slice(-6)}`}</span>
                    <div className="flex items-center gap-2">
                      {booking.bookingStatus !== "Cancelled" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:bg-red-50 border-red-200"
                          onClick={() => handleCancelBooking(booking._id)}
                        >
                          Cancel
                        </Button>
                      )}
                      {restaurant && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setReviewModalState({
                              isOpen: true,
                              restaurantId: restaurant._id,
                              restaurantName: restaurant.restaurantName,
                            })
                          }
                        >
                          Write Review
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <ReviewModal
        isOpen={reviewModalState.isOpen}
        onClose={() => setReviewModalState({ isOpen: false, restaurantId: null, restaurantName: "" })}
        targetType="restaurant"
        targetId={reviewModalState.restaurantId}
        targetName={reviewModalState.restaurantName}
        onSuccess={refreshBookings}
      />
    </div>
  );
}

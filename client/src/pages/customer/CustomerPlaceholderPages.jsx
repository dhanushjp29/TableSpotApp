import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import {
  Calendar,
  MapPin,
  Users,
  Heart,
  Bell,
  Star,
  Mail,
} from "lucide-react";
import toast from "react-hot-toast";

import { bookingApi } from "../../api/booking.api.js";
import { userApi } from "../../api/user.api.js";
import { subscribeToBookingUpdates } from "../../services/socket/socketService.js";

import Card from "../../components/ui/Card.jsx";
import Badge from "../../components/ui/Badge.jsx";
import Button from "../../components/ui/Button.jsx";
import Input from "../../components/ui/Input.jsx";
import { SkeletonText } from "../../components/ui/Skeleton.jsx";
import ErrorState from "../../components/ui/ErrorState.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import ReviewModal from "../../components/ui/ReviewModal.jsx";
import RestaurantCard from "../../components/restaurant/RestaurantCard.jsx";
import { formatDate, formatTime } from "../../utils/formatDate.js";

export function CustomerBookingsPage() {
  const [bookings, setBookings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [reviewModalState, setReviewModalState] = useState({
    isOpen: false,
    restaurantId: null,
    restaurantName: "",
  });

  const fetchBookings = async () => {
    try {
      const response = await bookingApi.getAll();
      setBookings(response?.data?.bookings || response?.bookings || []);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load bookings.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    bookingApi
      .getAll()
      .then((response) => {
        if (isMounted) {
          setBookings(response?.data?.bookings || response?.bookings || []);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err?.response?.data?.message || "Failed to load bookings.");
          setIsLoading(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToBookingUpdates("all", (updatedBooking) => {
      setBookings((prev) =>
        prev.map((b) => (b._id === updatedBooking._id ? updatedBooking : b))
      );
    });
    return unsubscribe;
  }, []);

  const handleCancelBooking = async (bookingId) => {
    if (!window.confirm("Are you sure you want to cancel this booking?")) return;
    try {
      await bookingApi.cancel(bookingId);
      toast.success("Booking cancelled.");
      fetchBookings();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to cancel booking.");
    }
  };

  const filteredBookings = bookings.filter((b) => {
    if (filterStatus === "ALL") return true;
    return b.bookingStatus === filterStatus;
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="p-5">
              <SkeletonText lines={3} />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        <ErrorState
          title="Unable to load bookings"
          description={error}
          onRetry={fetchBookings}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text">My Bookings</h1>
          <p className="text-sm text-muted">Manage your table reservations and write reviews</p>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap gap-2">
          {["ALL", "Pending", "Confirmed", "Completed", "Cancelled"].map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-all ${
                filterStatus === status
                  ? "bg-primary text-white shadow-sm"
                  : "bg-surface text-muted hover:bg-gray-100 border border-gray-200"
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {filteredBookings.length === 0 ? (
        <EmptyState
          title="No bookings found"
          description={
            filterStatus === "ALL"
              ? "Browse restaurants and make your first reservation."
              : `No bookings with status "${filterStatus}".`
          }
        />
      ) : (
        <div className="space-y-4">
          {filteredBookings.map((booking) => {
            const bookingDate = booking.bookingDateTime
              ? new Date(booking.bookingDateTime)
              : null;
            const restaurant =
              typeof booking.restaurantId === "object" ? booking.restaurantId : null;

            return (
              <Card key={booking._id} className="p-5 hover:shadow-md transition-shadow border border-gray-100">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-text">
                        {restaurant?.restaurantName || "Restaurant Booking"}
                      </h3>
                      {restaurant?.restaurantCode && (
                        <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted">
                          {restaurant.restaurantCode}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 space-y-1 text-sm text-muted">
                      {bookingDate && (
                        <div className="flex items-center gap-2">
                          <Calendar size={14} className="text-primary" />
                          <span>
                            {formatDate(bookingDate)} at {formatTime(bookingDate)}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Users size={14} className="text-primary" />
                        <span>{booking.numberOfGuests} guests</span>
                      </div>
                      {restaurant && (
                        <div className="flex items-center gap-2">
                          <MapPin size={14} className="text-primary" />
                          <span>
                            {restaurant.city}, {restaurant.state}
                          </span>
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
                        : booking.bookingStatus === "Completed"
                        ? "info"
                        : "warning"
                    }
                  >
                    {booking.bookingStatus || "Pending"}
                  </Badge>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
                  <span className="text-xs font-mono text-muted">{booking.bookingCode || `Ref: ${booking._id}`}</span>
                  <div className="flex items-center gap-2">
                    {booking.bookingStatus !== "Cancelled" && booking.bookingStatus !== "Completed" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 border-red-200 hover:bg-red-50"
                        onClick={() => handleCancelBooking(booking._id)}
                      >
                        Cancel Booking
                      </Button>
                    )}
                    {restaurant && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-amber-600 hover:bg-amber-50"
                        onClick={() =>
                          setReviewModalState({
                            isOpen: true,
                            restaurantId: restaurant._id,
                            restaurantName: restaurant.restaurantName,
                          })
                        }
                      >
                        <Star size={14} className="mr-1 fill-amber-400" />
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

      <ReviewModal
        isOpen={reviewModalState.isOpen}
        onClose={() => setReviewModalState({ isOpen: false, restaurantId: null, restaurantName: "" })}
        targetType="restaurant"
        targetId={reviewModalState.restaurantId}
        targetName={reviewModalState.restaurantName}
        onSuccess={fetchBookings}
      />
    </div>
  );
}

export function CustomerFavoritesPage() {
  const [restaurants, setRestaurants] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchFavorites = async () => {
    try {
      const response = await userApi.getFavoriteRestaurants();
      setRestaurants(response?.data?.restaurants || response?.restaurants || []);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load favorites.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    userApi
      .getFavoriteRestaurants()
      .then((response) => {
        if (isMounted) {
          setRestaurants(response?.data?.restaurants || response?.restaurants || []);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err?.response?.data?.message || "Failed to load favorites.");
          setIsLoading(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleToggleFavorite = async (restaurantId) => {
    try {
      await userApi.toggleFavorite(restaurantId);
      setRestaurants((prev) => prev.filter((r) => r._id !== restaurantId));
      toast.success("Removed from favorites.");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to update favorites.");
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text flex items-center gap-2">
          <Heart className="text-rose-500 fill-rose-500" size={24} />
          My Favorite Restaurants
        </h1>
        <p className="text-sm text-muted">Your saved dining spots for quick booking</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="p-5 h-48 animate-pulse bg-gray-100" />
          ))}
        </div>
      ) : error ? (
        <ErrorState title="Unable to load favorites" description={error} onRetry={fetchFavorites} />
      ) : restaurants.length === 0 ? (
        <EmptyState
          title="No favorite restaurants saved"
          description="Click the heart icon on any restaurant card to save it here for quick booking."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {restaurants.map((restaurant) => (
            <RestaurantCard
              key={restaurant._id}
              restaurant={restaurant}
              isFavorite
              onToggleFavorite={handleToggleFavorite}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function CustomerProfilePage() {
  const { user } = useSelector((state) => state.auth);

  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await userApi.updateProfile({ name, phone });
      toast.success("Profile updated successfully!");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to update profile.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text">Account Profile</h1>
        <p className="text-sm text-muted">View and update your personal details</p>
      </div>

      <Card className="p-6 sm:p-8 space-y-6 shadow-sm border border-gray-100">
        <div className="flex items-center gap-4 pb-6 border-b border-gray-100">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-2xl uppercase">
            {user?.fullName?.[0] || "U"}
          </div>
          <div>
            <h2 className="text-xl font-bold text-text">{user?.fullName}</h2>
            <p className="text-sm text-muted flex items-center gap-1 mt-0.5">
              <Mail size={14} /> {user?.email}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <Badge variant={user?.isVerified ? "success" : "warning"}>
                {user?.isVerified ? "Verified Account" : "Unverified"}
              </Badge>
              <Badge variant="info" className="uppercase">
                {user?.role}
              </Badge>
            </div>
          </div>
        </div>

        <form onSubmit={handleUpdateProfile} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text mb-1">Full Name</label>

              <Input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Your full name"
              />

          </div>

          <div>
            <label className="block text-sm font-medium text-text mb-1">Email Address</label>
            <div className="relative">
              <Input
                type="email"
                value={user?.email || ""}
                disabled
                className="bg-gray-50 text-gray-500 cursor-not-allowed"
              />
            </div>
            <p className="mt-1 text-xs text-muted">Email address cannot be changed</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-text mb-1">Phone Number</label>
            <div className="relative">
              <Input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 9876543210"
              />
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <Button type="submit" isLoading={isSubmitting} variant="primary">
              Save Changes
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

export function CustomerNotificationsPage() {
  const [notifications] = useState([
    {
      id: "1",
      title: "Booking Confirmed",
      message: "Your table reservation for 4 guests has been confirmed.",
      time: "10 mins ago",
      type: "success",
    },
    {
      id: "2",
      title: "Special Discount Available",
      message: "Enjoy 15% off your next weekend reservation at Gourmet Bistro.",
      time: "2 hours ago",
      type: "info",
    },
  ]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text flex items-center gap-2">
            <Bell size={24} className="text-primary" />
            Notifications
          </h1>
          <p className="text-sm text-muted">Stay updated with your latest booking updates</p>
        </div>
      </div>

      <div className="space-y-3">
        {notifications.map((n) => (
          <Card key={n.id} className="p-4 flex items-start gap-4 hover:bg-gray-50 transition-colors">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Bell size={18} />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-text text-sm">{n.title}</h4>
                <span className="text-xs text-muted">{n.time}</span>
              </div>
              <p className="text-xs text-muted mt-1">{n.message}</p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

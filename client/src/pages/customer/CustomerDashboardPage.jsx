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
  Star,
  Compass,
  ArrowRight,
} from "lucide-react";
import toast from "react-hot-toast";

import { bookingApi } from "../../api/booking.api.js";
import { restaurantApi } from "../../api/restaurant.api.js";
import { foodApi } from "../../api/food.api.js";
import { userApi } from "../../api/user.api.js";
import { restaurantReviewApi } from "../../api/review.api.js";
import { ROUTES } from "../../routes/routeConstants.js";
import Card from "../../components/ui/Card.jsx";
import Badge from "../../components/ui/Badge.jsx";
import Button from "../../components/ui/Button.jsx";
import { SkeletonCard, SkeletonText } from "../../components/ui/Skeleton.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import RestaurantCard from "../../components/restaurant/RestaurantCard.jsx";
import FoodCard from "../../components/food/FoodCard.jsx";
import ReviewModal from "../../components/ui/ReviewModal.jsx";
import { formatDate, formatTime } from "../../utils/formatDate.js";

export default function CustomerDashboardPage() {
  const { user } = useSelector((state) => state.auth);
  const [bookings, setBookings] = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [foods, setFoods] = useState([]);
  const [favoriteRestaurantIds, setFavoriteRestaurantIds] = useState(() => new Set());
  const [favoriteFoodIds, setFavoriteFoodIds] = useState(() => new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [reviewModalState, setReviewModalState] = useState({
    isOpen: false,
    restaurantId: null,
    restaurantName: "",
    foods: [],
    bookingId: null,
  });

  useEffect(() => {
    let isMounted = true;

    Promise.all([
      bookingApi.getAll(),
      restaurantApi.getAll({
        limit: 4,
        verificationStatus: "Verified",
        isActive: true,
        sortBy: "rating",
      }),
      foodApi.getAll({ limit: 4, isAvailable: true, sortBy: "rating" }),
      userApi.getFavoriteRestaurants().catch(() => null),
      userApi.getFavoriteFoods().catch(() => null),
    ])
      .then(
        ([bookingsRes, restaurantsRes, foodsRes, favRestRes, favFoodRes]) => {
          if (!isMounted) return;
          setBookings(bookingsRes?.data?.bookings || []);
          setRestaurants(restaurantsRes?.data?.restaurants || []);
          setFoods(foodsRes?.data?.foods || []);
          if (favRestRes) {
            setFavoriteRestaurantIds(
              new Set(
                (favRestRes?.data?.favoriteRestaurantIds || []).map(String)
              )
            );
          }
          if (favFoodRes) {
            setFavoriteFoodIds(
              new Set((favFoodRes?.data?.favoriteFoodIds || []).map(String))
            );
          }
          setIsLoading(false);
        }
      )
      .catch((err) => {
        if (isMounted) {
          console.error("Failed to load dashboard data", err);
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const refreshBookings = () => {
    bookingApi
      .getAll()
      .then((res) => setBookings(res?.data?.bookings || []))
      .catch((err) => console.error(err));
  };

  const upcomingBookings = bookings.filter(
    (b) => b.bookingStatus === "Pending" || b.bookingStatus === "Confirmed"
  );
  const completedBookings = bookings.filter(
    (b) => b.bookingStatus === "Completed"
  );
  const recentBookings = bookings.slice(0, 3);

  const handleToggleRestaurantFavorite = async (restaurantId) => {
    try {
      const res = await userApi.toggleFavorite(restaurantId);
      const isFavorite = res?.data?.isFavorite;
      setFavoriteRestaurantIds((prev) => {
        const next = new Set(prev);
        if (isFavorite) next.add(String(restaurantId));
        else next.delete(String(restaurantId));
        return next;
      });
      toast.success(isFavorite ? "Added to favorites." : "Removed from favorites.");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to update favorites.");
    }
  };

  const handleToggleFoodFavorite = async (foodId) => {
    try {
      const res = await userApi.toggleFavoriteFood(foodId);
      const isFavorite = res?.data?.isFavorite;
      setFavoriteFoodIds((prev) => {
        const next = new Set(prev);
        if (isFavorite) next.add(String(foodId));
        else next.delete(String(foodId));
        return next;
      });
      toast.success(isFavorite ? "Added to favorites." : "Removed from favorites.");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to update favorites.");
    }
  };

  const handleOpenReview = async (booking, restaurant) => {
    try {
      const res = await restaurantReviewApi.getEligibility(
        restaurant._id,
        booking?._id
      );
      if (!res?.data?.canReview) {
        toast(
          "You can write a review only after the restaurant creates your bill for this booking."
        );
        return;
      }
      // Only foods from the user's paid bill are eligible for food sub-reviews
      const billOrderedItems = res?.data?.billOrderedItems || [];
      setReviewModalState({
        isOpen: true,
        restaurantId: restaurant._id,
        restaurantName: restaurant.restaurantName,
        foods: billOrderedItems,
        bookingId: booking?._id,
      });
    } catch (err) {
      toast.error(
        err?.response?.data?.message || "Unable to start a review right now."
      );
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary via-primary/90 to-amber-600 p-6 sm:p-8 text-white shadow-xl">
        <div className="relative z-10 max-w-2xl">
          <h1 className="text-3xl font-extrabold sm:text-4xl">
            Welcome back, {user?.name || "Gourmet Guest"}!
          </h1>
          <p className="mt-2 text-white/90 text-sm sm:text-base">
            Ready for your next dining experience? Explore top-rated restaurants
            and dishes picked just for you.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link to={ROUTES.RESTAURANTS}>
              <Button variant="secondary" className="font-semibold shadow-md">
                <PlusCircle size={18} className="mr-2" />
                Book a Table
              </Button>
            </Link>
            <Link to={ROUTES.FOODS}>
              <Button variant="outline" className="border-white text-white hover:bg-white/10">
                <Utensils size={18} className="mr-2" />
                Explore Food
              </Button>
            </Link>
            <Link to={ROUTES.CUSTOMER_BOOKINGS}>
              <Button variant="ghost" className="text-white hover:bg-white/10">
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
            <p className="text-xs font-medium uppercase tracking-wider text-muted">Favorites</p>
            <Link to={ROUTES.CUSTOMER_FAVORITES} className="text-sm font-semibold text-primary hover:underline flex items-center gap-1">
              {favoriteRestaurantIds.size + favoriteFoodIds.size} saved
              <ChevronRight size={14} />
            </Link>
          </div>
        </Card>
      </div>

      {/* Recommended Restaurants */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-text flex items-center gap-2">
              <Compass size={20} className="text-primary" />
              Recommended Restaurants
            </h2>
            <p className="text-xs text-muted">Top-rated dining spots near you</p>
          </div>
          <Link to={ROUTES.RESTAURANTS} className="text-sm font-medium text-primary hover:underline flex items-center">
            Explore All <ChevronRight size={16} />
          </Link>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : restaurants.length === 0 ? (
          <Card className="p-8 text-center">
            <EmptyState
              title="No restaurants yet"
              description="Check back soon — new dining spots are being added."
              action={
                <Link to={ROUTES.RESTAURANTS}>
                  <Button variant="primary">Explore Restaurants</Button>
                </Link>
              }
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {restaurants.map((restaurant) => (
              <RestaurantCard
                key={restaurant._id}
                restaurant={restaurant}
                isFavorite={favoriteRestaurantIds.has(String(restaurant._id))}
                onToggleFavorite={handleToggleRestaurantFavorite}
              />
            ))}
          </div>
        )}
      </div>

      {/* Recommended Dishes */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-text flex items-center gap-2">
              <Star size={20} className="text-amber-500" />
              Trending Dishes
            </h2>
            <p className="text-xs text-muted">Highly rated food from verified restaurants</p>
          </div>
          <Link to={ROUTES.FOODS} className="text-sm font-medium text-primary hover:underline flex items-center">
            Explore Food <ChevronRight size={16} />
          </Link>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : foods.length === 0 ? (
          <Card className="p-8 text-center">
            <EmptyState
              title="No dishes yet"
              description="Restaurants are adding their menus — explore when they're live."
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {foods.map((food) => (
              <FoodCard
                key={food._id}
                food={food}
                isFavorite={favoriteFoodIds.has(String(food._id))}
                onToggleFavorite={handleToggleFoodFavorite}
              />
            ))}
          </div>
        )}
      </div>

      {/* Recent Bookings */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-text">Recent Bookings</h2>
            <p className="text-xs text-muted">Your latest reservations and quick actions</p>
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
        ) : recentBookings.length === 0 ? (
          <Card className="p-8 text-center">
            <EmptyState
              title="No bookings yet"
              description="Book your first table and your reservations will appear here."
              action={
                <Link to={ROUTES.RESTAURANTS}>
                  <Button variant="primary">
                    Book a Table <ArrowRight size={16} className="ml-2" />
                  </Button>
                </Link>
              }
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {recentBookings.map((booking) => {
              const bDate = booking.bookingDateTime
                ? new Date(booking.bookingDateTime)
                : null;
              const restaurant =
                typeof booking.restaurantId === "object"
                  ? booking.restaurantId
                  : null;

              return (
                <Card key={booking._id} className="p-5 hover:shadow-lg transition-all border border-gray-100">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-text truncate">
                          {restaurant?.restaurantName || "Restaurant Reservation"}
                        </h3>
                      </div>
                      <div className="mt-2 space-y-1.5 text-sm text-muted">
                        {bDate && (
                          <div className="flex items-center gap-2">
                            <Calendar size={14} className="text-primary" />
                            <span>
                              {formatDate(bDate)} at {formatTime(bDate)}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <Users size={14} className="text-primary" />
                          <span>{booking.numberOfGuests} Guests</span>
                        </div>
                        {restaurant && (
                          <div className="flex items-center gap-2">
                            <MapPin size={14} className="text-primary" />
                            <span className="truncate">
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
                      {booking.bookingStatus}
                    </Badge>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
                    <span className="text-xs font-mono text-muted">
                      {booking.bookingCode || `ID: ${booking._id.slice(-6)}`}
                    </span>
                    <div className="flex items-center gap-2">
                      {restaurant && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenReview(booking, restaurant)}
                        >
                          Write Review
                        </Button>
                      )}
                      <Link to={`/customer/bookings/${booking._id}`}>
                        <Button variant="outline" size="sm">
                          Details
                        </Button>
                      </Link>
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
        onClose={() =>
          setReviewModalState({
            isOpen: false,
            restaurantId: null,
            restaurantName: "",
            foods: [],
            bookingId: null,
          })
        }
        targetType="restaurant"
        targetId={reviewModalState.restaurantId}
        targetName={reviewModalState.restaurantName}
        foods={reviewModalState.foods}
        bookingId={reviewModalState.bookingId}
        onSuccess={refreshBookings}
      />
    </div>
  );
}

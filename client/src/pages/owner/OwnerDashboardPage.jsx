import {
  BarChart3,
  Calendar,
  CalendarClock,
  DollarSign,
  LayoutGrid,
  Star,
  TrendingUp,
  UtensilsCrossed,
} from "lucide-react";
import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";

import { fetchBills } from "../../store/slices/billSlice.js";
import { fetchBookings } from "../../store/slices/reservationSlice.js";
import { fetchFoods } from "../../store/slices/foodSlice.js";
import { fetchRestaurants } from "../../store/slices/restaurantSlice.js";
import { fetchRestaurantReviews } from "../../store/slices/reviewSlice.js";
import { fetchTables } from "../../store/slices/tableSlice.js";

import Card from "../../components/ui/Card.jsx";
import Badge from "../../components/ui/Badge.jsx";
import ErrorState from "../../components/ui/ErrorState.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import { SkeletonText } from "../../components/ui/Skeleton.jsx";
import { ROUTES } from "../../routes/routeConstants.js";
import { formatCurrency } from "../../utils/formatCurrency.js";
import { formatDate, formatTime } from "../../utils/formatDate.js";

const STATUS_VARIANT = {
  Pending: "warning",
  Confirmed: "info",
  Completed: "success",
  Cancelled: "danger",
  "No Show": "danger",
};

function StatCard({ icon: Icon, label, value, subtext, accent = "primary" }) {
  const accents = {
    primary: "border-l-primary bg-primary/10 text-primary",
    amber: "border-l-amber-500 bg-amber-500/10 text-amber-600",
    green: "border-l-green-500 bg-green-500/10 text-green-600",
    rose: "border-l-rose-500 bg-rose-500/10 text-rose-600",
    blue: "border-l-blue-500 bg-blue-500/10 text-blue-600",
    violet: "border-l-violet-500 bg-violet-500/10 text-violet-600",
  };
  const [border, chip] = accents[accent].split(" ");
  return (
    <Card className={`p-5 border-l-4 ${border}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted">{label}</p>
          <p className="mt-1 text-2xl font-bold text-text">{value}</p>
          {subtext && <p className="mt-1 text-xs text-muted">{subtext}</p>}
        </div>
        <div className={`rounded-full ${chip} p-3`}>
          <Icon size={20} />
        </div>
      </div>
    </Card>
  );
}

function OwnerDashboardPage() {
  const user = useSelector((state) => state.auth.user);
  const userId = user?._id || user?.id;
  const dispatch = useDispatch();

  const restaurants = useSelector((state) => state.restaurant.restaurants);
  const restaurantLoading = useSelector((state) => state.restaurant.isLoading);
  const restaurantError = useSelector((state) => state.restaurant.error);
  const tables = useSelector((state) => state.table.tables);
  const tableLoading = useSelector((state) => state.table.isLoading);
  const tableError = useSelector((state) => state.table.error);
  const foods = useSelector((state) => state.food.foods);
  const foodLoading = useSelector((state) => state.food.isLoading);
  const foodError = useSelector((state) => state.food.error);
  const bookings = useSelector((state) => state.reservation.bookings);
  const bookingLoading = useSelector((state) => state.reservation.isLoading);
  const bookingError = useSelector((state) => state.reservation.error);
  const reviews = useSelector((state) => state.review.restaurantReviews);
  const reviewLoading = useSelector((state) => state.review.isLoading);
  const reviewError = useSelector((state) => state.review.error);
  const bills = useSelector((state) => state.bill.bills);
  const billLoading = useSelector((state) => state.bill.isLoading);
  const billError = useSelector((state) => state.bill.error);

  const isLoading =
    restaurantLoading ||
    tableLoading ||
    foodLoading ||
    bookingLoading ||
    reviewLoading ||
    billLoading;
  const error =
    restaurantError ||
    tableError ||
    foodError ||
    bookingError ||
    reviewError ||
    billError;

  useEffect(() => {
    Promise.all([
      dispatch(fetchRestaurants({ ownerId: userId, limit: 100 })),
      dispatch(fetchTables({ limit: 100 })),
      dispatch(fetchFoods({ limit: 100 })),
      dispatch(fetchBookings({ limit: 100 })),
      dispatch(fetchRestaurantReviews({ ownerId: userId, limit: 100 })),
      dispatch(fetchBills({ limit: 100 })),
    ]).catch(() => {});
  }, [userId, dispatch]);

  const { stats, recentBookings } = useMemo(() => {
    const paidBills = bills.filter(
      (b) => b.billStatus === "Paid" || b.payment?.paymentStatus === "Paid"
    );
    const revenue = paidBills.reduce(
      (sum, b) => sum + Number(b.grandTotal || 0),
      0
    );
    const avgRating = reviews.length
      ? (
          reviews.reduce((sum, r) => sum + Number(r.rating || 0), 0) /
          reviews.length
        ).toFixed(1)
      : "0.0";

    return {
      stats: {
        totalRestaurants: restaurants.length,
        totalTables: tables.length,
        totalFoods: foods.length,
        totalBookings: bookings.length,
        pendingBookings: bookings.filter(
          (b) => b.bookingStatus === "Pending"
        ).length,
        totalReviews: reviews.length,
        avgRating,
        revenue,
      },
      recentBookings: bookings.slice(0, 5),
    };
  }, [restaurants, tables, foods, bookings, reviews, bills]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6">
          <SkeletonText lines={2} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
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
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <ErrorState
          title="Unable to load dashboard"
          description={error}
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-text">
          Welcome back, {user?.fullName || "Owner"}!
        </h1>
        <p className="mt-1 text-sm text-muted">
          Here's what's happening across your restaurants today.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          icon={UtensilsCrossed}
          label="Restaurants"
          value={stats.totalRestaurants}
          subtext="Your listings"
          accent="primary"
        />
        <StatCard
          icon={Calendar}
          label="Bookings"
          value={stats.totalBookings}
          subtext={`${stats.pendingBookings} pending approval`}
          accent="amber"
        />
        <StatCard
          icon={LayoutGrid}
          label="Tables"
          value={stats.totalTables}
          subtext="Across all restaurants"
          accent="blue"
        />
        <StatCard
          icon={BarChart3}
          label="Menu Items"
          value={stats.totalFoods}
          subtext="Active dishes"
          accent="violet"
        />
        <StatCard
          icon={Star}
          label="Reviews"
          value={`${stats.avgRating} ★`}
          subtext={`${stats.totalReviews} reviews received`}
          accent="green"
        />
        <StatCard
          icon={DollarSign}
          label="Revenue"
          value={formatCurrency(stats.revenue)}
          subtext="From paid bills"
          accent="rose"
        />
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-text">Quick Actions</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link to={ROUTES.OWNER_RESTAURANT}>
            <Card className="p-5 transition-all hover:shadow-md cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-primary/10 p-2.5">
                  <UtensilsCrossed size={18} className="text-primary" />
                </div>
                <div>
                  <p className="font-medium text-text">Manage Restaurant</p>
                  <p className="text-xs text-muted">Edit details & settings</p>
                </div>
              </div>
            </Card>
          </Link>
          <Link to={ROUTES.OWNER_TABLES}>
            <Card className="p-5 transition-all hover:shadow-md cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-primary/10 p-2.5">
                  <BarChart3 size={18} className="text-primary" />
                </div>
                <div>
                  <p className="font-medium text-text">Manage Tables</p>
                  <p className="text-xs text-muted">Add or update tables</p>
                </div>
              </div>
            </Card>
          </Link>
          <Link to={ROUTES.OWNER_FOODS}>
            <Card className="p-5 transition-all hover:shadow-md cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-primary/10 p-2.5">
                  <TrendingUp size={18} className="text-primary" />
                </div>
                <div>
                  <p className="font-medium text-text">Manage Menu</p>
                  <p className="text-xs text-muted">Add or update food items</p>
                </div>
              </div>
            </Card>
          </Link>
        </div>
      </div>

      {/* Recent Bookings */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text flex items-center gap-2">
            <CalendarClock size={20} className="text-primary" />
            Recent Reservations
          </h2>
          <Link
            to={ROUTES.OWNER_RESERVATIONS}
            className="text-sm font-medium text-primary hover:underline"
          >
            View All
          </Link>
        </div>

        {recentBookings.length === 0 ? (
          <Card className="p-8 text-center">
            <EmptyState
              title="No bookings yet"
              description="When customers reserve a table, their bookings will appear here."
            />
          </Card>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border bg-surface shadow-sm">
            <table className="w-full text-left text-sm text-text">
              <thead className="bg-surface-secondary/60 text-xs uppercase font-semibold text-muted border-b border-border">
                <tr>
                  <th className="px-5 py-3">Guest</th>
                  <th className="px-5 py-3">Restaurant</th>
                  <th className="px-5 py-3">Date & Time</th>
                  <th className="px-5 py-3">Guests</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70 font-medium">
                {recentBookings.map((booking) => {
                  const restaurant =
                    typeof booking.restaurantId === "object"
                      ? booking.restaurantId
                      : null;
                  const customer =
                    typeof booking.userId === "object" ? booking.userId : null;
                  const bDate = booking.bookingDateTime
                    ? new Date(booking.bookingDateTime)
                    : null;
                  return (
                    <tr key={booking._id} className="transition-colors hover:bg-primary/[0.04] dark:hover:bg-white/[0.03]">
                      <td className="px-5 py-3 font-semibold text-text">
                        {customer?.fullName || "Guest"}
                      </td>
                      <td className="px-5 py-3 text-xs text-muted">
                        {restaurant?.restaurantName || "—"}
                      </td>
                      <td className="px-5 py-3 text-xs text-muted">
                        {bDate
                          ? `${formatDate(bDate)} at ${formatTime(bDate)}`
                          : "—"}
                      </td>
                      <td className="px-5 py-3">{booking.numberOfGuests}</td>
                      <td className="px-5 py-3">
                        <Badge
                          variant={STATUS_VARIANT[booking.bookingStatus] || "default"}
                        >
                          {booking.bookingStatus}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default OwnerDashboardPage;

import { BarChart3, Calendar, DollarSign, Star, TrendingUp, UtensilsCrossed } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { bookingApi } from "../../api/booking.api.js";
import { restaurantApi } from "../../api/restaurant.api.js";
import { restaurantReviewApi } from "../../api/review.api.js";

import Card from "../../components/ui/Card.jsx";
import ErrorState from "../../components/ui/ErrorState.jsx";
import { SkeletonText } from "../../components/ui/Skeleton.jsx";
import { ROUTES } from "../../routes/routeConstants.js";
import { formatCurrency } from "../../utils/formatCurrency.js";

function StatCard({ icon: Icon, label, value, subtext }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted">{label}</p>
          <p className="mt-1 text-2xl font-bold text-text">{value}</p>
          {subtext && <p className="mt-1 text-xs text-muted">{subtext}</p>}
        </div>
        <div className="rounded-full bg-primary/10 p-3">
          <Icon size={20} className="text-primary" />
        </div>
      </div>
    </Card>
  );
}

function OwnerDashboardPage() {
  const [stats, setStats] = useState({
    totalRestaurants: 0,
    totalBookings: 0,
    totalReviews: 0,
    totalRevenue: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [restaurantsRes, bookingsRes, reviewsRes] = await Promise.all([
          restaurantApi.getAll({ isActive: true }),
          bookingApi.getAll({ limit: 1 }),
          restaurantReviewApi.getAll({ limit: 1 }),
        ]);

        const restaurants = restaurantsRes?.data?.restaurants || [];
        const bookings = bookingsRes?.bookings || [];
        const reviews = reviewsRes?.reviews || [];

        const totalRevenue = bookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);

        setStats({
          totalRestaurants: restaurants.length,
          totalBookings: bookings.length,
          totalReviews: reviews.length,
          totalRevenue,
        });
      } catch (err) {
        setError(err?.response?.data?.message || "Failed to load dashboard data.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6">
          <SkeletonText lines={2} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
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
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text">Owner Dashboard</h1>
        <p className="mt-1 text-sm text-muted">
          Manage your restaurants, tables, foods, and bookings.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={UtensilsCrossed}
          label="Restaurants"
          value={stats.totalRestaurants}
          subtext="Active restaurants"
        />
        <StatCard
          icon={Calendar}
          label="Bookings"
          value={stats.totalBookings}
          subtext="Total bookings"
        />
        <StatCard
          icon={Star}
          label="Reviews"
          value={stats.totalReviews}
          subtext="Customer reviews"
        />
        <StatCard
          icon={DollarSign}
          label="Revenue"
          value={formatCurrency(stats.totalRevenue)}
          subtext="Total earnings"
        />
      </div>

      {/* Quick Actions */}
      <div className="mt-8">
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
    </div>
  );
}

export default OwnerDashboardPage;

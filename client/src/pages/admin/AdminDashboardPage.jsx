import { useEffect, useState } from "react";

import { restaurantApi } from "../../api/restaurant.api.js";
import { restaurantReviewApi } from "../../api/review.api.js";
import { userApi } from "../../api/user.api.js";

import Card from "../../components/ui/Card.jsx";
import ErrorState from "../../components/ui/ErrorState.jsx";
import { SkeletonText } from "../../components/ui/Skeleton.jsx";

function AdminDashboardPage() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalRestaurants: 0,
    totalReviews: 0,
    pendingVerifications: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [usersRes, restaurantsRes, reviewsRes] = await Promise.all([
          userApi.getAll(),
          restaurantApi.getAll(),
          restaurantReviewApi.getAll({ limit: 1 }),
        ]);

        const users = usersRes?.users || [];
        const restaurants = restaurantsRes?.restaurants || [];
        const reviews = reviewsRes?.reviews || [];
        const pendingVerifications = restaurants.filter(
          (r) => r.verificationStatus === "Pending"
        ).length;

        setStats({
          totalUsers: users.length,
          totalRestaurants: restaurants.length,
          totalReviews: reviews.length,
          pendingVerifications,
        });
      } catch (err) {
        setError(err?.response?.data?.message || "Failed to load admin dashboard.");
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
          title="Unable to load admin dashboard"
          description={error}
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text">Admin Dashboard</h1>
        <p className="mt-1 text-sm text-muted">
          Platform overview, moderation, and reporting.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5">
          <p className="text-sm text-muted">Total Users</p>
          <p className="mt-1 text-2xl font-bold text-text">{stats.totalUsers}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted">Restaurants</p>
          <p className="mt-1 text-2xl font-bold text-text">{stats.totalRestaurants}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted">Reviews</p>
          <p className="mt-1 text-2xl font-bold text-text">{stats.totalReviews}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted">Pending Verifications</p>
          <p className="mt-1 text-2xl font-bold text-text">{stats.pendingVerifications}</p>
        </Card>
      </div>
    </div>
  );
}

export default AdminDashboardPage;

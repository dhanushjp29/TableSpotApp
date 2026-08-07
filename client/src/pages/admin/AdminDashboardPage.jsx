import { useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";

import { fetchUsers } from "../../store/slices/userSlice.js";
import { fetchRestaurants } from "../../store/slices/restaurantSlice.js";
import { fetchRestaurantReviews } from "../../store/slices/reviewSlice.js";

import Card from "../../components/ui/Card.jsx";
import ErrorState from "../../components/ui/ErrorState.jsx";
import { SkeletonText } from "../../components/ui/Skeleton.jsx";

function AdminDashboardPage() {
  const dispatch = useDispatch();
  const users = useSelector((state) => state.user.users);
  const restaurants = useSelector((state) => state.restaurant.restaurants);
  const restaurantReviews = useSelector(
    (state) => state.review.restaurantReviews
  );
  const usersLoading = useSelector((state) => state.user.isLoading);
  const restaurantsLoading = useSelector((state) => state.restaurant.isLoading);
  const reviewsLoading = useSelector((state) => state.review.isLoading);
  const usersError = useSelector((state) => state.user.error);
  const restaurantsError = useSelector((state) => state.restaurant.error);
  const reviewsError = useSelector((state) => state.review.error);

  const isLoading = usersLoading || restaurantsLoading || reviewsLoading;
  const error = usersError || restaurantsError || reviewsError;

  const stats = useMemo(() => {
    const pendingVerifications = restaurants.filter(
      (r) => r.verificationStatus === "Pending"
    ).length;
    return {
      totalUsers: users.length,
      totalRestaurants: restaurants.length,
      totalReviews: restaurantReviews.length,
      pendingVerifications,
    };
  }, [users, restaurants, restaurantReviews]);

  useEffect(() => {
    dispatch(fetchUsers()).catch(() => {});
    dispatch(fetchRestaurants()).catch(() => {});
    dispatch(fetchRestaurantReviews({ limit: 1 })).catch(() => {});
  }, [dispatch]);

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

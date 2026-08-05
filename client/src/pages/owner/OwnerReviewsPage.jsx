import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { Star, MessageSquare, ThumbsUp } from "lucide-react";

import { restaurantReviewApi, foodReviewApi } from "../../api/review.api.js";
import { restaurantApi } from "../../api/restaurant.api.js";
import Card from "../../components/ui/Card.jsx";
import Badge from "../../components/ui/Badge.jsx";
import Rating from "../../components/ui/Rating.jsx";
import { SkeletonText } from "../../components/ui/Skeleton.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import ErrorState from "../../components/ui/ErrorState.jsx";
import { formatDate } from "../../utils/formatDate.js";

export default function OwnerReviewsPage() {
  const user = useSelector((state) => state.auth.user);
  const [restaurantReviews, setRestaurantReviews] = useState([]);
  const [foodReviews, setFoodReviews] = useState([]);
  const [restaurant, setRestaurant] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("restaurant"); // 'restaurant' or 'food'
  const [starFilter, setStarFilter] = useState(0);

  const loadReviews = async () => {
    const restRes = await restaurantApi.getAll({
      ownerId: user?.id,
      isActive: true,
    });
    const restaurants = restRes.data?.restaurants || [];

    let allRestaurantReviews = [];
    let allFoodReviews = [];

    for (const r of restaurants) {
      const [rRevRes, fRevRes] = await Promise.all([
        restaurantReviewApi.getByRestaurant(r._id),
        foodReviewApi.getByRestaurant(r._id),
      ]);
      allRestaurantReviews = allRestaurantReviews.concat(
        rRevRes?.data?.reviews || []
      );
      allFoodReviews = allFoodReviews.concat(fRevRes?.data?.reviews || []);
    }

    return { restaurants, allRestaurantReviews, allFoodReviews };
  };

  const fetchReviews = async () => {
    try {
      const { restaurants, allRestaurantReviews, allFoodReviews } =
        await loadReviews();
      setRestaurant(restaurants[0] || null);
      setRestaurantReviews(allRestaurantReviews);
      setFoodReviews(allFoodReviews);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load customer reviews.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        const restRes = await restaurantApi.getAll({
          ownerId: user?.id,
          isActive: true,
        });
        const restaurants = restRes.data?.restaurants || [];

        let allRestaurantReviews = [];
        let allFoodReviews = [];

        for (const r of restaurants) {
          const [rRevRes, fRevRes] = await Promise.all([
            restaurantReviewApi.getByRestaurant(r._id),
            foodReviewApi.getByRestaurant(r._id),
          ]);
          allRestaurantReviews = allRestaurantReviews.concat(
            rRevRes?.data?.reviews || []
          );
          allFoodReviews = allFoodReviews.concat(fRevRes?.data?.reviews || []);
        }

        if (isMounted) {
          setRestaurant(restaurants[0] || null);
          setRestaurantReviews(allRestaurantReviews);
          setFoodReviews(allFoodReviews);
        }
      } catch (err) {
        if (isMounted) {
          setError(err?.response?.data?.message || "Failed to load customer reviews.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    load();
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentList = activeTab === "restaurant" ? restaurantReviews : foodReviews;

  const filteredReviews = currentList.filter((r) => {
    if (starFilter === 0) return true;
    return Math.round(r.rating) === starFilter;
  });

  const avgRating =
    currentList.length > 0
      ? (currentList.reduce((acc, r) => acc + (r.rating || 0), 0) / currentList.length).toFixed(1)
      : "0.0";

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text flex items-center gap-2">
          <Star className="text-amber-500 fill-amber-500" size={24} />
          Customer Reviews & Ratings
        </h1>
        <p className="text-sm text-muted">
          Feedback and ratings submitted by guests for {restaurant?.restaurantName || "your restaurant"}
        </p>
      </div>

      {/* Summary Stat Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Card className="p-5 flex items-center gap-4 bg-gradient-to-br from-amber-500/10 to-orange-500/5 border-amber-200">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500 text-white font-bold text-2xl shadow-md">
            {avgRating}
          </div>
          <div>
            <Rating value={Number(avgRating)} showText={false} size={20} />
            <p className="text-xs text-muted mt-1">
              Based on {currentList.length} total reviews
            </p>
          </div>
        </Card>

        <Card className="p-5 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <MessageSquare size={24} />
          </div>
          <div>
            <p className="text-xs uppercase font-medium tracking-wider text-muted">Restaurant Reviews</p>
            <p className="text-2xl font-bold text-text">{restaurantReviews.length}</p>
          </div>
        </Card>

        <Card className="p-5 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-500/10 text-green-600">
            <ThumbsUp size={24} />
          </div>
          <div>
            <p className="text-xs uppercase font-medium tracking-wider text-muted">Food Dish Reviews</p>
            <p className="text-2xl font-bold text-text">{foodReviews.length}</p>
          </div>
        </Card>
      </div>

      {/* Tabs and Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveTab("restaurant")}
            className={`pb-2 text-sm font-semibold border-b-2 transition-all ${
              activeTab === "restaurant"
                ? "border-primary text-primary"
                : "border-transparent text-muted hover:text-text"
            }`}
          >
            Restaurant Reviews ({restaurantReviews.length})
          </button>
          <button
            onClick={() => setActiveTab("food")}
            className={`pb-2 text-sm font-semibold border-b-2 transition-all ${
              activeTab === "food"
                ? "border-primary text-primary"
                : "border-transparent text-muted hover:text-text"
            }`}
          >
            Food Dish Reviews ({foodReviews.length})
          </button>
        </div>

        {/* Star Rating Filter */}
        <div className="flex items-center gap-1">
          <span className="text-xs font-semibold text-muted mr-1">Filter:</span>
          {[0, 5, 4, 3, 2, 1].map((s) => (
            <button
              key={s}
              onClick={() => setStarFilter(s)}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md border ${
                starFilter === s
                  ? "bg-amber-500 text-white border-amber-500"
                  : "bg-surface text-muted hover:bg-gray-100 border-gray-200"
              }`}
            >
              {s === 0 ? "All" : `${s} ★`}
            </button>
          ))}
        </div>
      </div>

      {/* Reviews List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <Card key={i} className="p-5">
              <SkeletonText lines={3} />
            </Card>
          ))}
        </div>
      ) : error ? (
        <ErrorState title="Unable to load reviews" description={error} onRetry={fetchReviews} />
      ) : filteredReviews.length === 0 ? (
        <EmptyState
          title="No reviews yet"
          description="Customer reviews and ratings for this category will be displayed here."
        />
      ) : (
        <div className="space-y-4">
          {filteredReviews.map((rev) => {
            const userObj = typeof rev.userId === "object" ? rev.userId : null;
            const foodObj = typeof rev.foodId === "object" ? rev.foodId : null;

            return (
              <Card key={rev._id} className="p-5 hover:shadow-md transition-shadow border border-gray-100">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">
                      {userObj?.fullName?.[0] || "U"}
                    </div>
                    <div>
                      <h4 className="font-semibold text-text text-sm">
                        {userObj?.fullName || "Verified Customer"}
                      </h4>
                      <p className="text-xs text-muted">
                        {rev.createdAt ? formatDate(new Date(rev.createdAt)) : "Recently"}
                      </p>
                    </div>
                  </div>

                  <Rating value={rev.rating || 5} size={16} />
                </div>

                {foodObj && (
                  <div className="mt-2 inline-block">
                    <Badge variant="info">Dish: {foodObj.foodName}</Badge>
                  </div>
                )}

                {rev.comment && (
                  <p className="mt-3 text-sm text-text bg-gray-50/80 p-3 rounded-lg italic">
                    "{rev.comment}"
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

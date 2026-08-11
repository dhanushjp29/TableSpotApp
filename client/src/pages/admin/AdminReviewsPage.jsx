import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  CornerDownRight,
  FolderOpen,
  MessageSquare,
  Star,
  Utensils,
} from "lucide-react";

import { fetchRestaurants } from "../../store/slices/restaurantSlice.js";
import {
  setFoodReviews,
  setRestaurantReviews,
} from "../../store/slices/reviewSlice.js";
import { restaurantReviewApi, foodReviewApi } from "../../api/review.api.js";

import Badge from "../../components/ui/Badge.jsx";
import Card from "../../components/ui/Card.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import ErrorState from "../../components/ui/ErrorState.jsx";
import Rating from "../../components/ui/Rating.jsx";
import RestaurantFilter from "../../components/owner/RestaurantFilter.jsx";
import { SkeletonText } from "../../components/ui/Skeleton.jsx";
import { formatDate } from "../../utils/formatDate.js";

const STATUS_VARIANT = {
  Pending: "warning",
  Published: "success",
  Hidden: "default",
  Rejected: "danger",
};

export default function AdminReviewsPage() {
  const dispatch = useDispatch();
  const restaurantReviews = useSelector((state) => state.review.restaurantReviews);
  const foodReviews = useSelector((state) => state.review.foodReviews);
  const reviewLoading = useSelector((state) => state.review.isLoading);
  const reviewError = useSelector((state) => state.review.error);
  const restaurants = useSelector((state) => state.restaurant.restaurants);

  const [activeTab, setActiveTab] = useState("restaurant"); // 'restaurant' or 'food'
  const [starFilter, setStarFilter] = useState(0);
  const [selectedRestaurant, setSelectedRestaurant] = useState("");

  const isLoading = reviewLoading;
  const error = reviewError;

  const loadReviews = async () => {
    const params = {
      limit: 100,
      ...(selectedRestaurant ? { restaurantId: selectedRestaurant } : {}),
    };

    const restRes = await restaurantReviewApi.getAll(params);
    const foodRes = await foodReviewApi.getAll(params);

    dispatch(
      setRestaurantReviews({
        reviews: restRes?.data?.reviews || [],
        meta: restRes?.data?.meta || null,
      })
    );
    dispatch(
      setFoodReviews({
        reviews: foodRes?.data?.reviews || [],
        meta: foodRes?.data?.meta || null,
      })
    );
  };

  const fetchReviews = async () => {
    try {
      await loadReviews();
    } catch {
      // Error is surfaced via the `error` selectors of the underlying slices.
    }
  };

  useEffect(() => {
    dispatch(fetchRestaurants({ limit: 100 })).catch(() => {});
  }, [dispatch]);

  useEffect(() => {
    fetchReviews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRestaurant]);

  const currentList = activeTab === "restaurant" ? restaurantReviews : foodReviews;

  const filterByStar = (list) =>
    starFilter === 0 ? list : list.filter((r) => Math.round(r.rating) === starFilter);

  const filteredReviews = filterByStar(currentList);

  const avgRating =
    currentList.length > 0
      ? (
          currentList.reduce((acc, r) => acc + (r.rating || 0), 0) /
          currentList.length
        ).toFixed(1)
      : "0.0";

  const totalReviews = restaurantReviews.length + foodReviews.length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
      <div className="max-w-xs">
        <RestaurantFilter
          restaurants={restaurants}
          value={selectedRestaurant}
          onChange={setSelectedRestaurant}
        />
      </div>

      <div>
        <h1 className="text-2xl font-bold text-text flex items-center gap-2">
          <Star className="text-amber-500 fill-amber-500" size={24} />
          Review Moderation
        </h1>
        <p className="text-sm text-muted">
          Customer reviews and ratings submitted across the platform
        </p>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <Card className="p-5 flex items-center gap-4 border border-amber-200/70 bg-gradient-to-br from-amber-500/10 to-orange-500/5 shadow-sm">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500 text-white font-bold text-2xl shadow-md">
            {avgRating}
          </div>
          <div>
            <Rating value={Number(avgRating)} showText={false} size={20} />
            <p className="text-xs text-muted mt-1">
              Avg rating · {currentList.length} reviews
            </p>
          </div>
        </Card>

        <Card className="p-5 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <FolderOpen size={24} />
          </div>
          <div>
            <p className="text-xs uppercase font-medium tracking-wider text-muted">Total Reviews</p>
            <p className="text-2xl font-bold text-text">{totalReviews}</p>
          </div>
        </Card>

        <Card className="p-5 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
            <MessageSquare size={24} />
          </div>
          <div>
            <p className="text-xs uppercase font-medium tracking-wider text-muted">Restaurant Reviews</p>
            <p className="text-2xl font-bold text-text">{restaurantReviews.length}</p>
          </div>
        </Card>

        <Card className="p-5 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-500/10 text-green-600">
            <Utensils size={24} />
          </div>
          <div>
            <p className="text-xs uppercase font-medium tracking-wider text-muted">Food Dish Reviews</p>
            <p className="text-2xl font-bold text-text">{foodReviews.length}</p>
          </div>
        </Card>
      </div>

      {/* Tabs and Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-3">
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
                  : "border border-border bg-surface-secondary/70 text-muted hover:bg-surface-hover hover:text-text"
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
          title="No reviews found"
          description="No customer reviews match the current filters."
        />
      ) : (
        <div className="space-y-4">
          {filteredReviews.map((rev) => {
            const userObj = typeof rev.userId === "object" ? rev.userId : null;
            const restaurantObj =
              typeof rev.restaurantId === "object" ? rev.restaurantId : null;
            const foodObj = typeof rev.foodId === "object" ? rev.foodId : null;
            const bookingObj = typeof rev.bookingId === "object" ? rev.bookingId : null;

            return (
              <Card key={rev._id} className="p-5 transition-all hover:-translate-y-px hover:shadow-md border border-border">
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
                        {userObj?.email ? `${userObj.email} · ` : ""}
                        {rev.reviewCode}
                        {" · "}
                        {rev.createdAt ? formatDate(new Date(rev.createdAt)) : "Recently"}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5">
                    <Rating value={rev.rating || 5} size={16} />
                    <Badge variant={STATUS_VARIANT[rev.status] || "default"}>
                      {rev.status || "Pending"}
                    </Badge>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {restaurantObj && (
                    <Badge variant="info">
                      {restaurantObj.restaurantName || "Restaurant"}
                      {restaurantObj.restaurantCode
                        ? ` · ${restaurantObj.restaurantCode}`
                        : ""}
                    </Badge>
                  )}
                  {foodObj && (
                    <Badge variant="warning">
                      Dish: {foodObj.foodName || "Food item"}
                      {foodObj.foodCode ? ` · ${foodObj.foodCode}` : ""}
                    </Badge>
                  )}
                  {bookingObj && (
                    <Badge variant="default">
                      Booking{" "}
                      {bookingObj.bookingCode ||
                        (bookingObj._id ? String(bookingObj._id) : "")}
                      {bookingObj.bookingDateTime
                        ? ` · ${formatDate(new Date(bookingObj.bookingDateTime))}`
                        : ""}
                    </Badge>
                  )}
                </div>

                {rev.title && (
                  <p className="mt-3 text-sm font-semibold text-text">{rev.title}</p>
                )}

                {rev.comment && (
                  <p className="mt-1 rounded-lg border border-border bg-surface-secondary/60 p-3 text-sm italic text-text">
                    "{rev.comment}"
                  </p>
                )}

                {rev.images?.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {rev.images.map((img, idx) => (
                      <img
                        key={idx}
                        src={img}
                        alt={`Review image ${idx + 1}`}
                        className="h-20 w-20 rounded-lg object-cover border border-border"
                        loading="lazy"
                      />
                    ))}
                  </div>
                )}

                {/* Owner reply */}
                {rev.ownerReply ? (
                  <div className="mt-4 flex gap-2 rounded-lg border border-primary/15 bg-primary/5 p-3">
                    <CornerDownRight
                      size={16}
                      className="mt-0.5 shrink-0 text-primary"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-primary">
                        Owner Reply
                        {rev.ownerRepliedAt
                          ? ` • ${formatDate(new Date(rev.ownerRepliedAt))}`
                          : ""}
                      </p>
                      <p className="mt-0.5 text-sm text-text">{rev.ownerReply}</p>
                    </div>
                  </div>
                ) : (
                  <p className="mt-4 text-xs italic text-muted">No owner reply yet.</p>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
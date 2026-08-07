import { useEffect, useState } from "react";
import { useDispatch, useSelector, useStore } from "react-redux";
import { Star, MessageSquare, ThumbsUp, CornerDownRight } from "lucide-react";
import toast from "react-hot-toast";

import { fetchRestaurants } from "../../store/slices/restaurantSlice.js";
import {
  fetchFoodReviewsByRestaurant,
  fetchRestaurantReviewsByRestaurant,
  setFoodReviews,
  setRestaurantReviews,
  updateFoodReview,
  updateRestaurantReview,
} from "../../store/slices/reviewSlice.js";
import Card from "../../components/ui/Card.jsx";
import Badge from "../../components/ui/Badge.jsx";
import Rating from "../../components/ui/Rating.jsx";
import Button from "../../components/ui/Button.jsx";
import { SkeletonText } from "../../components/ui/Skeleton.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import ErrorState from "../../components/ui/ErrorState.jsx";
import { formatDate } from "../../utils/formatDate.js";

export default function OwnerReviewsPage() {
  const user = useSelector((state) => state.auth.user);
  const dispatch = useDispatch();
  const store = useStore();
  const restaurantReviews = useSelector((state) => state.review.restaurantReviews);
  const foodReviews = useSelector((state) => state.review.foodReviews);
  const reviewLoading = useSelector((state) => state.review.isLoading);
  const reviewError = useSelector((state) => state.review.error);
  const restaurants = useSelector((state) => state.restaurant.restaurants);
  const restaurantLoading = useSelector((state) => state.restaurant.isLoading);
  const restaurantError = useSelector((state) => state.restaurant.error);
  const [activeTab, setActiveTab] = useState("restaurant"); // 'restaurant' or 'food'
  const [starFilter, setStarFilter] = useState(0);
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyDraft, setReplyDraft] = useState({});
  const [isReplying, setIsReplying] = useState(false);

  const restaurant = restaurants[0] || null;
  const isLoading = reviewLoading || restaurantLoading;
  const error = reviewError || restaurantError;

  const loadReviews = async () => {
    let allRestaurantReviews = [];
    let allFoodReviews = [];

    const restRes = await dispatch(
      fetchRestaurants({ ownerId: user?.id, isActive: true })
    );
    const ownedRestaurants =
      restRes?.data?.restaurants ||
      store.getState().restaurant.restaurants ||
      [];

    for (const r of ownedRestaurants) {
      const [rRevRes, fRevRes] = await Promise.all([
        dispatch(fetchRestaurantReviewsByRestaurant(r._id, { limit: 100 })),
        dispatch(fetchFoodReviewsByRestaurant(r._id, { limit: 100 })),
      ]);
      allRestaurantReviews = allRestaurantReviews.concat(
        rRevRes?.data?.reviews || []
      );
      allFoodReviews = allFoodReviews.concat(fRevRes?.data?.reviews || []);
    }

    dispatch(setRestaurantReviews({ reviews: allRestaurantReviews, meta: null }));
    dispatch(setFoodReviews({ reviews: allFoodReviews, meta: null }));
  };

  const fetchReviews = async () => {
    try {
      await loadReviews();
    } catch {
      // Error is captured in the review slice; surface via `error` selector.
    }
  };

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        await loadReviews();
      } catch {
        // Error is captured in the review slice; surface via `error` selector.
      } finally {
        if (isMounted) {
          // no-op: loading state lives in the slices
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

  const handleToggleReply = (reviewId) => {
    setReplyingTo((prev) => (prev === reviewId ? null : reviewId));
  };

  const handleSaveReply = async (review) => {
    const text = (replyDraft[review._id] || "").trim();
    if (!text) {
      toast.error("Please write a reply before saving.");
      return;
    }
    setIsReplying(true);
    try {
      if (activeTab === "restaurant") {
        await dispatch(updateRestaurantReview(review._id, { ownerReply: text }));
      } else {
        await dispatch(updateFoodReview(review._id, { ownerReply: text }));
      }
      toast.success("Reply posted to the customer.");
      setReplyingTo(null);
      setReplyDraft((prev) => ({ ...prev, [review._id]: "" }));
      await fetchReviews();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to save reply.");
    } finally {
      setIsReplying(false);
    }
  };

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

                {rev.images?.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {rev.images.map((img, idx) => (
                      <img
                        key={idx}
                        src={img}
                        alt={`Review image ${idx + 1}`}
                        className="h-20 w-20 rounded-lg object-cover border border-gray-100"
                        loading="lazy"
                      />
                    ))}
                  </div>
                )}

                {/* Owner reply */}
                {rev.ownerReply && (
                  <div className="mt-4 flex gap-2 rounded-lg border border-primary/15 bg-primary/5 p-3">
                    <CornerDownRight
                      size={16}
                      className="mt-0.5 shrink-0 text-primary"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-primary">
                        Your reply
                        {rev.ownerRepliedAt
                          ? ` • ${formatDate(new Date(rev.ownerRepliedAt))}`
                          : ""}
                      </p>
                      <p className="mt-0.5 text-sm text-text">{rev.ownerReply}</p>
                    </div>
                  </div>
                )}

                {replyingTo === rev._id ? (
                  <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50/60 p-3">
                    <label className="mb-1 block text-xs font-medium text-muted">
                      Reply to this review
                    </label>
                    <textarea
                      rows={3}
                      value={replyDraft[rev._id] || ""}
                      onChange={(e) =>
                        setReplyDraft((prev) => ({
                          ...prev,
                          [rev._id]: e.target.value,
                        }))
                      }
                      placeholder="Thank the guest and address their feedback..."
                      className="w-full rounded-lg border border-gray-200 p-2 text-sm focus:border-primary focus:outline-none"
                    />
                    <div className="mt-2 flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleToggleReply(rev._id)}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        isLoading={isReplying}
                        onClick={() => handleSaveReply(rev)}
                      >
                        Post Reply
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleToggleReply(rev._id)}
                    >
                      <CornerDownRight size={14} className="mr-1" />
                      {rev.ownerReply ? "Edit Reply" : "Reply"}
                    </Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

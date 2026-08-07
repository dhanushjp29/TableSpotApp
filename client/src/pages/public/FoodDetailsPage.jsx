import { ArrowLeft, Pencil, Star, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";

import { foodApi } from "../../api/food.api.js";
import { foodReviewApi, restaurantReviewApi } from "../../api/review.api.js";
import { useAuth } from "../../hooks/useAuth.js";

import Badge from "../../components/ui/Badge.jsx";
import Button from "../../components/ui/Button.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import ErrorState from "../../components/ui/ErrorState.jsx";
import Rating from "../../components/ui/Rating.jsx";
import ReviewModal from "../../components/ui/ReviewModal.jsx";
import Skeleton, { SkeletonText } from "../../components/ui/Skeleton.jsx";
import { formatCurrency } from "../../utils/formatCurrency.js";

function FoodDetailsPage() {
  const { foodId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const [food, setFood] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [editingReview, setEditingReview] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [foodRes, reviewsRes] = await Promise.all([
          foodApi.getById(foodId),
          foodReviewApi.getByFood(foodId, { limit: 5 }),
        ]);

        setFood(foodRes.data?.food || foodRes.data);
        setReviews(reviewsRes.data?.reviews || []);
      } catch (err) {
        setError(err?.response?.data?.message || "Failed to load food details.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [foodId]);

  const restaurantIdForFood = food?.restaurantId?._id || food?.restaurantId || null;

  const refreshReviews = () => {
    foodReviewApi
      .getByFood(foodId, { limit: 5 })
      .then((res) => setReviews(res.data?.reviews || []))
      .catch(() => {});
  };

  const handleWriteReview = async () => {
    if (!isAuthenticated) {
      toast.error("Please log in to write a review.");
      navigate("/login");
      return;
    }
    if (!restaurantIdForFood) {
      toast.error("Unable to verify your dining history for this dish.");
      return;
    }
    try {
      const res = await restaurantReviewApi.getEligibility(restaurantIdForFood);
      if (!res?.data?.canReview) {
        toast(
          "You can write a review only after your billing is completed at this restaurant."
        );
        return;
      }
      setEditingReview(null);
      setReviewModalOpen(true);
    } catch (err) {
      toast.error(
        err?.response?.data?.message || "Unable to start a review right now."
      );
    }
  };

  const handleEditReview = (review) => {
    setEditingReview(review);
    setReviewModalOpen(true);
  };

  const handleDeleteReview = async (review) => {
    if (!window.confirm("Delete this review?")) return;
    try {
      await foodReviewApi.remove(review._id);
      toast.success("Review deleted.");
      refreshReviews();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to delete review.");
    }
  };

  const isOwnReview = (review) =>
    user &&
    String(review.userId?._id || review.userId) === String(user?._id || user?.id);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <Skeleton className="h-64 w-full rounded-xl" />
        <div className="mt-6 space-y-4">
          <Skeleton className="h-8 w-1/2" />
          <SkeletonText lines={3} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <ErrorState
          title="Unable to load food details"
          description={error}
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  }

  if (!food) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <EmptyState title="Food item not found" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Back Link */}
      {food.restaurantId && (
        <Link
          to={`/restaurants/${food.restaurantId._id || food.restaurantId}`}
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-primary"
        >
          <ArrowLeft size={16} />
          Back to Restaurant
        </Link>
      )}

      {/* Food Header */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {/* Image */}
        <div className="relative h-64 overflow-hidden rounded-xl bg-gray-100 sm:h-80">
          {food.coverImage && (
            <img
              src={food.coverImage}
              alt={food.foodName}
              className="h-full w-full object-cover"
            />
          )}
        </div>

        {/* Info */}
        <div className="flex flex-col justify-center">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-text sm:text-3xl">
              {food.foodName}
            </h1>
            {food.foodCode && (
              <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted">
                {food.foodCode}
              </span>
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="primary">{food.category}</Badge>
            <Badge variant="neutral">{food.foodType}</Badge>
            {food.spiceLevel && food.spiceLevel !== "Medium" && (
              <Badge variant="warning">{food.spiceLevel}</Badge>
            )}
          </div>

          {food.description && (
            <p className="mt-3 text-sm text-muted">{food.description}</p>
          )}

          <div className="mt-4">
            <Rating
              value={food.averageRating || 0}
              count={food.totalReviews || 0}
              size={16}
            />
          </div>

          {/* Price */}
          {food.variants?.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium text-text">Price</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {food.variants.map((variant, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 rounded-lg border border-gray-100 px-3 py-1.5"
                  >
                    <span className="text-xs text-muted">
                      {variant.variantName}
                    </span>
                    <span className="text-sm font-semibold text-primary">
                      {formatCurrency(
                        variant.offerPrice > 0
                          ? variant.offerPrice
                          : variant.price
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Availability */}
          <div className="mt-4">
            {food.isAvailable ? (
              <Badge variant="success">Available</Badge>
            ) : (
              <Badge variant="error">Currently Unavailable</Badge>
            )}
          </div>

          {food.preparationTime > 0 && (
            <p className="mt-3 text-xs text-muted">
              Preparation time: ~{food.preparationTime} minutes
            </p>
          )}
        </div>
      </div>

      {/* Review CTA */}
      <div className="mt-6">
        <Button onClick={handleWriteReview}>
          <Star size={16} />
          Write a Review
        </Button>
        <ReviewModal
          isOpen={reviewModalOpen}
          onClose={() => {
            setReviewModalOpen(false);
            setEditingReview(null);
          }}
          targetType="food"
          targetId={food._id}
          targetName={food.foodName}
          restaurantId={restaurantIdForFood}
          reviewData={editingReview}
          onSuccess={refreshReviews}
        />
      </div>

      {/* Gallery */}
      {food.galleryImages?.length > 0 && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold text-text">Gallery</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {food.galleryImages.map((img, idx) => (
              <div
                key={idx}
                className="h-32 overflow-hidden rounded-lg bg-gray-100"
              >
                <img
                  src={img}
                  alt={`${food.foodName} ${idx + 1}`}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reviews */}
      <div className="mt-8 card p-5">
        <div className="flex items-center gap-2">
          <Star size={20} className="text-primary" />
          <h2 className="text-lg font-semibold text-text">Food Reviews</h2>
        </div>
        {reviews.length === 0 ? (
          <EmptyState
            title="No reviews yet"
            description="Be the first to review this food item."
          />
        ) : (
          <div className="mt-4 space-y-4">
            {reviews.map((review) => (
              <div
                key={review._id}
                className="border-b border-gray-50 pb-4 last:border-0"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text">
                      {review.userId?.fullName || "Anonymous"}
                    </span>
                    <Rating value={review.rating} size={12} showValue={false} />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted">
                      {new Date(review.createdAt).toLocaleDateString()}
                    </span>
                    {isOwnReview(review) && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleEditReview(review)}
                          className="rounded p-1 text-muted transition-colors hover:bg-primary/10 hover:text-primary"
                          aria-label="Edit review"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteReview(review)}
                          className="rounded p-1 text-muted transition-colors hover:bg-red-50 hover:text-red-600"
                          aria-label="Delete review"
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {review.title && (
                  <h4 className="mt-1 text-sm font-medium text-text">
                    {review.title}
                  </h4>
                )}
                <p className="mt-1 text-sm text-muted">{review.comment}</p>
                {review.images?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {review.images.map((img, idx) => (
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
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default FoodDetailsPage;

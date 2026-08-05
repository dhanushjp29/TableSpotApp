import { ArrowLeft, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { foodApi } from "../../api/food.api.js";
import { foodReviewApi } from "../../api/review.api.js";

import Badge from "../../components/ui/Badge.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import ErrorState from "../../components/ui/ErrorState.jsx";
import Rating from "../../components/ui/Rating.jsx";
import Skeleton, { SkeletonText } from "../../components/ui/Skeleton.jsx";
import { formatCurrency } from "../../utils/formatCurrency.js";

function FoodDetailsPage() {
  const { foodId } = useParams();
  const [food, setFood] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

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
                  <span className="text-xs text-muted">
                    {new Date(review.createdAt).toLocaleDateString()}
                  </span>
                </div>
                {review.title && (
                  <h4 className="mt-1 text-sm font-medium text-text">
                    {review.title}
                  </h4>
                )}
                <p className="mt-1 text-sm text-muted">{review.comment}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default FoodDetailsPage;

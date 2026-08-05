import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import {
  MapPin,
  Clock,
  Phone,
  Mail,
  Star,
  Calendar,
  UtensilsCrossed,
} from "lucide-react";

import { restaurantApi } from "../../api/restaurant.api.js";
import { foodApi } from "../../api/food.api.js";
import { restaurantReviewApi } from "../../api/review.api.js";

import Rating from "../../components/ui/Rating.jsx";
import Badge from "../../components/ui/Badge.jsx";
import Button from "../../components/ui/Button.jsx";
import Skeleton, { SkeletonText } from "../../components/ui/Skeleton.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import ErrorState from "../../components/ui/ErrorState.jsx";
import ReviewModal from "../../components/ui/ReviewModal.jsx";
import { formatCurrency } from "../../utils/formatCurrency.js";

function RestaurantDetailsPage() {
  const { restaurantId } = useParams();
  const [restaurant, setRestaurant] = useState(null);
  const [foods, setFoods] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [restaurantRes, foodsRes, reviewsRes] = await Promise.all([
          restaurantApi.getById(restaurantId),
          foodApi.getByRestaurant(restaurantId),
          restaurantReviewApi.getByRestaurant(restaurantId, { limit: 5 }),
        ]);

        setRestaurant(
          restaurantRes.data?.restaurant || restaurantRes.data
        );
        setFoods(foodsRes.data?.foods || []);
        setReviews(reviewsRes.data?.reviews || []);
      } catch (err) {
        setError(
          err?.response?.data?.message || "Failed to load restaurant details."
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [restaurantId]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <Skeleton className="h-64 w-full rounded-xl" />
        <div className="mt-6 space-y-4">
          <Skeleton className="h-8 w-2/3" />
          <SkeletonText lines={3} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-40 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <ErrorState
          title="Unable to load restaurant"
          description={error}
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <EmptyState title="Restaurant not found" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Cover Image */}
      <div className="relative h-64 overflow-hidden rounded-xl bg-gray-100 sm:h-80">
        {restaurant.coverImage && (
          <img
            src={restaurant.coverImage}
            alt={restaurant.restaurantName}
            className="h-full w-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute bottom-0 left-0 p-6">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-white sm:text-3xl">
              {restaurant.restaurantName}
            </h1>
            {restaurant.restaurantCode && (
              <span className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white">
                {restaurant.restaurantCode}
              </span>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Rating
              value={restaurant.averageRating || 0}
              count={restaurant.totalReviews || 0}
              size={16}
            />
            {restaurant.priceRange && (
              <Badge variant="primary">{restaurant.priceRange}</Badge>
            )}
            {restaurant.cuisineTypes?.map((cuisine) => (
              <Badge key={cuisine} variant="neutral">
                {cuisine}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="mt-4 flex flex-wrap gap-3">
        <Link to={"/restaurants/" + restaurantId + "/book"}>
          <Button>
            <Calendar size={16} />
            Reserve a Table
          </Button>
        </Link>
        <Button variant="outline" onClick={() => setReviewModalOpen(true)}>
          <Star size={16} />
          Write a Review
        </Button>
      </div>

      <ReviewModal
        isOpen={reviewModalOpen}
        onClose={() => setReviewModalOpen(false)}
        targetType="restaurant"
        targetId={restaurant._id}
        targetName={restaurant.restaurantName}
        onSuccess={() => {
          restaurantReviewApi
            .getByRestaurant(restaurantId, { limit: 5 })
            .then((res) => setReviews(res.data?.reviews || []))
            .catch(() => {});
        }}
      />

      {/* Content Grid */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* About */}
          {restaurant.description && (
            <div className="card p-5">
              <h2 className="text-lg font-semibold text-text">About</h2>
              <p className="mt-2 text-sm text-muted">
                {restaurant.description}
              </p>
            </div>
          )}

          {/* Food Menu */}
          <div className="card p-5">
            <div className="flex items-center gap-2">
              <UtensilsCrossed size={20} className="text-primary" />
              <h2 className="text-lg font-semibold text-text">Menu</h2>
            </div>
            {foods.length === 0 ? (
              <EmptyState
                title="No food items available"
                description="This restaurant hasn't added any food items yet."
              />
            ) : (
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {foods.map((food) => (
                  <div
                    key={food._id}
                    className="flex gap-3 rounded-lg border border-gray-100 p-3"
                  >
                    <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-gray-100">
                      {food.coverImage && (
                        <img
                          src={food.coverImage}
                          alt={food.foodName}
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>
                    <div className="flex-1">
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-sm font-medium text-text">
                        {food.foodName}
                      </h3>
                      {food.foodCode && (
                        <span className="rounded bg-gray-100 px-1 py-0.5 font-mono text-[9px] font-semibold text-muted">
                          {food.foodCode}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted">
                      {food.category} • {food.foodType}
                    </p>
                      <div className="mt-1 flex items-center justify-between">
                        <span className="text-sm font-semibold text-primary">
                          {formatCurrency(
                            food.variants?.[0]?.price || 0
                          )}
                        </span>
                        {food.isAvailable ? (
                          <Badge variant="success">Available</Badge>
                        ) : (
                          <Badge variant="neutral">Unavailable</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Reviews */}
          <div className="card p-5">
            <div className="flex items-center gap-2">
              <Star size={20} className="text-primary" />
              <h2 className="text-lg font-semibold text-text">Reviews</h2>
            </div>
            {reviews.length === 0 ? (
              <EmptyState
                title="No reviews yet"
                description="Be the first to review this restaurant."
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
                        <Rating
                          value={review.rating}
                          size={12}
                          showValue={false}
                        />
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
                    <p className="mt-1 text-sm text-muted">
                      {review.comment}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Contact Info */}
          <div className="card p-5">
            <h2 className="text-lg font-semibold text-text">Information</h2>
            <div className="mt-3 space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <MapPin size={16} className="mt-0.5 text-muted" />
                <span className="text-muted">
                  {restaurant.address}, {restaurant.city}, {restaurant.state},{" "}
                  {restaurant.country} - {restaurant.pincode}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Phone size={16} className="text-muted" />
                <span className="text-muted">{restaurant.phoneNumber}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail size={16} className="text-muted" />
                <span className="text-muted">{restaurant.email}</span>
              </div>
              {restaurant.averageCostForTwo > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-muted">Average cost for two:</span>
                  <span className="font-medium text-text">
                    {formatCurrency(restaurant.averageCostForTwo)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Operating Hours */}
          {restaurant.operatingHours?.length > 0 && (
            <div className="card p-5">
              <div className="flex items-center gap-2">
                <Clock size={18} className="text-primary" />
                <h2 className="text-lg font-semibold text-text">
                  Operating Hours
                </h2>
              </div>
              <div className="mt-3 space-y-1.5 text-sm">
                {restaurant.operatingHours.map((hour) => (
                  <div
                    key={hour.day}
                    className="flex items-center justify-between"
                  >
                    <span className="text-muted">{hour.day}</span>
                    <span
                      className={
                        hour.isOpen
                          ? "text-success font-medium"
                          : "text-error"
                      }
                    >
                      {hour.isOpen ? `${hour.open} - ${hour.close}` : "Closed"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Amenities */}
          {restaurant.amenities?.length > 0 && (
            <div className="card p-5">
              <h2 className="text-lg font-semibold text-text">Amenities</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {restaurant.amenities.map((amenity) => (
                  <Badge key={amenity} variant="neutral">
                    {amenity}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default RestaurantDetailsPage;

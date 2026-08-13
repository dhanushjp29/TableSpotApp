import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  MapPin,
  Clock,
  Phone,
  Mail,
  Star,
  Calendar,
  UtensilsCrossed,
  Pencil,
  Trash2,
  ArrowLeft,
  ShieldAlert,
  CornerDownRight,
} from "lucide-react";
import toast from "react-hot-toast";

import { fetchRestaurantById } from "../../store/slices/restaurantSlice.js";
import { fetchFoodsByRestaurant } from "../../store/slices/foodSlice.js";
import {
  deleteRestaurantReview,
  fetchFoodReviewsByRestaurant,
  fetchRestaurantReviewsByRestaurant,
} from "../../store/slices/reviewSlice.js";
import { restaurantReviewApi } from "../../api/review.api.js";
import { restaurantReportApi } from "../../api/report.api.js";
import { useAuth } from "../../hooks/useAuth.js";
import { ROUTES } from "../../routes/routeConstants.js";

import Rating from "../../components/ui/Rating.jsx";
import Badge from "../../components/ui/Badge.jsx";
import Button from "../../components/ui/Button.jsx";
import Skeleton, { SkeletonText } from "../../components/ui/Skeleton.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import ErrorState from "../../components/ui/ErrorState.jsx";
import ReviewModal from "../../components/ui/ReviewModal.jsx";
import ReportModal from "../../components/ui/ReportModal.jsx";
import { formatCurrency } from "../../utils/formatCurrency.js";

function RestaurantDetailsPage() {
  const { restaurantId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { isAuthenticated, user } = useAuth();
  const restaurant = useSelector((state) => state.restaurant.currentRestaurant);
  const foods = useSelector((state) => state.food.foods);
  const reviews = useSelector((state) => state.review.restaurantReviews);
  const foodReviews = useSelector((state) => state.review.foodReviews);
  const restaurantLoading = useSelector((state) => state.restaurant.isLoading);
  const foodsLoading = useSelector((state) => state.food.isLoading);
  const reviewsLoading = useSelector((state) => state.review.isLoading);
  const restaurantError = useSelector((state) => state.restaurant.error);
  const foodsError = useSelector((state) => state.food.error);
  const reviewsError = useSelector((state) => state.review.error);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [editingReview, setEditingReview] = useState(null);
  const [reviewFoods, setReviewFoods] = useState([]);
  const [reviewBookingId, setReviewBookingId] = useState(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reviewsTab, setReviewsTab] = useState("restaurant"); // 'restaurant' or 'food'

  const isLoading = restaurantLoading || foodsLoading || reviewsLoading;
  const error = restaurantError || foodsError || reviewsError;

  useEffect(() => {
    dispatch(fetchRestaurantById(restaurantId)).catch(() => {});
    dispatch(fetchFoodsByRestaurant(restaurantId)).catch(() => {});
    dispatch(fetchRestaurantReviewsByRestaurant(restaurantId, { limit: 5 })).catch(
      () => {}
    );
    dispatch(fetchFoodReviewsByRestaurant(restaurantId, { limit: 5 })).catch(
      () => {}
    );
  }, [dispatch, restaurantId]);

  const refreshReviews = () => {
    dispatch(fetchRestaurantReviewsByRestaurant(restaurantId, { limit: 5 })).catch(
      () => {}
    );
    dispatch(fetchFoodReviewsByRestaurant(restaurantId, { limit: 5 })).catch(
      () => {}
    );
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(ROUTES.HOME);
    }
  };

  const handleWriteReview = async () => {
    if (!isAuthenticated) {
      toast.error("Please log in to write a review.");
      navigate("/login");
      return;
    }
    try {
      const res = await restaurantReviewApi.getEligibility(restaurantId);
      if (!res?.data?.canReview) {
        toast(
          "You can write a review only after your billing is completed for this restaurant."
        );
        return;
      }
      // Only foods from the user's paid bill are eligible for food sub-reviews
      setReviewFoods(res?.data?.billOrderedItems || []);
      setReviewBookingId(res?.data?.booking?._id || null);
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

  const handleReportRestaurant = async () => {
    if (!isAuthenticated) {
      toast.error("Please log in to report a restaurant.");
      navigate("/login");
      return;
    }
    try {
      const res = await restaurantReportApi.getEligibility(restaurantId);
      if (!res?.data?.canReport) {
        toast(res?.data?.reason || "You are not eligible to report this restaurant.");
        return;
      }
      setReportModalOpen(true);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Unable to check report eligibility.");
    }
  };

  const handleDeleteReview = async (review) => {
    if (!window.confirm("Delete this review?")) return;
    try {
      await dispatch(deleteRestaurantReview(review._id));
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
      {/* Back Link */}
      <button
        onClick={handleBack}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-primary"
      >
        <ArrowLeft size={16} />
        Back
      </button>

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
        <Button variant="outline" onClick={handleWriteReview}>
          <Star size={16} />
          Write a Review
        </Button>
        <Button
          variant="outline"
          className="text-red-600 border-red-200 hover:bg-red-50"
          onClick={handleReportRestaurant}
        >
          <ShieldAlert size={16} />
          Report a Restaurant
        </Button>
      </div>

      <ReviewModal
        isOpen={reviewModalOpen}
        onClose={() => {
          setReviewModalOpen(false);
          setEditingReview(null);
        }}
        targetType="restaurant"
        targetId={restaurant._id}
        targetName={restaurant.restaurantName}
        foods={reviewFoods}
        reviewData={editingReview}
        bookingId={reviewBookingId}
        onSuccess={refreshReviews}
      />

      <ReportModal
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        restaurantId={restaurant._id}
        restaurantName={restaurant.restaurantName}
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
                  <Link
                    key={food._id}
                    to={`/foods/${food._id}`}
                    className="flex gap-3 rounded-lg border border-gray-100 p-3 transition-all hover:border-primary hover:shadow-sm"
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
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Reviews Section */}
          <div className="card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Star size={20} className="text-primary" />
                <h2 className="text-lg font-semibold text-text">Reviews</h2>
              </div>
              <div className="flex items-center gap-1 rounded-lg border border-gray-100 bg-gray-50/60 p-1 dark:border-white/10 dark:bg-white/5">
                <button
                  type="button"
                  onClick={() => setReviewsTab("restaurant")}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                    reviewsTab === "restaurant"
                      ? "bg-primary text-white shadow-sm"
                      : "text-muted hover:text-text"
                  }`}
                >
                  Restaurant Review
                </button>
                <button
                  type="button"
                  onClick={() => setReviewsTab("food")}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                    reviewsTab === "food"
                      ? "bg-primary text-white shadow-sm"
                      : "text-muted hover:text-text"
                  }`}
                >
                  Food Review
                </button>
              </div>
            </div>

            {reviewsTab === "restaurant" ? (
              reviews.length === 0 ? (
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
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="truncate text-sm font-medium text-text">
                            {review.userId?.fullName || "Anonymous"}
                          </span>
                          <Rating
                            value={review.rating}
                            size={12}
                            showValue={false}
                          />
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
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
                      <p className="mt-1 text-sm text-muted">
                        {review.comment}
                      </p>
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
                      {review.ownerReply && (
                        <div className="mt-3 flex gap-2 rounded-lg border border-primary/15 bg-primary/5 p-3">
                          <CornerDownRight
                            size={16}
                            className="mt-0.5 shrink-0 text-primary"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-primary">
                              Owner Reply
                              {review.ownerRepliedAt
                                ? ` • ${new Date(
                                    review.ownerRepliedAt
                                  ).toLocaleDateString()}`
                                : ""}
                            </p>
                            <p className="mt-0.5 text-sm text-text">
                              {review.ownerReply}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )
            ) : foodReviews.length === 0 ? (
              <EmptyState
                title="No food reviews yet"
                description="Reviews of individual dishes will appear here."
              />
            ) : (
              <div className="mt-4 space-y-4">
                {foodReviews.map((review) => {
                  const foodObj =
                    typeof review.foodId === "object" ? review.foodId : null;
                  return (
                    <div
                      key={review._id}
                      className="border-b border-gray-50 pb-4 last:border-0"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="truncate text-sm font-medium text-text">
                            {review.userId?.fullName || "Anonymous"}
                          </span>
                          <Rating
                            value={review.rating}
                            size={12}
                            showValue={false}
                          />
                        </div>
                        <span className="shrink-0 text-xs text-muted">
                          {review.createdAt
                            ? new Date(review.createdAt).toLocaleDateString()
                            : ""}
                        </span>
                      </div>
                      {foodObj && (
                        <Badge variant="primary" className="mt-2">
                          {foodObj.foodName}
                          {foodObj.foodCode ? ` · ${foodObj.foodCode}` : ""}
                        </Badge>
                      )}
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
                      {review.ownerReply && (
                        <div className="mt-3 flex gap-2 rounded-lg border border-primary/15 bg-primary/5 p-3">
                          <CornerDownRight
                            size={16}
                            className="mt-0.5 shrink-0 text-primary"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-primary">
                              Owner Reply
                              {review.ownerRepliedAt
                                ? ` • ${new Date(
                                    review.ownerRepliedAt
                                  ).toLocaleDateString()}`
                                : ""}
                            </p>
                            <p className="mt-0.5 text-sm text-text">
                              {review.ownerReply}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
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

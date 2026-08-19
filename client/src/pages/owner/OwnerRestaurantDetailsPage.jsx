import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  ArrowLeft,
  Clock,
  CornerDownRight,
  Mail,
  MapPin,
  MessageSquare,
  Pencil,
  Phone,
  Trash2,
  UtensilsCrossed,
} from "lucide-react";
import toast from "react-hot-toast";

import {
  deleteRestaurant,
  fetchRestaurantById,
} from "../../store/slices/restaurantSlice.js";
import {
  fetchFoodReviewsByRestaurant,
  fetchRestaurantReviewsByRestaurant,
  updateFoodReview,
  updateRestaurantReview,
} from "../../store/slices/reviewSlice.js";

import Badge from "../../components/ui/Badge.jsx";
import Button from "../../components/ui/Button.jsx";
import Card from "../../components/ui/Card.jsx";
import ConfirmDialog from "../../components/ui/ConfirmDialog.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import ErrorState from "../../components/ui/ErrorState.jsx";
import Modal from "../../components/ui/Modal.jsx";
import Rating from "../../components/ui/Rating.jsx";
import Skeleton, { SkeletonText } from "../../components/ui/Skeleton.jsx";
import { formatDate } from "../../utils/formatDate.js";

import { CreateRestaurantForm } from "./OwnerRestaurantPage.jsx";

export default function OwnerRestaurantDetailsPage() {
  const { restaurantId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const restaurant = useSelector((state) => state.restaurant.currentRestaurant);
  const restaurantLoading = useSelector((state) => state.restaurant.isLoading);
  const restaurantError = useSelector((state) => state.restaurant.error);
  const restaurantReviews = useSelector(
    (state) => state.review.restaurantReviews
  );
  const foodReviews = useSelector((state) => state.review.foodReviews);
  const reviewLoading = useSelector((state) => state.review.isLoading);
  const reviewError = useSelector((state) => state.review.error);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [activeTab, setActiveTab] = useState("restaurant");
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyDraft, setReplyDraft] = useState({});
  const [isReplying, setIsReplying] = useState(false);

  const isLoading = restaurantLoading || reviewLoading;
  const error = restaurantError || reviewError;

  const fetchData = async () => {
    await Promise.all([
      dispatch(fetchRestaurantById(restaurantId)),
      dispatch(fetchRestaurantReviewsByRestaurant(restaurantId, { limit: 100 })),
      dispatch(fetchFoodReviewsByRestaurant(restaurantId, { limit: 100 })),
    ]).catch(() => {});
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId, dispatch]);

  const handleBack = () => {
    navigate("/owner/restaurant");
  };

  const handleDeleteRestaurant = async () => {
    if (!restaurant) return;
    setDeleting(true);
    try {
      await dispatch(deleteRestaurant(restaurant._id));
      toast.success("Restaurant deleted successfully!");
      navigate("/owner/restaurant");
    } catch (err) {
      toast.error(
        err?.response?.data?.message || err?.message || "Failed to delete restaurant."
      );
    } finally {
      setDeleting(false);
    }
  };

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
      await fetchData();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to save reply.");
    } finally {
      setIsReplying(false);
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <Skeleton className="h-64 w-full rounded-xl" />
        <div className="mt-6 space-y-4">
          <Skeleton className="h-8 w-2/3" />
          <SkeletonText lines={3} />
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

  const currentList =
    activeTab === "restaurant" ? restaurantReviews : foodReviews;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
      {/* Back Link */}
      <button
        onClick={handleBack}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-primary"
      >
        <ArrowLeft size={16} />
        Back to Restaurants
      </button>

      {/* Header Card */}
      <Card className="overflow-hidden">
        <div className="relative h-56 overflow-hidden bg-gray-100 sm:h-64">
          {restaurant.coverImage ? (
            <img
              src={restaurant.coverImage}
              alt={restaurant.restaurantName}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-4xl text-muted">
              🍽️
            </div>
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
              <span className="text-xs text-gray-200">
                {restaurant.city}, {restaurant.state}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="text-sm font-medium text-text">Status</p>
            <p className="text-xs text-muted">
              {restaurant.verificationStatus || "Pending"}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEditModalOpen(true)}>
              <Pencil size={16} />
              Edit Restaurant
            </Button>
            <Button variant="danger" onClick={() => setDeleteConfirm(true)}>
              <Trash2 size={16} />
              Delete
            </Button>
          </div>
        </div>
      </Card>

      {/* Information */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {restaurant.description && (
            <Card className="p-5">
              <h2 className="text-lg font-semibold text-text">About</h2>
              <p className="mt-2 text-sm text-muted">{restaurant.description}</p>
            </Card>
          )}

          {restaurant.cuisineTypes?.length > 0 && (
            <Card className="p-5">
              <h2 className="text-lg font-semibold text-text">Cuisines & Services</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {[...(restaurant.cuisineTypes || []), ...(restaurant.services || [])].map(
                  (item) => (
                    <Badge key={item} variant="neutral">
                      {item}
                    </Badge>
                  )
                )}
              </div>
            </Card>
          )}

          {/* Reviews with owner reply */}
          <Card className="p-5">
            <div className="flex items-center gap-2">
              <MessageSquare size={20} className="text-primary" />
              <h2 className="text-lg font-semibold text-text">Customer Reviews</h2>
            </div>

            <div className="mt-4 flex items-center gap-3 border-b border-gray-100 pb-2">
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

            {currentList.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  title="No reviews yet"
                  description="Customer reviews for this category will appear here."
                />
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                {currentList.map((rev) => {
                  const userObj = typeof rev.userId === "object" ? rev.userId : null;
                  const foodObj = typeof rev.foodId === "object" ? rev.foodId : null;

                  return (
                    <Card
                      key={rev._id}
                      className="p-5 border border-gray-100 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">
                            {userObj?.fullName?.[0] || "U"}
                          </div>
                          <div>
                            <h4 className="text-sm font-semibold text-text">
                              {userObj?.fullName || "Verified Customer"}
                            </h4>
                            <p className="text-xs text-muted">
                              {rev.createdAt
                                ? formatDate(new Date(rev.createdAt))
                                : "Recently"}
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
                        <p className="mt-3 rounded-lg bg-gray-50/80 p-3 text-sm italic text-text dark:border dark:border-white/10 dark:bg-surface-elevated dark:text-gray-200">
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
                              className="h-20 w-20 rounded-lg border border-gray-100 object-cover"
                              loading="lazy"
                            />
                          ))}
                        </div>
                      )}

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
                            <p className="mt-0.5 text-sm text-text">
                              {rev.ownerReply}
                            </p>
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
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="text-lg font-semibold text-text">Information</h2>
            <div className="mt-3 space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <MapPin size={16} className="mt-0.5 shrink-0 text-muted" />
                <span className="text-muted">
                  {restaurant.address}, {restaurant.city}, {restaurant.state},{" "}
                  {restaurant.country} - {restaurant.pincode}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Phone size={16} className="shrink-0 text-muted" />
                <span className="text-muted">{restaurant.phoneNumber}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail size={16} className="shrink-0 text-muted" />
                <span className="text-muted">{restaurant.email}</span>
              </div>
            </div>
          </Card>

          {restaurant.operatingHours?.length > 0 && (
            <Card className="p-5">
              <div className="flex items-center gap-2">
                <Clock size={18} className="text-primary" />
                <h2 className="text-lg font-semibold text-text">Operating Hours</h2>
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
                        hour.isOpen ? "font-medium text-success" : "text-error"
                      }
                    >
                      {hour.isOpen ? `${hour.open} - ${hour.close}` : "Closed"}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {restaurant.amenities?.length > 0 && (
            <Card className="p-5">
              <div className="flex items-center gap-2">
                <UtensilsCrossed size={18} className="text-primary" />
                <h2 className="text-lg font-semibold text-text">Amenities</h2>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {restaurant.amenities.map((amenity) => (
                  <Badge key={amenity} variant="neutral">
                    {amenity}
                  </Badge>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {editModalOpen && (
        <Modal
          isOpen={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          title="Edit Restaurant"
          size="lg"
        >
          <CreateRestaurantForm
            restaurant={restaurant}
            onSuccess={() => {
              setEditModalOpen(false);
              fetchData();
            }}
            onCancel={() => setEditModalOpen(false)}
          />
        </Modal>
      )}

      {/* Delete Confirm */}
      <ConfirmDialog
        isOpen={deleteConfirm}
        onClose={() => setDeleteConfirm(false)}
        onConfirm={handleDeleteRestaurant}
        isLoading={deleting}
        title="Delete Restaurant"
        description={`Are you sure you want to delete "${restaurant.restaurantName}"? This action cannot be undone.`}
        confirmText="Delete"
      />
    </div>
  );
}

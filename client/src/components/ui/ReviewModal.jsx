import { useEffect, useRef, useState } from "react";
import { ImagePlus, Star, X } from "lucide-react";
import toast from "react-hot-toast";

import { foodReviewApi, restaurantReviewApi } from "../../api/review.api.js";
import { uploadApi } from "../../api/upload.api.js";
import Button from "./Button.jsx";
import Modal from "./Modal.jsx";

function StarPicker({ value, onChange }) {
  const [hover, setHover] = useState(0);

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className="p-0.5 text-amber-400 transition-transform hover:scale-110 focus:outline-none"
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(star)}
        >
          <Star
            size={22}
            fill={(hover || value) >= star ? "currentColor" : "none"}
            className={
              (hover || value) >= star ? "text-amber-400" : "text-gray-300"
            }
          />
        </button>
      ))}
      <span className="ml-1 text-xs font-semibold text-text">
        {value || 0} / 5
      </span>
    </div>
  );
}

function ReviewForm({
  onClose,
  targetType,
  targetId,
  foods,
  reviewData,
  restaurantId,
  bookingId,
  onSuccess,
}) {
  const isEditing = Boolean(reviewData);

  const [rating, setRating] = useState(reviewData?.rating || 5);
  const [title, setTitle] = useState(reviewData?.title || "");
  const [comment, setComment] = useState(reviewData?.comment || "");
  const [existingImages, setExistingImages] = useState(reviewData?.images || []);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [foodEntries, setFoodEntries] = useState(() =>
    (foods || []).map((food) => ({
      foodId: food._id || food.foodId,
      foodName: food.foodName,
      rating: 0,
      comment: "",
      reviewId: null,
    }))
  );
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!isEditing || targetType !== "restaurant" || !bookingId) return;

    let cancelled = false;
    foodReviewApi
      .getMyBookingReviews({ bookingId })
      .then((res) => {
        if (cancelled) return;
        const existing = res?.data?.reviews || [];
        setFoodEntries((prev) =>
          prev.map((entry) => {
            const match = existing.find(
              (review) =>
                String(review.foodId?._id || review.foodId) ===
                String(entry.foodId)
            );
            return match
              ? {
                  ...entry,
                  rating: Number(match.rating || 0),
                  comment: match.comment || "",
                  reviewId: match._id,
                }
              : entry;
          })
        );
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [isEditing, targetType, bookingId]);

  const handleClose = () => {
    setIsUploading(false);
    setIsSubmitting(false);
    onClose();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5 MB.");
      return;
    }
    setImageFile(file);
    setExistingImages([]);
    setImagePreview(URL.createObjectURL(file));
  };

  const removeImage = () => {
    setImageFile(null);
    setExistingImages([]);
    setImagePreview("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const updateFoodEntry = (index, patch) => {
    setFoodEntries((prev) =>
      prev.map((entry, i) => (i === index ? { ...entry, ...patch } : entry))
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!rating) {
      toast.error("Please select a rating.");
      return;
    }

    setIsSubmitting(true);
    try {
      let images = existingImages;
      if (imageFile) {
        setIsUploading(true);
        const uploaded = await uploadApi.image(imageFile);
        const url = uploaded?.url || uploaded?.secure_url || uploaded;
        if (url) images = [url];
      }

      if (isEditing) {
        if (targetType === "restaurant") {
          await restaurantReviewApi.update(reviewData._id, {
            rating,
            title,
            comment,
            images,
          });

          const readyFoodEntries = foodEntries.filter(
            (entry) => entry.rating > 0 && entry.comment.trim()
          );
          if (readyFoodEntries.length > 0) {
            const results = await Promise.allSettled(
              readyFoodEntries.map((entry) =>
                entry.reviewId
                  ? foodReviewApi.update(entry.reviewId, {
                      rating: entry.rating,
                      comment: entry.comment,
                    })
                  : foodReviewApi.create({
                      rating: entry.rating,
                      comment: entry.comment,
                      images: [],
                      foodId: entry.foodId,
                      restaurantId: targetId,
                      bookingId,
                    })
              )
            );
            const failed = results.filter((r) => r.status === "rejected");
            if (failed.length > 0) {
              toast.error(
                `${readyFoodEntries.length - failed.length} food review(s) saved, ${failed.length} could not be submitted.`
              );
            }
          }
        } else {
          await foodReviewApi.update(reviewData._id, {
            rating,
            title,
            comment,
            images,
          });
        }
        toast.success("Review updated successfully!");
      } else if (targetType === "restaurant") {
        await restaurantReviewApi.create({
          rating,
          title,
          comment,
          images,
          restaurantId: targetId,
          bookingId,
        });

        const readyFoodEntries = foodEntries.filter(
          (entry) => entry.rating > 0 && entry.comment.trim()
        );
        if (readyFoodEntries.length > 0) {
          const results = await Promise.allSettled(
            readyFoodEntries.map((entry) =>
              foodReviewApi.create({
                rating: entry.rating,
                comment: entry.comment,
                images: [],
                foodId: entry.foodId,
                restaurantId: targetId,
                bookingId,
              })
            )
          );
          const failed = results.filter((r) => r.status === "rejected");
          if (failed.length > 0) {
            toast.error(
              `${readyFoodEntries.length - failed.length} food review(s) saved, ${failed.length} could not be submitted.`
            );
          }
        }
        toast.success("Review submitted successfully!");
      } else {
        await foodReviewApi.create({
          rating,
          title,
          comment,
          images,
          foodId: targetId,
          restaurantId: restaurantId || null,
        });
        toast.success("Review submitted successfully!");
      }

      handleClose();
      if (onSuccess) onSuccess();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to submit review.");
    } finally {
      setIsUploading(false);
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 pt-2">
      <div>
        <label className="mb-2 block text-sm font-medium text-text">
          Rating
        </label>
        <StarPicker value={rating} onChange={setRating} />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-text">
          Title
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={100}
          placeholder="Summarize your visit"
          className="input-field w-full rounded-lg border border-gray-200 bg-white p-3 text-sm text-text focus:border-primary focus:outline-none dark:border-white/10 dark:bg-[#11151b] dark:text-slate-100"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-text">
          Comment / Feedback
        </label>
        <textarea
          rows={4}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={
            targetType === "restaurant"
              ? "Share your experience..."
              : "How was this dish?"
          }
          className="input-field w-full rounded-lg border border-gray-200 bg-white p-3 text-sm text-text focus:border-primary focus:outline-none dark:border-white/10 dark:bg-[#11151b] dark:text-slate-100"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-text">
          Photo (optional)
        </label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
        {imagePreview || existingImages[0] ? (
          <div className="relative inline-block">
            <img
              src={imagePreview || existingImages[0]}
              alt="Review preview"
              className="h-24 w-24 rounded-lg object-cover border border-gray-200 dark:border-white/10"
            />
            <button
              type="button"
              onClick={removeImage}
              className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-gray-800 text-white shadow"
              aria-label="Remove photo"
            >
              <X size={13} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-gray-300 text-muted transition-colors hover:border-primary hover:text-primary dark:border-white/15"
          >
            <ImagePlus size={22} />
            <span className="text-[10px] font-medium">Add photo</span>
          </button>
        )}
      </div>

      {/* Optional food reviews */}
      {targetType === "restaurant" && foodEntries.length > 0 && (
        <div>
          <div className="flex items-center gap-2">
            <label className="block text-sm font-medium text-text">
              {isEditing ? "Food Reviews" : "Food Reviews (optional)"}
            </label>
            <span className="text-xs text-muted">
              Rate the dishes you enjoyed
            </span>
          </div>
          <div className="mt-2 space-y-3">
            {foodEntries.map((entry, index) => (
              <div
                key={entry.foodId}
                className="rounded-lg border border-gray-100 bg-gray-50/60 p-3 dark:border-white/10 dark:bg-[#1d222b]"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-text">
                    {entry.foodName}
                  </span>
                  <StarPicker
                    value={entry.rating}
                    onChange={(val) => updateFoodEntry(index, { rating: val })}
                  />
                </div>
                {entry.rating > 0 && (
                  <input
                    type="text"
                    value={entry.comment}
                    onChange={(e) =>
                      updateFoodEntry(index, { comment: e.target.value })
                    }
                    placeholder="How was this dish?"
                    className="mt-2 w-full rounded-lg border border-gray-200 bg-white p-2 text-sm text-text focus:border-primary focus:outline-none dark:border-white/10 dark:bg-[#11151b] dark:text-slate-100"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={handleClose}>
          Cancel
        </Button>
        <Button type="submit" isLoading={isSubmitting || isUploading}>
          {isEditing ? "Update Review" : "Submit Review"}
        </Button>
      </div>
    </form>
  );
}

export default function ReviewModal({
  isOpen,
  onClose,
  targetType = "restaurant", // 'restaurant' or 'food'
  targetId,
  targetName = "",
  foods = [], // optional restaurant foods to allow food reviews
  reviewData = null, // existing review being edited
  restaurantId = null, // restaurant owning the food (required for food reviews)
  bookingId = null, // specific booking whose bill items are being reviewed
  onSuccess,
}) {
  const formKey = `${isOpen}-${targetType}-${targetId}-${reviewData?._id || "new"}`;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        reviewData
          ? "Update Review"
          : `Write a Review ${targetName ? `for ${targetName}` : ""}`.trim()
      }
    >
      {isOpen && (
        <ReviewForm
          key={formKey}
          onClose={onClose}
          targetType={targetType}
          targetId={targetId}
          foods={foods}
          reviewData={reviewData}
          restaurantId={restaurantId}
          bookingId={bookingId}
          onSuccess={onSuccess}
        />
      )}
    </Modal>
  );
}

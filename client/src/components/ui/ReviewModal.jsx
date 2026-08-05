import { useState } from "react";
import { Star } from "lucide-react";
import toast from "react-hot-toast";

import { foodReviewApi, restaurantReviewApi } from "../../api/review.api.js";
import Button from "./Button.jsx";
import Modal from "./Modal.jsx";

export default function ReviewModal({
  isOpen,
  onClose,
  targetType = "restaurant", // 'restaurant' or 'food'
  targetId,
  targetName = "",
  onSuccess,
}) {
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!rating) {
      toast.error("Please select a rating.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (targetType === "restaurant") {
        await restaurantReviewApi.create({
          restaurantId: targetId,
          rating,
          comment,
        });
      } else {
        await foodReviewApi.create({
          foodId: targetId,
          rating,
          comment,
        });
      }
      toast.success("Review submitted successfully!");
      setComment("");
      setRating(5);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to submit review.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Write a Review for ${targetName || (targetType === "restaurant" ? "Restaurant" : "Food Item")}`}
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        <div>
          <label className="mb-2 block text-sm font-medium text-text">
            Rating
          </label>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                className="p-1 text-amber-400 transition-transform hover:scale-110 focus:outline-none"
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                onClick={() => setRating(star)}
              >
                <Star
                  size={28}
                  fill={(hoverRating || rating) >= star ? "currentColor" : "none"}
                  className={(hoverRating || rating) >= star ? "text-amber-400" : "text-gray-300"}
                />
              </button>
            ))}
            <span className="ml-2 text-sm font-semibold text-text">
              {hoverRating || rating} / 5
            </span>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-text">
            Comment / Feedback
          </label>
          <textarea
            rows={4}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Share your experience..."
            className="input-field w-full rounded-lg border border-gray-200 p-3 text-sm focus:border-primary focus:outline-none"
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            Submit Review
          </Button>
        </div>
      </form>
    </Modal>
  );
}

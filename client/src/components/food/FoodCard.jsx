import { memo } from "react";
import { Link } from "react-router-dom";
import { Heart, MapPin, UtensilsCrossed } from "lucide-react";
import Rating from "../ui/Rating.jsx";
import Badge from "../ui/Badge.jsx";
import { formatCurrency } from "../../utils/formatCurrency.js";

function FoodCard({
  food,
  isFavorite = false,
  onToggleFavorite = () => {},
  isSelected = false,
  onSelect = () => {},
}) {
  const restaurant =
    typeof food.restaurantId === "object" ? food.restaurantId : null;
  const price =
    food.variants?.find((v) => v.offerPrice > 0)?.offerPrice ||
    food.variants?.[0]?.price ||
    0;

  const handleSelect = () => {
    if (restaurant?._id) {
      onSelect(restaurant._id);
    }
  };

  return (
    <div
      onClick={handleSelect}
      className={`card cursor-pointer overflow-hidden transition-all duration-200 hover:shadow-md ${
        isSelected ? "ring-2 ring-primary" : ""
      }`}
    >
      <Link
        to={`/foods/${food._id}`}
        onClick={(e) => e.stopPropagation()}
        className="relative block h-40 overflow-hidden bg-gray-100"
      >
        {food.coverImage ? (
          <img
            src={food.coverImage}
            alt={food.foodName}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted">
            <UtensilsCrossed size={32} />
          </div>
        )}
        {food.isRecommended && (
          <span className="absolute left-2 top-2 badge bg-amber-500 text-white">
            Recommended
          </span>
        )}
      </Link>

      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link
              to={`/foods/${food._id}`}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="font-semibold text-text line-clamp-1 hover:text-primary">
                {food.foodName}
              </h3>
            </Link>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <Badge variant="neutral">{food.category}</Badge>
              <Badge
                variant={
                  food.foodType === "Non-Veg" ? "danger" : "success"
                }
              >
                {food.foodType}
              </Badge>
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(food._id);
            }}
            className={
              isFavorite
                ? "text-rose-500"
                : "text-muted hover:text-primary"
            }
            aria-label={
              isFavorite ? "Remove from favorites" : "Add to favorites"
            }
          >
            <Heart size={18} fill={isFavorite ? "currentColor" : "none"} />
          </button>
        </div>

        <div className="mt-2 flex items-center justify-between gap-2">
          <Rating
            value={food.averageRating || 0}
            count={food.totalReviews || 0}
            size={13}
          />
          <span className="text-sm font-bold text-primary">
            {formatCurrency(price)}
          </span>
        </div>

        {restaurant && (
          <div className="mt-2 flex items-center gap-1 text-xs text-muted">
            <MapPin size={12} />
            <span className="line-clamp-1">
              {restaurant.restaurantName}
              {restaurant.city ? `, ${restaurant.city}` : ""}
            </span>
          </div>
        )}

        {!food.isAvailable && (
          <div className="mt-2">
            <Badge variant="danger">Currently Unavailable</Badge>
          </div>
        )}

        {restaurant && (
          <Link
            to={`/restaurants/${restaurant._id}`}
            onClick={(e) => e.stopPropagation()}
            className="mt-3 block rounded-lg bg-primary px-3 py-2 text-center text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
          >
            Book a Food
          </Link>
        )}
      </div>
    </div>
  );
}

export default memo(FoodCard);

import { memo } from "react";
import { Link } from "react-router-dom";
import { MapPin, Heart } from "lucide-react";
import Rating from "../ui/Rating.jsx";

function RestaurantCard({
  restaurant,
  isSelected = false,
  onSelect = () => {},
  isFavorite = false,
  onToggleFavorite = () => {},
}) {
  const handleSelect = () => {
    onSelect(restaurant._id);
  };

  return (
    <div
      onClick={handleSelect}
      className={`card cursor-pointer overflow-hidden transition-all duration-200 hover:shadow-md ${
        isSelected ? "ring-2 ring-primary" : ""
      }`}
    >
      <div className="relative h-40 overflow-hidden bg-gray-100">
        {restaurant.coverImage ? (
          <img
            src={restaurant.coverImage}
            alt={restaurant.restaurantName}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted">
            <MapPin size={32} />
          </div>
        )}
        {restaurant.isFeatured && (
          <span className="absolute left-2 top-2 badge bg-accent text-white">
            Featured
          </span>
        )}
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-text line-clamp-1">
            {restaurant.restaurantName}
          </h3>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(restaurant._id);
            }}
            className={isFavorite ? "text-rose-500" : "text-muted hover:text-primary"}
            aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
          >
            <Heart size={18} fill={isFavorite ? "currentColor" : "none"} />
          </button>
        </div>

        <div className="mt-1.5">
          <Rating
            value={restaurant.averageRating || 0}
            count={restaurant.totalReviews || 0}
            size={14}
          />
        </div>

        <p className="mt-1.5 text-xs text-muted line-clamp-1">
          {restaurant.cuisineTypes?.join(" • ") || "Restaurant"}
          {restaurant.priceRange && ` • ${restaurant.priceRange}`}
        </p>

        <div className="mt-2 flex items-center gap-1 text-xs text-muted">
          <MapPin size={12} />
          <span className="line-clamp-1">
            {restaurant.city}, {restaurant.state}
          </span>
        </div>

        <Link
          to={`/restaurants/${restaurant._id}`}
          onClick={(e) => e.stopPropagation()}
          className="mt-3 block text-center text-sm font-medium text-primary hover:text-primary-dark"
        >
          View Details
        </Link>
      </div>
    </div>
  );
}

export default memo(RestaurantCard);

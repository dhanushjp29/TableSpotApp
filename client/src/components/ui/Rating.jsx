import { Star } from "lucide-react";

function Rating({ value = 0, count = 0, size = 16, showValue = true }) {
  const rounded = Math.round(value * 2) / 2;

  return (
    <div className="flex items-center gap-1.5" aria-label={`Rated ${value} out of 5 stars`}>
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={size}
            className={
              star <= Math.round(rounded)
                ? "fill-accent text-accent"
                : "fill-surface-hover text-border-strong dark:fill-surface-secondary dark:text-border"
            }
            aria-hidden="true"
          />
        ))}
      </div>
      {showValue && (
        <span className="text-sm font-medium text-text">
          {Number(value).toFixed(1)}
        </span>
      )}
      {count > 0 && (
        <span className="text-xs text-muted">({count})</span>
      )}
    </div>
  );
}

export default Rating;

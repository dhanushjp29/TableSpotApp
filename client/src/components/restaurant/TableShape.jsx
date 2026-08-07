import { memo, useCallback } from "react";

import { TABLE_SHAPE } from "../../constants/table.js";

const COLORS = {
  selected: "#c62828",
  available: "#16a34a",
  unavailable: "#d6d3d1",
  inactive: "#ececec",
  neutral: "#9ca3af",
};

function renderTableBody(shape) {
  switch (shape) {
    case TABLE_SHAPE.ROUND:
      return <circle cx="50" cy="50" r="34" className="stroke-neutral-300" fill="#fafaf9" strokeWidth="1.5" />;
    case TABLE_SHAPE.SINGLE_ROW:
      return <rect x="8" y="40" width="84" height="20" rx="9" className="stroke-neutral-300" fill="#fafaf9" strokeWidth="1.5" />;
    case TABLE_SHAPE.RECTANGLE:
      return <rect x="14" y="30" width="72" height="40" rx="8" className="stroke-neutral-300" fill="#fafaf9" strokeWidth="1.5" />;
    case TABLE_SHAPE.OVAL:
      return <ellipse cx="50" cy="50" rx="40" ry="28" className="stroke-neutral-300" fill="#fafaf9" strokeWidth="1.5" />;
    case TABLE_SHAPE.BOAT:
      return <rect x="14" y="28" width="72" height="44" rx="20" className="stroke-neutral-300" fill="#fafaf9" strokeWidth="1.5" />;
    case TABLE_SHAPE.SQUARE:
    default:
      return <rect x="18" y="18" width="64" height="64" rx="10" className="stroke-neutral-300" fill="#fafaf9" strokeWidth="1.5" />;
  }
}

function TableShape({
  shape = TABLE_SHAPE.SQUARE,
  seats = [],
  selectedSeatIds = [],
  unavailableSeatIds = [],
  onSeatClick,
  neutral = false,
  size = 220,
  showLabels = true,
  className = "",
}) {
  const selected = new Set((selectedSeatIds || []).map(String));
  const unavailable = new Set((unavailableSeatIds || []).map(String));

  const handleKeyDown = useCallback(
    (e, seat) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onSeatClick?.(seat);
      }
    },
    [onSeatClick]
  );

  const activeSeats = (seats || []).filter((seat) => seat.isActive !== false);

  return (
    <svg
      viewBox="0 -4 100 112"
      width={size}
      height={size}
      role="img"
      aria-label="Table layout"
      className={`h-auto ${className}`}
    >
      {renderTableBody(shape)}

      {activeSeats.map((seat) => {
        const id = String(seat._id ?? seat.seatIndex);
        const isSelected = selected.has(id);
        const isUnavailable = unavailable.has(id) && !isSelected;

        let fill = COLORS.available;
        if (neutral) fill = COLORS.neutral;
        if (isUnavailable) fill = COLORS.unavailable;
        if (isSelected) fill = COLORS.selected;

        const x = seat.position?.x ?? 50;
        const y = seat.position?.y ?? 50;
        const isClickable = Boolean(onSeatClick) && !isUnavailable;

        return (
          <g
            key={id}
            role={isClickable ? "button" : undefined}
            tabIndex={isClickable ? 0 : undefined}
            aria-label={isClickable ? `Seat ${seat.seatLabel}` : undefined}
            onClick={isClickable ? () => onSeatClick(seat) : undefined}
            onKeyDown={isClickable ? (e) => handleKeyDown(e, seat) : undefined}
            className={isClickable ? "cursor-pointer" : undefined}
          >
            <title>{seat.seatLabel}</title>
            <circle
              cx={x}
              cy={y}
              r={isSelected ? 8 : 6.5}
              fill={fill}
              stroke={isSelected ? "#ffffff" : "#ffffff"}
              strokeWidth={isSelected ? 1.5 : 1}
            />
            {showLabels && (
              <text
                x={x}
                y={y + (isSelected ? 18 : 15)}
                textAnchor="middle"
                fontSize="7"
                className="fill-neutral-600 select-none"
                pointerEvents="none"
              >
                {seat.seatLabel}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export default memo(TableShape);

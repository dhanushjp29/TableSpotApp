import { CalendarClock, MapPin, Ticket } from "lucide-react";

import { formatDate } from "../../utils/formatDate.js";
import { formatCurrency } from "../../utils/formatCurrency.js";
import { formatOfferDiscount } from "../../constants/offer.js";
import Button from "../ui/Button.jsx";

function OfferCard({
  item,
  status = "available",
  claimed = false,
  onClaim,
  claiming = false,
  compact = false,
  selected = false,
  onSelect,
}) {
  const itemOffer = item?.offer || (item?.offerId?.offerCode ? item.offerId : null) || null;
  const offer = itemOffer || item || {};
  const restaurant =
    offer.restaurantId ||
    item?.restaurantId ||
    (itemOffer ? null : null) ||
    null;
  const restaurantName =
    typeof restaurant === "string"
      ? ""
      : restaurant?.restaurantName || "";
  const restaurantCity = typeof restaurant === "string" ? "" : restaurant?.city || "";

  const formatOfferDate = (value) => {
    if (!value) return "";
    const normalized = String(value).includes("T") ? value : `${value}T00:00:00`;
    return formatDate(normalized);
  };
  const validityStart = formatOfferDate(offer.validityStart);
  const validityEnd = formatOfferDate(offer.validityEnd);

  const selectable = typeof onSelect === "function";
  return (
    <div
      role={selectable ? "button" : undefined}
      tabIndex={selectable ? 0 : undefined}
      aria-pressed={selectable ? selected : undefined}
      onClick={selectable ? () => onSelect(offer) : undefined}
      onKeyDown={selectable ? (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(offer); } } : undefined}
      className={`card-theme flex flex-col overflow-hidden border transition-all duration-200 ${compact ? "min-w-0" : "hover:-translate-y-1 hover:shadow-lg"} ${selected ? "border-primary ring-2 ring-primary/20" : "border-transparent"} ${selectable ? "cursor-pointer" : ""}`}
    >
      <div className={`bg-gradient-to-r from-primary to-primary/70 ${compact ? "px-3 py-2.5" : "px-5 py-4"}`}>
        <div className="flex items-center justify-between gap-2">
            <span className="inline-flex min-w-0 items-center gap-1.5 rounded-md bg-white/20 px-2 py-1 font-mono text-xs font-bold text-white backdrop-blur">
            <Ticket size={13} />
            {offer.offerCode || "OFFER"}
          </span>
          {status && (
            <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold text-white capitalize backdrop-blur">
              {status}
            </span>
          )}
        </div>
        <p className={`${compact ? "mt-1 text-xl" : "mt-2 text-2xl"} font-extrabold tracking-tight text-white`}>
          {formatOfferDiscount(offer) || "0% OFF"}
        </p>
      </div>

      <div className={`flex flex-1 flex-col ${compact ? "p-3" : "p-5"}`}>
        <h3 className="line-clamp-1 text-base font-bold text-text">{offer.title || "Special offer"}</h3>
        {offer.description && (
          <p className={`${compact ? "text-xs" : "text-sm"} mt-1 line-clamp-2 text-muted`}>{offer.description}</p>
        )}

        <div className={`${compact ? "mt-2 space-y-1 text-xs" : "mt-4 space-y-1.5 text-sm"} text-muted`}>
          {restaurantName && (
            <p className="inline-flex items-center gap-1.5">
              <MapPin size={14} />
              {restaurantName}
              {restaurantCity ? ` · ${restaurantCity}` : ""}
            </p>
          )}
          {(validityStart || validityEnd) && (
            <p className="inline-flex items-center gap-1.5">
              <CalendarClock size={14} />
              {validityStart && validityEnd
                ? `${validityStart} – ${validityEnd}`
                : validityStart
                  ? `Valid from ${validityStart}`
                  : `Valid till ${validityEnd}`}
            </p>
          )}
          {offer.minOrderAmount > 0 && (
            <p>Minimum order of {formatCurrency(offer.minOrderAmount)}</p>
          )}
          {offer.maxDiscountAmount > 0 && (
            <p>Maximum discount of {formatCurrency(offer.maxDiscountAmount)}</p>
          )}
        </div>

        {selectable && (
          <div className="mt-auto pt-3 text-xs font-semibold text-primary">
            {selected ? "Selected" : "Select offer"}
          </div>
        )}
        {onClaim && (
          <div className="mt-5 pt-2">
            <Button
              variant={claimed ? "secondary" : "primary"}
              disabled={claimed}
              isLoading={claiming}
              onClick={() => onClaim(offer)}
              className="w-full"
            >
              {claimed ? "Claimed" : "Claim Offer"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default OfferCard;

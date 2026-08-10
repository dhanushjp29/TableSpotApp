import { CalendarClock, Tag, Users } from "lucide-react";

import { formatDate } from "../../utils/formatDate.js";
import { formatCurrency } from "../../utils/formatCurrency.js";
import {
  OFFER_TARGETING,
  OFFER_DISCOUNT_TYPE,
  formatOfferDiscount,
} from "../../constants/offer.js";
import { OfferStatusBadge } from "./OfferBadge.jsx";

const TARGETING_LABEL = {
  [OFFER_TARGETING.ALL]: "All customers",
  [OFFER_TARGETING.SELECTED]: "Selected customers",
  [OFFER_TARGETING.SEGMENT]: "Customer segment",
};

function OfferPreview({ offer = {} }) {
  const validityStart = offer.validityStart
    ? formatDate(offer.validityStart + "T00:00:00")
    : "";
  const validityEnd = offer.validityEnd
    ? formatDate(offer.validityEnd + "T00:00:00")
    : "";

  return (
    <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 font-mono text-xs font-bold text-white">
              <Tag size={12} />
              {offer.offerCode || "OFFER"}
            </span>
            <OfferStatusBadge offer={offer} />
          </div>
          <h3 className="mt-3 text-lg font-bold text-text">
            {offer.title || "Offer title"}
          </h3>
          <p className="mt-1 text-sm text-muted">
            {offer.description || "Offer description appears here."}
          </p>
        </div>
        <span className="rounded-xl bg-surface px-3 py-2 text-2xl font-extrabold tracking-tight text-primary shadow-sm">
          {formatOfferDiscount(offer) || "0% OFF"}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
        <span className="inline-flex items-center gap-1.5">
          <CalendarClock size={15} />
          {validityStart && validityEnd
            ? `${validityStart} – ${validityEnd}`
            : "No validity set"}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Users size={15} />
          {TARGETING_LABEL[offer.targeting] || "All customers"}
        </span>
        {offer.minOrderAmount > 0 && (
          <span>
            Min order {formatCurrency(offer.minOrderAmount)}
          </span>
        )}
        {offer.maxDiscountAmount > 0 &&
          offer.discountType === OFFER_DISCOUNT_TYPE.PERCENTAGE && (
            <span>Up to {formatCurrency(offer.maxDiscountAmount)}</span>
          )}
      </div>
    </div>
  );
}

export default OfferPreview;

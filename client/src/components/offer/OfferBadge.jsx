import Badge from "../ui/Badge.jsx";
import {
  getOfferStatus,
  OFFER_RECIPIENT_STATUS_META,
  OFFER_STATUS_META,
} from "../../constants/offer.js";

export function OfferStatusBadge({ offer, className = "" }) {
  const status = getOfferStatus(offer);
  const meta = OFFER_STATUS_META[status] || OFFER_STATUS_META.inactive;
  return (
    <Badge variant={meta.variant} className={className}>
      {meta.label}
    </Badge>
  );
}

export function OfferRecipientStatusBadge({ status, className = "" }) {
  const meta = OFFER_RECIPIENT_STATUS_META[status] || {
    label: status || "Unknown",
    variant: "neutral",
  };
  return (
    <Badge variant={meta.variant} className={className}>
      {meta.label}
    </Badge>
  );
}

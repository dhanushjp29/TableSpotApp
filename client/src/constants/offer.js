export const OFFER_TARGETING = {
  ALL: "ALL",
  SELECTED: "SELECTED",
  SEGMENT: "SEGMENT",
};

export const OFFER_TARGETING_OPTIONS = [
  { value: OFFER_TARGETING.ALL, label: "All customers" },
  { value: OFFER_TARGETING.SELECTED, label: "Selected customers" },
  { value: OFFER_TARGETING.SEGMENT, label: "Customer segment" },
];

export const OFFER_DISCOUNT_TYPE = {
  PERCENTAGE: "Percentage",
  AMOUNT: "Amount",
};

export const OFFER_DISCOUNT_TYPE_OPTIONS = [
  { value: OFFER_DISCOUNT_TYPE.PERCENTAGE, label: "Percentage (%)" },
  { value: OFFER_DISCOUNT_TYPE.AMOUNT, label: "Flat amount (₹)" },
];

export const OFFER_RECIPIENT_STATUS = {
  AVAILABLE: "AVAILABLE",
  CLAIMED: "CLAIMED",
  RESERVED: "RESERVED",
  USED: "USED",
  EXPIRED: "EXPIRED",
};

export const OFFER_RECIPIENT_STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: OFFER_RECIPIENT_STATUS.AVAILABLE, label: "Available" },
  { value: OFFER_RECIPIENT_STATUS.CLAIMED, label: "Claimed" },
  { value: OFFER_RECIPIENT_STATUS.RESERVED, label: "Reserved for Booking" },
  { value: OFFER_RECIPIENT_STATUS.USED, label: "Used" },
  { value: OFFER_RECIPIENT_STATUS.EXPIRED, label: "Expired" },
];

export const OFFER_USAGE_SOURCE = {
  WALK_IN: "WALK_IN",
  ONLINE: "ONLINE",
};

export const OFFER_USAGE_SOURCE_LABEL = {
  WALK_IN: "Walk-in",
  ONLINE: "Online",
};

// Owner-facing lifecycle of an offer derived from isActive + validity window.
export const getOfferStatus = (offer, now = new Date()) => {
  if (!offer) return "inactive";
  if (offer.isActive === false) return "inactive";
  const start = offer.validityStart ? new Date(offer.validityStart) : null;
  const end = offer.validityEnd ? new Date(offer.validityEnd) : null;
  if (start && now < start) return "scheduled";
  if (end && now > end) return "expired";
  return "active";
};

// Mirrors the server-side computeOfferDiscount: percentage/amount against the
// bill subtotal, capped by the subtotal and the offer's max discount cap.
export const computeOfferDiscount = (offer, subtotal = 0) => {
  if (!offer) return 0;
  const total = Math.max(0, Number(subtotal) || 0);
  if (total <= 0) return 0;
  const value = Number(offer.discountValue || 0);
  let discount =
    String(offer.discountType || "").toLowerCase() === "percentage"
      ? (total * value) / 100
      : value;
  discount = Math.min(discount, total);
  if (Number(offer.maxDiscountAmount) > 0) {
    discount = Math.min(discount, Number(offer.maxDiscountAmount));
  }
  return Math.round(discount * 100) / 100;
};

export const OFFER_STATUS_META = {
  active: { label: "Active", variant: "success" },
  scheduled: { label: "Scheduled", variant: "info" },
  expired: { label: "Expired", variant: "neutral" },
  inactive: { label: "Inactive", variant: "danger" },
};

export const OFFER_STATUS_FILTER_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "scheduled", label: "Scheduled" },
  { value: "expired", label: "Expired" },
  { value: "inactive", label: "Inactive" },
];

export const OFFER_RECIPIENT_STATUS_META = {
  AVAILABLE: { label: "Available", variant: "info" },
  CLAIMED: { label: "Claimed", variant: "warning" },
  RESERVED: { label: "Reserved for Booking", variant: "info" },
  USED: { label: "Used", variant: "success" },
  EXPIRED: { label: "Expired", variant: "neutral" },
};

// Human friendly discount label, e.g. "10% OFF" / "₹200 OFF".
export const formatOfferDiscount = (offer) => {
  if (!offer) return "";
  const value = Number(offer.discountValue ?? 0);
  if (offer.discountType === OFFER_DISCOUNT_TYPE.PERCENTAGE) {
    return `${value}% OFF`;
  }
  return `₹${value} OFF`;
};

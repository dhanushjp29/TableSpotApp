// Shared helper for resolving the food items shown for a booking.
//
// A bill's `orderedItems` are the authoritative record — they include spot
// orders, offer prices and per-item order sources (see the View Receipt / bill
// data flow). When no bill data is available we fall back to the booking's
// `preOrderedFoods` snapshot. Both UI and PDF consumers use the same mapping so
// the food-item information never diverges between views.

const normalizeBillItem = (item = {}) => ({
  foodName:
    item.foodName ||
    (typeof item.foodId === "object" ? item.foodId?.foodName : null) ||
    "Food item",
  variantName: item.variantName || "Regular",
  quantity: Number(item.quantity || 0),
  unitPrice: Number(item.unitPrice ?? item.price ?? 0),
  offerPrice: Number(item.offerPrice || 0),
  totalPrice: Number(
    item.totalPrice ??
      Number(item.unitPrice ?? item.price ?? 0) * Number(item.quantity || 0)
  ),
  orderSource: item.orderSource || "Spot Order",
});

const normalizePreOrderItem = (item = {}) => ({
  foodName:
    (typeof item.foodId === "object" ? item.foodId?.foodName : null) ||
    item.foodName ||
    "Food item",
  variantName: item.variantName || "Regular",
  quantity: Number(item.quantity || 0),
  unitPrice: Number(item.unitPrice ?? item.price ?? 0),
  offerPrice: Number(item.offerPrice || 0),
  totalPrice: Number(
    item.totalPrice ??
      Number(item.price ?? item.unitPrice ?? 0) * Number(item.quantity || 0)
  ),
  orderSource: item.orderSource || "Pre-Order",
});

export const getBookingFoodItems = (booking = {}) => {
  const bill = typeof booking.billId === "object" ? booking.billId : null;
  const billItems = bill?.orderedItems || [];

  if (billItems.length > 0) {
    return billItems.map(normalizeBillItem);
  }

  return (booking.preOrderedFoods || []).map(normalizePreOrderItem);
};
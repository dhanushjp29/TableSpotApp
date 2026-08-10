// Shared palette and helpers for the light-mode PDF documents.
// These values must never reference the app's dark-mode theme.

import { formatCurrency } from "../formatCurrency.js";
import { REFUND_METHOD_LABELS } from "../../constants/refund.js";

export const PDF_COLORS = {
  bg: "#ffffff",
  text: "#172033",
  muted: "#6b7280",
  border: "#e5e7eb",
  red: "#b91c1c",
  redDark: "#991b1b",
  redSoft: "#fef2f2",
  redBorder: "#fecaca",
  emerald: "#047857",
  amber: "#b45309",
  amberSoft: "#fffbeb",
  blue: "#1d4ed8",
  blueSoft: "#eff6ff",
};

export const money = (value) => formatCurrency(value);

export const dash = (value) => (value ? value : "—");

export const restaurantAddress = (restaurant = {}) => {
  const parts = [
    restaurant.address,
    restaurant.city,
    restaurant.state,
    restaurant.pincode,
    restaurant.country,
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : "";
};

export const tableLabel = (table = {}) =>
  table?.tableName ||
  (table?.tableNumber ? `Table ${table.tableNumber}` : undefined) ||
  table?.tableCode ||
  table?.tableLabel ||
  "";

export const REFUND_STATUS_LABELS = {
  REFUND_PENDING: "Pending",
  REFUND_PROCESSING: "Processing",
  REFUND_AWAITING_CUSTOMER_CONFIRMATION: "Awaiting customer confirmation",
  REFUNDED: "Refunded",
  REFUND_OVERDUE: "Overdue",
  REFUND_FAILED: "Failed",
  REFUND_DISPUTED: "Disputed",
};

export const REFUND_REASON_LABELS = {
  CUSTOMER_CANCELLED: "Customer cancellation",
  CUSTOMER_NO_SHOW: "Customer no-show",
  EXCESS_ADVANCE_PAYMENT: "Excess advance payment",
  BILL_ADJUSTMENT: "Bill adjustment",
  OTHER_APPROVED_REASON: "Approved reason",
};

export const refundStatusLabel = (status) =>
  REFUND_STATUS_LABELS[status] || status || "N/A";

export const refundReasonLabel = (reason) =>
  REFUND_REASON_LABELS[reason] || reason || "N/A";

export const refundMethodLabel = (method) =>
  REFUND_METHOD_LABELS[method] || method || "N/A";

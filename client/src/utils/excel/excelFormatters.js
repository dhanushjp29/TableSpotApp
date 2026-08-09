// Value normalization helpers for Excel exports.
// Every helper is defensive: never throws on null/undefined/malformed data.

export const DASH = "-";

/** Return fallback ("-") when value is null/undefined/empty string. */
export const safe = (value, fallback = DASH) => {
  if (value === null || value === undefined || value === "") return fallback;
  return value;
};

/** Number for money/int cells. Returns null when not a valid number. */
export const toNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

/** Rounded integer for int cells. Returns null when invalid. */
export const toInt = (value) => {
  const n = toNumber(value);
  return n === null ? null : Math.round(n);
};

/** Date object for date cells. Returns null when invalid. */
export const toDate = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** True/false to Yes/No. */
export const yesNo = (value) => {
  if (value === null || value === undefined || value === "") return DASH;
  const v = String(value).toLowerCase();
  return v === "true" || v === "1" || v === "yes" ? "Yes" : "No";
};

/** True/false to Active/Inactive. */
export const activeLabel = (value) => {
  if (value === null || value === undefined || value === "") return DASH;
  const v = String(value).toLowerCase();
  return v === "false" || v === "0" || v === "no" ? "Inactive" : "Active";
};

/**
 * Human-readable label from a nested object (avoid `[object Object]`).
 * Picks the first known display field, otherwise a compact JSON summary.
 */
export const objectLabel = (obj) => {
  if (obj === null || obj === undefined) return DASH;
  if (typeof obj !== "object") return String(obj);
  if (Array.isArray(obj)) return arrayText(obj);
  for (const key of ["label", "name", "title", "fullName", "restaurantName", "foodName", "value", "code"]) {
    const v = obj[key];
    if (v !== undefined && v !== null && v !== "") return String(v);
  }
  const text = JSON.stringify(obj);
  return text && text !== "{}" ? text : DASH;
};

/** Join an array (of strings/objects) into readable text. */
export const arrayText = (arr, separator = ", ") => {
  if (arr === null || arr === undefined) return DASH;
  if (!Array.isArray(arr)) return objectLabel(arr);
  const parts = arr
    .map((item) => (item && typeof item === "object" ? objectLabel(item) : String(item)))
    .filter(Boolean);
  return parts.length ? parts.join(separator) : DASH;
};

/** Currency symbol per code (mirrors client/src/constants/app.js). */
export const currencySymbol = (code) => {
  const symbols = { INR: "₹", USD: "$", EUR: "€", GBP: "£", AED: "د.إ", CAD: "CA$", AUD: "A$", SGD: "S$", MYR: "RM", JPY: "¥" };
  return symbols[code] || "₹";
};

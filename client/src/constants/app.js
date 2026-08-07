export const CURRENCY = "INR";
export const CURRENCY_SYMBOL = "₹";

export const CURRENCY_VALUES = [
  "INR",
  "USD",
  "EUR",
  "GBP",
  "AED",
  "CAD",
  "AUD",
  "SGD",
  "MYR",
  "JPY",
];

export const CURRENCY_SYMBOLS = {
  INR: "₹",
  USD: "$",
  EUR: "€",
  GBP: "£",
  AED: "د.إ",
  CAD: "CA$",
  AUD: "A$",
  SGD: "S$",
  MYR: "RM",
  JPY: "¥",
};

export const CURRENCY_OPTIONS = CURRENCY_VALUES.map((code) => ({
  code,
  symbol: CURRENCY_SYMBOLS[code] || "",
  label: `${code} (${CURRENCY_SYMBOLS[code] || code})`,
}));

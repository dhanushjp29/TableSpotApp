import { CURRENCY, CURRENCY_SYMBOLS } from "../constants/app.js";

export const formatCurrency = (value, currency = CURRENCY) => {
  const amount = Number(value || 0);
  const symbol = CURRENCY_SYMBOLS[currency] || "";
  const formatted = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return symbol ? `${symbol}${formatted}` : `${currency} ${formatted}`;
};

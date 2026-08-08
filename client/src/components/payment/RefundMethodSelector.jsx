import {
  Banknote,
  CreditCard,
  HandCoins,
  Landmark,
  Smartphone,
  Wallet,
} from "lucide-react";

import {
  REFUND_METHOD,
  REFUND_METHOD_OPTIONS,
} from "../../constants/refund.js";

const METHOD_ICONS = {
  [REFUND_METHOD.CASH]: Banknote,
  [REFUND_METHOD.UPI]: Smartphone,
  [REFUND_METHOD.CARD]: CreditCard,
  [REFUND_METHOD.NET_BANKING]: Landmark,
  [REFUND_METHOD.WALLET]: Wallet,
  [REFUND_METHOD.RAZORPAY]: HandCoins,
};

/**
 * Owner-facing refund method picker. Radio card grid, mobile responsive.
 * The selected value is sent verbatim to the backend process endpoint.
 */
function RefundMethodSelector({ value, onChange, disabled = false }) {
  return (
    <fieldset disabled={disabled}>
      <legend className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
        Refund Method
      </legend>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {REFUND_METHOD_OPTIONS.map((option) => {
          const Icon = METHOD_ICONS[option.value];
          const isSelected = value === option.value;
          return (
            <label
              key={option.value}
              className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 transition ${
                isSelected
                  ? "border-primary bg-primary/5"
                  : "border-gray-200 bg-white hover:border-gray-300"
              } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
            >
              <input
                type="radio"
                name="refundMethod"
                value={option.value}
                checked={isSelected}
                onChange={() => onChange?.(option.value)}
                className="mt-0.5 shrink-0 accent-primary"
              />
              <div className="min-w-0">
                <span className="flex items-center gap-1.5 text-sm font-medium text-text">
                  <Icon size={15} className="text-primary shrink-0" />
                  {option.label}
                </span>
                <span className="mt-0.5 block text-xs text-muted">
                  {option.hint}
                </span>
              </div>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export default RefundMethodSelector;

// Refund methods supported by the backend (mirrors server REFUND_METHOD_VALUES).
// The values are sent verbatim to POST /refunds/:id/process — do not rename.

export const REFUND_METHOD = {
  CASH: "Cash",
  UPI: "UPI",
  CARD: "Card",
  NET_BANKING: "Net Banking",
  WALLET: "Wallet",
  RAZORPAY: "RAZORPAY",
};

export const REFUND_METHOD_LABELS = {
  [REFUND_METHOD.CASH]: "Cash",
  [REFUND_METHOD.UPI]: "UPI",
  [REFUND_METHOD.CARD]: "Card",
  [REFUND_METHOD.NET_BANKING]: "Net Banking",
  [REFUND_METHOD.WALLET]: "Wallet",
  [REFUND_METHOD.RAZORPAY]: "Razorpay / Online",
};

// Ordered list used by the owner refund method selector.
export const REFUND_METHOD_OPTIONS = [
  {
    value: REFUND_METHOD.CASH,
    label: "Cash",
    hint: "Pay the customer in person. They confirm receipt in the app.",
  },
  {
    value: REFUND_METHOD.UPI,
    label: "UPI",
    hint: "Transfer via UPI. Customer confirms receipt in the app.",
  },
  {
    value: REFUND_METHOD.CARD,
    label: "Card",
    hint: "Refund to the customer's card. Confirmation required.",
  },
  {
    value: REFUND_METHOD.NET_BANKING,
    label: "Net Banking",
    hint: "Bank transfer refund. Confirmation required.",
  },
  {
    value: REFUND_METHOD.WALLET,
    label: "Wallet",
    hint: "Refund to the customer's wallet. Confirmation required.",
  },
  {
    value: REFUND_METHOD.RAZORPAY,
    label: "Razorpay / Online",
    hint: "Automatic gateway refund to the original payment method.",
  },
];

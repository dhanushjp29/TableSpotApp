const MOCK_FLAGS = [
  ["RAZORPAY_ORDER_MOCK", "order"],
  ["RAZORPAY_REFUND_MOCK", "refund"],
  ["RAZORPAY_ONBOARDING_MOCK", "onboarding"],
];

const parseBoolean = (value) =>
  String(value ?? "").trim().toLowerCase() === "true";

export const assertRazorpayMockModesSafe = () => {
  if (String(process.env.NODE_ENV || "").trim().toLowerCase() !== "production") {
    return;
  }

  for (const [flag, label] of MOCK_FLAGS) {
    if (parseBoolean(process.env[flag])) {
      throw new Error(`Razorpay ${label} mock mode cannot be enabled in production.`);
    }
  }
};

export const isRazorpayMockEnabled = (flag) => {
  // Re-check on every use so a runtime environment mutation cannot enable a
  // mock path while the process is running in production.
  assertRazorpayMockModesSafe();
  return parseBoolean(process.env[flag]);
};

const MOCK_FLAGS = [
  ["RAZORPAY_ORDER_MOCK", "order"],
  ["RAZORPAY_REFUND_MOCK", "refund"],
  ["RAZORPAY_ONBOARDING_MOCK", "onboarding"],
];

const parseBoolean = (value) =>
  String(value ?? "").trim().toLowerCase() === "true";

/**
 * Razorpay key mode: "test" or "live". Defaults to "live" so a production
 * deployment without an explicit RAZORPAY_MODE keeps the strict live-key
 * requirement. Throws on any other explicit value.
 */
export const getRazorpayMode = () => {
  const mode = String(process.env.RAZORPAY_MODE || "").trim().toLowerCase();
  if (!mode) return "live";
  if (mode === "test" || mode === "live") return mode;
  throw new Error(`RAZORPAY_MODE must be "test" or "live"; received "${mode}".`);
};

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

/**
 * Returns the TEST_RAZORPAY_ACCOUNT_ID when running in Razorpay test mode.
 * Returns null when:
 *   - RAZORPAY_MODE is not "test"
 *   - TEST_RAZORPAY_ACCOUNT_ID is not set
 *   - TEST_RAZORPAY_ACCOUNT_ID is empty or whitespace-only
 *
 * In live mode this always returns null regardless of the env value, so the
 * setting can never accidentally leak into production flows.
 */
export const getTestRazorpayAccountId = () => {
  const mode = getRazorpayMode();
  if (mode !== "test") return null;

  const id = String(process.env.TEST_RAZORPAY_ACCOUNT_ID || "").trim();
  return id || null;
};

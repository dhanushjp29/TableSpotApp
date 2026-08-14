import Razorpay from "razorpay";
import crypto from "crypto";
import ApiError from "../utils/ApiError.js";
import { isRazorpayMockEnabled } from "../config/razorpay.js";

/**
 * Where a linked account holder completes KYC and manages their payout
 * account. The Route API has no per-account hosted onboarding URL, so this
 * dashboard is the honest target for "complete onboarding".
 */
export const RAZORPAY_DASHBOARD_URL = "https://dashboard.razorpay.com/";

const isOnboardingMock = () =>
  isRazorpayMockEnabled("RAZORPAY_ONBOARDING_MOCK");

const isOrderMock = () =>
  isRazorpayMockEnabled("RAZORPAY_ORDER_MOCK");

/**
 * Extract a diagnostic summary from any Razorpay failure shape (SDK thrown
 * objects, gateway error bodies, or plain Error instances). Never falls back
 * to "Unknown error".
 */
const describeRazorpayError = (error = {}) => {
  const body =
    error?.error ||
    error?.response?.data?.error ||
    error?.response?.data ||
    {};
  return {
    statusCode: Number(
      error?.statusCode || error?.status || error?.response?.status || 0
    ),
    code: body?.code || "",
    description: body?.description || error?.message || "",
    source: body?.source || "",
    step: body?.step || "",
    reason: body?.reason || "",
    field: body?.field || "",
  };
};

/**
 * Log the full gateway diagnostic server-side and throw a safe ApiError. The
 * client never receives gateway internals (codes, descriptions, metadata) —
 * only a fixed message appropriate for the failure class.
 */
const throwRazorpayError = (operation, safeMessage, error) => {
  const detail = describeRazorpayError(error);
  console.error(`Razorpay ${operation} failed`, {
    statusCode: detail.statusCode || undefined,
    code: detail.code || undefined,
    description: detail.description || undefined,
    source: detail.source || undefined,
    step: detail.step || undefined,
    reason: detail.reason || undefined,
    field: detail.field || undefined,
  });
  throw new ApiError(detail.statusCode >= 500 ? 502 : 400, safeMessage);
};

// Initialize Razorpay client lazily to avoid crashing if env variables are not set during boot
let razorpayInstance = null;

const getRazorpayInstance = () => {
    if (razorpayInstance) return razorpayInstance;

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
        throw new ApiError(500, "Razorpay key credentials are not configured in environment variables.");
    }

    razorpayInstance = new Razorpay({
        key_id: keyId,
        key_secret: keySecret,
    });

    return razorpayInstance;
};

/**
 * Create a new Razorpay Order with optional route transfer to owner's linked account.
 * @param {string} bookingId - The original table booking ID
 * @param {number} amount - Amount in INR (e.g. 500)
 * @param {string} [razorpayAccountId] - Owner's Razorpay Account ID if transferring directly
 * @returns {Promise<object>} The created Razorpay Order object
 */
export const createPaymentOrder = async ({
  bookingId,
  amount,
  razorpayAccountId,
  receipt = "",
}) => {
    // RAZORPAY_ORDER_MOCK=true short-circuits the real gateway call (the
    // sandbox key used in automated tests does not support live orders) so the
    // full payment-first flow can be exercised deterministically. It MUST be
    // removed in production.
    if (isOrderMock()) {
        const amountInPaise = Math.round(amount * 100);
        const uniqueSuffix = `${Date.now().toString(36)}${Math.random()
            .toString(36)
            .slice(2, 8)}`;
        return {
            id: `order_mock_${bookingId.toString().substring(0, 8)}_${uniqueSuffix}`,
            amount: amountInPaise,
            currency: "INR",
            receipt: receipt || `rcpt_bk_${bookingId.toString().substring(0, 14)}`,
            status: "created",
            notes: {
                bookingId: bookingId.toString(),
            },
            ...(razorpayAccountId && razorpayAccountId.trim() !== ""
                ? {
                      transfers: [
                          {
                              account: razorpayAccountId.trim(),
                              amount: amountInPaise,
                              currency: "INR",
                              on_hold: false,
                          },
                      ],
                  }
                : {}),
        };
    }

    const razorpay = getRazorpayInstance();

    const amountInPaise = Math.round(amount * 100);

    const options = {
        amount: amountInPaise,
        currency: "INR",
        receipt: receipt || `rcpt_bk_${bookingId.toString().substring(0, 14)}`,
        notes: {
            bookingId: bookingId.toString(),
        },
    };

    // If a linked merchant account is set for the owner, transfer funds to them using Razorpay Route
    if (razorpayAccountId && razorpayAccountId.trim() !== "") {
        options.transfers = [
            {
                account: razorpayAccountId.trim(),
                amount: amountInPaise,
                currency: "INR",
                on_hold: false,
            },
        ];
    }

    try {
        const order = await razorpay.orders.create(options);
        return order;
    } catch (error) {
        throwRazorpayError(
            "order creation",
            "Razorpay order creation failed. Please try again later.",
            error
        );
    }
};

/**
 * Recover an order created before the application lost the response. Razorpay
 * supports filtering orders by receipt, which lets retries recover the same
 * gateway order without creating another one.
 */
export const findPaymentOrderByReceipt = async ({ receipt }) => {
    if (!receipt || isOrderMock()) return null;

    const razorpay = getRazorpayInstance();

    try {
        const result = await razorpay.orders.all({ receipt, count: 10 });
        return (result?.items || []).find((order) => order.receipt === receipt) || null;
    } catch (error) {
        throwRazorpayError(
            "order recovery",
            "Razorpay order recovery is temporarily unavailable.",
            error
        );
    }
};

/**
 * Initiate a Razorpay refund against a captured payment.
 *
 * RAZORPAY_REFUND_MOCK=true short-circuits the real gateway call so that
 * automated tests (which use synthetic webhook payment ids) can exercise the
 * full refund lifecycle deterministically. It MUST be removed in production.
 *
 * @param {string} razorpayPaymentId - captured payment id from Razorpay
 * @param {number} amount - refund amount in INR
 * @param {string} refundCode - app-side refund code (used in the mock id)
 * @returns {Promise<{id: string, status: string}>}
 */
export const createRefundForPayment = async ({
  razorpayPaymentId,
  amount,
  refundCode,
}) => {
  if (isRazorpayMockEnabled("RAZORPAY_REFUND_MOCK")) {
    return {
      id: `rgd_${refundCode}`,
      status: "processed",
    };
  }

    const razorpay = getRazorpayInstance();

    try {
        const refund = await razorpay.payments.refund(razorpayPaymentId, {
            amount: Math.round(Number(amount) * 100),
            notes: { refundCode },
        });
        return refund;
    } catch (error) {
        throwRazorpayError(
            "refund",
            "Razorpay refund failed. Please try again later.",
            error
        );
    }
};

/**
 * Verify signature of Razorpay payment payload
 * @param {string} razorpayOrderId 
 * @param {string} razorpayPaymentId 
 * @param {string} razorpaySignature 
 * @returns {boolean} True if signature matches, throws ApiError otherwise
 */
export const verifyPaymentSignature = ({ razorpayOrderId, razorpayPaymentId, razorpaySignature }) => {
    // RAZORPAY_ORDER_MOCK=true skips the HMAC check because the checkout is
    // simulated (no real gateway signature exists). Test-only; MUST be removed
    // in production.
    if (isOrderMock()) {
        return true;
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
        throw new ApiError(500, "Razorpay Secret Key is not configured.");
    }

    const generatedSignature = crypto
        .createHmac("sha256", keySecret)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest("hex");

    if (generatedSignature !== razorpaySignature) {
        throw new ApiError(400, "Invalid Razorpay payment signature verification failed.");
    }

    return true;
};

/**
 * Verify Razorpay webhook signature.
 * The expected signature is an HMAC-SHA256 of the raw request body using the
 * configured webhook secret. Supports the "v1=" prefix Razorpay sends when
 * timestamp signing is enabled.
 * @param {Buffer|string} rawBody
 * @param {string} signature - value of the x-razorpay-signature header
 * @returns {boolean} True if signature matches, throws ApiError otherwise
 */
export const verifyWebhookSignature = ({ rawBody, signature }) => {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
        throw new ApiError(500, "Razorpay webhook secret is not configured.");
    }

    if (!signature) {
        throw new ApiError(400, "Missing Razorpay webhook signature.");
    }

    const expected = crypto
        .createHmac("sha256", webhookSecret)
        .update(rawBody)
        .digest();

    const received = signature.startsWith("v1=")
        ? signature.slice(3)
        : signature;

    const receivedBuffer = Buffer.from(received, "hex");

    if (
        expected.length !== receivedBuffer.length ||
        !crypto.timingSafeEqual(expected, receivedBuffer)
    ) {
        throw new ApiError(400, "Invalid Razorpay webhook signature.");
    }

    return true;
};

/**
 * Create a Razorpay linked payment account (Route) for an owner's payouts.
 *
 * RAZORPAY_ONBOARDING_MOCK=true short-circuits the real gateway call (the
 * sandbox key does not have the Route feature enabled) so the onboarding flow
 * can be exercised deterministically. It MUST be removed in production.
 *
 * Only the resulting Linked Account ID / status are returned for storage;
 * no secrets or banking credentials ever leave Razorpay.
 */
export const createPaymentAccount = async ({
    email,
    phone,
    legalBusinessName,
    businessType = "individual",
    registeredAddress = null,
}) => {
    if (isOnboardingMock()) {
        return {
            id: `acc_mock_${Date.now().toString(36)}${Math.random()
                .toString(36)
                .slice(2, 8)}`,
            status: "pending",
            active: false,
        };
    }

    const razorpay = getRazorpayInstance();

    const registered =
        registeredAddress && String(registeredAddress.street1 || "").trim()
            ? {
                  street1: String(registeredAddress.street1).trim(),
                  street2:
                      String(registeredAddress.street2 || "").trim() || "NA",
                  city: String(registeredAddress.city || "").trim(),
                  state: String(registeredAddress.state || "")
                      .trim()
                      .toUpperCase(),
                  postal_code: String(
                      registeredAddress.postalCode || ""
                  ).trim(),
                  country:
                      String(registeredAddress.country || "").trim() || "IN",
              }
            : {
                  street1: String(legalBusinessName || "TableSpot").trim(),
                  street2: "Update during KYC",
                  city: "Bengaluru",
                  state: "KARNATAKA",
                  postal_code: "560001",
                  country: "IN",
              };

    try {
        const account = await razorpay.accounts.create({
            type: "route",
            email: String(email || "").trim(),
            phone: String(phone || "9999999999").trim(),
            legal_business_name: String(legalBusinessName || "").trim(),
            business_type: businessType,
            profile: {
                category: "food",
                subcategory: "restaurant",
                addresses: {
                    registered,
                },
            },
            notes: {
                source: "tablespot",
            },
        });

        const active =
            account.status === "active" ||
            account.activation_details?.status === "active";

        return {
            id: account.id,
            status: active ? "active" : "pending",
            active,
        };
    } catch (error) {
        throwRazorpayError(
            "account creation",
            "Razorpay account creation failed. Please verify your details and try again.",
            error
        );
    }
};

/**
 * Fetch the current activation status of a Razorpay linked account.
 *
 * A linked account's `status` stays "created" forever — the real activation
 * signal is the Route product configuration's `activation_status`, which
 * becomes "activated" only after the holder completes KYC. The product
 * configuration can be read directly when its id is known, otherwise the
 * idempotent request endpoint returns the existing configuration.
 *
 * @param {string} accountId - Linked account id
 * @param {string} [productId] - Route product id when known
 * @returns {Promise<{id: string, status: string, active: boolean, activationStatus: string, productId: string}>}
 */
export const getPaymentAccountStatus = async (accountId, productId = "") => {
    if (isOnboardingMock()) {
        return {
            id: accountId,
            status: "active",
            active: true,
            activationStatus: "activated",
            productId,
        };
    }

    const razorpay = getRazorpayInstance();

    // Never send a leftover mock account id to the live gateway.
    if (!isOnboardingMock() && String(accountId || "").startsWith("acc_mock_")) {
        throw new ApiError(400, "Payment account is not connected.");
    }

    try {
        const product = productId
            ? await razorpay.api.get({
                  version: "v2",
                  url: `/accounts/${accountId}/products/${productId}`,
              })
            : await razorpay.api.post({
                  version: "v2",
                  url: `/accounts/${accountId}/products`,
                  data: {
                      product_name: "route",
                      tnc_accepted: true,
                  },
              });

        const activationStatus = product?.activation_status || "requested";
        const active = activationStatus === "activated";

        return {
            id: accountId,
            status: active ? "active" : "pending",
            active,
            activationStatus,
            productId: product?.id || productId,
        };
    } catch (error) {
        throwRazorpayError(
            "account status check",
            "Razorpay account status could not be checked. Please try again later.",
            error
        );
    }
};

/**
 * Prepare the linked account for KYC onboarding.
 *
 * The Route API has no `account_link` endpoint (it returns 404). The correct
 * post-creation step is to request the `route` product configuration, which
 * generates the KYC requirements; the owner then completes KYC in the
 * Razorpay dashboard. The request is idempotent — repeating it returns the
 * existing product configuration.
 * @returns {Promise<{url: string, status: string, activationStatus: string, productId: string}>}
 */
export const createPaymentAccountOnboardingLink = async ({ accountId }) => {
    if (isOnboardingMock()) {
        return {
            url: `https://rzp.io/i/TableSpotOnboarding_${accountId}`,
            status: "created",
            activationStatus: "requested",
            productId: "",
        };
    }

    const razorpay = getRazorpayInstance();

    // Never send a leftover mock account id to the live gateway.
    if (!isOnboardingMock() && String(accountId || "").startsWith("acc_mock_")) {
        throw new ApiError(400, "Payment account is not connected.");
    }

    try {
        const product = await razorpay.api.post({
            version: "v2",
            url: `/accounts/${accountId}/products`,
            data: {
                product_name: "route",
                tnc_accepted: true,
            },
        });

        const activationStatus = product?.activation_status || "requested";

        return {
            url: RAZORPAY_DASHBOARD_URL,
            status:
                activationStatus === "activated" ? "active" : "pending",
            activationStatus,
            productId: product?.id || "",
        };
    } catch (error) {
        throwRazorpayError(
            "onboarding",
            "Razorpay onboarding could not be started. Please try again later.",
            error
        );
    }
};

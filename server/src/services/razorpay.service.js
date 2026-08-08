import Razorpay from "razorpay";
import crypto from "crypto";
import ApiError from "../utils/ApiError.js";

const isOnboardingMock = () =>
  process.env.RAZORPAY_ONBOARDING_MOCK === "true";

const isOrderMock = () => process.env.RAZORPAY_ORDER_MOCK === "true";

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
export const createPaymentOrder = async ({ bookingId, amount, razorpayAccountId }) => {
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
            receipt: `rcpt_bk_${bookingId.toString().substring(0, 14)}`,
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
        receipt: `rcpt_bk_${bookingId.toString().substring(0, 14)}`,
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
        throw new ApiError(500, `Razorpay Order Creation Failed: ${error.message}`);
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
  if (process.env.RAZORPAY_REFUND_MOCK === "true") {
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
    throw new ApiError(
      502,
      `Razorpay Refund Failed: ${error.message}`
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
    contact,
    legalBusinessName,
    businessType = "individual",
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

    try {
        const account = await razorpay.accounts.create({
            type: "route",
            email: String(email || "").trim(),
            contact: String(contact || "").trim(),
            legal_business_name: String(legalBusinessName || "").trim(),
            business_type: businessType,
            profile: {
                category: "food",
                subcategory: "restaurants",
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
        const detail = error?.error?.description || error?.message || "Unknown error";
        throw new ApiError(502, `Razorpay account creation failed: ${detail}`);
    }
};

/**
 * Fetch the current activation status of a Razorpay linked account.
 * @returns {Promise<{status: string, active: boolean}>}
 */
export const getPaymentAccountStatus = async (accountId) => {
    if (isOnboardingMock()) {
        return {
            id: accountId,
            status: "active",
            active: true,
        };
    }

    const razorpay = getRazorpayInstance();

    try {
        const account = await razorpay.accounts.fetch(accountId);
        const active =
            account.status === "active" ||
            account.activation_details?.status === "active";

        return {
            id: account.id,
            status: active ? "active" : "pending",
            active,
        };
    } catch (error) {
        const detail = error?.error?.description || error?.message || "Unknown error";
        throw new ApiError(502, `Razorpay account status check failed: ${detail}`);
    }
};

/**
 * Generate a Razorpay onboarding link the owner uses to complete KYC and link
 * their payout account.
 * @returns {Promise<{url: string, status: string}>}
 */
export const createPaymentAccountOnboardingLink = async ({
    accountId,
    email,
    contact,
    businessName,
}) => {
    if (isOnboardingMock()) {
        return {
            url: `https://rzp.io/i/TableSpotOnboarding_${accountId}`,
            status: "created",
        };
    }

    const razorpay = getRazorpayInstance();

    try {
        const link = await razorpay.api.post({
            version: "v2",
            url: `/accounts/${accountId}/account_link`,
            data: {
                amount: 0,
                currency: "INR",
                customer: {
                    name: String(businessName || "").trim(),
                    email: String(email || "").trim(),
                    contact: String(contact || "").trim(),
                },
                notify: {
                    email: true,
                    sms: false,
                    whatsapp: false,
                },
            },
        });

        return {
            url: link.url,
            status: link.status,
        };
    } catch (error) {
        const detail = error?.error?.description || error?.message || "Unknown error";
        throw new ApiError(502, `Razorpay onboarding link generation failed: ${detail}`);
    }
};

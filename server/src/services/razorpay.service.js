import Razorpay from "razorpay";
import crypto from "crypto";
import ApiError from "../utils/ApiError.js";

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
 * Verify signature of Razorpay payment payload
 * @param {string} razorpayOrderId 
 * @param {string} razorpayPaymentId 
 * @param {string} razorpaySignature 
 * @returns {boolean} True if signature matches, throws ApiError otherwise
 */
export const verifyPaymentSignature = ({ razorpayOrderId, razorpayPaymentId, razorpaySignature }) => {
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

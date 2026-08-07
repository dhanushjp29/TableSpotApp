import * as razorpayService from "../services/razorpay.service.js";
import {
  handlePaymentCaptured,
  handlePaymentFailed,
  mapRazorpayMethod,
} from "../services/payment.service.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";

/**
 * Razorpay webhook handler (no auth; protected by signature verification).
 *
 * Events handled:
 *  - payment.captured: mark the Payment + Booking as captured/paid.
 *  - payment.failed:   mark the Payment as failed.
 *  - refund.*:         handled in the refund phase.
 * Unknown events return 200 so Razorpay does not retry indefinitely.
 */
export const handleWebhook = asyncHandler(async (req, res) => {
    const signature = req.headers["x-razorpay-signature"];

    const rawBody = req.body;

    if (!Buffer.isBuffer(rawBody)) {
        throw new ApiError(400, "Webhook expects a raw JSON body.");
    }

    razorpayService.verifyWebhookSignature({
        rawBody,
        signature,
    });

    let payload;
    try {
        payload = JSON.parse(rawBody.toString("utf8"));
    } catch (error) {
        throw new ApiError(400, "Invalid JSON payload in webhook.");
    }

    const event = payload.event;
    const entity = payload.payload?.payment?.entity || {};

    switch (event) {
        case "payment.captured":
            if (entity.order_id && entity.id) {
                await handlePaymentCaptured({
                    razorpayOrderId: entity.order_id,
                    razorpayPaymentId: entity.id,
                    paymentMethod: mapRazorpayMethod(entity.method),
                    transactionNotes: `Captured via Razorpay webhook. Order ID: ${entity.order_id}`,
                });
            }
            break;

        case "payment.failed":
            if (entity.order_id) {
                await handlePaymentFailed({
                    razorpayOrderId: entity.order_id,
                    razorpayPaymentId: entity.id,
                });
            }
            break;

        default:
            break;
    }

    res.status(200).json({ success: true, received: true });
});

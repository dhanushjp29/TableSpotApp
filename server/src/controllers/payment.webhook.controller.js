import * as razorpayService from "../services/razorpay.service.js";
import crypto from "crypto";
import WebhookEvent, {
  WEBHOOK_EVENT_STATUS,
} from "../models/WebhookEvent.js";
import {
  handlePaymentCaptured,
  handlePaymentFailed,
  mapRazorpayMethod,
} from "../services/payment.service.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";

const PROCESSING_TIMEOUT_MS = 5 * 60 * 1000;

const claimWebhookEvent = async ({
  eventId,
  eventType,
  entity,
}) => {
  const claimToken = crypto.randomUUID();
  const now = new Date();
  const staleBefore = new Date(now.getTime() - PROCESSING_TIMEOUT_MS);

  const existing = await WebhookEvent.findOne({ eventId }).lean();
  if (existing) {
    if (existing.status === WEBHOOK_EVENT_STATUS.PROCESSED) {
      return { duplicate: true, event: existing };
    }

    if (
      existing.status === WEBHOOK_EVENT_STATUS.PROCESSING &&
      existing.processingStartedAt &&
      existing.processingStartedAt > staleBefore
    ) {
      return { duplicate: true, event: existing };
    }

    const reclaimed = await WebhookEvent.findOneAndUpdate(
      {
        eventId,
        $or: [
          { status: WEBHOOK_EVENT_STATUS.FAILED_RETRYABLE },
          {
            status: WEBHOOK_EVENT_STATUS.PROCESSING,
            processingStartedAt: { $lte: staleBefore },
          },
        ],
      },
      {
        $set: {
          status: WEBHOOK_EVENT_STATUS.PROCESSING,
          claimToken,
          processingStartedAt: now,
          lastError: "",
          eventType,
          razorpayOrderId: entity.order_id || "",
          razorpayPaymentId: entity.id || "",
        },
        $inc: { attempts: 1 },
      },
      { new: true }
    ).lean();

    return reclaimed?.claimToken === claimToken
      ? { duplicate: false, event: reclaimed, claimToken }
      : { duplicate: true, event: reclaimed || existing };
  }

  let created;
  try {
    created = await WebhookEvent.findOneAndUpdate(
      { eventId },
      {
        $setOnInsert: {
          eventId,
          eventType,
          status: WEBHOOK_EVENT_STATUS.PROCESSING,
          claimToken,
          attempts: 1,
          receivedAt: now,
          processingStartedAt: now,
          razorpayOrderId: entity.order_id || "",
          razorpayPaymentId: entity.id || "",
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
  } catch (error) {
    if (error?.code !== 11000) throw error;
    created = await WebhookEvent.findOne({ eventId }).lean();
  }

  return created?.claimToken === claimToken
    ? { duplicate: false, event: created, claimToken }
    : { duplicate: true, event: created };
};

const markProcessed = async ({ eventId, claimToken }) => {
  await WebhookEvent.updateOne(
    { eventId, claimToken, status: WEBHOOK_EVENT_STATUS.PROCESSING },
    {
      $set: {
        status: WEBHOOK_EVENT_STATUS.PROCESSED,
        processedAt: new Date(),
        processingStartedAt: null,
        lastError: "",
      },
    }
  );
};

const markRetryableFailure = async ({ eventId, claimToken, error }) => {
  await WebhookEvent.updateOne(
    { eventId, claimToken, status: WEBHOOK_EVENT_STATUS.PROCESSING },
    {
      $set: {
        status: WEBHOOK_EVENT_STATUS.FAILED_RETRYABLE,
        processingStartedAt: null,
        lastError: String(error?.message || "Webhook processing failed").slice(0, 1000),
      },
    }
  );
};

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
    const eventId = String(req.headers["x-razorpay-event-id"] || "").trim();
    if (!eventId) {
        throw new ApiError(400, "Missing Razorpay webhook event ID.");
    }
    if (typeof event !== "string" || !event.trim()) {
        throw new ApiError(400, "Invalid Razorpay webhook event type.");
    }
    const entity = payload.payload?.payment?.entity || {};

    const claim = await claimWebhookEvent({
        eventId,
        eventType: event,
        entity,
    });

    if (claim.duplicate) {
        return res.status(200).json({ success: true, received: true, duplicate: true });
    }

    try {
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

      await markProcessed({ eventId, claimToken: claim.claimToken });
    } catch (error) {
      await markRetryableFailure({
        eventId,
        claimToken: claim.claimToken,
        error,
      });
      throw new ApiError(500, "Webhook processing could not be completed.");
    }

    res.status(200).json({ success: true, received: true });
});

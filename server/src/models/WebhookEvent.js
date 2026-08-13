import mongoose from "mongoose";

export const WEBHOOK_EVENT_STATUS = {
  PROCESSING: "PROCESSING",
  PROCESSED: "PROCESSED",
  FAILED_RETRYABLE: "FAILED_RETRYABLE",
};

const webhookEventSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      required: true,
      trim: true,
    },
    eventType: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: Object.values(WEBHOOK_EVENT_STATUS),
      required: true,
    },
    claimToken: {
      type: String,
      default: "",
      trim: true,
    },
    attempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    receivedAt: {
      type: Date,
      default: Date.now,
    },
    processingStartedAt: {
      type: Date,
      default: null,
    },
    processedAt: {
      type: Date,
      default: null,
    },
    lastError: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
    },
    razorpayOrderId: {
      type: String,
      default: "",
      trim: true,
    },
    razorpayPaymentId: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { timestamps: true }
);

webhookEventSchema.index(
  { eventId: 1 },
  { unique: true, name: "razorpay_webhook_event_unique" }
);
webhookEventSchema.index({ status: 1, processingStartedAt: 1 });

const WebhookEvent = mongoose.model("WebhookEvent", webhookEventSchema);

export default WebhookEvent;

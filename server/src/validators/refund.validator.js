import { z } from "zod";
import { mongoIdSchema } from "./common.validator.js";
import {
  REFUND_METHOD_VALUES,
  REFUND_STATUS_VALUES,
} from "../utils/constants.js";

// Route param schema for refund operations
export const refundIdParamSchema = z
  .object({
    refundId: mongoIdSchema,
  })
  .strict();

// Process a pending refund (owner/admin). An optional manual refund method
// lets the owner record a cash/offline refund instead of a Razorpay one.
export const processRefundSchema = z
  .object({
    refundMethod: z.enum(REFUND_METHOD_VALUES).optional(),
  })
  .strict();

// Customer confirms receipt of a manual refund - body intentionally empty
export const confirmRefundSchema = z.object({}).strict();

// Customer disputes a manual refund
export const disputeRefundSchema = z
  .object({
    disputeReason: z
      .string({
        required_error: "Dispute reason is required.",
      })
      .trim()
      .min(5, "Dispute reason must be at least 5 characters.")
      .max(500, "Dispute reason cannot exceed 500 characters."),
  })
  .strict();

// Query schema for listing refunds
export const listRefundsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    bookingId: mongoIdSchema.optional(),
    restaurantId: mongoIdSchema.optional(),
    refundStatus: z.enum(REFUND_STATUS_VALUES).optional(),
  })
  .strict();

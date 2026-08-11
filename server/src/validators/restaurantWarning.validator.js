import { z } from "zod";

import { mongoIdSchema } from "./common.validator.js";

import {
  MAX_WARNING_REASON_LENGTH,
  WARNING_LEVEL_VALUES,
  WARNING_STATUS_VALUES,
} from "../utils/constants.js";

// Create Restaurant Warning (admin).
export const createWarningSchema = z
  .object({
    restaurantId: mongoIdSchema,
    title: z.string().trim().min(3).max(200),
    reason: z
      .string()
      .trim()
      .min(1, "Reason is required.")
      .max(
        MAX_WARNING_REASON_LENGTH,
        `Reason cannot exceed ${MAX_WARNING_REASON_LENGTH} characters.`
      ),
    level: z.enum(WARNING_LEVEL_VALUES).optional(),
    // Default validity in days when no explicit expiry is supplied.
    expiresInDays: z.coerce.number().int().min(1).max(365).optional(),
    expiresAt: z.coerce.date().optional(),
    relatedReportId: mongoIdSchema.optional(),
  })
  .strict();

// Update Restaurant Warning (admin): re-scope level/reason, extend the
// expiry, or clear an active warning early.
export const updateWarningSchema = z
  .object({
    title: z.string().trim().min(3).max(200).optional(),
    reason: z
      .string()
      .trim()
      .min(1)
      .max(MAX_WARNING_REASON_LENGTH)
      .optional(),
    level: z.enum(WARNING_LEVEL_VALUES).optional(),
    expiresAt: z.coerce.date().optional(),
    status: z
      .enum(WARNING_STATUS_VALUES)
      .optional(),
    clearedReason: z.string().trim().max(MAX_WARNING_REASON_LENGTH).optional(),
  })
  .strict();

// Params
export const warningIdSchema = z
  .object({
    warningId: mongoIdSchema,
  })
  .strict();

// Owner / admin reply on an active warning.
export const replyWarningSchema = z
  .object({
    message: z
      .string()
      .trim()
      .min(1, "Reply message is required.")
      .max(MAX_WARNING_REASON_LENGTH, `Reply cannot exceed ${MAX_WARNING_REASON_LENGTH} characters.`),
  })
  .strict();
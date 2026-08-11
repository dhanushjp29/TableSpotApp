import { z } from "zod";

import { mongoIdSchema } from "./common.validator.js";

import {
  MAX_REPORT_ADMIN_NOTES_LENGTH,
  MAX_REPORT_DESCRIPTION_LENGTH,
  MAX_REPORT_IMAGES,
  MIN_REPORT_DESCRIPTION_LENGTH,
  REPORT_CATEGORY_VALUES,
  REPORT_SEVERITY,
  REPORT_SEVERITY_VALUES,
  REPORT_STATUS_VALUES,
} from "../utils/constants.js";

// Create Restaurant Report (customer).
export const createReportSchema = z
  .object({
    restaurantId: mongoIdSchema,
    bookingId: mongoIdSchema.optional(),
    category: z.enum(REPORT_CATEGORY_VALUES, {
      required_error: "Category is required.",
    }),
    severity: z
      .enum(REPORT_SEVERITY_VALUES)
      .optional()
      .default(REPORT_SEVERITY.MEDIUM),
    title: z.string().trim().max(150).optional().default(""),
    description: z
      .string()
      .trim()
      .min(
        MIN_REPORT_DESCRIPTION_LENGTH,
        `Description must be at least ${MIN_REPORT_DESCRIPTION_LENGTH} characters.`
      )
      .max(
        MAX_REPORT_DESCRIPTION_LENGTH,
        `Description cannot exceed ${MAX_REPORT_DESCRIPTION_LENGTH} characters.`
      ),
    images: z
      .array(z.string().trim().min(1))
      .max(MAX_REPORT_IMAGES, `No more than ${MAX_REPORT_IMAGES} images.`)
      .default([]),
  })
  .strict();

// Update report status (admin action: under review / resolve / reject).
export const updateReportStatusSchema = z
  .object({
    status: z.enum(REPORT_STATUS_VALUES, {
      required_error: "Status is required.",
    }),
    adminNotes: z
      .string()
      .trim()
      .max(MAX_REPORT_ADMIN_NOTES_LENGTH)
      .optional()
      .default(""),
  })
  .strict();

// Params
export const reportIdSchema = z
  .object({
    reportId: mongoIdSchema,
  })
  .strict();

export const restaurantIdParamSchema = z
  .object({
    restaurantId: mongoIdSchema,
  })
  .strict();

export const reportQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    status: z.enum(REPORT_STATUS_VALUES).optional(),
    category: z.enum(REPORT_CATEGORY_VALUES).optional(),
    severity: z.enum(REPORT_SEVERITY_VALUES).optional(),
    restaurantId: mongoIdSchema.optional(),
  })
  .strict();
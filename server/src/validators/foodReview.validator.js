import { z } from "zod";

import { mongoIdSchema } from "./common.validator.js";

import { REVIEW_STATUS_VALUES } from "../utils/constants.js";

const reviewCoreSchema = z
  .object({
    restaurantId: mongoIdSchema,
    foodId: mongoIdSchema,
    userId: mongoIdSchema.optional(),
    bookingId: mongoIdSchema.optional(),
    rating: z
      .number({
        required_error: "Rating is required.",
        invalid_type_error: "Rating must be a number.",
      })
      .min(1, "Rating must be at least 1.")
      .max(5, "Rating cannot exceed 5."),
    title: z.string().trim().max(100).optional(),
    comment: z.string().trim().min(1).max(1000),
    images: z.array(z.string().trim().min(1)).optional(),
    status: z.enum(REVIEW_STATUS_VALUES).optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

// Create Food Review: apply defaults for omitted optional fields.
export const createReviewSchema = reviewCoreSchema
  .extend({
    title: z.string().trim().max(100).optional().default(""),
    images: z.array(z.string().trim().min(1)).default([]),
  })
  .strict();

// Update Food Review: defaults must NOT be injected on partial updates
// (e.g. a bare { ownerReply } payload must stay a bare { ownerReply } payload).
export const updateReviewSchema = reviewCoreSchema
  .partial()
  .extend({
    ownerReply: z.string().trim().max(1000).optional(),
  })
  .strict();

// Review Id
export const reviewIdSchema = z
  .object({
    reviewId: mongoIdSchema,
  })
  .strict();

import { z } from "zod";

import { mongoIdSchema } from "./common.validator.js";

import {
  DISCOUNT_TYPE_VALUES,
  OFFER_TARGETING_VALUES,
} from "../utils/constants.js";

const offerCodeSchema = z
  .string()
  .trim()
  .min(3, "Offer code must be at least 3 characters.")
  .max(30, "Offer code cannot exceed 30 characters.")
  .regex(
    /^[a-zA-Z0-9_-]+$/,
    "Offer code can only contain letters, numbers, underscore or dash."
  )
  .transform((value) => value.toUpperCase());

const segmentRulesSchema = z
  .object({
    minBookings: z
      .number({ invalid_type_error: "minBookings must be a number." })
      .int("minBookings must be a whole number.")
      .min(0)
      .optional()
      .default(0),
    minTotalSpent: z
      .number({ invalid_type_error: "minTotalSpent must be a number." })
      .min(0)
      .optional()
      .default(0),
    hasCompletedBooking: z.boolean().optional().default(false),
    recentWithinDays: z
      .number({ invalid_type_error: "recentWithinDays must be a number." })
      .int("recentWithinDays must be a whole number.")
      .min(0)
      .optional()
      .default(0),
    inactiveSinceDays: z
      .number({ invalid_type_error: "inactiveSinceDays must be a number." })
      .int("inactiveSinceDays must be a whole number.")
      .min(0)
      .optional()
      .default(0),
  })
  .strict();

const offerCoreSchema = z
  .object({
    offerCode: offerCodeSchema,
    title: z.string().trim().min(3, "Title must be at least 3 characters.").max(120),
    description: z.string().trim().max(500).optional().default(""),
    discountType: z.enum(DISCOUNT_TYPE_VALUES, {
      errorMap: () => ({ message: "Discount type must be Amount or Percentage." }),
    }),
    discountValue: z
      .number({
        required_error: "Discount value is required.",
        invalid_type_error: "Discount value must be a number.",
      })
      .positive("Discount value must be greater than zero."),
    minOrderAmount: z
      .number({ invalid_type_error: "Minimum order amount must be a number." })
      .min(0)
      .optional()
      .default(0),
    maxDiscountAmount: z
      .number({ invalid_type_error: "Max discount amount must be a number." })
      .min(0)
      .optional()
      .default(0),
    maxRedemptions: z
      .number({ invalid_type_error: "Max redemptions must be a number." })
      .int("Max redemptions must be a whole number.")
      .min(0)
      .optional()
      .default(0),
    perUserRedemptionLimit: z
      .number({ invalid_type_error: "Per-user limit must be a number." })
      .int("Per-user limit must be a whole number.")
      .min(1)
      .optional()
      .default(1),
    validityStart: z.coerce.date(),
    validityEnd: z.coerce.date(),
    targeting: z.enum(OFFER_TARGETING_VALUES).optional().default("ALL"),
    segmentRules: segmentRulesSchema.optional(),
    targetUserIds: z.array(mongoIdSchema).max(200).optional().default([]),
    isStackable: z.boolean().optional().default(false),
    isActive: z.boolean().optional(),
  })
  .strict();

// Percentage discounts must never exceed 100% - a value above 100 would let a
// discount produce negative bills. Applied to both create and update paths.
const percentageMaxRefine = (data, ctx) => {
  if (
    data.discountType === "Percentage" &&
    data.discountValue != null &&
    Number(data.discountValue) > 100
  ) {
    ctx.addIssue({
      path: ["discountValue"],
      message: "Percentage discount value cannot exceed 100.",
      code: z.ZodIssueCode.custom,
    });
  }
};

// Create Offer
export const createOfferSchema = offerCoreSchema
  .extend({
    restaurantId: mongoIdSchema,
  })
  .strict()
  .superRefine(percentageMaxRefine);

// Update Offer (offerCode / isActive are immutable; restaurantId is not part
// of the offer core schema so it is rejected by .strict() automatically)
export const updateOfferSchema = offerCoreSchema
  .omit({ offerCode: true, isActive: true })
  .partial()
  .strict()
  .superRefine(percentageMaxRefine);

// Toggle Offer Active
export const toggleOfferActiveSchema = z
  .object({
    isActive: z.boolean({
      required_error: "isActive is required.",
      invalid_type_error: "isActive must be a boolean.",
    }),
  })
  .strict();

// Offer Id
export const offerIdSchema = z
  .object({
    offerId: mongoIdSchema,
  })
  .strict();

// Query schema for the customer "available offers" endpoint. restaurantId is
// optional: when omitted, live offers across every active restaurant are
// returned (each offer carries its restaurant). page/limit follow the standard
// list-query convention.
export const listAvailableOffersQuerySchema = z
  .object({
    restaurantId: mongoIdSchema.optional(),
    excludeClaimed: z.coerce.boolean().optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  })
  .strict();

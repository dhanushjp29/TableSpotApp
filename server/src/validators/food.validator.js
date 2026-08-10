import { z } from "zod";

import {
  mongoIdSchema,
  timeSchema,
} from "./common.validator.js";

import {
  FOOD_CATEGORY_VALUES,
  FOOD_SPICE_LEVEL_VALUES,
  FOOD_TYPE_VALUES,
  WEEKDAY_VALUES,
  CURRENCY_VALUES,
  GST_SLAB_VALUES,
} from "../utils/constants.js";

const variantSchema = z
  .object({
    variantName: z.string().trim().min(1).max(100),
    price: z
      .number({
        required_error: "Variant price is required.",
        invalid_type_error: "Variant price must be a number.",
      })
      .min(0),
    offerPrice: z
      .number({
        invalid_type_error: "Offer price must be a number.",
      })
      .min(0)
      .optional(),
  })
  .strict();

const availabilitySchema = z
  .object({
    availableDays: z.array(z.enum(WEEKDAY_VALUES)).optional(),
    startTime: timeSchema.optional(),
    endTime: timeSchema.optional(),
  })
  .strict();

const specialScheduleSchema = z
  .object({
    day: z.enum(WEEKDAY_VALUES),
    startTime: timeSchema.optional(),
    endTime: timeSchema.optional(),
  })
  .strict();

const foodCoreSchema = z
  .object({
    restaurantId: mongoIdSchema,
    foodName: z.string().trim().min(2).max(150),
    description: z.string().trim().max(500).optional(),
    category: z.enum(FOOD_CATEGORY_VALUES),
    otherCategory: z.string().trim().max(100).optional(),
    foodType: z.enum(FOOD_TYPE_VALUES),
    spiceLevel: z.enum(FOOD_SPICE_LEVEL_VALUES).optional(),
    hasVariants: z.boolean().optional(),
    currency: z.enum(CURRENCY_VALUES).optional(),
    // GST_SLAB_VALUES are numbers. Zod v4's z.enum() only supports string
    // enums, so a numeric allow-list is enforced via refine instead.
    gstRate: z
      .number({ invalid_type_error: "GST rate must be a number." })
      .refine((value) => GST_SLAB_VALUES.includes(value), {
        message: `Invalid GST rate. Allowed values: ${GST_SLAB_VALUES.join(", ")}.`,
      })
      .optional(),
    variants: z.array(variantSchema).optional(),
    preparationTime: z
      .number({
        invalid_type_error: "Preparation time must be a number.",
      })
      .min(0)
      .optional(),
    coverImage: z.string().trim().min(1, "Cover image is required."),
    galleryImages: z.array(z.string().trim().min(1)).optional(),
    availability: availabilitySchema.optional(),
    specialSchedule: z
      .object({
        isEnabled: z.boolean().optional(),
        schedules: z.array(specialScheduleSchema).optional(),
      })
      .strict()
      .optional(),
    isAvailable: z.boolean().optional(),
    isRecommended: z.boolean().optional(),
    isPopular: z.boolean().optional(),
    displayOrder: z
      .number({
        invalid_type_error: "Display order must be a number.",
      })
      .int("Display order must be a whole number.")
      .min(1)
      .optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

// Create Food
export const createFoodSchema = foodCoreSchema
  .extend({
    description: z.string().trim().max(500).optional().default(""),
    otherCategory: z.string().trim().max(100).optional().default(""),
    variants: z.array(variantSchema).default([]),
    galleryImages: z.array(z.string().trim().min(1)).default([]),
    specialSchedule: z
      .object({
        isEnabled: z.boolean().optional(),
        schedules: z.array(specialScheduleSchema).default([]),
      })
      .strict()
      .optional(),
  })
  .strict();

// Update Food
export const updateFoodSchema =
  foodCoreSchema.partial().strict();

// Food Id
export const foodIdSchema = z
  .object({
    foodId: mongoIdSchema,
  })
  .strict();

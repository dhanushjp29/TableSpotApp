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
    description: z.string().trim().max(500).optional().default(""),
    category: z.enum(FOOD_CATEGORY_VALUES),
    otherCategory: z.string().trim().max(100).optional().default(""),
    foodType: z.enum(FOOD_TYPE_VALUES),
    spiceLevel: z.enum(FOOD_SPICE_LEVEL_VALUES).optional(),
    hasVariants: z.boolean().optional(),
    variants: z.array(variantSchema).default([]),
    preparationTime: z
      .number({
        invalid_type_error: "Preparation time must be a number.",
      })
      .min(0)
      .optional(),
    coverImage: z.string().trim().min(1, "Cover image is required."),
    galleryImages: z.array(z.string().trim().min(1)).default([]),
    availability: availabilitySchema.optional(),
    specialSchedule: z
      .object({
        isEnabled: z.boolean().optional(),
        schedules: z.array(specialScheduleSchema).default([]),
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
export const createFoodSchema = foodCoreSchema.strict();

// Update Food
export const updateFoodSchema =
  foodCoreSchema.partial().strict();

// Food Id
export const foodIdSchema = z
  .object({
    foodId: mongoIdSchema,
  })
  .strict();

import { z } from "zod";

import {
  emailSchema,
  phoneNumberSchema,
  longitudeSchema,
  latitudeSchema,
  mongoIdSchema,
} from "./common.validator.js";

import {
  PRICE_RANGE_VALUES,
  RESTAURANT_OFFER_TYPE_VALUES,
  RESTAURANT_VERIFICATION_STATUS_VALUES,
  WEEKDAY_VALUES,
} from "../utils/constants.js";

const operatingHourSchema = z
  .object({
    day: z.enum(WEEKDAY_VALUES),
    isOpen: z.boolean().optional(),
    open: z.string().trim().max(5).optional().default(""),
    close: z.string().trim().max(5).optional().default(""),
  })
  .strict();

const offerSchema = z
  .object({
    title: z.string().trim().min(1).max(100),
    description: z.string().trim().max(500).optional().default(""),
    offerType: z.enum(RESTAURANT_OFFER_TYPE_VALUES).optional(),
    offerValue: z
      .number({
        invalid_type_error: "Offer value must be a number.",
      })
      .min(0)
      .optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

const locationSchema = z
  .object({
    latitude: latitudeSchema,
    longitude: longitudeSchema,
  })
  .strict();

const restaurantCoreSchema = z
  .object({
    ownerId: mongoIdSchema.optional(),
    restaurantName: z.string().trim().min(3).max(100),
    description: z.string().trim().max(500).optional().default(""),
    contactPerson: z.string().trim().min(3).max(100),
    phoneNumber: phoneNumberSchema,
    email: emailSchema,
    address: z.string().trim().min(3).max(255),
    city: z.string().trim().min(2).max(100),
    state: z.string().trim().min(2).max(100),
    country: z.string().trim().min(2).max(100),
    pincode: z.string().trim().min(3).max(10),
    location: locationSchema,
    coverImage: z.string().trim().min(1, "Cover image is required."),
    galleryImages: z
      .array(z.string().trim().min(1))
      .min(3, "Gallery must contain at least 3 images.")
      .max(10, "Gallery cannot exceed 10 images."),
    cuisineTypes: z.array(z.string().trim().min(1)).default([]),
    operatingHours: z.array(operatingHourSchema).default([]),
    amenities: z.array(z.string().trim().min(1)).default([]),
    services: z.array(z.string().trim().min(1)).default([]),
    currentOffers: z.array(offerSchema).default([]),
    priceRange: z.enum(PRICE_RANGE_VALUES).optional(),
    averageCostForTwo: z
      .number({
        invalid_type_error: "Average cost must be a number.",
      })
      .min(0)
      .optional(),
    verificationStatus: z
      .enum(RESTAURANT_VERIFICATION_STATUS_VALUES)
      .optional(),
    isFeatured: z.boolean().optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

// Create Restaurant
export const createRestaurantSchema = restaurantCoreSchema.strict();

// Update Restaurant
export const updateRestaurantSchema =
  restaurantCoreSchema.partial().strict();

// Restaurant Id
export const restaurantIdSchema = z
  .object({
    restaurantId: mongoIdSchema,
  })
  .strict();

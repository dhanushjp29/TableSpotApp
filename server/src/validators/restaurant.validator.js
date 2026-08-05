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
  TABLE_LOCATION_VALUES,
  TABLE_STATUS_VALUES,
  TABLE_TYPE_VALUES,
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

const tableDraftSchema = z
  .object({
    tableNumber: z.coerce
      .number({
        invalid_type_error: "Table number must be a number.",
      })
      .int("Table number must be a whole number.")
      .positive("Table number must be greater than 0."),
    tableName: z.string().trim().max(50).optional().default(""),
    capacity: z.coerce
      .number({
        invalid_type_error: "Capacity must be a number.",
      })
      .int("Capacity must be a whole number.")
      .min(1, "Capacity must be at least 1.")
      .max(100, "Capacity cannot exceed 100."),
    minimumCapacity: z.coerce
      .number({
        invalid_type_error: "Minimum capacity must be a number.",
      })
      .int("Minimum capacity must be a whole number.")
      .min(1)
      .optional()
      .default(1),
    tableType: z.enum(TABLE_TYPE_VALUES).optional(),
    otherTableType: z.string().trim().max(50).optional().default(""),
    tableLocation: z.enum(TABLE_LOCATION_VALUES).optional(),
    otherTableLocation: z.string().trim().max(50).optional().default(""),
    floor: z.string().trim().max(50).optional().default(""),
    status: z.enum(TABLE_STATUS_VALUES).optional(),
    isReservable: z.boolean().optional(),
    displayOrder: z.coerce
      .number()
      .int()
      .min(1)
      .optional()
      .default(1),
    description: z.string().trim().max(500).optional().default(""),
  })
  .strict();

// Create Restaurant
export const createRestaurantSchema = restaurantCoreSchema
  .extend({
    tables: z
      .array(tableDraftSchema)
      .min(1, "Add at least one table for your restaurant.")
      .default([]),
  })
  .strict();

// Update Restaurant
export const updateRestaurantSchema =
  restaurantCoreSchema.partial().strict();

// Restaurant Id
export const restaurantIdSchema = z
  .object({
    restaurantId: mongoIdSchema,
  })
  .strict();

// Verify / Reject Restaurant
export const verifyRestaurantSchema = z
  .object({
    verificationStatus: z.enum(RESTAURANT_VERIFICATION_STATUS_VALUES),
    rejectionReason: z.string().trim().max(500).optional().default(""),
  })
  .strict();

import { z } from "zod";

import {
  mongoIdSchema,
} from "./common.validator.js";

import {
  BOOKING_STATUS_VALUES,
  BOOKING_TYPE_VALUES,
  PAYMENT_METHOD_VALUES,
  PAYMENT_STATUS_VALUES,
} from "../utils/constants.js";

const preOrderedFoodSchema = z
  .object({
    foodId: mongoIdSchema,
    variantName: z.string().trim().min(1).optional().default("Regular"),
    quantity: z
      .number({
        required_error: "Quantity is required.",
        invalid_type_error: "Quantity must be a number.",
      })
      .int("Quantity must be a whole number.")
      .min(1, "Quantity must be at least 1."),
    price: z
      .number({
        required_error: "Price is required.",
        invalid_type_error: "Price must be a number.",
      })
      .min(0),
  })
  .strict();

const bookingCoreSchema = z
  .object({
    userId: mongoIdSchema.optional(),
    restaurantId: mongoIdSchema,
    tableId: mongoIdSchema,
    bookingDateTime: z.coerce.date(),
    expectedDuration: z
      .number({
        invalid_type_error: "Expected duration must be a number.",
      })
      .int("Expected duration must be a whole number.")
      .min(1)
      .optional(),
    numberOfGuests: z
      .number({
        required_error: "Number of guests is required.",
        invalid_type_error: "Number of guests must be a number.",
      })
      .int("Number of guests must be a whole number.")
      .min(1, "Number of guests must be at least 1."),
    bookingStatus: z.enum(BOOKING_STATUS_VALUES).optional(),
    bookingType: z.enum(BOOKING_TYPE_VALUES).optional(),
    paymentStatus: z.enum(PAYMENT_STATUS_VALUES).optional(),
    paymentMethod: z.enum(PAYMENT_METHOD_VALUES).optional(),
    advanceAmount: z
      .number({
        invalid_type_error: "Advance amount must be a number.",
      })
      .min(0)
      .optional(),
    totalAmount: z
      .number({
        invalid_type_error: "Total amount must be a number.",
      })
      .min(0)
      .optional(),
    specialRequest: z.string().trim().max(500).optional().default(""),
    preOrderedFoods: z.array(preOrderedFoodSchema).default([]),
    billId: mongoIdSchema.optional().nullable(),
    checkedInAt: z.coerce.date().optional().nullable(),
    completedAt: z.coerce.date().optional().nullable(),
    cancelledAt: z.coerce.date().optional().nullable(),
    cancellationReason: z.string().trim().max(500).optional().default(""),
    isActive: z.boolean().optional(),
  })
  .strict();

// Create Booking
export const createBookingSchema = bookingCoreSchema.strict();

// Update Booking
export const updateBookingSchema =
  bookingCoreSchema.partial().strict();

// Update Booking Status
export const updateBookingStatusSchema = z
  .object({
    bookingStatus: z.enum(BOOKING_STATUS_VALUES),
  })
  .strict();

// Booking Id
export const bookingIdSchema = z
  .object({
    bookingId: mongoIdSchema,
  })
  .strict();

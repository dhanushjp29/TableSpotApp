import { z } from "zod";

import {
  mongoIdSchema,
} from "./common.validator.js";

import {
  BOOKING_STATUS_VALUES,
  BOOKING_TYPE_VALUES,
  MAX_REMARKS_LENGTH,
  MIN_REMARKS_LENGTH,
  PAYMENT_METHOD_VALUES,
  PAYMENT_STATUS_VALUES,
  SEAT_SELECTION_MODE_VALUES,
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

const tableSelectionSchema = z
  .object({
    tableId: mongoIdSchema,
    seatIds: z.array(mongoIdSchema).max(100).optional().default([]),
  })
  .strict();

const bookingCoreSchema = z
  .object({
    userId: mongoIdSchema.optional(),
    restaurantId: mongoIdSchema,
    tableId: mongoIdSchema.optional(),
    seatIds: z.array(mongoIdSchema).max(100).optional().default([]),
    tables: z
      .array(tableSelectionSchema)
      .max(20, "A booking can include at most 20 tables.")
      .optional(),
    bookingMode: z.enum(SEAT_SELECTION_MODE_VALUES).optional(),
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
    offerId: mongoIdSchema.optional().nullable(),
    completedAt: z.coerce.date().optional().nullable(),
    cancelledAt: z.coerce.date().optional().nullable(),
    cancellationReason: z.string().trim().max(500).optional().default(""),
    isActive: z.boolean().optional(),
  })
  .strict();

// Create Booking
export const createBookingSchema = bookingCoreSchema.strict();

// Update Booking (customer / owner / admin)
//
// Only customer-editable scheduling fields are allowed. Booking status,
// payment status, amounts, billing linkage and lifecycle timestamps are
// NEVER settable via this endpoint — they are managed exclusively through
// the dedicated cancel / no-show endpoints and by the payment & bill
// services on the server.
const editableBookingFields = {
    tableId: mongoIdSchema.optional(),
    seatIds: z.array(mongoIdSchema).max(100).optional(),
    tables: z
        .array(tableSelectionSchema)
        .max(20, "A booking can include at most 20 tables.")
        .optional(),
    bookingDateTime: z.coerce.date().optional(),
    expectedDuration: z
        .number({
            invalid_type_error: "Expected duration must be a number.",
        })
        .int("Expected duration must be a whole number.")
        .min(1)
        .optional(),
    numberOfGuests: z
        .number({
            invalid_type_error: "Number of guests must be a number.",
        })
        .int("Number of guests must be a whole number.")
        .min(1, "Number of guests must be at least 1.")
        .optional(),
    specialRequest: z.string().trim().max(500).optional(),
    preOrderedFoods: z.array(preOrderedFoodSchema).optional(),
};

export const updateBookingSchema = z
    .object(editableBookingFields)
    .strict();

// Internal-only booking updates (server side). Never exposed via routes.
export const internalBookingUpdateSchema = z
    .object(editableBookingFields)
    .partial()
    .extend({
        bookingStatus: z.enum(BOOKING_STATUS_VALUES).optional(),
        bookingType: z.enum(BOOKING_TYPE_VALUES).optional(),
        paymentStatus: z.enum(PAYMENT_STATUS_VALUES).optional(),
        paymentMethod: z.enum(PAYMENT_METHOD_VALUES).optional(),
        advanceAmount: z.number().min(0).optional(),
        totalAmount: z.number().min(0).optional(),
        billId: mongoIdSchema.optional().nullable(),
        completedAt: z.coerce.date().optional().nullable(),
        cancelledAt: z.coerce.date().optional().nullable(),
        cancellationReason: z.string().trim().max(500).optional(),
        isActive: z.boolean().optional(),
    })
    .strict();

// Mark No Show
export const markNoShowSchema = z
  .object({
    remarks: z
      .string({
        required_error: "Remarks are required when marking a no-show.",
      })
      .trim()
      .min(
        MIN_REMARKS_LENGTH,
        `Remarks must be at least ${MIN_REMARKS_LENGTH} characters.`
      )
      .max(
        MAX_REMARKS_LENGTH,
        `Remarks cannot exceed ${MAX_REMARKS_LENGTH} characters.`
      ),
  })
  .strict();

// Booking Id
export const bookingIdSchema = z
  .object({
    bookingId: mongoIdSchema,
  })
  .strict();

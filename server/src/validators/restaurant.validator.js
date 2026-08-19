import { z } from "zod";

import {
  emailSchema,
  phoneNumberSchema,
  longitudeSchema,
  latitudeSchema,
  mongoIdSchema,
} from "./common.validator.js";

import {
  BOOKING_PAYMENT_POLICY,
  BOOKING_PAYMENT_POLICY_VALUES,
  BOOKING_PAYMENT_TYPE,
  BOOKING_PAYMENT_TYPE_VALUES,
  MAX_BOOKING_ADVANCE_AMOUNT,
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

const bookingPaymentPolicySchema = z
  .object({
    type: z.enum(BOOKING_PAYMENT_POLICY_VALUES),
    paymentType: z.enum(BOOKING_PAYMENT_TYPE_VALUES).optional(),
    fixedAmount: z
      .number({
        invalid_type_error: "Fixed amount must be a number.",
      })
      .min(0)
      .max(MAX_BOOKING_ADVANCE_AMOUNT)
      .optional(),
    percentage: z
      .number({
        invalid_type_error: "Percentage must be a number.",
      })
      .min(0)
      .max(100)
      .optional(),
    maximumAmount: z
      .number({
        invalid_type_error: "Maximum amount must be a number.",
      })
      .min(0)
      .max(MAX_BOOKING_ADVANCE_AMOUNT)
      .optional(),
  })
  .strict()
  .superRefine((policy, ctx) => {
    if (policy.type === BOOKING_PAYMENT_POLICY.PAY_ON_SPOT) {
      return;
    }

    if (!policy.paymentType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["paymentType"],
        message:
          "Payment type is required when Pay Amount to Book is selected.",
      });
      return;
    }

    // Fixed Amount is always required and must be ≥ 1 for PAY_TO_BOOK
    if (
      policy.fixedAmount === undefined ||
      policy.fixedAmount === null ||
      policy.fixedAmount < 1 ||
      policy.fixedAmount > MAX_BOOKING_ADVANCE_AMOUNT
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["fixedAmount"],
        message: `Fixed amount must be between ₹1 and ₹${MAX_BOOKING_ADVANCE_AMOUNT}.`,
      });
    }

    if (policy.paymentType === BOOKING_PAYMENT_TYPE.PERCENTAGE) {
      if (policy.percentage === undefined || policy.percentage <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["percentage"],
          message: "Percentage must be between 1 and 100.",
        });
      }

      if (
        policy.maximumAmount !== undefined &&
        policy.maximumAmount > MAX_BOOKING_ADVANCE_AMOUNT
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["maximumAmount"],
          message: `Maximum amount cannot exceed ₹${MAX_BOOKING_ADVANCE_AMOUNT}.`,
        });
      }
    }
  });

const cancellationPolicySchema = z
  .object({
    isEnabled: z.boolean().optional(),
    hoursBeforeBooking: z
      .number({
        invalid_type_error: "Cancellation cutoff hours must be a number.",
      })
      .int()
      .min(1)
      .max(168)
      .optional(),
    refundPercentage: z
      .number({
        invalid_type_error: "Refund percentage must be a number.",
      })
      .min(0)
      .max(100)
      .optional(),
    noShowRefundPercentage: z
      .number({
        invalid_type_error: "No-show refund percentage must be a number.",
      })
      .min(0)
      .max(100)
      .optional(),
  })
  .strict();

const restaurantCoreSchema = z
  .object({
    ownerId: mongoIdSchema.optional(),
    restaurantName: z.string().trim().min(3).max(100),
    description: z.string().trim().max(500).optional(),
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
    cuisineTypes: z.array(z.string().trim().min(1)).optional(),
    operatingHours: z.array(operatingHourSchema).optional(),
    amenities: z.array(z.string().trim().min(1)).optional(),
    services: z.array(z.string().trim().min(1)).optional(),
    currentOffers: z.array(offerSchema).optional(),
    priceRange: z.enum(PRICE_RANGE_VALUES).optional(),
    averageCostForTwo: z
      .number({
        invalid_type_error: "Average cost must be a number.",
      })
      .min(0)
      .optional(),
    gstin: z.string().trim().regex(/^[0-9A-Za-z]{15}$/, "GSTIN must be a valid 15-character GST number.").optional(),
    bookingPaymentPolicy: bookingPaymentPolicySchema,
    cancellationPolicy: cancellationPolicySchema.optional(),
    customerWaitingPeriod: z
      .number({
        invalid_type_error: "Customer waiting period must be a number.",
      })
      .int()
      .min(5)
      .max(180)
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
    description: z.string().trim().max(500).optional().default(""),
    cuisineTypes: z.array(z.string().trim().min(1)).default([]),
    operatingHours: z.array(operatingHourSchema).default([]),
    amenities: z.array(z.string().trim().min(1)).default([]),
    services: z.array(z.string().trim().min(1)).default([]),
    currentOffers: z.array(offerSchema).default([]),
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

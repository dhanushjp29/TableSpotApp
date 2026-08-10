import { z } from "zod";

import { mongoIdSchema } from "./common.validator.js";

import {
  BILL_STATUS_VALUES,
  DISCOUNT_TYPE_VALUES,
  ORDER_SOURCE_VALUES,
  PAYMENT_METHOD_VALUES,
  PAYMENT_STATUS_VALUES,
} from "../utils/constants.js";

const orderedItemSchema = z
  .object({
    foodId: mongoIdSchema,
    foodName: z.string().trim().min(1).max(150).optional().default(""),
    variantName: z.string().trim().min(1).optional().default("Regular"),
    quantity: z
      .number({
        required_error: "Quantity is required.",
        invalid_type_error: "Quantity must be a number.",
      })
      .int("Quantity must be a whole number.")
      .min(1),
    // unitPrice / totalPrice are accepted for display purposes only. The
    // server derives authoritative prices from the Food model and recomputes
    // every total, so they are optional and never trusted.
    unitPrice: z
      .number({
        invalid_type_error: "Unit price must be a number.",
      })
      .min(0)
      .optional(),
    offerPrice: z
      .number({
        invalid_type_error: "Offer price must be a number.",
      })
      .min(0)
      .optional(),
    totalPrice: z
      .number({
        invalid_type_error: "Total price must be a number.",
      })
      .min(0)
      .optional(),
    orderSource: z.enum(ORDER_SOURCE_VALUES).optional(),
  })
  .strict();

const paymentHistorySchema = z
  .object({
    paymentMethod: z.enum(PAYMENT_METHOD_VALUES),
    amount: z
      .number({
        required_error: "Amount is required.",
        invalid_type_error: "Amount must be a number.",
      })
      .min(0),
    transactionId: z.string().trim().max(100).optional().default(""),
    notes: z.string().trim().max(500).optional().default(""),
    paidAt: z.coerce.date().optional(),
  })
  .strict();

const discountSchema = z
  .object({
    type: z
      .union([z.enum(DISCOUNT_TYPE_VALUES), z.enum(["amount", "percentage"])])
      .optional(),
    value: z
      .number({
        invalid_type_error: "Discount value must be a number.",
      })
      .min(0)
      .optional(),
  })
  .strict();

const paymentSummarySchema = z
  .object({
    replacePayments: z.boolean().optional(),
    totalPaid: z
      .number({
        invalid_type_error: "Total paid must be a number.",
      })
      .min(0)
      .optional(),
    advancePaid: z
      .number({
        invalid_type_error: "Advance paid must be a number.",
      })
      .min(0)
      .optional(),
    spotPaid: z
      .number({
        invalid_type_error: "Spot paid must be a number.",
      })
      .min(0)
      .optional(),
    balanceDue: z
      .number({
        invalid_type_error: "Balance due must be a number.",
      })
      .min(0)
      .optional(),
    paymentStatus: z.enum(PAYMENT_STATUS_VALUES).optional(),
    payments: z.array(paymentHistorySchema).default([]),
  })
  .strict();

// Offer to apply at bill creation (walk-in bills). An offer claimed online is
// attached to the booking and applied automatically — it must not be sent here.
const offerInputSchema = z
  .object({
    offerId: mongoIdSchema.optional(),
    offerCode: z.string().trim().min(1).max(30).optional(),
    customerEmail: z
      .string()
      .trim()
      .email()
      .optional()
      .or(z.literal(""))
      .default(""),
  })
  .strict();

// Consume a claimed/global offer manually (walk-in redemption without a bill).
export const consumeOfferSchema = z
  .object({
    restaurantId: mongoIdSchema,
    offerId: mongoIdSchema.optional(),
    offerCode: z.string().trim().min(1).max(30).optional(),
    customerEmail: z
      .string()
      .trim()
      .email()
      .optional()
      .or(z.literal(""))
      .default(""),
    bookingId: mongoIdSchema.optional(),
  })
  .strict();

const billCoreSchema = z
  .object({
    bookingId: mongoIdSchema.optional(),
    billType: z.enum(["ONLINE", "WALK_IN"]).optional().default("ONLINE"),
    restaurantId: mongoIdSchema.optional(),
    tableId: mongoIdSchema.optional(),
    customerName: z.string().trim().max(150).optional().default(""),
    customerPhone: z.string().trim().max(30).optional().default(""),
    customerEmail: z.string().trim().email().optional().or(z.literal("")).default(""),
    orderedItems: z.array(orderedItemSchema),
    subTotal: z
      .number({
        invalid_type_error: "Sub total must be a number.",
      })
      .min(0)
      .optional(),
    discount: discountSchema.optional(),
    offer: offerInputSchema.optional(),
    taxAmount: z
      .number({
        invalid_type_error: "Tax amount must be a number.",
      })
      .min(0)
      .optional(),
    taxPercentage: z
      .number({
        invalid_type_error: "Tax percentage must be a number.",
      })
      .min(0)
      .max(100)
      .optional(),
    serviceCharge: z
      .number({
        invalid_type_error: "Service charge must be a number.",
      })
      .min(0)
      .optional(),
    deliveryCharge: z
      .number({
        invalid_type_error: "Delivery charge must be a number.",
      })
      .min(0)
      .optional(),
    grandTotal: z
      .number({
        invalid_type_error: "Grand total must be a number.",
      })
      .min(0)
      .optional(),
    payment: paymentSummarySchema.optional(),
    billStatus: z.enum(BILL_STATUS_VALUES).optional(),
    notes: z.string().trim().max(500).optional(),
    generatedBy: mongoIdSchema.optional(),
    generatedAt: z.coerce.date().optional().nullable(),
    isActive: z.boolean().optional(),
  })
  .strict();

// Create Bill
export const createBillSchema = billCoreSchema
  .extend({
    notes: z.string().trim().max(500).optional().default(""),
  })
  .strict();

// Update Bill
export const updateBillSchema =
  billCoreSchema.partial().strict();

// Mark Bill Status
export const markBillStatusSchema = z
  .object({
    billStatus: z.enum(BILL_STATUS_VALUES),
  })
  .strict();

// Add Bill Payment
export const addBillPaymentSchema = z
  .object({
    paymentMethod: z.enum(PAYMENT_METHOD_VALUES),
    amount: z
      .number({
        required_error: "Amount is required.",
        invalid_type_error: "Amount must be a number.",
      })
      .min(0),
    transactionId: z.string().trim().max(100).optional().default(""),
    notes: z.string().trim().max(500).optional().default(""),
    paidAt: z.coerce.date().optional(),
  })
  .strict();

// Bill Id
export const billIdSchema = z
  .object({
    billId: mongoIdSchema,
  })
  .strict();

// Convert a confirmed/checked-in booking into a bill (payment-first lifecycle)
export const convertBookingToBillSchema = z
  .object({
    notes: z.string().trim().max(500).optional().default(""),
    taxPercentage: z
      .number({ invalid_type_error: "Tax percentage must be a number." })
      .min(0)
      .max(100)
      .optional()
      .default(0),
  })
  .strict();

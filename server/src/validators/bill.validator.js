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
    foodName: z.string().trim().min(1).max(150),
    variantName: z.string().trim().min(1).optional().default("Regular"),
    quantity: z
      .number({
        required_error: "Quantity is required.",
        invalid_type_error: "Quantity must be a number.",
      })
      .int("Quantity must be a whole number.")
      .min(1),
    unitPrice: z
      .number({
        required_error: "Unit price is required.",
        invalid_type_error: "Unit price must be a number.",
      })
      .min(0),
    offerPrice: z
      .number({
        invalid_type_error: "Offer price must be a number.",
      })
      .min(0)
      .optional(),
    totalPrice: z
      .number({
        required_error: "Total price is required.",
        invalid_type_error: "Total price must be a number.",
      })
      .min(0),
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
    type: z.enum(DISCOUNT_TYPE_VALUES).optional(),
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

const billCoreSchema = z
  .object({
    bookingId: mongoIdSchema,
    orderedItems: z.array(orderedItemSchema).default([]),
    subTotal: z
      .number({
        invalid_type_error: "Sub total must be a number.",
      })
      .min(0)
      .optional(),
    discount: discountSchema.optional(),
    taxAmount: z
      .number({
        invalid_type_error: "Tax amount must be a number.",
      })
      .min(0)
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
    notes: z.string().trim().max(500).optional().default(""),
    generatedBy: mongoIdSchema.optional(),
    generatedAt: z.coerce.date().optional().nullable(),
    isActive: z.boolean().optional(),
  })
  .strict();

// Create Bill
export const createBillSchema = billCoreSchema.strict();

// Update Bill
export const updateBillSchema =
  billCoreSchema.partial().strict();

// Bill Id
export const billIdSchema = z
  .object({
    billId: mongoIdSchema,
  })
  .strict();

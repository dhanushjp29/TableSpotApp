import { z } from "zod";
import { mongoIdSchema } from "./common.validator.js";
import { PAYMENT_PURPOSE_VALUES } from "../utils/constants.js";

const bookingDraftTableSchema = z
    .object({
        tableId: mongoIdSchema,
        seatIds: z.array(mongoIdSchema).max(100).optional().default([]),
    })
    .strict();

const bookingDraftFoodSchema = z
    .object({
        foodId: mongoIdSchema,
        variantName: z.string().trim().min(1).optional().default("Regular"),
        quantity: z
            .number({
                invalid_type_error: "Quantity must be a number.",
            })
            .int("Quantity must be a whole number.")
            .min(1, "Quantity must be at least 1."),
        price: z
            .number({
                invalid_type_error: "Price must be a number.",
            })
            .min(0)
            .optional(),
    })
    .strict();

// Payment-first booking draft: sent with the order when no booking exists yet.
// The server re-validates every field and derives all amounts itself.
const bookingDraftSchema = z
    .object({
        restaurantId: mongoIdSchema,
        tables: z
            .array(bookingDraftTableSchema)
            .max(20, "A booking can include at most 20 tables.")
            .optional()
            .default([]),
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
        specialRequest: z.string().trim().max(500).optional().default(""),
        preOrderedFoods: z.array(bookingDraftFoodSchema).optional().default([]),
    })
    .strict();

export const createOrderSchema = z
    .object({
        bookingId: mongoIdSchema.optional(),
        purpose: z.enum(PAYMENT_PURPOSE_VALUES).optional(),
        idempotencyKey: z.string().trim().min(1).max(100).optional(),
        amount: z
            .number({
                invalid_type_error: "Amount must be a number.",
            })
            .positive("Amount must be greater than zero.")
            .optional(),
        // Required (with bookingId absent) for the payment-first flow.
        bookingData: bookingDraftSchema.optional(),
    })
    .strict();

export const verifyPaymentSchema = z
    .object({
        razorpay_order_id: z.string().trim().min(1, "razorpay_order_id is required"),
        razorpay_payment_id: z.string().trim().min(1, "razorpay_payment_id is required"),
        razorpay_signature: z.string().trim().min(1, "razorpay_signature is required"),
        // Optional: payment-first verifications have no booking yet.
        bookingId: mongoIdSchema.optional(),
        paymentMethod: z.string().trim().min(1).max(50).optional(),
    })
    .strict();

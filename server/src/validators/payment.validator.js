import { z } from "zod";
import { mongoIdSchema } from "./common.validator.js";

export const createOrderSchema = z
    .object({
        bookingId: mongoIdSchema,
    })
    .strict();

export const verifyPaymentSchema = z
    .object({
        razorpay_order_id: z.string().trim().min(1, "razorpay_order_id is required"),
        razorpay_payment_id: z.string().trim().min(1, "razorpay_payment_id is required"),
        razorpay_signature: z.string().trim().min(1, "razorpay_signature is required"),
        bookingId: mongoIdSchema,
    })
    .strict();

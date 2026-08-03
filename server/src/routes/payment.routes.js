import { Router } from "express";
import * as paymentController from "../controllers/payment.controller.js";
import validateRequest from "../middleware/validateRequest.js";
import authenticate from "../middleware/authenticate.js";
import { createOrderSchema, verifyPaymentSchema } from "../validators/payment.validator.js";

const router = Router();

// Secure all payment endpoints with authentication
router.use(authenticate);

// Create Razorpay payment order
router.post(
    "/create-order",
    validateRequest(createOrderSchema),
    paymentController.createOrder
);

// Verify Razorpay payment signature
router.post(
    "/verify",
    validateRequest(verifyPaymentSchema),
    paymentController.verifyPayment
);

export default router;

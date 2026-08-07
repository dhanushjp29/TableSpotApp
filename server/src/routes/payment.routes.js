import { Router } from "express";
import * as paymentController from "../controllers/payment.controller.js";
import * as paymentAccountController from "../controllers/paymentAccount.controller.js";
import validateRequest from "../middleware/validateRequest.js";
import authenticate from "../middleware/authenticate.js";
import authorize from "../middleware/authorize.js";
import { USER_ROLE } from "../utils/constants.js";
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

// Get role-scoped payment / transaction history
router.get("/history", paymentController.getHistory);

// Owner payment account (Razorpay onboarding / payout link) — all Razorpay
// operations stay server-side; the frontend never sees secret keys.
router.post(
    "/account/connect",
    authorize(USER_ROLE.OWNER),
    paymentAccountController.connect
);

router.get(
    "/account/status",
    authorize(USER_ROLE.OWNER),
    paymentAccountController.getStatus
);

export default router;

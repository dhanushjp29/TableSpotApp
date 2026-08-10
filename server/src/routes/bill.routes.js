import { Router } from "express";

import * as billController from "../controllers/bill.controller.js";
import asyncHandler from "../utils/asyncHandler.js";
import validateRequest from "../middleware/validateRequest.js";
import authenticate from "../middleware/authenticate.js";

import {
    createBillSchema,
    updateBillSchema,
    addBillPaymentSchema,
    markBillStatusSchema,
    convertBookingToBillSchema,
    consumeOfferSchema,
} from "../validators/bill.validator.js";

const router = Router();

// All bill routes require authentication
router.use(authenticate);

router.post(
    "/",
    validateRequest(createBillSchema),
    asyncHandler(billController.create)
);

router.get("/", asyncHandler(billController.getAll));
router.get("/:billId", asyncHandler(billController.getById));

router.post(
    "/:bookingId/convert-to-bill",
    validateRequest(convertBookingToBillSchema),
    asyncHandler(billController.convert)
);

router.patch(
    "/:billId",
    validateRequest(updateBillSchema),
    asyncHandler(billController.update)
);

router.post(
    "/:billId/payments",
    validateRequest(addBillPaymentSchema),
    asyncHandler(billController.addPayment)
);
router.patch(
    "/:billId/status",
    validateRequest(markBillStatusSchema),
    asyncHandler(billController.markStatus)
);

router.post(
    "/offers/consume",
    validateRequest(consumeOfferSchema),
    asyncHandler(billController.consumeOffer)
);

export default router;

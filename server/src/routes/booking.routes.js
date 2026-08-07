import { Router } from "express";

import * as bookingController from "../controllers/booking.controller.js";
import asyncHandler from "../utils/asyncHandler.js";
import validateRequest from "../middleware/validateRequest.js";
import authenticate from "../middleware/authenticate.js";

import {
    createBookingSchema,
    markNoShowSchema,
    updateBookingSchema,
} from "../validators/booking.validator.js";

const router = Router();

// All booking routes require authentication
router.use(authenticate);

router.post(
    "/",
    validateRequest(createBookingSchema),
    asyncHandler(bookingController.create)
);

router.get("/", asyncHandler(bookingController.getAll));
router.get("/:bookingId", asyncHandler(bookingController.getById));

router.patch(
    "/:bookingId",
    validateRequest(updateBookingSchema),
    asyncHandler(bookingController.update)
);

router.post("/:bookingId/cancel", asyncHandler(bookingController.cancel));
router.post(
    "/:bookingId/no-show",
    validateRequest(markNoShowSchema),
    asyncHandler(bookingController.markNoShow)
);

router.post(
    "/walk-in",
    validateRequest(createBookingSchema),
    asyncHandler(bookingController.createWalkIn)
);

export default router;

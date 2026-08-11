import { Router } from "express";

import * as restaurantReviewController from "../controllers/restaurantReview.controller.js";
import asyncHandler from "../utils/asyncHandler.js";
import validateRequest from "../middleware/validateRequest.js";
import authenticate from "../middleware/authenticate.js";

import {
    createReviewSchema,
    updateReviewSchema,
} from "../validators/restaurantReview.validator.js";

const router = Router();

// Public Routes
router.get("/restaurant/:restaurantId", asyncHandler(restaurantReviewController.getByRestaurant));
router.get("/my/booking", authenticate, asyncHandler(restaurantReviewController.getMyBookingReview));
router.get("/:reviewId", asyncHandler(restaurantReviewController.getById));

// Protected Routes
router.use(authenticate);

router.get("/eligibility/:restaurantId", asyncHandler(restaurantReviewController.getEligibility));

router.get("/", asyncHandler(restaurantReviewController.getAll));

router.post(
    "/",
    validateRequest(createReviewSchema),
    asyncHandler(restaurantReviewController.create)
);

router.patch(
    "/:reviewId",
    validateRequest(updateReviewSchema),
    asyncHandler(restaurantReviewController.update)
);

router.delete(
    "/:reviewId",
    asyncHandler(restaurantReviewController.deleteReview)
);

export default router;

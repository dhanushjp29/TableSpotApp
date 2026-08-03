import { Router } from "express";

import * as reviewController from "../controllers/review.controller.js";
import asyncHandler from "../utils/asyncHandler.js";
import validateRequest from "../middleware/validateRequest.js";
import authenticate from "../middleware/authenticate.js";

import {
    createReviewSchema,
    updateReviewSchema,
} from "../validators/review.validator.js";

const router = Router();

// Public Routes
router.get("/restaurant/:restaurantId", asyncHandler(reviewController.getByRestaurant));
router.get("/:reviewId", asyncHandler(reviewController.getById));

// Protected Routes
router.use(authenticate);

router.post(
    "/",
    validateRequest(createReviewSchema),
    asyncHandler(reviewController.create)
);

router.patch(
    "/:reviewId",
    validateRequest(updateReviewSchema),
    asyncHandler(reviewController.update)
);

router.delete(
    "/:reviewId",
    asyncHandler(reviewController.deleteReview)
);

export default router;

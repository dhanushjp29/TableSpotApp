import { Router } from "express";

import * as foodReviewController from "../controllers/foodReview.controller.js";
import asyncHandler from "../utils/asyncHandler.js";
import validateRequest from "../middleware/validateRequest.js";
import authenticate from "../middleware/authenticate.js";

import {
    createReviewSchema,
    updateReviewSchema,
} from "../validators/foodReview.validator.js";

const router = Router();

// Public Routes
router.get("/food/:foodId", asyncHandler(foodReviewController.getByFood));
router.get("/restaurant/:restaurantId", asyncHandler(foodReviewController.getByRestaurant));
router.get("/:reviewId", asyncHandler(foodReviewController.getById));

// Protected Routes
router.use(authenticate);

router.post(
    "/",
    validateRequest(createReviewSchema),
    asyncHandler(foodReviewController.create)
);

router.patch(
    "/:reviewId",
    validateRequest(updateReviewSchema),
    asyncHandler(foodReviewController.update)
);

router.delete(
    "/:reviewId",
    asyncHandler(foodReviewController.deleteReview)
);

export default router;

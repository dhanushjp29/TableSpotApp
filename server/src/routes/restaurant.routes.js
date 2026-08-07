import { Router } from "express";

import * as restaurantController from "../controllers/restaurant.controller.js";
import asyncHandler from "../utils/asyncHandler.js";
import validateRequest from "../middleware/validateRequest.js";
import authenticate from "../middleware/authenticate.js";
import authorize from "../middleware/authorize.js";
import { USER_ROLE } from "../utils/constants.js";

import {
    createRestaurantSchema,
    updateRestaurantSchema,
    restaurantIdSchema,
    verifyRestaurantSchema,
} from "../validators/restaurant.validator.js";

const router = Router();

// Public Routes
router.get("/", asyncHandler(restaurantController.getAll));
router.get("/cities", asyncHandler(restaurantController.getCities));
router.get("/slug/:slug", asyncHandler(restaurantController.getBySlug));
router.get("/:restaurantId", asyncHandler(restaurantController.getById));

// Protected Routes
router.use(authenticate);

// Owner & Admin routes
router.post(
    "/",
    authorize(USER_ROLE.OWNER, USER_ROLE.ADMIN),
    validateRequest(createRestaurantSchema),
    asyncHandler(restaurantController.create)
);

router.patch(
    "/:restaurantId",
    authorize(USER_ROLE.OWNER, USER_ROLE.ADMIN),
    validateRequest(updateRestaurantSchema),
    asyncHandler(restaurantController.update)
);

router.delete(
    "/:restaurantId",
    authorize(USER_ROLE.OWNER, USER_ROLE.ADMIN),
    asyncHandler(restaurantController.deleteRestaurant)
);

// Admin only routes
router.patch(
    "/:restaurantId/verify",
    authorize(USER_ROLE.ADMIN),
    validateRequest(verifyRestaurantSchema),
    asyncHandler(restaurantController.verify)
);

export default router;

import { Router } from "express";

import * as foodController from "../controllers/food.controller.js";
import asyncHandler from "../utils/asyncHandler.js";
import validateRequest from "../middleware/validateRequest.js";
import authenticate from "../middleware/authenticate.js";
import authorize from "../middleware/authorize.js";
import { USER_ROLE } from "../utils/constants.js";

import {
    createFoodSchema,
    updateFoodSchema,
} from "../validators/food.validator.js";

const router = Router();

// Public Routes
router.get("/restaurant/:restaurantId", asyncHandler(foodController.getByRestaurant));
router.get("/:foodId", asyncHandler(foodController.getById));

// Protected Routes (Owner & Admin)
router.use(authenticate);
router.use(authorize(USER_ROLE.OWNER, USER_ROLE.ADMIN));

// List all foods (authenticated)
router.get("/", asyncHandler(foodController.getAll));

router.post(
    "/",
    validateRequest(createFoodSchema),
    asyncHandler(foodController.create)
);

router.patch(
    "/:foodId",
    validateRequest(updateFoodSchema),
    asyncHandler(foodController.update)
);

router.delete(
    "/:foodId",
    asyncHandler(foodController.deleteFood)
);

export default router;

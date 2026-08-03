import { Router } from "express";

import * as tableController from "../controllers/table.controller.js";
import asyncHandler from "../utils/asyncHandler.js";
import validateRequest from "../middleware/validateRequest.js";
import authenticate from "../middleware/authenticate.js";
import authorize from "../middleware/authorize.js";
import { USER_ROLE } from "../utils/constants.js";

import {
    createTableSchema,
    updateTableSchema,
    updateTableStatusSchema,
} from "../validators/table.validator.js";

const router = Router();

// Public Routes
router.get("/restaurant/:restaurantId", asyncHandler(tableController.getByRestaurant));
router.get("/:tableId", asyncHandler(tableController.getById));

// Protected Routes (Owner & Admin)
router.use(authenticate);
router.use(authorize(USER_ROLE.OWNER, USER_ROLE.ADMIN));

router.post(
    "/",
    validateRequest(createTableSchema),
    asyncHandler(tableController.create)
);

router.patch(
    "/:tableId",
    validateRequest(updateTableSchema),
    asyncHandler(tableController.update)
);

router.patch(
    "/:tableId/status",
    validateRequest(updateTableStatusSchema),
    asyncHandler(tableController.updateStatus)
);

router.delete(
    "/:tableId",
    asyncHandler(tableController.deleteTable)
);

export default router;

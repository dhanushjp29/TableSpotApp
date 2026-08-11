import { Router } from "express";

import * as restaurantWarningController from "../controllers/restaurantWarning.controller.js";
import asyncHandler from "../utils/asyncHandler.js";
import validateRequest from "../middleware/validateRequest.js";
import authenticate from "../middleware/authenticate.js";
import authorize from "../middleware/authorize.js";
import { USER_ROLE } from "../utils/constants.js";

import {
  createWarningSchema,
  replyWarningSchema,
  updateWarningSchema,
  warningIdSchema,
} from "../validators/restaurantWarning.validator.js";

const router = Router();

router.use(authenticate);

// Admin: issue a new warning (optionally closing a report).
router.post(
  "/",
  authorize(USER_ROLE.ADMIN),
  validateRequest(createWarningSchema),
  asyncHandler(restaurantWarningController.create)
);

// Admin: update / clear a warning.
router.patch(
  "/:warningId",
  authorize(USER_ROLE.ADMIN),
  validateRequest(warningIdSchema, "params"),
  validateRequest(updateWarningSchema),
  asyncHandler(restaurantWarningController.update)
);

// Owner / Admin / Customer (linked report): single warning.
router.get(
  "/:warningId",
  authorize(USER_ROLE.OWNER, USER_ROLE.ADMIN, USER_ROLE.CUSTOMER),
  asyncHandler(restaurantWarningController.getById)
);

// Owner (own restaurants), Admin (all) or Customer (linked to their reports).
router.get(
  "/",
  authorize(USER_ROLE.OWNER, USER_ROLE.ADMIN, USER_ROLE.CUSTOMER),
  asyncHandler(restaurantWarningController.getAll)
);

// Owner / Admin / Customer: reply on an active warning.
router.post(
  "/:warningId/reply",
  authorize(USER_ROLE.OWNER, USER_ROLE.ADMIN, USER_ROLE.CUSTOMER),
  validateRequest(warningIdSchema, "params"),
  validateRequest(replyWarningSchema),
  asyncHandler(restaurantWarningController.reply)
);

export default router;
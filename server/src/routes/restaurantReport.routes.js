import { Router } from "express";

import * as restaurantReportController from "../controllers/restaurantReport.controller.js";
import asyncHandler from "../utils/asyncHandler.js";
import validateRequest from "../middleware/validateRequest.js";
import authenticate from "../middleware/authenticate.js";
import authorize from "../middleware/authorize.js";
import { USER_ROLE } from "../utils/constants.js";

import {
  createReportSchema,
  reportIdSchema,
  restaurantIdParamSchema,
  updateReportStatusSchema,
} from "../validators/restaurantReport.validator.js";

const router = Router();

router.use(authenticate);

// Customer: report eligibility + own reports. Registered before the
// parameterized routes so "my" is never captured as a reportId.
router.get(
  "/my",
  asyncHandler(restaurantReportController.getMyReports)
);

router.get(
  "/eligibility/:restaurantId",
  validateRequest(restaurantIdParamSchema, "params"),
  asyncHandler(restaurantReportController.getEligibility)
);

router.post(
  "/",
  authorize(USER_ROLE.CUSTOMER),
  validateRequest(createReportSchema),
  asyncHandler(restaurantReportController.create)
);

// Admin: status transitions (under review / resolve / reject).
router.patch(
  "/:reportId/status",
  authorize(USER_ROLE.ADMIN),
  validateRequest(reportIdSchema, "params"),
  validateRequest(updateReportStatusSchema),
  asyncHandler(restaurantReportController.updateStatus)
);

// A registered customer may read their own reports; owners may only inspect
// reports against their own restaurants (checked in a later step).
router.get(
  "/:reportId",
  authorize(USER_ROLE.CUSTOMER, USER_ROLE.OWNER, USER_ROLE.ADMIN),
  asyncHandler(restaurantReportController.getById)
);

// Admin: all reports with filters.
router.get(
  "/",
  authorize(USER_ROLE.ADMIN),
  asyncHandler(restaurantReportController.getAll)
);

export default router;
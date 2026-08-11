import { Router } from "express";

import * as analyticsController from "../controllers/analytics.controller.js";
import asyncHandler from "../utils/asyncHandler.js";
import validateRequest from "../middleware/validateRequest.js";
import authenticate from "../middleware/authenticate.js";
import authorize from "../middleware/authorize.js";
import { USER_ROLE } from "../utils/constants.js";

import { ownerReportQuerySchema } from "../validators/analytics.validator.js";

const router = Router();

router.use(authenticate);

router.get(
  "/owner",
  authorize(USER_ROLE.OWNER, USER_ROLE.ADMIN),
  validateRequest(ownerReportQuerySchema, "query"),
  asyncHandler(analyticsController.getOwnerReport)
);

router.get(
  "/owner/export",
  authorize(USER_ROLE.OWNER, USER_ROLE.ADMIN),
  validateRequest(ownerReportQuerySchema, "query"),
  asyncHandler(analyticsController.getOwnerReportExport)
);

export default router;

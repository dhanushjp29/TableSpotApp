import { Router } from "express";

import * as refundController from "../controllers/refund.controller.js";
import asyncHandler from "../utils/asyncHandler.js";
import validateRequest from "../middleware/validateRequest.js";
import authenticate from "../middleware/authenticate.js";

import {
  confirmRefundSchema,
  disputeRefundSchema,
  listRefundsQuerySchema,
  processRefundSchema,
  refundIdParamSchema,
} from "../validators/refund.validator.js";

const router = Router();

router.use(authenticate);

router.get("/", validateRequest(listRefundsQuerySchema, "query"), asyncHandler(refundController.getAll));
router.get("/:refundId", asyncHandler(refundController.getById));

router.post(
  "/:refundId/process",
  validateRequest(refundIdParamSchema, "params"),
  validateRequest(processRefundSchema),
  asyncHandler(refundController.process)
);

router.post(
  "/:refundId/confirm-receipt",
  validateRequest(refundIdParamSchema, "params"),
  validateRequest(confirmRefundSchema),
  asyncHandler(refundController.confirmReceived)
);

router.post(
  "/:refundId/dispute",
  validateRequest(refundIdParamSchema, "params"),
  validateRequest(disputeRefundSchema),
  asyncHandler(refundController.dispute)
);

export default router;

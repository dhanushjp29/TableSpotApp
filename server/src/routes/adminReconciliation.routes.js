import { Router } from "express";

import * as adminReconciliationController from "../controllers/adminReconciliation.controller.js";
import authorize from "../middleware/authorize.js";
import authenticate from "../middleware/authenticate.js";
import { USER_ROLE } from "../utils/constants.js";

const router = Router();

// Admin-only: no client-supplied amounts or identities are accepted anywhere;
// every payload is derived server-side from the tracked payment.
router.use(authenticate);
router.use(authorize(USER_ROLE.ADMIN));

router.get("/", adminReconciliationController.listReconciliations);
router.get("/status", adminReconciliationController.getStatus);

router.post("/:reconciliationId/retry", adminReconciliationController.retry);
router.post("/:reconciliationId/refund", adminReconciliationController.refund);
router.post("/:reconciliationId/close", adminReconciliationController.close);

export default router;

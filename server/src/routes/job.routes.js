import { Router } from "express";

import * as jobController from "../controllers/job.controller.js";
import asyncHandler from "../utils/asyncHandler.js";
import authenticate from "../middleware/authenticate.js";
import authorize from "../middleware/authorize.js";

const router = Router();

router.use(authenticate);
router.use(authorize("admin"));

router.post("/deadline-tasks/run", asyncHandler(jobController.runNow));

export default router;

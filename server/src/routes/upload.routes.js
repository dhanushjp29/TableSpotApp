import { Router } from "express";

import * as uploadController from "../controllers/upload.controller.js";
import { uploadSingle } from "../middleware/upload.js";
import asyncHandler from "../utils/asyncHandler.js";
import authenticate from "../middleware/authenticate.js";

const router = Router();

// Every upload must be tied to an authenticated application user.
router.use(authenticate);
router.post("/image", uploadSingle("image"), asyncHandler(uploadController.uploadImage));

export default router;

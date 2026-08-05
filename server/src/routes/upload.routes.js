import { Router } from "express";

import * as uploadController from "../controllers/upload.controller.js";
import { uploadSingle } from "../middleware/upload.js";
import asyncHandler from "../utils/asyncHandler.js";

const router = Router();

// Protected or public image uploads (owner must be authenticated on client-side if needed)
router.post("/image", uploadSingle("image"), asyncHandler(uploadController.uploadImage));

export default router;

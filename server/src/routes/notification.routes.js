import { Router } from "express";

import * as notificationController from "../controllers/notification.controller.js";
import asyncHandler from "../utils/asyncHandler.js";
import authenticate from "../middleware/authenticate.js";

const router = Router();

router.use(authenticate);

router.get("/", asyncHandler(notificationController.getList));
router.get("/unread-count", asyncHandler(notificationController.getUnreadCount));
router.patch("/read-all", asyncHandler(notificationController.markAllRead));
router.patch("/:notificationId/read", asyncHandler(notificationController.markRead));

export default router;

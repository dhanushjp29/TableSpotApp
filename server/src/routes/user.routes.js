import { Router } from "express";

import * as userController from "../controllers/user.controller.js";
import asyncHandler from "../utils/asyncHandler.js";
import authenticate from "../middleware/authenticate.js";
import authorize from "../middleware/authorize.js";
import { USER_ROLE } from "../utils/constants.js";

const router = Router();

router.use(authenticate);

// Profile
router.get("/profile", asyncHandler(userController.getProfile));
router.patch("/profile", asyncHandler(userController.updateProfile));

// Favorites
router.get("/favorites", asyncHandler(userController.getFavorites));
router.post("/favorites/:restaurantId", asyncHandler(userController.toggleFavorite));

// Admin management
router.use(authorize(USER_ROLE.ADMIN));

router.get("/", asyncHandler(userController.getAll));
router.patch("/:userId/status", asyncHandler(userController.toggleActive));
router.delete("/:userId", asyncHandler(userController.deleteUser));

export default router;

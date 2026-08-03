import { Router } from "express";

import * as authController from "../controllers/auth.controller.js";
import asyncHandler from "../utils/asyncHandler.js";
import validateRequest from "../middleware/validateRequest.js";
import authenticate from "../middleware/authenticate.js";

import {
    registerSchema,
    loginSchema,
    logoutSchema,
    refreshTokenSchema,
    verifyEmailSchema,
    resendOTPSchema,
    forgotPasswordSchema,
    resetPasswordSchema,
    changePasswordSchema,
    googleLoginSchema,
} from "../validators/auth.validator.js";

const router = Router();

// Public Routes
router.post(
    "/register",
    validateRequest(registerSchema),
    asyncHandler(authController.register)
);

router.post(
    "/login",
    validateRequest(loginSchema),
    asyncHandler(authController.login)
);

router.post(
    "/google-login",
    validateRequest(googleLoginSchema),
    asyncHandler(authController.googleLogin)
);

router.post(
    "/verify-email",
    validateRequest(verifyEmailSchema),
    asyncHandler(authController.verifyEmail)
);

router.post(
    "/resend-otp",
    validateRequest(resendOTPSchema),
    asyncHandler(authController.resendOTP)
);

router.post(
    "/forgot-password",
    validateRequest(forgotPasswordSchema),
    asyncHandler(authController.forgotPassword)
);

router.post(
    "/reset-password",
    validateRequest(resetPasswordSchema),
    asyncHandler(authController.resetPassword)
);

router.post(
    "/refresh-token",
    validateRequest(refreshTokenSchema),
    asyncHandler(authController.refreshToken)
);

router.post(
    "/logout",
    validateRequest(logoutSchema),
    asyncHandler(authController.logout)
);

// Protected Routes
router.use(authenticate);

router.get("/me", asyncHandler(authController.getMe));

router.post(
    "/change-password",
    validateRequest(changePasswordSchema),
    asyncHandler(authController.changePassword)
);

export default router;

import { z } from "zod";

import {
  emailSchema,
  passwordSchema,
  phoneNumberSchema,
  fullNameSchema,
  otpSchema,
  refreshTokenSchema as refreshTokenValueSchema,
} from "./common.validator.js";

import { AUTH_REGISTER_ROLE_VALUES } from "../utils/constants.js";

// Register
export const registerSchema = z
  .object({
    fullName: fullNameSchema,
    email: emailSchema,
    phoneNumber: phoneNumberSchema,
    password: passwordSchema,
    role: z.enum(AUTH_REGISTER_ROLE_VALUES),
  })
  .strict();

// Verify Email
export const verifyEmailSchema = z
  .object({
    email: emailSchema,
    otp: otpSchema,
  })
  .strict();

// Resend OTP
export const resendOTPSchema = z
  .object({
    email: emailSchema,
  })
  .strict();

// Login
export const loginSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
  })
  .strict();

// Refresh Token
export const refreshTokenSchema = z
  .object({
    refreshToken: refreshTokenValueSchema,
  })
  .strict();

// Logout
export const logoutSchema = z
  .object({
    refreshToken: refreshTokenValueSchema,
  })
  .strict();

// Forgot Password
export const forgotPasswordSchema = z
  .object({
    email: emailSchema,
  })
  .strict();

// Reset Password
export const resetPasswordSchema = z
  .object({
    email: emailSchema,
    otp: otpSchema,
    newPassword: passwordSchema,
  })
  .strict();

// Change Password
export const changePasswordSchema = z
  .object({
    oldPassword: passwordSchema,
    newPassword: passwordSchema,
  })
  .strict();

// Google Login
export const googleLoginSchema = z
  .object({
    email: emailSchema,
    fullName: fullNameSchema.optional(),
    providerId: z
      .string()
      .trim()
      .min(1, "Google provider id is required."),
    profileImage: z
      .string()
      .trim()
      .url("Profile image must be a valid URL.")
      .optional()
      .or(z.literal("")),
  })
  .strict();

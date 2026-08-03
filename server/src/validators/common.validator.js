import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .email("Please enter a valid email address.")
  .toLowerCase();

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(100, "Password cannot exceed 100 characters.");

export const phoneNumberSchema = z
  .string()
  .trim()
  .regex(/^[6-9]\d{9}$/, "Please enter a valid phone number.");

export const fullNameSchema = z
  .string()
  .trim()
  .min(3, "Full name must be at least 3 characters.")
  .max(100, "Full name cannot exceed 100 characters.");

export const otpSchema = z
  .string()
  .length(6, "OTP must be exactly 6 digits.")
  .regex(/^\d+$/, "OTP must contain only numbers.");

export const mongoIdSchema = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, "Invalid MongoDB ObjectId.");

export const refreshTokenSchema = z
  .string()
  .trim()
  .min(1, "Refresh token is required.");

export const googleIdTokenSchema = z
  .string()
  .trim()
  .min(1, "Google ID token is required.");

export const latitudeSchema = z.number().min(-90).max(90);

export const longitudeSchema = z.number().min(-180).max(180);

export const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:mm).");

export const tableNameSchema = z
  .string()
  .trim()
  .min(1, "Table name is required.")
  .max(50, "Table name cannot exceed 50 characters.");


export const capacitySchema = z
  .number({
    required_error: "Capacity is required.",
    invalid_type_error: "Capacity must be a number.",
  })
  .int("Capacity must be a whole number.")
  .min(1, "Capacity must be at least 1.")
  .max(100, "Capacity cannot exceed 100.");

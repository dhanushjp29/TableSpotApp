import mongoose from "mongoose";
import { ZodError } from "zod";

import ApiError from "../utils/ApiError.js";

const errorHandler = (error, _req, res, _next) => {
  const isProduction = String(process.env.NODE_ENV || "").toLowerCase() === "production";
  const statusCode =
    error instanceof ApiError
      ? error.statusCode
      : error instanceof ZodError
        ? 400
        : error instanceof mongoose.Error.ValidationError
          ? 400
          : error instanceof mongoose.Error.CastError
            ? 400
            : 500;

  let message = "Internal server error.";
  let errors = [];

  if (error instanceof ApiError) {
    const exposeApiError = !isProduction || error.statusCode < 500;
    message = exposeApiError ? error.message : "Service temporarily unavailable.";
    errors = exposeApiError ? error.errors || [] : [];
  } else if (error instanceof ZodError) {
    errors = error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));
    message = errors.length
      ? `Validation failed. ${errors
          .map((e) => (e.path ? `${e.path}: ${e.message}` : e.message))
          .join("; ")}`
      : "Validation failed.";
  } else if (error instanceof mongoose.Error.ValidationError) {
    errors = Object.values(error.errors).map((err) => ({
      path: err.path,
      message: err.message,
    }));
    message = errors.length
      ? `Validation failed. ${errors
          .map((e) => (e.path ? `${e.path}: ${e.message}` : e.message))
          .join("; ")}`
      : "Validation failed.";
  } else if (error instanceof mongoose.Error.CastError) {
    message = `Invalid ${error.path}.`;
  } else if (!isProduction && error?.message) {
    message = error.message;
  }

  return res.status(statusCode).json({
    success: false,
    statusCode,
    message,
    errors,
    timestamp: new Date().toISOString(),
  });
};

export default errorHandler;

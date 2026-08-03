import mongoose from "mongoose";
import { ZodError } from "zod";

import ApiError from "../utils/ApiError.js";

const errorHandler = (error, _req, res, _next) => {
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
    message = error.message;
    errors = error.errors || [];
  } else if (error instanceof ZodError) {
    message = "Validation failed.";
    errors = error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));
  } else if (error instanceof mongoose.Error.ValidationError) {
    message = "Validation failed.";
    errors = Object.values(error.errors).map((err) => ({
      path: err.path,
      message: err.message,
    }));
  } else if (error instanceof mongoose.Error.CastError) {
    message = `Invalid ${error.path}.`;
  } else if (error?.message) {
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

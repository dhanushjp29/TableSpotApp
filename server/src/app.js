import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";

import errorHandler from "./middleware/errorHandler.js";
import ApiError from "./utils/ApiError.js";
import corsOptions from "./config/cors.js";
import apiRouter from "./routes/index.js";
import paymentWebhookRouter from "./routes/payment.webhook.routes.js";

const app = express();

const rateLimitMessage = {
  success: false,
  statusCode: 429,
  message: "Too many requests, please try again later.",
};

// Generous general limiter: protects against abuse without blocking normal
// multi-tab / multi-user usage (logins, token refreshes, data fetches all
// share the client IP).
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitMessage,
});

// Strict limiter for brute-force prone auth endpoints only.
// Successful requests are not counted, so real users are unaffected.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitMessage,
});

app.use(helmet());
app.use(cors(corsOptions));
app.use(morgan("dev"));

// Razorpay webhook MUST be mounted before express.json() so the raw body
// is available for signature verification.
app.use("/api/v1/payments/webhook", paymentWebhookRouter);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(generalLimiter);

// Strict rate limiting only on sensitive auth endpoints.
// /refresh-token and /logout are excluded so sessions never get dropped.
app.use("/api/v1/auth/login", authLimiter);
app.use("/api/v1/auth/register", authLimiter);
app.use("/api/v1/auth/google-login", authLimiter);
app.use("/api/v1/auth/verify-email", authLimiter);
app.use("/api/v1/auth/resend-otp", authLimiter);
app.use("/api/v1/auth/forgot-password", authLimiter);
app.use("/api/v1/auth/reset-password", authLimiter);
app.use("/api/v1/auth/change-password", authLimiter);

// Health Check
app.get("/", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "TableSpot API is running successfully.",
  });
});

// API Routes
app.use("/api/v1", apiRouter);

// 404 handler
app.use((req, _res, next) => {
  next(new ApiError(404, `Route ${req.originalUrl} not found.`));
});

app.use(errorHandler);

export default app;

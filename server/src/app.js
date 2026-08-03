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

const app = express();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    success: false,
    statusCode: 429,
    message: "Too many requests, please try again later.",
  },
});

app.use(helmet());
app.use(cors(corsOptions));
app.use(morgan("dev"));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(limiter);

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

import { Router } from "express";

import adminReconciliationRoutes from "./adminReconciliation.routes.js";
import analyticsRoutes from "./analytics.routes.js";
import authRoutes from "./auth.routes.js";
import billRoutes from "./bill.routes.js";
import bookingRoutes from "./booking.routes.js";
import foodRoutes from "./food.routes.js";
import foodReviewRoutes from "./foodReview.routes.js";
import jobRoutes from "./job.routes.js";
import notificationRoutes from "./notification.routes.js";
import offerRoutes from "./offer.routes.js";
import paymentRoutes from "./payment.routes.js";
import refundRoutes from "./refund.routes.js";
import restaurantReportRoutes from "./restaurantReport.routes.js";
import restaurantReviewRoutes from "./restaurantReview.routes.js";
import restaurantRoutes from "./restaurant.routes.js";
import restaurantWarningRoutes from "./restaurantWarning.routes.js";
import tableRoutes from "./table.routes.js";
import uploadRoutes from "./upload.routes.js";
import userRoutes from "./user.routes.js";

const apiRouter = Router();

apiRouter.use("/reports", analyticsRoutes);
apiRouter.use("/auth", authRoutes);
apiRouter.use("/restaurants", restaurantRoutes);
apiRouter.use("/restaurant-reports", restaurantReportRoutes);
apiRouter.use("/restaurant-warnings", restaurantWarningRoutes);
apiRouter.use("/tables", tableRoutes);
apiRouter.use("/foods", foodRoutes);
apiRouter.use("/bookings", bookingRoutes);
apiRouter.use("/bills", billRoutes);
apiRouter.use("/users", userRoutes);
apiRouter.use("/notifications", notificationRoutes);
apiRouter.use("/offers", offerRoutes);
apiRouter.use("/restaurant-reviews", restaurantReviewRoutes);
apiRouter.use("/food-reviews", foodReviewRoutes);
apiRouter.use("/payments", paymentRoutes);
apiRouter.use("/refunds", refundRoutes);
apiRouter.use("/admin/payments/reconciliation", adminReconciliationRoutes);
apiRouter.use("/jobs", jobRoutes);
apiRouter.use("/uploads", uploadRoutes);

export default apiRouter;

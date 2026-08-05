import { Router } from "express";

import authRoutes from "./auth.routes.js";
import billRoutes from "./bill.routes.js";
import bookingRoutes from "./booking.routes.js";
import foodRoutes from "./food.routes.js";
import foodReviewRoutes from "./foodReview.routes.js";
import notificationRoutes from "./notification.routes.js";
import paymentRoutes from "./payment.routes.js";
import restaurantRoutes from "./restaurant.routes.js";
import restaurantReviewRoutes from "./restaurantReview.routes.js";
import tableRoutes from "./table.routes.js";
import uploadRoutes from "./upload.routes.js";
import userRoutes from "./user.routes.js";

const apiRouter = Router();

apiRouter.use("/auth", authRoutes);
apiRouter.use("/restaurants", restaurantRoutes);
apiRouter.use("/tables", tableRoutes);
apiRouter.use("/foods", foodRoutes);
apiRouter.use("/bookings", bookingRoutes);
apiRouter.use("/bills", billRoutes);
apiRouter.use("/users", userRoutes);
apiRouter.use("/notifications", notificationRoutes);
apiRouter.use("/restaurant-reviews", restaurantReviewRoutes);
apiRouter.use("/food-reviews", foodReviewRoutes);
apiRouter.use("/payments", paymentRoutes);
apiRouter.use("/uploads", uploadRoutes);

export default apiRouter;

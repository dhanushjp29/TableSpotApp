import { Router } from "express";

import authRoutes from "./auth.routes.js";
import restaurantRoutes from "./restaurant.routes.js";
import tableRoutes from "./table.routes.js";
import foodRoutes from "./food.routes.js";
import bookingRoutes from "./booking.routes.js";
import billRoutes from "./bill.routes.js";
import userRoutes from "./user.routes.js";
import reviewRoutes from "./review.routes.js";
import paymentRoutes from "./payment.routes.js";

const apiRouter = Router();

apiRouter.use("/auth", authRoutes);
apiRouter.use("/restaurants", restaurantRoutes);
apiRouter.use("/tables", tableRoutes);
apiRouter.use("/foods", foodRoutes);
apiRouter.use("/bookings", bookingRoutes);
apiRouter.use("/bills", billRoutes);
apiRouter.use("/users", userRoutes);
apiRouter.use("/reviews", reviewRoutes);
apiRouter.use("/payments", paymentRoutes);

export default apiRouter;


import http from "http";

import app from "./app.js";
import connectDatabase, { closeDatabase } from "./config/database.js";
import { assertProductionEnvironment } from "./config/env.js";
import { assertRazorpayMockModesSafe } from "./config/razorpay.js";
import { getRazorpayMode, getTestRazorpayAccountId } from "./config/razorpay.js";
import { startDeadlineCron } from "./services/deadlineCron.service.js";
import { startOfferCron } from "./services/offerCron.service.js";
import {
  startReconciliationWorker,
  stopReconciliationWorker,
} from "./services/reconciliation.worker.js";
import { startTableStatusScheduler } from "./services/tableStatusScheduler.service.js";
import { startWarningCron } from "./services/warningCron.service.js";
import { closeSocket, initSocket } from "./sockets/socket.handler.js";

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    assertProductionEnvironment();
    assertRazorpayMockModesSafe();

    const razorpayMode = getRazorpayMode();
    const testAccountId = getTestRazorpayAccountId();
    if (testAccountId) {
      console.log(
        `[Razorpay] TEST Route account override is ACTIVE (mode=${razorpayMode}). ` +
        `All payment flows will use ${testAccountId} as the Route destination.`
      );
    } else {
      console.log(`[Razorpay] mode=${razorpayMode}. Route account override is inactive.`);
    }

    await connectDatabase();

    const server = http.createServer(app);
    initSocket(server);

    startDeadlineCron();
    startTableStatusScheduler();
    startOfferCron();
    startWarningCron();
    startReconciliationWorker();

    const activeServer = server.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });

    let shuttingDown = false;
    const shutdown = async (signal) => {
      if (shuttingDown) return;
      shuttingDown = true;
      console.log(`${signal} received. Shutting down gracefully...`);
      await new Promise((resolve) => activeServer.close(resolve));
      await closeSocket();
      stopReconciliationWorker();
      await closeDatabase();
      console.log("HTTP, Socket.io, reconciliation worker, and MongoDB connections closed.");
      process.exit(0);
    };

    process.on("unhandledRejection", (error) => {
      console.error("Unhandled rejection. Shutting down gracefully.", error?.name, error?.message);
      void shutdown("unhandledRejection");
    });
    process.on("uncaughtException", (error) => {
      console.error("Uncaught exception. Shutting down gracefully.", error?.name, error?.message);
      void shutdown("uncaughtException");
    });
    process.on("SIGTERM", () => void shutdown("SIGTERM"));
    process.on("SIGINT", () => void shutdown("SIGINT"));
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
};

startServer();

import dotenv from "dotenv";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";

// Proper dotenv path loading to look inside src/
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, ".env") });

import app from "./app.js";
import connectDatabase from "./config/database.js";
import { initSocket } from "./sockets/socket.handler.js";
import { startDeadlineCron } from "./services/deadlineCron.service.js";
import { startOfferCron } from "./services/offerCron.service.js";
import { startTableStatusScheduler } from "./services/tableStatusScheduler.service.js";
import { startWarningCron } from "./services/warningCron.service.js";

const PORT = process.env.PORT || 5000;

const startServer = async () => {
    try {
        await connectDatabase();

        const server = http.createServer(app);

        // Initialize Socket.io
        initSocket(server);

        // Start scheduled deadline tasks (no-show grace, refund deadlines)
        startDeadlineCron();

        // Revert owner-set table status timers back to Available on expiry
        startTableStatusScheduler();

        // Offer expiring-soon reminders + expire stale active recipients
        startOfferCron();

        // Expire restaurant warnings whose validity window has closed
        startWarningCron();

        const activeServer = server.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });

        // Graceful shutdown handlers
        process.on("unhandledRejection", (err) => {
            console.error("UNHANDLED REJECTION! Shutting down gracefully...");
            console.error(err.name, err.message, err.stack);
            activeServer.close(() => {
                process.exit(1);
            });
        });

        process.on("uncaughtException", (err) => {
            console.error("UNCAUGHT EXCEPTION! Shutting down gracefully...");
            console.error(err.name, err.message, err.stack);
            activeServer.close(() => {
                process.exit(1);
            });
        });

        process.on("SIGTERM", () => {
            console.log("👋 SIGTERM RECEIVED. Shutting down gracefully...");
            activeServer.close(() => {
                console.log("💥 Process terminated!");
            });
        });

    } catch (error) {
        console.error("Failed to start server:", error.message);
        process.exit(1);
    }
};

startServer();

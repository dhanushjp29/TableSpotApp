import "./env.js";

import "./env.js";

const configuredOrigins = [
    process.env.CLIENT_URL,
    ...(process.env.CLIENT_ORIGINS || "").split(","),
    ...(String(process.env.NODE_ENV || "").toLowerCase() === "production" ? [] : ["http://localhost:5173"]),
].map((origin) => origin.trim()).filter(Boolean);

const corsOptions = {
    origin: (origin, callback) => {
        if (!origin || configuredOrigins.includes(origin)) {
            callback(null, true);
            return;
        }
        callback(new Error("Origin is not allowed by TableSpot CORS policy."));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Access-Token",
        "X-Requested-With",
    ],
};

export default corsOptions;

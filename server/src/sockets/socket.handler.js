import { Server } from "socket.io";
import corsOptions from "../config/cors.js";

let io;

export const initSocket = (server) => {
    io = new Server(server, {
        cors: corsOptions,
    });

    io.on("connection", (socket) => {
        console.log(`Socket connected: ${socket.id}`);

        // Join a room specifically for a restaurant's staff
        socket.on("join:restaurant", (restaurantId) => {
            socket.join(`restaurant_${restaurantId}`);
            console.log(`Socket ${socket.id} joined restaurant_${restaurantId}`);
        });

        socket.on("leave:restaurant", (restaurantId) => {
            socket.leave(`restaurant_${restaurantId}`);
            console.log(`Socket ${socket.id} left restaurant_${restaurantId}`);
        });

        socket.on("disconnect", () => {
            console.log(`Socket disconnected: ${socket.id}`);
        });
    });

    return io;
};

export const getIO = () => {
    if (!io) {
        throw new Error("Socket.io not initialized!");
    }
    return io;
};

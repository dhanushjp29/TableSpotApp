import { Server } from "socket.io";
import corsOptions from "../config/cors.js";
import { verifyAccessToken } from "../utils/jwt.js";
import User from "../models/User.js";
import Restaurant from "../models/Restaurant.js";
import { USER_ROLE } from "../utils/constants.js";

let io;

const extractTokenFromCookie = (cookieHeader) => {
    if (!cookieHeader) return null;
    const match = cookieHeader.match(/(?:^|;\s*)accessToken=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : null;
};

const authenticateSocket = async (socket, next) => {
    try {
        const token =
            socket.handshake.auth?.token ||
            socket.handshake.headers?.authorization?.replace("Bearer ", "") ||
            extractTokenFromCookie(socket.handshake.headers?.cookie);

        if (!token) {
            return next(new Error("Authentication token is required."));
        }

        const payload = verifyAccessToken(token);
        const user = await User.findById(payload.userId).select("_id role isActive isDeleted");

        if (!user || !user.isActive || user.isDeleted) {
            return next(new Error("User not found or account disabled."));
        }

        socket.user = user;
        return next();
    } catch (error) {
        return next(new Error("Invalid or expired token."));
    }
};

export const initSocket = (server) => {
    io = new Server(server, {
        cors: corsOptions,
    });

    // Require authentication for all socket connections
    io.use(authenticateSocket);

    io.on("connection", (socket) => {
        console.log(`Socket connected: ${socket.id} (user: ${socket.user._id})`);

        // Join a per-user room so we can push live notifications
        socket.join(`user_${socket.user._id}`);

        // Join a room specifically for a restaurant's staff
        socket.on("join:restaurant", async (restaurantId, callback) => {
            try {
                // Only owners and admins can join restaurant rooms
                if (
                    socket.user.role !== USER_ROLE.OWNER &&
                    socket.user.role !== USER_ROLE.ADMIN
                ) {
                    return callback?.({ error: "Only restaurant owners can join restaurant rooms." });
                }

                // Verify the owner actually owns this restaurant
                if (socket.user.role === USER_ROLE.OWNER) {
                    const restaurant = await Restaurant.findById(restaurantId).select("ownerId");
                    if (!restaurant || String(restaurant.ownerId) !== String(socket.user._id)) {
                        return callback?.({ error: "You can only join rooms for your own restaurants." });
                    }
                }

                socket.join(`restaurant_${restaurantId}`);
                console.log(`Socket ${socket.id} joined restaurant_${restaurantId}`);
                callback?.({ success: true });
            } catch (error) {
                callback?.({ error: error.message || "Failed to join restaurant room." });
            }
        });

        socket.on("leave:restaurant", (restaurantId) => {
            socket.leave(`restaurant_${restaurantId}`);
            console.log(`Socket ${socket.id} left restaurant_${restaurantId}`);
        });

        // Join the restaurant room(s) to receive live table/booking updates.
        // Owners may only join their own restaurants; admins may join any.
        // When no restaurantId is given, an owner joins all of their
        // restaurants' rooms.
        const joinRestaurantRooms = async (restaurantId) => {
            if (socket.user.role === USER_ROLE.CUSTOMER) {
                if (!restaurantId) return [];
                const restaurant = await Restaurant.findById(restaurantId).select(
                    "_id isActive isDeleted"
                );
                if (!restaurant || !restaurant.isActive || restaurant.isDeleted) {
                    throw new Error("Restaurant not found.");
                }
                socket.join(`restaurant_${restaurantId}`);
                return [String(restaurantId)];
            }

            if (socket.user.role === USER_ROLE.ADMIN) {
                if (restaurantId) {
                    socket.join(`restaurant_${restaurantId}`);
                    return [String(restaurantId)];
                }
                return [];
            }

            if (restaurantId) {
                const restaurant = await Restaurant.findById(restaurantId).select(
                    "ownerId"
                );
                if (
                    !restaurant ||
                    String(restaurant.ownerId) !== String(socket.user._id)
                ) {
                    throw new Error(
                        "You can only subscribe to your own restaurants."
                    );
                }
                socket.join(`restaurant_${restaurantId}`);
                return [String(restaurantId)];
            }

            const owned = await Restaurant.find({
                ownerId: socket.user._id,
                isDeleted: false,
            }).select("_id");
            owned.forEach((r) => socket.join(`restaurant_${r._id}`));
            return owned.map((r) => String(r._id));
        };

        socket.on("subscribe:tables", async (payload, callback) => {
            try {
                await joinRestaurantRooms(payload?.restaurantId);
                callback?.({ success: true });
            } catch (error) {
                callback?.({
                    error: error.message || "Failed to subscribe to table updates.",
                });
            }
        });

        socket.on("subscribe:bookings", async (payload, callback) => {
            try {
                await joinRestaurantRooms(payload?.restaurantId);
                callback?.({ success: true });
            } catch (error) {
                callback?.({
                    error: error.message || "Failed to subscribe to booking updates.",
                });
            }
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

export const closeSocket = async () => {
    if (io) {
        await new Promise((resolve) => io.close(resolve));
        io = undefined;
    }
};

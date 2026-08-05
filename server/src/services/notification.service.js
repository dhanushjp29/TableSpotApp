import Notification from "../models/Notification.js";

import ApiError from "../utils/ApiError.js";
import generateCode from "../utils/generateCode.js";
import { CODE_PREFIX } from "../utils/constants.js";
import { getIO } from "../sockets/socket.handler.js";

const emitNotification = (userId, notification) => {
    try {
        const io = getIO();
        io.to(`user_${userId}`).emit("notification:new", { notification });
    } catch (error) {
        console.error("Socket emit failed for notification:", error.message);
    }
};

export const createNotification = async ({
    userId,
    title,
    message,
    type = "System",
    linkId = null,
    linkModel = "",
}) => {
    if (!userId) {
        return null;
    }

    const notificationCode = await generateCode(
        Notification,
        "notificationCode",
        CODE_PREFIX.NOTIFICATION
    );

    const notification = await Notification.create({
        notificationCode,
        userId,
        title,
        message,
        type,
        linkId,
        linkModel,
    });

    emitNotification(userId, notification);

    return notification;
};

export const getNotifications = async ({
    userId,
    page = 1,
    limit = 20,
    unreadOnly = false,
}) => {
    const query = { userId, isActive: true, isDeleted: false };

    if (unreadOnly) {
        query.isRead = false;
    }

    const pageNumber = Math.max(Number(page) || 1, 1);
    const pageSize = Math.min(Math.max(Number(limit) || 20, 1), 50);
    const skip = (pageNumber - 1) * pageSize;

    const [notifications, total] = await Promise.all([
        Notification.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(pageSize),
        Notification.countDocuments(query),
    ]);

    return {
        notifications,
        meta: {
            page: pageNumber,
            limit: pageSize,
            total,
            totalPages: Math.ceil(total / pageSize) || 1,
        },
    };
};

export const getUnreadCount = async ({ userId }) => {
    const count = await Notification.countDocuments({
        userId,
        isActive: true,
        isDeleted: false,
        isRead: false,
    });

    return { count };
};

export const markNotificationAsRead = async ({ userId, notificationId }) => {
    const notification = await Notification.findOneAndUpdate(
        { _id: notificationId, userId },
        { isRead: true, readAt: new Date() },
        { new: true }
    );

    if (!notification) {
        throw new ApiError(404, "Notification not found.");
    }

    return { notification };
};

export const markAllNotificationsAsRead = async ({ userId }) => {
    await Notification.updateMany(
        { userId, isRead: false },
        { isRead: true, readAt: new Date() }
    );

    return { message: "All notifications marked as read." };
};

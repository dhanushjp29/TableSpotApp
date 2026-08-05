import * as notificationService from "../services/notification.service.js";
import ApiResponse from "../utils/ApiResponse.js";

export const getList = async (req, res) => {
    const result = await notificationService.getNotifications({
        userId: req.user._id,
        page: req.query.page,
        limit: req.query.limit,
        unreadOnly: req.query.unreadOnly === "true",
    });
    res.status(200).json(new ApiResponse(200, "Notifications retrieved.", result));
};

export const getUnreadCount = async (req, res) => {
    const result = await notificationService.getUnreadCount({
        userId: req.user._id,
    });
    res.status(200).json(new ApiResponse(200, "Unread count retrieved.", result));
};

export const markRead = async (req, res) => {
    const result = await notificationService.markNotificationAsRead({
        userId: req.user._id,
        notificationId: req.params.notificationId,
    });
    res.status(200).json(new ApiResponse(200, "Notification marked as read.", result));
};

export const markAllRead = async (req, res) => {
    const result = await notificationService.markAllNotificationsAsRead({
        userId: req.user._id,
    });
    res.status(200).json(new ApiResponse(200, result.message, result));
};

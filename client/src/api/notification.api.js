import apiClient from "./apiClient.js";

export const notificationApi = {
  async getAll(params = {}) {
    const response = await apiClient.get("/notifications", { params });
    return response.data;
  },

  async getUnreadCount() {
    const response = await apiClient.get("/notifications/unread-count");
    return response.data;
  },

  async markAsRead(notificationId) {
    const response = await apiClient.patch(`/notifications/${notificationId}/read`);
    return response.data;
  },

  async markAllAsRead() {
    const response = await apiClient.patch("/notifications/read-all");
    return response.data;
  },
};

export default notificationApi;

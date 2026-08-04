import apiClient from "./apiClient.js";

export const userApi = {
  // Profile
  async getProfile() {
    const response = await apiClient.get("/users/profile");
    return response.data;
  },

  async updateProfile(data) {
    const response = await apiClient.patch("/users/profile", data);
    return response.data;
  },

  // Admin
  async getAll(params = {}) {
    const response = await apiClient.get("/users", { params });
    return response.data;
  },

  async toggleActive(userId) {
    const response = await apiClient.patch(`/users/${userId}/status`);
    return response.data;
  },

  async remove(userId) {
    const response = await apiClient.delete(`/users/${userId}`);
    return response.data;
  },
};

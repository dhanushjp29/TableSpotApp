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

  // Favorites
  async getFavoriteRestaurants() {
    const response = await apiClient.get("/users/favorites");
    return response.data;
  },

  async toggleFavorite(restaurantId) {
    const response = await apiClient.post(`/users/favorites/${restaurantId}`);
    return response.data;
  },

  async getFavoriteFoods() {
    const response = await apiClient.get("/users/favorites/foods");
    return response.data;
  },

  async toggleFavoriteFood(foodId) {
    const response = await apiClient.post(`/users/favorites/foods/${foodId}`);
    return response.data;
  },

  // Admin
  async getAll(params = {}) {
    const response = await apiClient.get("/users", { params });
    return response.data;
  },

  async toggleActive(userId, data = {}) {
    const response = await apiClient.patch(`/users/${userId}/status`, data);
    return response.data;
  },

  async remove(userId) {
    const response = await apiClient.delete(`/users/${userId}`);
    return response.data;
  },
};

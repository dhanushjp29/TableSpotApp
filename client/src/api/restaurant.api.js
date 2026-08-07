import apiClient from "./apiClient.js";

export const restaurantApi = {
  async getAll(params = {}) {
    const response = await apiClient.get("/restaurants", { params });
    return response.data;
  },

  async getCities() {
    const response = await apiClient.get("/restaurants/cities");
    return response.data;
  },

  async getById(restaurantId) {
    const response = await apiClient.get(`/restaurants/${restaurantId}`);
    return response.data;
  },

  async getBySlug(slug) {
    const response = await apiClient.get(`/restaurants/slug/${slug}`);
    return response.data;
  },

  async create(data) {
    const response = await apiClient.post("/restaurants", data);
    return response.data;
  },

  async update(restaurantId, data) {
    const response = await apiClient.patch(`/restaurants/${restaurantId}`, data);
    return response.data;
  },

  async remove(restaurantId) {
    const response = await apiClient.delete(`/restaurants/${restaurantId}`);
    return response.data;
  },

  async verify(restaurantId, data) {
    const response = await apiClient.patch(`/restaurants/${restaurantId}/verify`, data);
    return response.data;
  },
};

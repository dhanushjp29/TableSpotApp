import apiClient from "./apiClient.js";

export const foodApi = {
  async getAll(params = {}) {
    const response = await apiClient.get("/foods", { params });
    return response.data;
  },

  async getByRestaurant(restaurantId, params = {}) {
    const response = await apiClient.get(`/foods/restaurant/${restaurantId}`, {
      params,
    });
    return response.data;
  },

  async getById(foodId) {
    const response = await apiClient.get(`/foods/${foodId}`);
    return response.data;
  },

  async create(data) {
    const response = await apiClient.post("/foods", data);
    return response.data;
  },

  async update(foodId, data) {
    const response = await apiClient.patch(`/foods/${foodId}`, data);
    return response.data;
  },

  async remove(foodId) {
    const response = await apiClient.delete(`/foods/${foodId}`);
    return response.data;
  },
};

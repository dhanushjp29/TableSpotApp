import apiClient from "./apiClient.js";

export const tableApi = {
  async getAll(params = {}) {
    const response = await apiClient.get("/tables", { params });
    return response.data;
  },

  async getByRestaurant(restaurantId, params = {}) {
    const response = await apiClient.get(`/tables/restaurant/${restaurantId}`, {
      params,
    });
    return response.data;
  },

  async getAvailability(restaurantId, params = {}) {
    const response = await apiClient.get(
      `/tables/restaurant/${restaurantId}/availability`,
      { params }
    );
    return response.data;
  },

  async getById(tableId) {
    const response = await apiClient.get(`/tables/${tableId}`);
    return response.data;
  },

  async create(data) {
    const response = await apiClient.post("/tables", data);
    return response.data;
  },

  async update(tableId, data) {
    const response = await apiClient.patch(`/tables/${tableId}`, data);
    return response.data;
  },

  async updateStatus(tableId, data) {
    const response = await apiClient.patch(`/tables/${tableId}/status`, data);
    return response.data;
  },

  async remove(tableId) {
    const response = await apiClient.delete(`/tables/${tableId}`);
    return response.data;
  },
};

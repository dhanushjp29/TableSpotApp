import apiClient from "./apiClient.js";

export const bookingApi = {
  async getAll(params = {}) {
    const response = await apiClient.get("/bookings", { params });
    return response.data;
  },

  async getById(bookingId) {
    const response = await apiClient.get(`/bookings/${bookingId}`);
    return response.data;
  },

  async create(data) {
    const response = await apiClient.post("/bookings", data);
    return response.data;
  },

  async update(bookingId, data) {
    const response = await apiClient.patch(`/bookings/${bookingId}`, data);
    return response.data;
  },

  async cancel(bookingId, data = {}) {
    const response = await apiClient.post(`/bookings/${bookingId}/cancel`, data);
    return response.data;
  },

  async markNoShow(bookingId, remarks) {
    const response = await apiClient.post(`/bookings/${bookingId}/no-show`, {
      remarks,
    });
    return response.data;
  },
};

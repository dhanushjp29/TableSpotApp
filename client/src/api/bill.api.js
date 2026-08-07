import apiClient from "./apiClient.js";

export const billApi = {
  async getAll(params = {}) {
    const response = await apiClient.get("/bills", { params });
    return response.data;
  },

  async getById(billId) {
    const response = await apiClient.get(`/bills/${billId}`);
    return response.data;
  },

  async create(data) {
    const response = await apiClient.post("/bills", data);
    return response.data;
  },

  async convertToBill(bookingId, data = {}) {
    const response = await apiClient.post(
      `/bills/${bookingId}/convert-to-bill`,
      data
    );
    return response.data;
  },

  async update(billId, data) {
    const response = await apiClient.patch(`/bills/${billId}`, data);
    return response.data;
  },

  async addPayment(billId, data) {
    const response = await apiClient.post(`/bills/${billId}/payments`, data);
    return response.data;
  },

  async markStatus(billId, data) {
    const response = await apiClient.patch(`/bills/${billId}/status`, data);
    return response.data;
  },
};

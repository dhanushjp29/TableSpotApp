import apiClient from "./apiClient.js";

export const paymentApi = {
  async createOrder(data) {
    const response = await apiClient.post("/payments/create-order", data);
    return response.data;
  },

  async verifyPayment(data) {
    const response = await apiClient.post("/payments/verify", data);
    return response.data;
  },

  async getHistory(params = {}) {
    const response = await apiClient.get("/payments/history", { params });
    return response.data;
  },

  async connectAccount() {
    const response = await apiClient.post("/payments/account/connect");
    return response.data;
  },

  async getAccountStatus() {
    const response = await apiClient.get("/payments/account/status");
    return response.data;
  },
};

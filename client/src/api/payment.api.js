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
};

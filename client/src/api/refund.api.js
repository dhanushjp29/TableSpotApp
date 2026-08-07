import apiClient from "./apiClient.js";

export const refundApi = {
  async getAll(params = {}) {
    const response = await apiClient.get("/refunds", { params });
    return response.data;
  },

  async getById(refundId) {
    const response = await apiClient.get(`/refunds/${refundId}`);
    return response.data;
  },

  async process(refundId, refundMethod) {
    const response = await apiClient.post(
      `/refunds/${refundId}/process`,
      refundMethod ? { refundMethod } : undefined
    );
    return response.data;
  },

  async confirmReceipt(refundId) {
    const response = await apiClient.post(`/refunds/${refundId}/confirm-receipt`);
    return response.data;
  },

  async dispute(refundId, disputeReason) {
    const response = await apiClient.post(`/refunds/${refundId}/dispute`, {
      disputeReason,
    });
    return response.data;
  },
};

export default refundApi;

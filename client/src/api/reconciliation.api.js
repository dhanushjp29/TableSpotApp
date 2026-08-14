import apiClient from "./apiClient.js";

export const reconciliationApi = {
  async getAll(params = {}) {
    const response = await apiClient.get("/admin/payments/reconciliation", {
      params,
    });
    return response.data;
  },

  async getStatus() {
    const response = await apiClient.get(
      "/admin/payments/reconciliation/status"
    );
    return response.data;
  },

  async retry(reconciliationId) {
    const response = await apiClient.post(
      `/admin/payments/reconciliation/${reconciliationId}/retry`,
      {}
    );
    return response.data;
  },

  async refund(reconciliationId) {
    const response = await apiClient.post(
      `/admin/payments/reconciliation/${reconciliationId}/refund`,
      {}
    );
    return response.data;
  },

  async close(reconciliationId, reason) {
    const response = await apiClient.post(
      `/admin/payments/reconciliation/${reconciliationId}/close`,
      reason ? { reason } : {}
    );
    return response.data;
  },
};

export default reconciliationApi;

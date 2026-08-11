import apiClient from "./apiClient.js";

export const ownerReportApi = {
  async getReport(params = {}) {
    const response = await apiClient.get("/reports/owner", { params });
    return response.data;
  },

  async getExportData(params = {}) {
    const response = await apiClient.get("/reports/owner/export", { params });
    return response.data;
  },
};

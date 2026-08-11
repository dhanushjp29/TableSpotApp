import apiClient from "./apiClient.js";

export const restaurantReportApi = {
  async getAll(params = {}) {
    const response = await apiClient.get("/restaurant-reports", { params });
    return response.data;
  },

  async getMy(params = {}) {
    const response = await apiClient.get("/restaurant-reports/my", { params });
    return response.data;
  },

  async getEligibility(restaurantId) {
    const response = await apiClient.get(
      `/restaurant-reports/eligibility/${restaurantId}`
    );
    return response.data;
  },

  async getById(reportId) {
    const response = await apiClient.get(`/restaurant-reports/${reportId}`);
    return response.data;
  },

  async create(data) {
    const response = await apiClient.post("/restaurant-reports", data);
    return response.data;
  },

  async updateStatus(reportId, data) {
    const response = await apiClient.patch(
      `/restaurant-reports/${reportId}/status`,
      data
    );
    return response.data;
  },
};

export const restaurantWarningApi = {
  async getAll(params = {}) {
    const response = await apiClient.get("/restaurant-warnings", { params });
    return response.data;
  },

  async getById(warningId) {
    const response = await apiClient.get(`/restaurant-warnings/${warningId}`);
    return response.data;
  },

  async create(data) {
    const response = await apiClient.post("/restaurant-warnings", data);
    return response.data;
  },

  async update(warningId, data) {
    const response = await apiClient.patch(
      `/restaurant-warnings/${warningId}`,
      data
    );
    return response.data;
  },

  async reply(warningId, message) {
    const response = await apiClient.post(
      `/restaurant-warnings/${warningId}/reply`,
      { message }
    );
    return response.data;
  },
};
import apiClient from "./apiClient.js";

export const offerApi = {
  // Owner
  async create(data) {
    const response = await apiClient.post("/offers", data);
    return response.data;
  },

  async getAll(params = {}) {
    const response = await apiClient.get("/offers", { params });
    return response.data;
  },

  async getById(offerId) {
    const response = await apiClient.get(`/offers/${offerId}`);
    return response.data;
  },

  async update(offerId, data) {
    const response = await apiClient.patch(`/offers/${offerId}`, data);
    return response.data;
  },

  async remove(offerId) {
    const response = await apiClient.delete(`/offers/${offerId}`);
    return response.data;
  },

  async toggleActive(offerId, data) {
    const response = await apiClient.patch(`/offers/${offerId}/active`, data);
    return response.data;
  },

  async getStats(offerId) {
    const response = await apiClient.get(`/offers/${offerId}/stats`);
    return response.data;
  },

  async getRecipients(offerId, params = {}) {
    const response = await apiClient.get(`/offers/${offerId}/recipients`, {
      params,
    });
    return response.data;
  },

  // Customer
  async getAvailable(params = {}) {
    const response = await apiClient.get("/offers/available", { params });
    return response.data;
  },

  async getMine(params = {}) {
    const response = await apiClient.get("/offers/mine", { params });
    return response.data;
  },

  async claim(offerId) {
    const response = await apiClient.post(`/offers/${offerId}/claim`);
    return response.data;
  },

  // Bill consumption (owner walk-in)
  async consumeOffer(data) {
    const response = await apiClient.post("/bills/offers/consume", data);
    return response.data;
  },
};

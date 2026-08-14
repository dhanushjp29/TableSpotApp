import apiClient from "./apiClient.js";

export const receiptApi = {
  async download(type, id) {
    const response = await apiClient.get(`/receipts/${type}/${id}.pdf`, { responseType: "blob" });
    return response.data;
  },
};

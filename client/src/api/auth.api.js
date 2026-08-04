import apiClient from "./apiClient.js";
import { storage } from "../utils/storage.js";

export const authApi = {
  async register(data) {
    const response = await apiClient.post("/auth/register", data);
    return response.data;
  },

  async login(data) {
    const response = await apiClient.post("/auth/login", data);
    // Store refresh token for the refresh flow
    if (response.data?.data?.refreshToken) {
      storage.set("refreshToken", response.data.data.refreshToken);
    }
    return response.data;
  },

  async googleLogin(data) {
    const response = await apiClient.post("/auth/google-login", data);
    if (response.data?.data?.refreshToken) {
      storage.set("refreshToken", response.data.data.refreshToken);
    }
    return response.data;
  },

  async verifyEmail(data) {
    const response = await apiClient.post("/auth/verify-email", data);
    return response.data;
  },

  async resendOTP(data) {
    const response = await apiClient.post("/auth/resend-otp", data);
    return response.data;
  },

  async forgotPassword(data) {
    const response = await apiClient.post("/auth/forgot-password", data);
    return response.data;
  },

  async resetPassword(data) {
    const response = await apiClient.post("/auth/reset-password", data);
    return response.data;
  },

  async changePassword(data) {
    const response = await apiClient.post("/auth/change-password", data);
    return response.data;
  },

  async logout() {
    const refreshToken = storage.get("refreshToken");
    const response = await apiClient.post("/auth/logout", { refreshToken });
    storage.remove("refreshToken");
    return response.data;
  },

  async getMe() {
    const response = await apiClient.get("/auth/me");
    return response.data;
  },
};

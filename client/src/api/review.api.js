import apiClient from "./apiClient.js";

export const restaurantReviewApi = {
  async getAll(params = {}) {
    const response = await apiClient.get("/restaurant-reviews", { params });
    return response.data;
  },

  async getByRestaurant(restaurantId, params = {}) {
    const response = await apiClient.get(
      `/restaurant-reviews/restaurant/${restaurantId}`,
      { params }
    );
    return response.data;
  },

  async getEligibility(restaurantId, bookingId = null) {
    const response = await apiClient.get(
      `/restaurant-reviews/eligibility/${restaurantId}`,
      { params: bookingId ? { bookingId } : {} }
    );
    return response.data;
  },

  async getById(reviewId) {
    const response = await apiClient.get(`/restaurant-reviews/${reviewId}`);
    return response.data;
  },

  async getMyBookingReview({ bookingId, restaurantId = null }) {
    const response = await apiClient.get("/restaurant-reviews/my/booking", {
      params: {
        bookingId,
        ...(restaurantId ? { restaurantId } : {}),
      },
    });
    return response.data;
  },

  async create(data) {
    const response = await apiClient.post("/restaurant-reviews", data);
    return response.data;
  },

  async update(reviewId, data) {
    const response = await apiClient.patch(`/restaurant-reviews/${reviewId}`, data);
    return response.data;
  },

  async remove(reviewId) {
    const response = await apiClient.delete(`/restaurant-reviews/${reviewId}`);
    return response.data;
  },
};

export const foodReviewApi = {
  async getAll(params = {}) {
    const response = await apiClient.get("/food-reviews", { params });
    return response.data;
  },

  async getByFood(foodId, params = {}) {
    const response = await apiClient.get(`/food-reviews/food/${foodId}`, {
      params,
    });
    return response.data;
  },

  async getByRestaurant(restaurantId, params = {}) {
    const response = await apiClient.get(
      `/food-reviews/restaurant/${restaurantId}`,
      { params }
    );
    return response.data;
  },

  async getById(reviewId) {
    const response = await apiClient.get(`/food-reviews/${reviewId}`);
    return response.data;
  },

  async getMyBookingReviews({ bookingId }) {
    const response = await apiClient.get("/food-reviews/my/booking", {
      params: { bookingId },
    });
    return response.data;
  },

  async create(data) {
    const response = await apiClient.post("/food-reviews", data);
    return response.data;
  },

  async update(reviewId, data) {
    const response = await apiClient.patch(`/food-reviews/${reviewId}`, data);
    return response.data;
  },

  async remove(reviewId) {
    const response = await apiClient.delete(`/food-reviews/${reviewId}`);
    return response.data;
  },
};

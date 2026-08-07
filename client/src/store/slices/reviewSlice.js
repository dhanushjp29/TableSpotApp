import { createSlice } from "@reduxjs/toolkit";
import {
  restaurantReviewApi,
  foodReviewApi,
} from "../../api/review.api.js";

const initialState = {
  restaurantReviews: [],
  foodReviews: [],
  meta: null,
  isLoading: false,
  error: null,
};

const reviewSlice = createSlice({
  name: "review",
  initialState,
  reducers: {
    setLoading(state, action) {
      state.isLoading = action.payload;
    },
    setError(state, action) {
      state.error = action.payload;
    },
    setRestaurantReviews(state, action) {
      state.restaurantReviews = action.payload.reviews;
      state.meta = action.payload.meta;
      state.error = null;
    },
    setFoodReviews(state, action) {
      state.foodReviews = action.payload.reviews;
      state.meta = action.payload.meta;
      state.error = null;
    },
    appendRestaurantReviews(state, action) {
      state.restaurantReviews = [...state.restaurantReviews, ...action.payload];
      state.error = null;
    },
    appendFoodReviews(state, action) {
      state.foodReviews = [...state.foodReviews, ...action.payload];
      state.error = null;
    },
    removeRestaurantReview(state, action) {
      state.restaurantReviews = state.restaurantReviews.filter(
        (review) => String(review._id) !== String(action.payload)
      );
      state.error = null;
    },
    removeFoodReview(state, action) {
      state.foodReviews = state.foodReviews.filter(
        (review) => String(review._id) !== String(action.payload)
      );
      state.error = null;
    },
  },
});

export const {
  setLoading,
  setError,
  setRestaurantReviews,
  setFoodReviews,
  appendRestaurantReviews,
  appendFoodReviews,
  removeRestaurantReview,
  removeFoodReview,
} = reviewSlice.actions;

export const fetchRestaurantReviews =
  (params = {}) =>
  async (dispatch) => {
    dispatch(setLoading(true));
    dispatch(setError(null));
    try {
      const response = await restaurantReviewApi.getAll(params);
      dispatch(
        setRestaurantReviews({
          reviews: response.data?.reviews || [],
          meta: response.data?.meta || null,
        })
      );
      return response;
    } catch (error) {
      dispatch(
        setError(error.response?.data?.message || "Failed to load restaurant reviews.")
      );
      throw error;
    } finally {
      dispatch(setLoading(false));
    }
  };

export const fetchRestaurantReviewsByRestaurant =
  (restaurantId, params = {}) =>
  async (dispatch) => {
    dispatch(setLoading(true));
    dispatch(setError(null));
    try {
      const response = await restaurantReviewApi.getByRestaurant(
        restaurantId,
        params
      );
      dispatch(
        setRestaurantReviews({
          reviews: response.data?.reviews || [],
          meta: response.data?.meta || null,
        })
      );
      return response;
    } catch (error) {
      dispatch(
        setError(error.response?.data?.message || "Failed to load restaurant reviews.")
      );
      throw error;
    } finally {
      dispatch(setLoading(false));
    }
  };

export const updateRestaurantReview =
  (reviewId, data) => async (dispatch) => {
    dispatch(setLoading(true));
    dispatch(setError(null));
    try {
      const response = await restaurantReviewApi.update(reviewId, data);
      return response;
    } catch (error) {
      dispatch(
        setError(error.response?.data?.message || "Failed to update restaurant review.")
      );
      throw error;
    } finally {
      dispatch(setLoading(false));
    }
  };

export const deleteRestaurantReview = (reviewId) => async (dispatch) => {
  dispatch(setLoading(true));
  dispatch(setError(null));
  try {
    const response = await restaurantReviewApi.remove(reviewId);
    dispatch(removeRestaurantReview(reviewId));
    return response;
  } catch (error) {
    dispatch(
      setError(error.response?.data?.message || "Failed to delete restaurant review.")
    );
    throw error;
  } finally {
    dispatch(setLoading(false));
  }
};

export const fetchFoodReviews =
  (params = {}) =>
  async (dispatch) => {
    dispatch(setLoading(true));
    dispatch(setError(null));
    try {
      const response = await foodReviewApi.getAll(params);
      dispatch(
        setFoodReviews({
          reviews: response.data?.reviews || [],
          meta: response.data?.meta || null,
        })
      );
      return response;
    } catch (error) {
      dispatch(
        setError(error.response?.data?.message || "Failed to load food reviews.")
      );
      throw error;
    } finally {
      dispatch(setLoading(false));
    }
  };

export const fetchFoodReviewsByRestaurant =
  (restaurantId, params = {}) =>
  async (dispatch) => {
    dispatch(setLoading(true));
    dispatch(setError(null));
    try {
      const response = await foodReviewApi.getByRestaurant(restaurantId, params);
      dispatch(
        setFoodReviews({
          reviews: response.data?.reviews || [],
          meta: response.data?.meta || null,
        })
      );
      return response;
    } catch (error) {
      dispatch(
        setError(error.response?.data?.message || "Failed to load food reviews.")
      );
      throw error;
    } finally {
      dispatch(setLoading(false));
    }
  };

export const fetchFoodReviewsByFood =
  (foodId, params = {}) =>
  async (dispatch) => {
    dispatch(setLoading(true));
    dispatch(setError(null));
    try {
      const response = await foodReviewApi.getByFood(foodId, params);
      dispatch(
        setFoodReviews({
          reviews: response.data?.reviews || [],
          meta: response.data?.meta || null,
        })
      );
      return response;
    } catch (error) {
      dispatch(
        setError(error.response?.data?.message || "Failed to load food reviews.")
      );
      throw error;
    } finally {
      dispatch(setLoading(false));
    }
  };

export const updateFoodReview = (reviewId, data) => async (dispatch) => {
  dispatch(setLoading(true));
  dispatch(setError(null));
  try {
    const response = await foodReviewApi.update(reviewId, data);
    return response;
  } catch (error) {
    dispatch(
      setError(error.response?.data?.message || "Failed to update food review.")
    );
    throw error;
  } finally {
    dispatch(setLoading(false));
  }
};

export const deleteFoodReview = (reviewId) => async (dispatch) => {
  dispatch(setLoading(true));
  dispatch(setError(null));
  try {
    const response = await foodReviewApi.remove(reviewId);
    dispatch(removeFoodReview(reviewId));
    return response;
  } catch (error) {
    dispatch(
      setError(error.response?.data?.message || "Failed to delete food review.")
    );
    throw error;
  } finally {
    dispatch(setLoading(false));
  }
};

export default reviewSlice.reducer;

import { createSlice } from "@reduxjs/toolkit";
import { restaurantApi } from "../../api/restaurant.api.js";

const initialState = {
  restaurants: [],
  currentRestaurant: null,
  cities: [],
  meta: null,
  isLoading: false,
  error: null,
};

const restaurantSlice = createSlice({
  name: "restaurant",
  initialState,
  reducers: {
    setLoading(state, action) {
      state.isLoading = action.payload;
    },
    setError(state, action) {
      state.error = action.payload;
    },
    setRestaurants(state, action) {
      state.restaurants = action.payload.restaurants;
      state.meta = action.payload.meta;
      state.error = null;
    },
    setCurrentRestaurant(state, action) {
      state.currentRestaurant = action.payload;
      state.error = null;
    },
    setCities(state, action) {
      state.cities = action.payload;
    },
    clearCurrentRestaurant(state) {
      state.currentRestaurant = null;
    },
  },
});

export const {
  setLoading,
  setError,
  setRestaurants,
  setCurrentRestaurant,
  setCities,
  clearCurrentRestaurant,
} = restaurantSlice.actions;

export const fetchRestaurants = (params = {}) => async (dispatch) => {
  dispatch(setLoading(true));
  dispatch(setError(null));
  try {
    const response = await restaurantApi.getAll(params);
    dispatch(
      setRestaurants({
        restaurants: response.data?.restaurants || [],
        meta: response.data?.meta || null,
      })
    );
    return response;
  } catch (error) {
    dispatch(
      setError(error.response?.data?.message || "Failed to load restaurants.")
    );
    throw error;
  } finally {
    dispatch(setLoading(false));
  }
};

export const fetchRestaurantById = (restaurantId) => async (dispatch) => {
  dispatch(setLoading(true));
  dispatch(setError(null));
  try {
    const response = await restaurantApi.getById(restaurantId);
    dispatch(setCurrentRestaurant(response.data?.restaurant || response.data));
    return response;
  } catch (error) {
    dispatch(
      setError(error.response?.data?.message || "Failed to load restaurant.")
    );
    throw error;
  } finally {
    dispatch(setLoading(false));
  }
};

export const fetchCities = () => async (dispatch) => {
  const response = await restaurantApi.getCities();
  dispatch(setCities(response.data?.cities || []));
  return response;
};

export const createRestaurant = (data) => async (dispatch) => {
  dispatch(setLoading(true));
  dispatch(setError(null));
  try {
    const response = await restaurantApi.create(data);
    return response;
  } catch (error) {
    dispatch(
      setError(error.response?.data?.message || "Failed to create restaurant.")
    );
    throw error;
  } finally {
    dispatch(setLoading(false));
  }
};

export const updateRestaurant = (restaurantId, data) => async (dispatch) => {
  dispatch(setLoading(true));
  dispatch(setError(null));
  try {
    const response = await restaurantApi.update(restaurantId, data);
    return response;
  } catch (error) {
    dispatch(
      setError(error.response?.data?.message || "Failed to update restaurant.")
    );
    throw error;
  } finally {
    dispatch(setLoading(false));
  }
};

export const deleteRestaurant = (restaurantId) => async (dispatch) => {
  dispatch(setLoading(true));
  dispatch(setError(null));
  try {
    const response = await restaurantApi.remove(restaurantId);
    return response;
  } catch (error) {
    dispatch(
      setError(error.response?.data?.message || "Failed to delete restaurant.")
    );
    throw error;
  } finally {
    dispatch(setLoading(false));
  }
};

export const verifyRestaurant = (restaurantId, data) => async (dispatch) => {
  dispatch(setLoading(true));
  dispatch(setError(null));
  try {
    const response = await restaurantApi.verify(restaurantId, data);
    return response;
  } catch (error) {
    dispatch(
      setError(error.response?.data?.message || "Failed to verify restaurant.")
    );
    throw error;
  } finally {
    dispatch(setLoading(false));
  }
};

export default restaurantSlice.reducer;

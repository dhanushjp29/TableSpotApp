import { createSlice } from "@reduxjs/toolkit";
import { foodApi } from "../../api/food.api.js";

const initialState = {
  foods: [],
  currentFood: null,
  meta: null,
  isLoading: false,
  error: null,
};

const foodSlice = createSlice({
  name: "food",
  initialState,
  reducers: {
    setLoading(state, action) {
      state.isLoading = action.payload;
    },
    setError(state, action) {
      state.error = action.payload;
    },
    setFoods(state, action) {
      state.foods = action.payload.foods;
      state.meta = action.payload.meta;
      state.error = null;
    },
    setCurrentFood(state, action) {
      state.currentFood = action.payload;
      state.error = null;
    },
    clearCurrentFood(state) {
      state.currentFood = null;
    },
  },
});

export const {
  setLoading,
  setError,
  setFoods,
  setCurrentFood,
  clearCurrentFood,
} = foodSlice.actions;

export const fetchFoods = (params = {}) => async (dispatch) => {
  dispatch(setLoading(true));
  dispatch(setError(null));
  try {
    const response = await foodApi.getAll(params);
    dispatch(
      setFoods({
        foods: response.data?.foods || [],
        meta: response.data?.meta || null,
      })
    );
    return response;
  } catch (error) {
    dispatch(
      setError(error.response?.data?.message || "Failed to load food items.")
    );
    throw error;
  } finally {
    dispatch(setLoading(false));
  }
};

export const fetchFoodsByRestaurant =
  (restaurantId, params = {}) =>
  async (dispatch) => {
    dispatch(setLoading(true));
    dispatch(setError(null));
    try {
      const response = await foodApi.getByRestaurant(restaurantId, params);
      dispatch(
        setFoods({
          foods: response.data?.foods || [],
          meta: response.data?.meta || null,
        })
      );
      return response;
    } catch (error) {
      dispatch(
        setError(error.response?.data?.message || "Failed to load food items.")
      );
      throw error;
    } finally {
      dispatch(setLoading(false));
    }
  };

export const fetchFoodById = (foodId) => async (dispatch) => {
  dispatch(setLoading(true));
  dispatch(setError(null));
  try {
    const response = await foodApi.getById(foodId);
    dispatch(setCurrentFood(response.data?.food || response.data));
    return response;
  } catch (error) {
    dispatch(setError(error.response?.data?.message || "Failed to load food item."));
    throw error;
  } finally {
    dispatch(setLoading(false));
  }
};

export const createFood = (data) => async (dispatch) => {
  dispatch(setLoading(true));
  dispatch(setError(null));
  try {
    const response = await foodApi.create(data);
    return response;
  } catch (error) {
    dispatch(setError(error.response?.data?.message || "Failed to create food item."));
    throw error;
  } finally {
    dispatch(setLoading(false));
  }
};

export const updateFood = (foodId, data) => async (dispatch) => {
  dispatch(setLoading(true));
  dispatch(setError(null));
  try {
    const response = await foodApi.update(foodId, data);
    return response;
  } catch (error) {
    dispatch(setError(error.response?.data?.message || "Failed to update food item."));
    throw error;
  } finally {
    dispatch(setLoading(false));
  }
};

export const deleteFood = (foodId) => async (dispatch) => {
  dispatch(setLoading(true));
  dispatch(setError(null));
  try {
    const response = await foodApi.remove(foodId);
    return response;
  } catch (error) {
    dispatch(setError(error.response?.data?.message || "Failed to delete food item."));
    throw error;
  } finally {
    dispatch(setLoading(false));
  }
};

export default foodSlice.reducer;

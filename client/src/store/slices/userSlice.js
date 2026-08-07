import { createSlice } from "@reduxjs/toolkit";
import { userApi } from "../../api/user.api.js";
import { authApi } from "../../api/auth.api.js";

const initialState = {
  profile: null,
  users: [],
  meta: null,
  favoriteRestaurants: [],
  favoriteFoods: [],
  isLoading: false,
  error: null,
};

const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
    setLoading(state, action) {
      state.isLoading = action.payload;
    },
    setError(state, action) {
      state.error = action.payload;
    },
    setProfile(state, action) {
      state.profile = action.payload;
      state.error = null;
    },
    setUsers(state, action) {
      state.users = action.payload.users;
      state.meta = action.payload.meta;
      state.error = null;
    },
    setFavoriteRestaurants(state, action) {
      state.favoriteRestaurants = action.payload;
      state.error = null;
    },
    setFavoriteFoods(state, action) {
      state.favoriteFoods = action.payload;
      state.error = null;
    },
  },
});

export const {
  setLoading,
  setError,
  setProfile,
  setUsers,
  setFavoriteRestaurants,
  setFavoriteFoods,
} = userSlice.actions;

export const fetchProfile = () => async (dispatch) => {
  dispatch(setLoading(true));
  dispatch(setError(null));
  try {
    const response = await userApi.getProfile();
    dispatch(setProfile(response.data?.user || response.data));
    return response;
  } catch (error) {
    dispatch(setError(error.response?.data?.message || "Failed to load profile."));
    throw error;
  } finally {
    dispatch(setLoading(false));
  }
};

export const updateProfile = (data) => async (dispatch) => {
  dispatch(setLoading(true));
  dispatch(setError(null));
  try {
    const response = await userApi.updateProfile(data);
    dispatch(setProfile(response.data?.user || response.data));
    return response;
  } catch (error) {
    dispatch(setError(error.response?.data?.message || "Failed to update profile."));
    throw error;
  } finally {
    dispatch(setLoading(false));
  }
};

export const changePassword = (data) => async () => {
  return authApi.changePassword(data);
};

export const fetchUsers = (params = {}) => async (dispatch) => {
  dispatch(setLoading(true));
  dispatch(setError(null));
  try {
    const response = await userApi.getAll(params);
    dispatch(
      setUsers({
        users: response.data?.users || [],
        meta: response.data?.meta || null,
      })
    );
    return response;
  } catch (error) {
    dispatch(setError(error.response?.data?.message || "Failed to load users."));
    throw error;
  } finally {
    dispatch(setLoading(false));
  }
};

export const toggleUserActive = (userId, data = {}) => async (dispatch) => {
  dispatch(setLoading(true));
  dispatch(setError(null));
  try {
    const response = await userApi.toggleActive(userId, data);
    return response;
  } catch (error) {
    dispatch(
      setError(error.response?.data?.message || "Failed to update user status.")
    );
    throw error;
  } finally {
    dispatch(setLoading(false));
  }
};

export const deleteUser = (userId) => async (dispatch) => {
  dispatch(setLoading(true));
  dispatch(setError(null));
  try {
    const response = await userApi.remove(userId);
    return response;
  } catch (error) {
    dispatch(setError(error.response?.data?.message || "Failed to delete user."));
    throw error;
  } finally {
    dispatch(setLoading(false));
  }
};

export const fetchFavoriteRestaurants = () => async (dispatch) => {
  dispatch(setLoading(true));
  dispatch(setError(null));
  try {
    const response = await userApi.getFavoriteRestaurants();
    dispatch(
      setFavoriteRestaurants(
        response.data?.restaurants || response.data?.favorites || response.data || []
      )
    );
    return response;
  } catch (error) {
    dispatch(setError(error.response?.data?.message || "Failed to load favorites."));
    throw error;
  } finally {
    dispatch(setLoading(false));
  }
};

export const fetchFavoriteFoods = () => async (dispatch) => {
  dispatch(setLoading(true));
  dispatch(setError(null));
  try {
    const response = await userApi.getFavoriteFoods();
    dispatch(
      setFavoriteFoods(
        response.data?.foods || response.data?.favorites || response.data || []
      )
    );
    return response;
  } catch (error) {
    dispatch(setError(error.response?.data?.message || "Failed to load favorite foods."));
    throw error;
  } finally {
    dispatch(setLoading(false));
  }
};

export const toggleFavorite = (restaurantId) => async (dispatch) => {
  try {
    const response = await userApi.toggleFavorite(restaurantId);
    await dispatch(fetchFavoriteRestaurants());
    return response;
  } catch (error) {
    dispatch(setError(error.response?.data?.message || "Failed to toggle favorite."));
    throw error;
  }
};

export const toggleFavoriteFood = (foodId) => async (dispatch) => {
  try {
    const response = await userApi.toggleFavoriteFood(foodId);
    await dispatch(fetchFavoriteFoods());
    return response;
  } catch (error) {
    dispatch(setError(error.response?.data?.message || "Failed to toggle favorite food."));
    throw error;
  }
};

export default userSlice.reducer;

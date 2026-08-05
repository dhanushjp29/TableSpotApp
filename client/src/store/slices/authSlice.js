import { createSlice } from "@reduxjs/toolkit";
import { authApi } from "../../api/auth.api.js";
import { storage } from "../../utils/storage.js";

const initialUser = storage.get("user");

const initialState = {
  user: initialUser,
  isAuthenticated: Boolean(initialUser),
  isInitialized: false,
  isLoading: false,
  error: null,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setLoading(state, action) {
      state.isLoading = action.payload;
    },
    setError(state, action) {
      state.error = action.payload;
    },
    setAuthenticated(state, action) {
      state.user = action.payload;
      state.isAuthenticated = Boolean(action.payload);
      state.error = null;
      if (action.payload) {
        storage.set("user", action.payload);
      } else {
        storage.remove("user");
      }
    },
    setInitialized(state) {
      state.isInitialized = true;
    },
    clearAuth(state) {
      state.user = null;
      state.isAuthenticated = false;
      state.isInitialized = true;
      state.error = null;
      storage.remove("user");
      storage.remove("refreshToken");
    },
  },
});

export const { setLoading, setError, setAuthenticated, setInitialized, clearAuth } =
  authSlice.actions;

/**
 * Initialize auth on app load.
 * If a refresh token exists in storage, verify the session by calling /auth/me.
 * This prevents redirecting to login before the session check completes.
 */
export const initializeAuth = () => async (dispatch) => {
  const refreshToken = storage.get("refreshToken");

  if (!refreshToken) {
    dispatch(setInitialized());
    return;
  }

  dispatch(setLoading(true));
  try {
    const response = await authApi.getMe();
    dispatch(setAuthenticated(response.data?.user || response.data));
  } catch {
    // Session expired or invalid - clear auth state
    dispatch(clearAuth());
  } finally {
    dispatch(setLoading(false));
    dispatch(setInitialized());
  }
};

// Async thunks
export const loginUser = (data) => async (dispatch) => {
  dispatch(setLoading(true));
  dispatch(setError(null));
  try {
    const response = await authApi.login(data);
    dispatch(setAuthenticated(response.data.user));
    return response;
  } catch (error) {
    const message =
      error.response?.data?.message || "Login failed. Please try again.";
    dispatch(setError(message));
    throw error;
  } finally {
    dispatch(setLoading(false));
  }
};

export const googleLoginUser = (data) => async (dispatch) => {
  dispatch(setLoading(true));
  dispatch(setError(null));
  try {
    const response = await authApi.googleLogin(data);
    dispatch(setAuthenticated(response.data.user));
    return response;
  } catch (error) {
    const message =
      error.response?.data?.message || "Google login failed. Please try again.";
    dispatch(setError(message));
    throw error;
  } finally {
    dispatch(setLoading(false));
  }
};

export const registerUser = (data) => async (dispatch) => {
  dispatch(setLoading(true));
  dispatch(setError(null));
  try {
    const response = await authApi.register(data);
    return response;
  } catch (error) {
    const message =
      error.response?.data?.message || "Registration failed. Please try again.";
    dispatch(setError(message));
    throw error;
  } finally {
    dispatch(setLoading(false));
  }
};

export const logoutUser = () => async (dispatch) => {
  try {
    await authApi.logout();
  } catch {
    // Ignore logout errors - always clear local state
  } finally {
    dispatch(clearAuth());
  }
};

export const fetchCurrentUser = () => async (dispatch) => {
  dispatch(setLoading(true));
  try {
    const response = await authApi.getMe();
    dispatch(setAuthenticated(response.data?.user || response.data));
    return response;
  } catch (error) {
    const message =
      error.response?.data?.message || "Failed to fetch user.";
    dispatch(setError(message));
    dispatch(clearAuth());
    throw error;
  } finally {
    dispatch(setLoading(false));
  }
};

export default authSlice.reducer;

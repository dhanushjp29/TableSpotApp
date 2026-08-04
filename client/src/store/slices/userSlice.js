import { createSlice } from "@reduxjs/toolkit";
import { userApi } from "../../api/user.api.js";
import { authApi } from "../../api/auth.api.js";

const initialState = {
  profile: null,
  users: [],
  meta: null,
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
  },
});

export const { setLoading, setError, setProfile, setUsers } =
  userSlice.actions;

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

export default userSlice.reducer;

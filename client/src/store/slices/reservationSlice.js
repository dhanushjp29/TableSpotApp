import { createSlice } from "@reduxjs/toolkit";
import { bookingApi } from "../../api/booking.api.js";

const initialState = {
  bookings: [],
  currentBooking: null,
  bill: null,
  meta: null,
  isLoading: false,
  error: null,
};

const reservationSlice = createSlice({
  name: "reservation",
  initialState,
  reducers: {
    setLoading(state, action) {
      state.isLoading = action.payload;
    },
    setError(state, action) {
      state.error = action.payload;
    },
    setBookings(state, action) {
      state.bookings = action.payload.bookings;
      state.meta = action.payload.meta;
      state.error = null;
    },
    setCurrentBooking(state, action) {
      state.currentBooking = action.payload;
      state.error = null;
    },
    setBill(state, action) {
      state.bill = action.payload;
      state.error = null;
    },
    clearCurrentBooking(state) {
      state.currentBooking = null;
      state.bill = null;
    },
  },
});

export const {
  setLoading,
  setError,
  setBookings,
  setCurrentBooking,
  setBill,
  clearCurrentBooking,
} = reservationSlice.actions;

export const fetchBookings = (params = {}) => async (dispatch) => {
  dispatch(setLoading(true));
  dispatch(setError(null));
  try {
    const response = await bookingApi.getAll(params);
    dispatch(
      setBookings({
        bookings: response.data?.bookings || [],
        meta: response.data?.meta || null,
      })
    );
    return response;
  } catch (error) {
    dispatch(
      setError(error.response?.data?.message || "Failed to load bookings.")
    );
    throw error;
  } finally {
    dispatch(setLoading(false));
  }
};

export const fetchBookingById = (bookingId) => async (dispatch) => {
  dispatch(setLoading(true));
  dispatch(setError(null));
  try {
    const response = await bookingApi.getById(bookingId);
    dispatch(setCurrentBooking(response.data?.booking || response.data));
    return response;
  } catch (error) {
    dispatch(
      setError(error.response?.data?.message || "Failed to load booking.")
    );
    throw error;
  } finally {
    dispatch(setLoading(false));
  }
};

export const createBooking = (data) => async (dispatch) => {
  dispatch(setLoading(true));
  dispatch(setError(null));
  try {
    const response = await bookingApi.create(data);
    return response;
  } catch (error) {
    dispatch(
      setError(error.response?.data?.message || "Failed to create booking.")
    );
    throw error;
  } finally {
    dispatch(setLoading(false));
  }
};

export const updateBookingStatus = (bookingId, data) => async (dispatch) => {
  dispatch(setLoading(true));
  dispatch(setError(null));
  try {
    const response = await bookingApi.updateStatus(bookingId, data);
    return response;
  } catch (error) {
    dispatch(
      setError(error.response?.data?.message || "Failed to update booking status.")
    );
    throw error;
  } finally {
    dispatch(setLoading(false));
  }
};

export const cancelBooking = (bookingId, data = {}) => async (dispatch) => {
  dispatch(setLoading(true));
  dispatch(setError(null));
  try {
    const response = await bookingApi.cancel(bookingId, data);
    return response;
  } catch (error) {
    dispatch(
      setError(error.response?.data?.message || "Failed to cancel booking.")
    );
    throw error;
  } finally {
    dispatch(setLoading(false));
  }
};

export default reservationSlice.reducer;

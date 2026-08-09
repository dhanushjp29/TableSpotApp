import { createSlice } from "@reduxjs/toolkit";
import { paymentApi } from "../../api/payment.api.js";

const initialState = {
  transactions: [],
  summary: {},
  isLoading: false,
  error: null,
};

const paymentSlice = createSlice({
  name: "payment",
  initialState,
  reducers: {
    setLoading(state, action) {
      state.isLoading = action.payload;
    },
    setError(state, action) {
      state.error = action.payload;
    },
    setHistory(state, action) {
      state.transactions = action.payload.transactions;
      state.summary = action.payload.summary;
      state.error = null;
    },
  },
});

export const { setLoading, setError, setHistory } = paymentSlice.actions;

export const fetchPaymentHistory = (params = {}) => async (dispatch) => {
  dispatch(setLoading(true));
  dispatch(setError(null));
  try {
    const response = await paymentApi.getHistory(params);
    const payload = response?.data?.data || response?.data || {};
    dispatch(
      setHistory({
        transactions: payload.transactions || [],
        summary: payload.summary || {},
      })
    );
    return response;
  } catch (error) {
    dispatch(
      setError(error.response?.data?.message || "Failed to load payment history.")
    );
    throw error;
  } finally {
    dispatch(setLoading(false));
  }
};

export default paymentSlice.reducer;

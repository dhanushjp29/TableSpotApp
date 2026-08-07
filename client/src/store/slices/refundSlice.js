import { createSlice } from "@reduxjs/toolkit";
import { refundApi } from "../../api/refund.api.js";

const initialState = {
  refunds: [],
  currentRefund: null,
  meta: null,
  isLoading: false,
  error: null,
};

const refundSlice = createSlice({
  name: "refund",
  initialState,
  reducers: {
    setLoading(state, action) {
      state.isLoading = action.payload;
    },
    setError(state, action) {
      state.error = action.payload;
    },
    setRefunds(state, action) {
      state.refunds = action.payload.refunds;
      state.meta = action.payload.meta;
      state.error = null;
    },
    setCurrentRefund(state, action) {
      state.currentRefund = action.payload;
      state.error = null;
    },
    clearCurrentRefund(state) {
      state.currentRefund = null;
    },
  },
});

export const {
  setLoading,
  setError,
  setRefunds,
  setCurrentRefund,
  clearCurrentRefund,
} = refundSlice.actions;

export const fetchRefunds = (params = {}) => async (dispatch) => {
  dispatch(setLoading(true));
  dispatch(setError(null));
  try {
    const response = await refundApi.getAll(params);
    dispatch(
      setRefunds({
        refunds: response.data?.refunds || [],
        meta: response.data?.meta || null,
      })
    );
    return response;
  } catch (error) {
    dispatch(
      setError(error.response?.data?.message || "Failed to load refunds.")
    );
    throw error;
  } finally {
    dispatch(setLoading(false));
  }
};

export const fetchRefundById = (refundId) => async (dispatch) => {
  dispatch(setLoading(true));
  dispatch(setError(null));
  try {
    const response = await refundApi.getById(refundId);
    dispatch(setCurrentRefund(response.data?.refund || response.data));
    return response;
  } catch (error) {
    dispatch(setError(error.response?.data?.message || "Failed to load refund."));
    throw error;
  } finally {
    dispatch(setLoading(false));
  }
};

export const processRefund = (refundId, refundMethod) => async (dispatch) => {
  dispatch(setLoading(true));
  dispatch(setError(null));
  try {
    const response = await refundApi.process(refundId, refundMethod);
    return response;
  } catch (error) {
    dispatch(
      setError(error.response?.data?.message || "Failed to process refund.")
    );
    throw error;
  } finally {
    dispatch(setLoading(false));
  }
};

export const confirmRefundReceipt = (refundId) => async (dispatch) => {
  dispatch(setLoading(true));
  dispatch(setError(null));
  try {
    const response = await refundApi.confirmReceipt(refundId);
    return response;
  } catch (error) {
    dispatch(
      setError(error.response?.data?.message || "Failed to confirm refund receipt.")
    );
    throw error;
  } finally {
    dispatch(setLoading(false));
  }
};

export const disputeRefund = (refundId, disputeReason) => async (dispatch) => {
  dispatch(setLoading(true));
  dispatch(setError(null));
  try {
    const response = await refundApi.dispute(refundId, disputeReason);
    return response;
  } catch (error) {
    dispatch(
      setError(error.response?.data?.message || "Failed to dispute refund.")
    );
    throw error;
  } finally {
    dispatch(setLoading(false));
  }
};

export default refundSlice.reducer;

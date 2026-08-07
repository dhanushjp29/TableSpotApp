import { createSlice } from "@reduxjs/toolkit";
import { billApi } from "../../api/bill.api.js";

const initialState = {
  bills: [],
  currentBill: null,
  meta: null,
  isLoading: false,
  error: null,
};

const billSlice = createSlice({
  name: "bill",
  initialState,
  reducers: {
    setLoading(state, action) {
      state.isLoading = action.payload;
    },
    setError(state, action) {
      state.error = action.payload;
    },
    setBills(state, action) {
      state.bills = action.payload.bills;
      state.meta = action.payload.meta;
      state.error = null;
    },
    setCurrentBill(state, action) {
      state.currentBill = action.payload;
      state.error = null;
    },
    clearCurrentBill(state) {
      state.currentBill = null;
    },
  },
});

export const {
  setLoading,
  setError,
  setBills,
  setCurrentBill,
  clearCurrentBill,
} = billSlice.actions;

export const fetchBills = (params = {}) => async (dispatch) => {
  dispatch(setLoading(true));
  dispatch(setError(null));
  try {
    const response = await billApi.getAll(params);
    dispatch(
      setBills({
        bills: response.data?.bills || [],
        meta: response.data?.meta || null,
      })
    );
    return response;
  } catch (error) {
    dispatch(
      setError(error.response?.data?.message || "Failed to load bills.")
    );
    throw error;
  } finally {
    dispatch(setLoading(false));
  }
};

export const fetchBillById = (billId) => async (dispatch) => {
  dispatch(setLoading(true));
  dispatch(setError(null));
  try {
    const response = await billApi.getById(billId);
    dispatch(setCurrentBill(response.data?.bill || response.data));
    return response;
  } catch (error) {
    dispatch(setError(error.response?.data?.message || "Failed to load bill."));
    throw error;
  } finally {
    dispatch(setLoading(false));
  }
};

export const convertBookingToBill =
  (bookingId, data = {}) =>
  async (dispatch) => {
    dispatch(setLoading(true));
    dispatch(setError(null));
    try {
      const response = await billApi.convertToBill(bookingId, data);
      dispatch(setCurrentBill(response.data?.bill || response.data));
      return response;
    } catch (error) {
      dispatch(
        setError(error.response?.data?.message || "Failed to convert booking to bill.")
      );
      throw error;
    } finally {
      dispatch(setLoading(false));
    }
  };

export const createBill = (data) => async (dispatch) => {
  dispatch(setLoading(true));
  dispatch(setError(null));
  try {
    const response = await billApi.create(data);
    return response;
  } catch (error) {
    dispatch(setError(error.response?.data?.message || "Failed to create bill."));
    throw error;
  } finally {
    dispatch(setLoading(false));
  }
};

export const updateBill = (billId, data) => async (dispatch) => {
  dispatch(setLoading(true));
  dispatch(setError(null));
  try {
    const response = await billApi.update(billId, data);
    return response;
  } catch (error) {
    dispatch(setError(error.response?.data?.message || "Failed to update bill."));
    throw error;
  } finally {
    dispatch(setLoading(false));
  }
};

export const addBillPayment = (billId, data) => async (dispatch) => {
  dispatch(setLoading(true));
  dispatch(setError(null));
  try {
    const response = await billApi.addPayment(billId, data);
    return response;
  } catch (error) {
    dispatch(
      setError(error.response?.data?.message || "Failed to add bill payment.")
    );
    throw error;
  } finally {
    dispatch(setLoading(false));
  }
};

export const markBillStatus = (billId, data) => async (dispatch) => {
  dispatch(setLoading(true));
  dispatch(setError(null));
  try {
    const response = await billApi.markStatus(billId, data);
    return response;
  } catch (error) {
    dispatch(
      setError(error.response?.data?.message || "Failed to update bill status.")
    );
    throw error;
  } finally {
    dispatch(setLoading(false));
  }
};

export default billSlice.reducer;

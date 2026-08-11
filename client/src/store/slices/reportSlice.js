import { createSlice } from "@reduxjs/toolkit";
import {
  restaurantReportApi,
  restaurantWarningApi,
} from "../../api/report.api.js";

const initialState = {
  reports: [],
  warnings: [],
  reportCounts: null,
  warningCounts: null,
  meta: null,
  isLoading: false,
  error: null,
};

const reportSlice = createSlice({
  name: "report",
  initialState,
  reducers: {
    setLoading(state, action) {
      state.isLoading = action.payload;
    },
    setError(state, action) {
      state.error = action.payload;
    },
    setReports(state, action) {
      state.reports = action.payload.reports;
      state.reportCounts = action.payload.counts || null;
      state.meta = action.payload.meta;
      state.error = null;
    },
    setWarnings(state, action) {
      state.warnings = action.payload.warnings;
      state.warningCounts = action.payload.counts || null;
      state.meta = action.payload.meta;
      state.error = null;
    },
  },
});

export const { setLoading, setError, setReports, setWarnings } =
  reportSlice.actions;

export const fetchReports =
  (params = {}) =>
  async (dispatch) => {
    dispatch(setLoading(true));
    dispatch(setError(null));
    try {
      const response = await restaurantReportApi.getAll(params);
      dispatch(
        setReports({
          reports: response.data?.reports || [],
          counts: response.data?.counts || null,
          meta: response.data?.meta || null,
        })
      );
      return response;
    } catch (error) {
      dispatch(
        setError(
          error.response?.data?.message || "Failed to load restaurant reports."
        )
      );
      throw error;
    } finally {
      dispatch(setLoading(false));
    }
  };

export const updateReportStatus =
  (reportId, data) => async (dispatch) => {
    dispatch(setLoading(true));
    dispatch(setError(null));
    try {
      const response = await restaurantReportApi.updateStatus(reportId, data);
      return response;
    } catch (error) {
      dispatch(
        setError(
          error.response?.data?.message || "Failed to update report status."
        )
      );
      throw error;
    } finally {
      dispatch(setLoading(false));
    }
  };

export const issueWarning = (data) => async (dispatch) => {
  dispatch(setLoading(true));
  dispatch(setError(null));
  try {
    const response = await restaurantWarningApi.create(data);
    return response;
  } catch (error) {
    dispatch(
      setError(
        error.response?.data?.message || "Failed to issue restaurant warning."
      )
    );
    throw error;
  } finally {
    dispatch(setLoading(false));
  }
};

export const updateWarning = (warningId, data) => async (dispatch) => {
  dispatch(setLoading(true));
  dispatch(setError(null));
  try {
    const response = await restaurantWarningApi.update(warningId, data);
    return response;
  } catch (error) {
    dispatch(
      setError(
        error.response?.data?.message || "Failed to update restaurant warning."
      )
    );
    throw error;
  } finally {
    dispatch(setLoading(false));
  }
};

export const fetchWarnings =
  (params = {}) =>
  async (dispatch) => {
    dispatch(setLoading(true));
    dispatch(setError(null));
    try {
      const response = await restaurantWarningApi.getAll(params);
      dispatch(
        setWarnings({
          warnings: response.data?.warnings || [],
          counts: response.data?.counts || null,
          meta: response.data?.meta || null,
        })
      );
      return response;
    } catch (error) {
      dispatch(
        setError(
          error.response?.data?.message || "Failed to load restaurant warnings."
        )
      );
      throw error;
    } finally {
      dispatch(setLoading(false));
    }
  };

export const replyToWarning = (warningId, message) => async (dispatch) => {
  dispatch(setLoading(true));
  dispatch(setError(null));
  try {
    const response = await restaurantWarningApi.reply(warningId, message);
    return response;
  } catch (error) {
    dispatch(
      setError(
        error.response?.data?.message || "Failed to reply to the warning."
      )
    );
    throw error;
  } finally {
    dispatch(setLoading(false));
  }
};

export default reportSlice.reducer;
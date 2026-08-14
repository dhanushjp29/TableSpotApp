import { createSlice } from "@reduxjs/toolkit";
import { reconciliationApi } from "../../api/reconciliation.api.js";

const initialState = {
  reconciliations: [],
  worker: null,
  counts: null,
  meta: null,
  isLoading: false,
  actionLoadingId: null,
  error: null,
};

const reconciliationSlice = createSlice({
  name: "reconciliation",
  initialState,
  reducers: {
    setLoading(state, action) {
      state.isLoading = action.payload;
    },
    setActionLoadingId(state, action) {
      state.actionLoadingId = action.payload;
    },
    setError(state, action) {
      state.error = action.payload;
    },
    setReconciliations(state, action) {
      state.reconciliations = action.payload.reconciliations;
      state.meta = action.payload.meta;
      state.error = null;
    },
    setStatus(state, action) {
      state.worker = action.payload.worker;
      state.counts = action.payload.counts;
    },
    patchReconciliation(state, action) {
      const updated = action.payload;
      state.reconciliations = state.reconciliations.map((r) =>
        r._id === updated._id ? { ...r, ...updated } : r
      );
    },
  },
});

export const {
  setLoading,
  setActionLoadingId,
  setError,
  setReconciliations,
  setStatus,
  patchReconciliation,
} = reconciliationSlice.actions;

export const fetchReconciliations = (params = {}) => async (dispatch) => {
  dispatch(setLoading(true));
  dispatch(setError(null));
  try {
    const response = await reconciliationApi.getAll(params);
    dispatch(
      setReconciliations({
        reconciliations: response.data?.reconciliations || [],
        meta: response.data?.meta || null,
      })
    );
    return response;
  } catch (error) {
    dispatch(
      setError(
        error.response?.data?.message || "Failed to load reconciliation records."
      )
    );
    throw error;
  } finally {
    dispatch(setLoading(false));
  }
};

export const fetchReconciliationStatus = () => async (dispatch) => {
  try {
    const response = await reconciliationApi.getStatus();
    dispatch(setStatus(response.data || {}));
    return response;
  } catch {
    return null;
  }
};

export const runReconciliationAction =
  ({ id, action }) =>
  async (dispatch) => {
    dispatch(setActionLoadingId(id));
    dispatch(setError(null));
    try {
      let response;
      if (action === "retry") response = await reconciliationApi.retry(id);
      if (action === "refund") response = await reconciliationApi.refund(id);
      if (action === "close")
        response = await reconciliationApi.close(id, undefined);
      const updated = response?.data?.reconciliation || response?.data;
      if (updated?._id) {
        dispatch(patchReconciliation(updated));
      }
      return response;
    } catch (error) {
      dispatch(
        setError(
          error.response?.data?.message || "Failed to update reconciliation."
        )
      );
      throw error;
    } finally {
      dispatch(setActionLoadingId(null));
    }
  };

export default reconciliationSlice.reducer;

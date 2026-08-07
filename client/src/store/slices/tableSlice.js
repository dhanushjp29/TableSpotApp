import { createSlice } from "@reduxjs/toolkit";
import { tableApi } from "../../api/table.api.js";

const initialState = {
  tables: [],
  currentTable: null,
  meta: null,
  isLoading: false,
  error: null,
};

const tableSlice = createSlice({
  name: "table",
  initialState,
  reducers: {
    setLoading(state, action) {
      state.isLoading = action.payload;
    },
    setError(state, action) {
      state.error = action.payload;
    },
    setTables(state, action) {
      state.tables = action.payload.tables;
      state.meta = action.payload.meta;
      state.error = null;
    },
    setCurrentTable(state, action) {
      state.currentTable = action.payload;
      state.error = null;
    },
    clearCurrentTable(state) {
      state.currentTable = null;
    },
  },
});

export const {
  setLoading,
  setError,
  setTables,
  setCurrentTable,
  clearCurrentTable,
} = tableSlice.actions;

export const fetchTables = (params = {}) => async (dispatch) => {
  dispatch(setLoading(true));
  dispatch(setError(null));
  try {
    const response = await tableApi.getAll(params);
    dispatch(
      setTables({
        tables: response.data?.tables || [],
        meta: response.data?.meta || null,
      })
    );
    return response;
  } catch (error) {
    dispatch(
      setError(error.response?.data?.message || "Failed to load tables.")
    );
    throw error;
  } finally {
    dispatch(setLoading(false));
  }
};

export const fetchTablesByRestaurant =
  (restaurantId, params = {}) =>
  async (dispatch) => {
    dispatch(setLoading(true));
    dispatch(setError(null));
    try {
      const response = await tableApi.getByRestaurant(restaurantId, params);
      dispatch(
        setTables({
          tables: response.data?.tables || [],
          meta: response.data?.meta || null,
        })
      );
      return response;
    } catch (error) {
      dispatch(
        setError(error.response?.data?.message || "Failed to load tables.")
      );
      throw error;
    } finally {
      dispatch(setLoading(false));
    }
  };

export const fetchTableById = (tableId) => async (dispatch) => {
  dispatch(setLoading(true));
  dispatch(setError(null));
  try {
    const response = await tableApi.getById(tableId);
    dispatch(setCurrentTable(response.data?.table || response.data));
    return response;
  } catch (error) {
    dispatch(setError(error.response?.data?.message || "Failed to load table."));
    throw error;
  } finally {
    dispatch(setLoading(false));
  }
};

export const createTable = (data) => async (dispatch) => {
  dispatch(setLoading(true));
  dispatch(setError(null));
  try {
    const response = await tableApi.create(data);
    return response;
  } catch (error) {
    dispatch(setError(error.response?.data?.message || "Failed to create table."));
    throw error;
  } finally {
    dispatch(setLoading(false));
  }
};

export const updateTable = (tableId, data) => async (dispatch) => {
  dispatch(setLoading(true));
  dispatch(setError(null));
  try {
    const response = await tableApi.update(tableId, data);
    return response;
  } catch (error) {
    dispatch(setError(error.response?.data?.message || "Failed to update table."));
    throw error;
  } finally {
    dispatch(setLoading(false));
  }
};

export const updateTableStatus = (tableId, data) => async (dispatch) => {
  dispatch(setLoading(true));
  dispatch(setError(null));
  try {
    const response = await tableApi.updateStatus(tableId, data);
    return response;
  } catch (error) {
    dispatch(
      setError(error.response?.data?.message || "Failed to update table status.")
    );
    throw error;
  } finally {
    dispatch(setLoading(false));
  }
};

export const updateSeatsStatus = (tableId, data) => async (dispatch) => {
  dispatch(setLoading(true));
  dispatch(setError(null));
  try {
    const response = await tableApi.updateSeatsStatus(tableId, data);
    return response;
  } catch (error) {
    dispatch(
      setError(error.response?.data?.message || "Failed to update seat status.")
    );
    throw error;
  } finally {
    dispatch(setLoading(false));
  }
};

export const deleteTable = (tableId) => async (dispatch) => {
  dispatch(setLoading(true));
  dispatch(setError(null));
  try {
    const response = await tableApi.remove(tableId);
    return response;
  } catch (error) {
    dispatch(setError(error.response?.data?.message || "Failed to delete table."));
    throw error;
  } finally {
    dispatch(setLoading(false));
  }
};

export default tableSlice.reducer;

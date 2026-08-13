import { createSlice } from "@reduxjs/toolkit";
import { notificationApi } from "../../api/notification.api.js";

const initialState = {
  notifications: [],
  unreadCount: 0,
  meta: null,
  socketEvent: null,
  isLoading: false,
  error: null,
};

const notificationSlice = createSlice({
  name: "notification",
  initialState,
  reducers: {
    setNotifications(state, action) {
      state.notifications = action.payload;
    },
    addNotification(state, action) {
      const notification = action.payload;
      if (!notification) return;
      const exists = state.notifications.some(
        (n) => String(n._id) === String(notification._id)
      );
      if (exists) return;
      state.notifications.unshift(notification);
      if (!notification.isRead) {
        state.unreadCount += 1;
      }
    },
    appendNotifications(state, action) {
      state.notifications = [...state.notifications, ...action.payload];
    },
    setMeta(state, action) {
      state.meta = action.payload;
    },
    markAllRead(state) {
      state.notifications = state.notifications.map((n) => ({
        ...n,
        isRead: true,
      }));
      state.unreadCount = 0;
    },
    markAsRead(state, action) {
      const id = String(action.payload);
      let foundUnread = false;
      state.notifications = state.notifications.map((n) => {
        if (String(n._id) !== id) return n;
        if (!n.isRead) foundUnread = true;
        return { ...n, isRead: true };
      });
      if (foundUnread) {
        state.unreadCount = Math.max(0, state.unreadCount - 1);
      }
    },
    setSocketEvent(state, action) {
      state.socketEvent = action.payload;
    },
    clearSocketEvent(state) {
      state.socketEvent = null;
    },
    setLoading(state, action) {
      state.isLoading = action.payload;
    },
    setError(state, action) {
      state.error = action.payload;
    },
    setUnreadCount(state, action) {
      state.unreadCount = action.payload;
    },
  },
});

export const {
  setNotifications,
  addNotification,
  appendNotifications,
  setMeta,
  markAllRead,
  markAsRead,
  setSocketEvent,
  clearSocketEvent,
  setLoading,
  setError,
  setUnreadCount,
} = notificationSlice.actions;

export const fetchNotifications = (params = {}) => async (dispatch) => {
  dispatch(setLoading(true));
  dispatch(setError(null));
  try {
    const response = await notificationApi.getAll(params);
    dispatch(
      setNotifications(
        response.data?.notifications || response.data || []
      )
    );
    dispatch(setMeta(response.data?.meta || null));
    return response;
  } catch (error) {
    dispatch(
      setError(error.response?.data?.message || "Failed to load notifications.")
    );
    throw error;
  } finally {
    dispatch(setLoading(false));
  }
};

export const fetchNotificationsMore = (params = {}) => async (dispatch) => {
  dispatch(setLoading(true));
  dispatch(setError(null));
  try {
    const response = await notificationApi.getAll(params);
    dispatch(appendNotifications(response.data?.notifications || []));
    dispatch(setMeta(response.data?.meta || null));
    return response;
  } catch (error) {
    dispatch(
      setError(error.response?.data?.message || "Failed to load notifications.")
    );
    throw error;
  } finally {
    dispatch(setLoading(false));
  }
};

export const fetchUnreadCount = () => async (dispatch) => {
  dispatch(setLoading(true));
  dispatch(setError(null));
  try {
    const response = await notificationApi.getUnreadCount();
    dispatch(
      setUnreadCount(
        Number(response.data?.count ?? response.data?.unreadCount ?? 0)
      )
    );
    return response;
  } catch (error) {
    dispatch(
      setError(error.response?.data?.message || "Failed to load unread count.")
    );
    throw error;
  } finally {
    dispatch(setLoading(false));
  }
};

export const markAsReadNotification =
  (notificationId) => async (dispatch) => {
    dispatch(setLoading(true));
    dispatch(setError(null));
    try {
      const response = await notificationApi.markAsRead(notificationId);
      dispatch(markAsRead(notificationId));
      return response;
    } catch (error) {
      dispatch(
        setError(error.response?.data?.message || "Failed to delete notification.")
      );
      throw error;
    } finally {
      dispatch(setLoading(false));
    }
  };

export const markAllAsRead = () => async (dispatch) => {
  dispatch(setLoading(true));
  dispatch(setError(null));
  try {
    const response = await notificationApi.markAllAsRead();
    dispatch(markAllRead());
    return response;
  } catch (error) {
    dispatch(
      setError(error.response?.data?.message || "Failed to clear notifications.")
    );
    throw error;
  } finally {
    dispatch(setLoading(false));
  }
};

export default notificationSlice.reducer;

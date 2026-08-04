import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  notifications: [],
  unreadCount: 0,
  socketEvent: null,
};

const notificationSlice = createSlice({
  name: "notification",
  initialState,
  reducers: {
    setNotifications(state, action) {
      state.notifications = action.payload;
      state.unreadCount = action.payload.filter((n) => !n.isRead).length;
    },
    addNotification(state, action) {
      state.notifications.unshift(action.payload);
      if (!action.payload.isRead) {
        state.unreadCount += 1;
      }
    },
    markAllRead(state) {
      state.notifications = state.notifications.map((n) => ({
        ...n,
        isRead: true,
        readAt: new Date().toISOString(),
      }));
      state.unreadCount = 0;
    },
    markAsRead(state, action) {
      const notification = state.notifications.find(
        (n) => String(n._id) === String(action.payload)
      );
      if (notification && !notification.isRead) {
        notification.isRead = true;
        notification.readAt = new Date().toISOString();
        state.unreadCount = Math.max(0, state.unreadCount - 1);
      }
    },
    setSocketEvent(state, action) {
      state.socketEvent = action.payload;
    },
    clearSocketEvent(state) {
      state.socketEvent = null;
    },
  },
});

export const {
  setNotifications,
  addNotification,
  markAllRead,
  markAsRead,
  setSocketEvent,
  clearSocketEvent,
} = notificationSlice.actions;

export default notificationSlice.reducer;

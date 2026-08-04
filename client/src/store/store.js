import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./slices/authSlice.js";
import userReducer from "./slices/userSlice.js";
import restaurantReducer from "./slices/restaurantSlice.js";
import reservationReducer from "./slices/reservationSlice.js";
import notificationReducer from "./slices/notificationSlice.js";
import uiReducer from "./slices/uiSlice.js";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    user: userReducer,
    restaurant: restaurantReducer,
    reservation: reservationReducer,
    notification: notificationReducer,
    ui: uiReducer,
  },
});

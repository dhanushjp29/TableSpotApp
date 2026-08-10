import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./slices/authSlice.js";
import userReducer from "./slices/userSlice.js";
import restaurantReducer from "./slices/restaurantSlice.js";
import reservationReducer from "./slices/reservationSlice.js";
import notificationReducer from "./slices/notificationSlice.js";
import uiReducer from "./slices/uiSlice.js";
import billReducer from "./slices/billSlice.js";
import tableReducer from "./slices/tableSlice.js";
import foodReducer from "./slices/foodSlice.js";
import reviewReducer from "./slices/reviewSlice.js";
import refundReducer from "./slices/refundSlice.js";
import paymentReducer from "./slices/paymentSlice.js";
import offerReducer from "./slices/offerSlice.js";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    user: userReducer,
    restaurant: restaurantReducer,
    reservation: reservationReducer,
    notification: notificationReducer,
    ui: uiReducer,
    bill: billReducer,
    table: tableReducer,
    food: foodReducer,
    review: reviewReducer,
    refund: refundReducer,
    payment: paymentReducer,
    offer: offerReducer,
  },
});

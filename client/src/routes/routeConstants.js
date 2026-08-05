export const ROUTES = {
  // Public
  HOME: "/",
  RESTAURANTS: "/restaurants",
  RESTAURANT_DETAILS: "/restaurants/:restaurantId",
  FOOD_DETAILS: "/foods/:foodId",

  // Auth
  LOGIN: "/login",
  REGISTER: "/register",
  VERIFY_EMAIL: "/verify-email",
  FORGOT_PASSWORD: "/forgot-password",
  RESET_PASSWORD: "/reset-password",

  // Customer
  CUSTOMER_HOME: "/customer",
  CUSTOMER_DASHBOARD: "/customer/dashboard",
  CUSTOMER_BOOKINGS: "/customer/bookings",
  CUSTOMER_FAVORITES: "/customer/favorites",
  CUSTOMER_PROFILE: "/customer/profile",
  CUSTOMER_CHANGE_PASSWORD: "/customer/change-password",
  CUSTOMER_NOTIFICATIONS: "/customer/notifications",
  BOOKING: "/restaurants/:restaurantId/book",
  BOOKING_CONFIRMATION: "/booking/:bookingId/confirmation",

  // Owner
  OWNER_HOME: "/owner",
  OWNER_DASHBOARD: "/owner/dashboard",
  OWNER_RESTAURANT: "/owner/restaurant",
  OWNER_TABLES: "/owner/tables",
  OWNER_FOODS: "/owner/foods",
  OWNER_RESERVATIONS: "/owner/reservations",
  OWNER_BILLING: "/owner/billing",
  OWNER_REVIEWS: "/owner/reviews",
  OWNER_REPORTS: "/owner/reports",
  OWNER_NOTIFICATIONS: "/owner/notifications",
  OWNER_PROFILE: "/owner/profile",

  // Admin
  ADMIN_HOME: "/admin",
  ADMIN_DASHBOARD: "/admin/dashboard",
  ADMIN_USERS: "/admin/users",
  ADMIN_RESTAURANTS: "/admin/restaurants",
  ADMIN_REVIEWS: "/admin/reviews",
  ADMIN_REPORTS: "/admin/reports",
  ADMIN_NOTIFICATIONS: "/admin/notifications",
  ADMIN_PROFILE: "/admin/profile",
};

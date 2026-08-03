// ===============================
// User
// ===============================

export const USER_ROLE = {
  CUSTOMER: "customer",
  OWNER: "owner",
  ADMIN: "admin",
};

export const USER_ROLE_VALUES = [
  USER_ROLE.CUSTOMER,
  USER_ROLE.OWNER,
  USER_ROLE.ADMIN,
];

export const AUTH_REGISTER_ROLE_VALUES = [
  USER_ROLE.CUSTOMER,
  USER_ROLE.OWNER,
];

export const AUTH_PROVIDER = {
  LOCAL: "local",
  GOOGLE: "google",
};

export const AUTH_PROVIDER_VALUES = [
  AUTH_PROVIDER.LOCAL,
  AUTH_PROVIDER.GOOGLE,
];

// ===============================
// OTP
// ===============================

export const OTP_PURPOSE = {
  EMAIL_VERIFICATION: "Email Verification",
  PASSWORD_RESET: "Password Reset",
  FORGOT_PASSWORD: "Password Reset",
  CHANGE_EMAIL: "Change Email",
  LOGIN_VERIFICATION: "Login Verification",
};

export const OTP_PURPOSE_VALUES = [
  "Email Verification",
  "Password Reset",
  "Change Email",
  "Login Verification",
];

// ===============================
// Restaurant
// ===============================

export const RESTAURANT_STATUS = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

export const RESTAURANT_STATUS_VALUES = [
  RESTAURANT_STATUS.PENDING,
  RESTAURANT_STATUS.APPROVED,
  RESTAURANT_STATUS.REJECTED,
];

export const RESTAURANT_TYPE = {
  VEG: "Veg",
  NON_VEG: "Non-Veg",
  BOTH: "Both",
};

export const RESTAURANT_TYPE_VALUES = [
  RESTAURANT_TYPE.VEG,
  RESTAURANT_TYPE.NON_VEG,
  RESTAURANT_TYPE.BOTH,
];

export const RESTAURANT_OFFER_TYPE_VALUES = [
  "Percentage",
  "Flat",
  "Free Item",
  "Other",
];

export const RESTAURANT_VERIFICATION_STATUS_VALUES = [
  "Pending",
  "Verified",
  "Rejected",
];

// ===============================
// Table
// ===============================

export const TABLE_STATUS = {
  AVAILABLE: "Available",
  RESERVED: "Reserved",
  OCCUPIED: "Occupied",
  CLEANING: "Cleaning",
  MAINTENANCE: "Maintenance",
};

export const TABLE_STATUS_VALUES = [
  TABLE_STATUS.AVAILABLE,
  TABLE_STATUS.RESERVED,
  TABLE_STATUS.OCCUPIED,
  TABLE_STATUS.CLEANING,
  TABLE_STATUS.MAINTENANCE,
];

export const TABLE_TYPE_VALUES = [
  "Normal",
  "VIP",
  "Private",
  "Family",
  "Couple",
  "Window",
  "Kids",
  "Other",
];

export const TABLE_LOCATION_VALUES = [
  "Indoor",
  "Outdoor",
  "Ground Floor",
  "1st Floor",
  "2nd Floor",
  "Terrace",
  "Rooftop",
  "Garden",
  "Pool Side",
  "Beach Side",
  "Other",
];

// ===============================
// Booking
// ===============================

export const BOOKING_STATUS = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  CHECKED_IN: "Checked In",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NO_SHOW: "No Show",
};

export const BOOKING_STATUS_VALUES = [
  BOOKING_STATUS.PENDING,
  BOOKING_STATUS.CONFIRMED,
  BOOKING_STATUS.CHECKED_IN,
  BOOKING_STATUS.COMPLETED,
  BOOKING_STATUS.CANCELLED,
  BOOKING_STATUS.NO_SHOW,
];

export const BOOKING_TYPE_VALUES = [
  "Online",
  "Walk-In",
];

// ===============================
// Bill
// ===============================

export const BILL_STATUS = {
  DRAFT: "Draft",
  GENERATED: "Generated",
  PAID: "Paid",
  CANCELLED: "Cancelled",
};

export const BILL_STATUS_VALUES = [
  BILL_STATUS.DRAFT,
  BILL_STATUS.GENERATED,
  BILL_STATUS.PAID,
  BILL_STATUS.CANCELLED,
];

export const PAYMENT_STATUS = {
  PENDING: "Pending",
  PARTIALLY_PAID: "Partially Paid",
  PAID: "Paid",
  REFUNDED: "Refunded",
};

export const PAYMENT_STATUS_VALUES = [
  PAYMENT_STATUS.PENDING,
  PAYMENT_STATUS.PARTIALLY_PAID,
  PAYMENT_STATUS.PAID,
  PAYMENT_STATUS.REFUNDED,
];

export const PAYMENT_METHOD = {
  CASH: "Cash",
  UPI: "UPI",
  CARD: "Card",
  NET_BANKING: "Net Banking",
  WALLET: "Wallet",
};

export const PAYMENT_METHOD_VALUES = [
  PAYMENT_METHOD.CASH,
  PAYMENT_METHOD.UPI,
  PAYMENT_METHOD.CARD,
  PAYMENT_METHOD.NET_BANKING,
  PAYMENT_METHOD.WALLET,
];

export const PAYMENT_TRANSACTION_STATUS = {
  PENDING: "Pending",
  CAPTURED: "Captured",
  FAILED: "Failed",
};

export const PAYMENT_TRANSACTION_STATUS_VALUES = [
  PAYMENT_TRANSACTION_STATUS.PENDING,
  PAYMENT_TRANSACTION_STATUS.CAPTURED,
  PAYMENT_TRANSACTION_STATUS.FAILED,
];

// ===============================
// Discount
// ===============================

export const DISCOUNT_TYPE = {
  AMOUNT: "Amount",
  PERCENTAGE: "Percentage",
};

export const DISCOUNT_TYPE_VALUES = [
  DISCOUNT_TYPE.AMOUNT,
  DISCOUNT_TYPE.PERCENTAGE,
];

// ===============================
// Food
// ===============================

export const FOOD_TYPE = {
  VEG: "Veg",
  NON_VEG: "Non-Veg",
  VEGAN: "Vegan",
  EGG: "Egg",
};

export const FOOD_TYPE_VALUES = [
  FOOD_TYPE.VEG,
  FOOD_TYPE.NON_VEG,
  FOOD_TYPE.EGG,
  FOOD_TYPE.VEGAN,
  "Jain",
];

export const FOOD_CATEGORY_VALUES = [
  "Starters",
  "Main Course",
  "Biryani",
  "Pizza",
  "Burger",
  "Pasta",
  "Sandwich",
  "Chinese",
  "South Indian",
  "North Indian",
  "Desserts",
  "Beverages",
  "Juices",
  "Ice Cream",
  "Combo",
  "Kids Menu",
  "Other",
];

export const FOOD_SPICE_LEVEL_VALUES = [
  "Mild",
  "Medium",
  "Hot",
  "Extra Hot",
];

export const WEEKDAY_VALUES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export const ORDER_SOURCE = {
  PRE_ORDER: "Pre-Order",
  SPOT_ORDER: "Spot Order",
};

export const ORDER_SOURCE_VALUES = [
  ORDER_SOURCE.PRE_ORDER,
  ORDER_SOURCE.SPOT_ORDER,
];

export const REVIEW_STATUS_VALUES = [
  "Pending",
  "Published",
  "Hidden",
  "Rejected",
];

export const PRICE_RANGE_VALUES = [
  "₹",
  "₹₹",
  "₹₹₹",
  "₹₹₹₹",
];

// ===============================
// Code Prefixes
// ===============================

export const CODE_PREFIX = {
  USER: "USR",
  RESTAURANT: "RST",
  TABLE: "TBL",
  FOOD: "FOD",
  BOOKING: "BKG",
  BILL: "BIL",
  REVIEW: "REV",
  NOTIFICATION: "NOT",
  SESSION: "SES",
};


export const OTP_EXPIRY_MINUTES = 5;


export const SALT_ROUNDS = Number(process.env.SALT_ROUNDS) || 10;


export const REFRESH_TOKEN_EXPIRY_DAYS = 7;


export const MAX_ACTIVE_SESSIONS = 5;

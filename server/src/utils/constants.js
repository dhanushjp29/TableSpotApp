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

// ===============================
// Currency
// ===============================

export const CURRENCY = "INR";
export const CURRENCY_SYMBOL = "₹";

export const CURRENCY_VALUES = [
  "INR",
  "USD",
  "EUR",
  "GBP",
  "AED",
  "CAD",
  "AUD",
  "SGD",
  "MYR",
  "JPY",
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

export const TABLE_SHAPE = {
  ROUND: "Round",
  SQUARE: "Square",
  RECTANGLE: "Rectangle",
  OVAL: "Oval",
  BOAT: "Boat",
  SINGLE_ROW: "SingleRow",
};

export const TABLE_SHAPE_VALUES = [
  TABLE_SHAPE.ROUND,
  TABLE_SHAPE.SQUARE,
  TABLE_SHAPE.RECTANGLE,
  TABLE_SHAPE.OVAL,
  TABLE_SHAPE.BOAT,
  TABLE_SHAPE.SINGLE_ROW,
];

export const SEAT_SELECTION_MODE = {
  FULL_TABLE: "FullTable",
  INDIVIDUAL_SEATS: "IndividualSeats",
};

export const SEAT_SELECTION_MODE_VALUES = [
  SEAT_SELECTION_MODE.FULL_TABLE,
  SEAT_SELECTION_MODE.INDIVIDUAL_SEATS,
];

export const MAX_SEATS_PER_TABLE = 100;
export const MAX_SEATS_SINGLE_ROW = 24;

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
// Booking Payment Policy
// ===============================

export const BOOKING_PAYMENT_POLICY = {
  PAY_ON_SPOT: "PAY_ON_SPOT",
  PAY_TO_BOOK: "PAY_TO_BOOK",
};

export const BOOKING_PAYMENT_POLICY_VALUES = [
  BOOKING_PAYMENT_POLICY.PAY_ON_SPOT,
  BOOKING_PAYMENT_POLICY.PAY_TO_BOOK,
];

export const BOOKING_PAYMENT_TYPE = {
  FIXED_AMOUNT: "FIXED_AMOUNT",
  PERCENTAGE: "PERCENTAGE",
  FULL_PREORDER: "FULL_PREORDER",
};

export const BOOKING_PAYMENT_TYPE_VALUES = [
  BOOKING_PAYMENT_TYPE.FIXED_AMOUNT,
  BOOKING_PAYMENT_TYPE.PERCENTAGE,
  BOOKING_PAYMENT_TYPE.FULL_PREORDER,
];

export const MAX_BOOKING_ADVANCE_AMOUNT = 200;

// ===============================
// Razorpay Payment Account (Onboarding)
// ===============================

export const RAZORPAY_ACCOUNT_STATUS = {
  NOT_CONNECTED: "Not Connected",
  VERIFICATION_PENDING: "Verification Pending",
  CONNECTED: "Connected & Verified",
};

export const RAZORPAY_ACCOUNT_STATUS_VALUES = [
  RAZORPAY_ACCOUNT_STATUS.NOT_CONNECTED,
  RAZORPAY_ACCOUNT_STATUS.VERIFICATION_PENDING,
  RAZORPAY_ACCOUNT_STATUS.CONNECTED,
];

// ===============================
// Payment Purpose
// ===============================

export const PAYMENT_PURPOSE = {
  BOOKING_ADVANCE: "BOOKING_ADVANCE",
  PREORDER_PAYMENT: "PREORDER_PAYMENT",
  SPOT_FOOD_PAYMENT: "SPOT_FOOD_PAYMENT",
  BILL_PAYMENT: "BILL_PAYMENT",
  REFUND: "REFUND",
  OTHER: "OTHER",
};

export const PAYMENT_PURPOSE_VALUES = [
  PAYMENT_PURPOSE.BOOKING_ADVANCE,
  PAYMENT_PURPOSE.PREORDER_PAYMENT,
  PAYMENT_PURPOSE.SPOT_FOOD_PAYMENT,
  PAYMENT_PURPOSE.BILL_PAYMENT,
  PAYMENT_PURPOSE.REFUND,
  PAYMENT_PURPOSE.OTHER,
];

// ===============================
// Refunds
// ===============================

export const REFUND_STATUS = {
  NOT_REQUIRED: "NOT_REQUIRED",
  REFUND_PENDING: "REFUND_PENDING",
  REFUND_PROCESSING: "REFUND_PROCESSING",
  REFUND_AWAITING_CUSTOMER_CONFIRMATION: "REFUND_AWAITING_CUSTOMER_CONFIRMATION",
  REFUNDED: "REFUNDED",
  REFUND_OVERDUE: "REFUND_OVERDUE",
  REFUND_FAILED: "REFUND_FAILED",
  REFUND_DISPUTED: "REFUND_DISPUTED",
};

export const REFUND_STATUS_VALUES = [
  REFUND_STATUS.NOT_REQUIRED,
  REFUND_STATUS.REFUND_PENDING,
  REFUND_STATUS.REFUND_PROCESSING,
  REFUND_STATUS.REFUND_AWAITING_CUSTOMER_CONFIRMATION,
  REFUND_STATUS.REFUNDED,
  REFUND_STATUS.REFUND_OVERDUE,
  REFUND_STATUS.REFUND_FAILED,
  REFUND_STATUS.REFUND_DISPUTED,
];

export const REFUND_METHOD = {
  CASH: "Cash",
  UPI: "UPI",
  CARD: "Card",
  NET_BANKING: "Net Banking",
  WALLET: "Wallet",
  RAZORPAY: "RAZORPAY",
};

export const REFUND_METHOD_VALUES = [
  REFUND_METHOD.CASH,
  REFUND_METHOD.UPI,
  REFUND_METHOD.CARD,
  REFUND_METHOD.NET_BANKING,
  REFUND_METHOD.WALLET,
  REFUND_METHOD.RAZORPAY,
];

export const REFUND_REASON = {
  CUSTOMER_CANCELLED: "CUSTOMER_CANCELLED",
  CUSTOMER_NO_SHOW: "CUSTOMER_NO_SHOW",
  EXCESS_ADVANCE_PAYMENT: "EXCESS_ADVANCE_PAYMENT",
  BILL_ADJUSTMENT: "BILL_ADJUSTMENT",
  OTHER_APPROVED_REASON: "OTHER_APPROVED_REASON",
};

export const REFUND_REASON_VALUES = [
  REFUND_REASON.CUSTOMER_CANCELLED,
  REFUND_REASON.CUSTOMER_NO_SHOW,
  REFUND_REASON.EXCESS_ADVANCE_PAYMENT,
  REFUND_REASON.BILL_ADJUSTMENT,
  REFUND_REASON.OTHER_APPROVED_REASON,
];

export const REFUND_DEADLINE_DAYS = 3;

// ===============================
// Cancellation & No-Show
// ===============================

export const DEFAULT_CANCELLATION_POLICY = {
  isEnabled: true,
  hoursBeforeBooking: 6,
  refundPercentage: 100,
  noShowRefundPercentage: 0,
};

export const DEFAULT_CUSTOMER_WAITING_PERIOD_MINUTES = 30;

export const NO_SHOW_REASON = {
  CUSTOMER_DID_NOT_ARRIVE: "Customer did not arrive within the grace period.",
};

export const MIN_REMARKS_LENGTH = 5;
export const MAX_REMARKS_LENGTH = 500;

// ===============================
// Owner Booking Status
// ===============================

export const OWNER_BOOKING_STATUS = {
  ACTIVE: "ACTIVE",
  BOOKING_RESTRICTED: "BOOKING_RESTRICTED",
};

export const OWNER_BOOKING_STATUS_VALUES = [
  OWNER_BOOKING_STATUS.ACTIVE,
  OWNER_BOOKING_STATUS.BOOKING_RESTRICTED,
];

// ===============================
// GST
// ===============================

export const GST_RATE_BY_CATEGORY = {
  "Starters": 5,
  "Main Course": 5,
  "Biryani": 5,
  "Pizza": 5,
  "Burger": 5,
  "Pasta": 5,
  "Sandwich": 5,
  "Chinese": 5,
  "South Indian": 5,
  "North Indian": 5,
  "Desserts": 18,
  "Beverages": 18,
  "Juices": 5,
  "Ice Cream": 18,
  "Combo": 5,
  "Kids Menu": 5,
  "Other": 5,
};

export const GST_SLAB_VALUES = [5, 12, 18, 28];

export const getGstRateForCategory = (category) =>
  GST_RATE_BY_CATEGORY[category] ?? 5;

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
  REFUND: "RFD",
  AUDIT: "AUD",
};


export const OTP_EXPIRY_MINUTES = 5;


export const SALT_ROUNDS = Number(process.env.SALT_ROUNDS) || 10;


export const REFRESH_TOKEN_EXPIRY_DAYS = 7;


export const MAX_ACTIVE_SESSIONS = 5;

export const BOOKING_STATUS = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NO_SHOW: "No Show",
};

export const BOOKING_TYPE = {
  ONLINE: "Online",
  WALK_IN: "Walk-In",
};

export const BOOKING_TYPE_VALUES = [BOOKING_TYPE.ONLINE, BOOKING_TYPE.WALK_IN];

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

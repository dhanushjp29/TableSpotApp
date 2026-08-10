import ApiError from "../utils/ApiError.js";
import {
  BOOKING_PAYMENT_POLICY,
  BOOKING_PAYMENT_TYPE,
  MAX_BOOKING_ADVANCE_AMOUNT,
} from "../utils/constants.js";

const roundAmount = (value) => Math.round(Number(value || 0) * 100) / 100;

/**
 * Normalize a restaurant's booking payment policy into a usable shape.
 */
export const getEffectiveBookingPaymentPolicy = (restaurant) => {
  const policy = restaurant?.bookingPaymentPolicy || {};

  return {
    type: policy.type || BOOKING_PAYMENT_POLICY.PAY_ON_SPOT,
    paymentType: policy.paymentType || BOOKING_PAYMENT_TYPE.FIXED_AMOUNT,
    fixedAmount: Number(policy.fixedAmount) || 0,
    percentage: Number(policy.percentage) || 0,
    maximumAmount:
      Number(policy.maximumAmount) || MAX_BOOKING_ADVANCE_AMOUNT,
  };
};

/**
 * Compute the amount a customer must pay to book (backend source of truth).
 *
 * Rules (from spec):
 * - PAY_ON_SPOT            -> 0
 * - PAY_TO_BOOK / FIXED    -> min(fixedAmount, maximumAmount)  (<= Rs.200)
 * - PAY_TO_BOOK / PERCENT  -> min(round(total * pct / 100), maximumAmount)
 * - PAY_TO_BOOK / FULL     -> full pre-order total, reduced by an applied
 *                             offer discount (the discount only ever affects
 *                             a FULL pre-payment; partial advances are a % /
 *                             flat amount of the undiscounted total and the
 *                             offer applies at bill time).
 */
export const calculateRequiredBookingPayment = ({
  restaurant,
  totalAmount,
  discountAmount = 0,
}) => {
  if (!restaurant) {
    throw new ApiError(500, "Restaurant context is required to compute booking payment.");
  }

  const policy = getEffectiveBookingPaymentPolicy(restaurant);
  const total = roundAmount(Number(totalAmount) || 0);
  const discount = roundAmount(Math.max(0, Number(discountAmount) || 0));

  if (policy.type === BOOKING_PAYMENT_POLICY.PAY_ON_SPOT) {
    return 0;
  }

  if (policy.type !== BOOKING_PAYMENT_POLICY.PAY_TO_BOOK) {
    return 0;
  }

  switch (policy.paymentType) {
    case BOOKING_PAYMENT_TYPE.FIXED_AMOUNT:
      return Math.min(policy.fixedAmount, policy.maximumAmount);
    case BOOKING_PAYMENT_TYPE.PERCENTAGE:
      return Math.min(
        roundAmount((total * policy.percentage) / 100),
        policy.maximumAmount
      );
    case BOOKING_PAYMENT_TYPE.FULL_PREORDER:
      return Math.max(roundAmount(total - discount), 0);
    default:
      return 0;
  }
};

/**
 * Compute the cancellation cutoff snapshot for a booking at creation.
 */
export const calculateCancellationCutoffAt = ({
  restaurant,
  bookingAt,
}) => {
  const policy = restaurant?.cancellationPolicy;

  if (!policy || !policy.isEnabled) {
    return null;
  }

  const hours = Number(policy.hoursBeforeBooking) || 0;
  const bookingTime = new Date(bookingAt);

  return new Date(bookingTime.getTime() - hours * 60 * 60 * 1000);
};

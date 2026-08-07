import Refund from "../models/Refund.js";
import User from "../models/User.js";
import ApiError from "../utils/ApiError.js";
import {
  OWNER_BOOKING_STATUS,
  REFUND_STATUS,
} from "../utils/constants.js";

/**
 * Refund states that count as "unresolved". As long as a restaurant owner has
 * at least one refund in any of these states, the owner stays BOOKING_RESTRICTED.
 */
const UNRESOLVED_REFUND_STATUSES = [
  REFUND_STATUS.REFUND_PENDING,
  REFUND_STATUS.REFUND_PROCESSING,
  REFUND_STATUS.REFUND_AWAITING_CUSTOMER_CONFIRMATION,
  REFUND_STATUS.REFUND_OVERDUE,
  REFUND_STATUS.REFUND_DISPUTED,
  REFUND_STATUS.REFUND_FAILED,
];

export const countUnresolvedRefunds = async (ownerId) =>
  Refund.countDocuments({
    ownerId,
    isDeleted: false,
    refundStatus: { $in: UNRESOLVED_REFUND_STATUSES },
  });

export const getOwnerBookingStatus = async (ownerId) => {
  const owner = await User.findById(ownerId).select("bookingStatus");
  if (!owner || owner.isDeleted) return null;
  return owner.bookingStatus;
};

/**
 * Throw if the owner is BOOKING_RESTRICTED. Used to gate operations that
 * accept / enable new bookings.
 */
export const assertOwnerAllowsNewBookings = async (ownerId) => {
  const status = await getOwnerBookingStatus(ownerId);

  if (status === OWNER_BOOKING_STATUS.BOOKING_RESTRICTED) {
    throw new ApiError(
      409,
      "This restaurant is currently not accepting new bookings while refunds are pending."
    );
  }
};

/**
 * Automatically restrict an owner whenever they have at least one unresolved
 * refund. No-op if they are already restricted.
 */
export const restrictOwnerIfUnresolvedRefunds = async (ownerId) => {
  const count = await countUnresolvedRefunds(ownerId);

  if (count <= 0) {
    return { restricted: false };
  }

  const owner = await User.findById(ownerId).select(
    "bookingStatus bookingRestrictedAt bookingRestrictedBy"
  );

  if (!owner) {
    return { restricted: false };
  }

  if (owner.bookingStatus !== OWNER_BOOKING_STATUS.BOOKING_RESTRICTED) {
    owner.bookingStatus = OWNER_BOOKING_STATUS.BOOKING_RESTRICTED;
    owner.bookingRestrictedAt = new Date();
    owner.bookingRestrictedBy = null;
    await owner.save();
    return { restricted: true, owner };
  }

  return { restricted: false, owner };
};

/**
 * Automatically unlock a restricted owner back to ACTIVE as soon as they have
 * no unresolved refunds left.
 */
export const unlockOwnerIfNoUnresolvedRefunds = async (ownerId) => {
  const unresolved = await countUnresolvedRefunds(ownerId);

  if (unresolved > 0) {
    return { unlocked: false, unresolved };
  }

  const owner = await User.findById(ownerId).select(
    "bookingStatus bookingRestrictedAt bookingRestrictedBy"
  );

  if (!owner) {
    return { unlocked: false };
  }

  if (owner.bookingStatus === OWNER_BOOKING_STATUS.BOOKING_RESTRICTED) {
    owner.bookingStatus = OWNER_BOOKING_STATUS.ACTIVE;
    owner.bookingRestrictedAt = null;
    owner.bookingRestrictedBy = null;
    await owner.save();
    return { unlocked: true, owner };
  }

  return { unlocked: false };
};

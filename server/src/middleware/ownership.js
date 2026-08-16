import ApiError from "../utils/ApiError.js";
import { USER_ROLE } from "../utils/constants.js";
import Restaurant from "../models/Restaurant.js";
import Booking from "../models/Booking.js";

/**
 * Verify that a user has access to a booking.
 * - Admin: full access
 * - Customer: only their own bookings
 * - Owner: only bookings for their restaurants
 */
export const verifyBookingAccess = async (req, booking) => {
    if (req.user.role === USER_ROLE.ADMIN) return true;

    if (req.user.role === USER_ROLE.CUSTOMER) {
        const bookingUserId = booking.userId?._id || booking.userId;
        if (String(bookingUserId) !== String(req.user._id)) {
            throw new ApiError(403, "You can only access your own bookings.");
        }
    } else if (req.user.role === USER_ROLE.OWNER) {
        const restaurant = await Restaurant.findById(booking.restaurantId?._id || booking.restaurantId).select("ownerId");
        if (!restaurant || String(restaurant.ownerId) !== String(req.user._id)) {
            throw new ApiError(403, "You can only access bookings for your restaurants.");
        }
    }
};

/**
 * Verify that a user has access to a bill (via its booking).
 * - Admin: full access
 * - Customer: only their own bills
 * - Owner: only bills for their restaurants
 */
export const verifyBillAccess = async (req, bookingId) => {
    if (req.user.role === USER_ROLE.ADMIN) return true;

    const booking = await Booking.findById(bookingId);
    if (!booking) throw new ApiError(404, "Booking not found.");

    if (req.user.role === USER_ROLE.CUSTOMER) {
        if (String(booking.userId) !== String(req.user._id)) {
            throw new ApiError(403, "You can only access your own bills.");
        }
    } else if (req.user.role === USER_ROLE.OWNER) {
        const restaurant = await Restaurant.findById(booking.restaurantId).select("ownerId");
        if (!restaurant || String(restaurant.ownerId) !== String(req.user._id)) {
            throw new ApiError(403, "You can only access bills for your restaurants.");
        }
    }
};

/**
 * Get the list of restaurant IDs owned by the current user (for owners).
 * Returns null for admin (no restriction) and throws for customers.
 */
export const getOwnedRestaurantIds = async (req) => {
    if (req.user.role === USER_ROLE.ADMIN) return null;

    if (req.user.role === USER_ROLE.OWNER) {
        const restaurants = await Restaurant.find({ ownerId: req.user._id }).select("_id");
        return restaurants.map((r) => r._id);
    }

  throw new ApiError(403, "You do not have permission to access this resource.");
};

export const assertRestaurantOwnedByUser = async (req, restaurantId) => {
    if (req.user.role === USER_ROLE.ADMIN) return null;

    const restaurant = await Restaurant.findById(restaurantId).select("ownerId");
    if (!restaurant || String(restaurant.ownerId) !== String(req.user._id)) {
        throw new ApiError(403, "You do not have permission for this restaurant.");
    }

    return restaurant;
};

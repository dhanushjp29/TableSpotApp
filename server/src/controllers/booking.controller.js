import * as bookingService from "../services/booking.service.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import { USER_ROLE } from "../utils/constants.js";
import {
    verifyBookingAccess,
    getOwnedRestaurantIds,
} from "../middleware/ownership.js";

export const create = async (req, res) => {
    const result = await bookingService.createBooking({
        ...req.validatedData,
        userId: req.user._id,
    });
    res.status(201).json(new ApiResponse(201, result.message, result));
};

export const update = async (req, res) => {
    const { bookingId } = req.params;
    const { booking } = await bookingService.getBookingById({ bookingId });
    await verifyBookingAccess(req, booking);

    const result = await bookingService.updateBooking({
        bookingId,
        updates: req.validatedData,
    });
    res.status(200).json(new ApiResponse(200, result.message, result));
};

export const updateStatus = async (req, res) => {
    const { bookingId } = req.params;
    const { booking } = await bookingService.getBookingById({ bookingId });
    await verifyBookingAccess(req, booking);

    // Only owners and admins can change booking status
    if (req.user.role === USER_ROLE.CUSTOMER) {
        throw new ApiError(403, "Only restaurant owners can update booking status.");
    }

    const result = await bookingService.updateBookingStatus({
        bookingId,
        ...req.validatedData,
    });
    res.status(200).json(new ApiResponse(200, result.message, result));
};

export const cancel = async (req, res) => {
    const { bookingId } = req.params;
    const { booking } = await bookingService.getBookingById({ bookingId });
    await verifyBookingAccess(req, booking);

    const result = await bookingService.cancelBooking({
        bookingId,
        cancellationReason: req.body.cancellationReason || "Cancelled by user",
    });
    res.status(200).json(new ApiResponse(200, result.message, result));
};

export const checkIn = async (req, res) => {
    const { bookingId } = req.params;
    const { booking } = await bookingService.getBookingById({ bookingId });
    await verifyBookingAccess(req, booking);

    // Only owners and admins can check in a booking
    if (req.user.role === USER_ROLE.CUSTOMER) {
        throw new ApiError(403, "Only restaurant owners can check in a booking.");
    }

    const result = await bookingService.checkInBooking({ bookingId });
    res.status(200).json(new ApiResponse(200, result.message, result));
};

export const complete = async (req, res) => {
    const { bookingId } = req.params;
    const { booking } = await bookingService.getBookingById({ bookingId });
    await verifyBookingAccess(req, booking);

    // Only owners and admins can complete a booking
    if (req.user.role === USER_ROLE.CUSTOMER) {
        throw new ApiError(403, "Only restaurant owners can complete a booking.");
    }

    const result = await bookingService.completeBooking({ bookingId });
    res.status(200).json(new ApiResponse(200, result.message, result));
};

export const getById = async (req, res) => {
    const { bookingId } = req.params;
    const result = await bookingService.getBookingById({ bookingId });
    await verifyBookingAccess(req, result.booking);

    res.status(200).json(new ApiResponse(200, "Booking retrieved successfully.", result));
};

export const getAll = async (req, res) => {
    const query = { ...req.query };

    if (req.user.role === USER_ROLE.CUSTOMER) {
        query.userId = req.user._id;
    } else if (req.user.role === USER_ROLE.OWNER) {
        // Scope to only the owner's restaurants
        const ownedRestaurantIds = await getOwnedRestaurantIds(req);
        query.restaurantId = { $in: ownedRestaurantIds };
    }

    const result = await bookingService.getBookings(query);
    res.status(200).json(new ApiResponse(200, "Bookings retrieved successfully.", result));
};

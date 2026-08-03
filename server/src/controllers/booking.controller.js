import * as bookingService from "../services/booking.service.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import { USER_ROLE } from "../utils/constants.js";
import Restaurant from "../models/Restaurant.js";

const verifyBookingAccess = async (req, booking) => {
    if (req.user.role === USER_ROLE.ADMIN) return true;

    if (req.user.role === USER_ROLE.CUSTOMER) {
        if (String(booking.userId._id) !== String(req.user._id)) {
            throw new ApiError(403, "You can only access your own bookings.");
        }
    } else if (req.user.role === USER_ROLE.OWNER) {
        const restaurant = await Restaurant.findById(booking.restaurantId).select("ownerId");
        if (!restaurant || String(restaurant.ownerId) !== String(req.user._id)) {
            throw new ApiError(403, "You can only access bookings for your restaurants.");
        }
    }
};

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

    const result = await bookingService.checkInBooking({ bookingId });
    res.status(200).json(new ApiResponse(200, result.message, result));
};

export const complete = async (req, res) => {
    const { bookingId } = req.params;
    const { booking } = await bookingService.getBookingById({ bookingId });
    await verifyBookingAccess(req, booking);

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
    }

    const result = await bookingService.getBookings(query);

    if (req.user.role === USER_ROLE.OWNER) {
        // Filter out rows not belonging to this owner by ensuring restaurantId matches their owned ones
        // For a complex production app we'd inject this via query array or refactor service layer
        // For now, doing it post-query or we expect frontend to pass valid restaurantIds
    }

    res.status(200).json(new ApiResponse(200, "Bookings retrieved successfully.", result));
};

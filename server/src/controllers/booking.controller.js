import * as bookingService from "../services/booking.service.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import Restaurant from "../models/Restaurant.js";
import { getEffectiveBookingPaymentPolicy } from "../services/bookingPayment.service.js";
import {
    BOOKING_PAYMENT_POLICY,
    USER_ROLE,
} from "../utils/constants.js";
import {
    verifyBookingAccess,
    getOwnedRestaurantIds,
} from "../middleware/ownership.js";

export const create = async (req, res) => {
    // Payment-first gating: customers can never create a booking directly for
    // a PAY_TO_BOOK restaurant — the booking only comes into existence after
    // a backend-verified advance payment. Owners/admins may still create them.
    if (req.user.role === USER_ROLE.CUSTOMER) {
        const restaurant = await Restaurant.findById(req.validatedData.restaurantId);

        if (!restaurant || restaurant.isDeleted) {
            throw new ApiError(404, "Restaurant not found.");
        }

        const policy = getEffectiveBookingPaymentPolicy(restaurant);

        if (policy.type === BOOKING_PAYMENT_POLICY.PAY_TO_BOOK) {
            throw new ApiError(
                409,
                "This restaurant requires an advance payment to confirm your booking. Please complete the payment first."
            );
        }
    }

    const result = await bookingService.createBooking({
        ...req.validatedData,
        // Walk-ins are only ever created via the owner-only walk-in endpoint.
        // A customer-supplied bookingType must never downgrade an online
        // booking to a walk-in (which bypasses the advance policy).
        bookingType: "Online",
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
        cancelledBy: req.user._id,
        role: req.user.role,
    });
    res.status(200).json(new ApiResponse(200, result.message, result));
};

export const createWalkIn = async (req, res) => {
    if (req.user.role === USER_ROLE.CUSTOMER) {
        throw new ApiError(403, "Only restaurant owners can create walk-in bookings.");
    }

    const result = await bookingService.createWalkInBooking({
        ...req.validatedData,
        ownerId: req.user._id,
    });
    res.status(201).json(new ApiResponse(201, result.message, result));
};

export const checkIn = async (req, res) => {
    const { bookingId } = req.params;
    const { booking } = await bookingService.getBookingById({ bookingId });
    await verifyBookingAccess(req, booking);

    // Only owners and admins can check in a booking
    if (req.user.role === USER_ROLE.CUSTOMER) {
        throw new ApiError(403, "Only restaurant owners can check in a booking.");
    }

    const result = await bookingService.checkInBooking({
        bookingId,
        performedBy: req.user._id,
        performedByRole: req.user.role,
    });
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

    const result = await bookingService.completeBooking({
        bookingId,
        performedBy: req.user._id,
        performedByRole: req.user.role,
    });
    res.status(200).json(new ApiResponse(200, result.message, result));
};

export const markNoShow = async (req, res) => {
    const { bookingId } = req.params;
    const { booking } = await bookingService.getBookingById({ bookingId });
    await verifyBookingAccess(req, booking);

    // Only owners and admins can mark a booking as no-show
    if (req.user.role === USER_ROLE.CUSTOMER) {
        throw new ApiError(403, "Only restaurant owners can mark a booking as no-show.");
    }

    const result = await bookingService.markNoShowBooking({
        bookingId,
        remarks: req.validatedData.remarks,
        confirmedBy: req.user._id,
        confirmedByRole: req.user.role,
    });
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

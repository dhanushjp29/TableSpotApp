import * as billService from "../services/bill.service.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import { USER_ROLE } from "../utils/constants.js";
import Booking from "../models/Booking.js";
import Restaurant from "../models/Restaurant.js";

const verifyBillAccess = async (req, bookingId) => {
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

export const create = async (req, res) => {
    await verifyBillAccess(req, req.validatedData.bookingId);

    const result = await billService.createBill({
        ...req.validatedData,
        generatedBy: req.user._id,
    });
    res.status(201).json(new ApiResponse(201, result.message, result));
};

export const update = async (req, res) => {
    const { billId } = req.params;
    const { bill } = await billService.getBillById({ billId });
    await verifyBillAccess(req, bill.bookingId._id);

    const result = await billService.updateBill({
        billId,
        updates: req.validatedData,
    });
    res.status(200).json(new ApiResponse(200, result.message, result));
};

export const addPayment = async (req, res) => {
    const { billId } = req.params;
    const { bill } = await billService.getBillById({ billId });
    await verifyBillAccess(req, bill.bookingId._id);

    const result = await billService.addBillPayment({
        billId,
        ...req.body,
    });
    res.status(200).json(new ApiResponse(200, result.message, result));
};

export const markStatus = async (req, res) => {
    const { billId } = req.params;
    const { bill } = await billService.getBillById({ billId });
    await verifyBillAccess(req, bill.bookingId._id);

    const result = await billService.markBillStatus({
        billId,
        billStatus: req.body.billStatus,
    });
    res.status(200).json(new ApiResponse(200, result.message, result));
};

export const getById = async (req, res) => {
    const { billId } = req.params;
    const result = await billService.getBillById({ billId });
    await verifyBillAccess(req, result.bill.bookingId._id);

    res.status(200).json(new ApiResponse(200, "Bill retrieved successfully.", result));
};

export const getAll = async (req, res) => {
    // Similarly, scope query if customer
    const result = await billService.getBills(req.query);
    res.status(200).json(new ApiResponse(200, "Bills retrieved successfully.", result));
};

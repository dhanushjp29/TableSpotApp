import * as billService from "../services/bill.service.js";
import ApiResponse from "../utils/ApiResponse.js";
import { USER_ROLE } from "../utils/constants.js";
import Booking from "../models/Booking.js";
import {
    verifyBillAccess,
    getOwnedRestaurantIds,
} from "../middleware/ownership.js";

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
        ...req.validatedData,
    });
    res.status(200).json(new ApiResponse(200, result.message, result));
};

export const markStatus = async (req, res) => {
    const { billId } = req.params;
    const { bill } = await billService.getBillById({ billId });
    await verifyBillAccess(req, bill.bookingId._id);

    const result = await billService.markBillStatus({
        billId,
        billStatus: req.validatedData.billStatus,
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
    const query = { ...req.query };

    if (req.user.role === USER_ROLE.CUSTOMER) {
        // Scope to bills belonging to the customer's bookings
        const bookings = await Booking.find({ userId: req.user._id }).select("_id");
        query.bookingId = { $in: bookings.map((b) => b._id) };
    } else if (req.user.role === USER_ROLE.OWNER) {
        // Scope to bills for the owner's restaurants
        const ownedRestaurantIds = await getOwnedRestaurantIds(req);
        const bookings = await Booking.find({
            restaurantId: { $in: ownedRestaurantIds },
        }).select("_id");
        query.bookingId = { $in: bookings.map((b) => b._id) };
    }

    const result = await billService.getBills(query);
    res.status(200).json(new ApiResponse(200, "Bills retrieved successfully.", result));
};

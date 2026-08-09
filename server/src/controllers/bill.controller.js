import * as billService from "../services/bill.service.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import { USER_ROLE } from "../utils/constants.js";
import Booking from "../models/Booking.js";
import Restaurant from "../models/Restaurant.js";
import { verifyBillAccess, getOwnedRestaurantIds } from "../middleware/ownership.js";

const assertBillWriteAccess = (req) => {
  if (req.user.role !== USER_ROLE.OWNER && req.user.role !== USER_ROLE.ADMIN) {
    throw new ApiError(403, "Only restaurant owners or admins can modify bills.");
  }
};

const assertBillOwnerAccess = async (req, bill) => {
  if (req.user.role === USER_ROLE.ADMIN) return true;
  if (req.user.role !== USER_ROLE.OWNER) {
    throw new ApiError(403, "Only restaurant owners or admins can modify bills.");
  }

  const restaurant = await Restaurant.findById(bill.restaurantId).select("ownerId");
  if (!restaurant || String(restaurant.ownerId) !== String(req.user._id)) {
    throw new ApiError(403, "You can only access bills for your restaurants.");
  }
};

export const create = async (req, res) => {
  assertBillWriteAccess(req);
  if (req.validatedData.billType === "WALK_IN") {
    await assertBillOwnerAccess(req, { restaurantId: req.validatedData.restaurantId });
  } else {
    await verifyBillAccess(req, req.validatedData.bookingId);
  }

  const result = await billService.createBill({
    ...req.validatedData,
    generatedBy: req.user._id,
  });
  res.status(201).json(new ApiResponse(201, result.message, result));
};

export const convert = async (req, res) => {
  assertBillWriteAccess(req);
  await verifyBillAccess(req, req.params.bookingId);

  const result = await billService.convertBookingToBill({
    bookingId: req.params.bookingId,
    generatedBy: req.user._id,
    notes: req.body?.notes || "",
  });
  res.status(201).json(new ApiResponse(201, result.message, result));
};

export const update = async (req, res) => {
  assertBillWriteAccess(req);
  const { billId } = req.params;
  const { bill } = await billService.getBillById({ billId });
  if (bill.bookingId?._id) {
    await verifyBillAccess(req, bill.bookingId._id);
  } else {
    await assertBillOwnerAccess(req, bill);
  }

  const result = await billService.updateBill({
    billId,
    updates: req.validatedData,
  });
  res.status(200).json(new ApiResponse(200, result.message, result));
};

export const addPayment = async (req, res) => {
  assertBillWriteAccess(req);
  const { billId } = req.params;
  const { bill } = await billService.getBillById({ billId });
  if (bill.bookingId?._id) {
    await verifyBillAccess(req, bill.bookingId._id);
  } else {
    await assertBillOwnerAccess(req, bill);
  }

  const result = await billService.addBillPayment({
    billId,
    ...req.validatedData,
  });
  res.status(200).json(new ApiResponse(200, result.message, result));
};

export const markStatus = async (req, res) => {
  assertBillWriteAccess(req);
  const { billId } = req.params;
  const { bill } = await billService.getBillById({ billId });
  if (bill.bookingId?._id) {
    await verifyBillAccess(req, bill.bookingId._id);
  } else {
    await assertBillOwnerAccess(req, bill);
  }

  const result = await billService.markBillStatus({
    billId,
    billStatus: req.validatedData.billStatus,
  });
  res.status(200).json(new ApiResponse(200, result.message, result));
};

export const getById = async (req, res) => {
  const { billId } = req.params;
  const result = await billService.getBillById({ billId });
  if (result.bill.bookingId?._id) {
    await verifyBillAccess(req, result.bill.bookingId._id);
  } else {
    await assertBillOwnerAccess(req, result.bill);
  }

  res.status(200).json(new ApiResponse(200, "Bill retrieved successfully.", result));
};

export const getAll = async (req, res) => {
  const query = { ...req.query };

  if (req.user.role === USER_ROLE.CUSTOMER) {
    const bookings = await Booking.find({ userId: req.user._id }).select("_id");
    query.bookingId = { $in: bookings.map((b) => b._id) };
  } else if (req.user.role === USER_ROLE.OWNER) {
    const ownedRestaurantIds = await getOwnedRestaurantIds(req);
    query.restaurantId = { $in: ownedRestaurantIds };
  }

  const result = await billService.getBills(query);
  res.status(200).json(new ApiResponse(200, "Bills retrieved successfully.", result));
};

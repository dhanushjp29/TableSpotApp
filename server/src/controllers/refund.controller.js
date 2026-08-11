import * as refundService from "../services/refund.service.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import Restaurant from "../models/Restaurant.js";
import { USER_ROLE } from "../utils/constants.js";
import {
  getOwnedRestaurantIds,
  assertRestaurantOwnedByUser,
} from "../middleware/ownership.js";

const ensureOwnerOrAdmin = (req) => {
  if (req.user.role === USER_ROLE.CUSTOMER) {
    throw new ApiError(403, "Only restaurant owners can process refunds.");
  }
};

const ensureCustomer = (req) => {
  if (req.user.role !== USER_ROLE.CUSTOMER) {
    throw new ApiError(403, "Only the customer can perform this action.");
  }
};

export const process = async (req, res) => {
  ensureOwnerOrAdmin(req);
  const { refund } = await refundService.getRefundById({
    refundId: req.params.refundId,
  });
  await assertRestaurantOwnedByUser(req, refund.restaurantId?._id || refund.restaurantId);

  const result = await refundService.processRefund({
    refundId: req.params.refundId,
    processedBy: req.user._id,
    refundMethod: req.validatedData?.refundMethod,
  });

  res.status(200).json(new ApiResponse(200, "Refund processed successfully.", result));
};

export const confirmReceived = async (req, res) => {
  ensureCustomer(req);

  const result = await refundService.confirmCashRefundReceived({
    refundId: req.params.refundId,
    confirmedBy: req.user._id,
  });

  res.status(200).json(new ApiResponse(200, "Refund receipt confirmed.", result));
};

export const dispute = async (req, res) => {
  ensureCustomer(req);

  const result = await refundService.disputeRefund({
    refundId: req.params.refundId,
    confirmedBy: req.user._id,
    disputeReason: req.validatedData.disputeReason,
  });

  res.status(200).json(new ApiResponse(200, "Refund disputed successfully.", result));
};

export const getById = async (req, res) => {
  const { refund } = await refundService.getRefundById({ refundId: req.params.refundId });

  const customerId = refund.customerId?._id || refund.customerId;
  const restaurantId = refund.restaurantId?._id || refund.restaurantId;

  if (req.user.role === USER_ROLE.CUSTOMER) {
    if (String(customerId) !== String(req.user._id)) {
      throw new ApiError(403, "You can only access your own refunds.");
    }
  } else if (req.user.role === USER_ROLE.OWNER) {
    const restaurant = await Restaurant.findById(restaurantId).select("ownerId");
    if (!restaurant || String(restaurant.ownerId) !== String(req.user._id)) {
      throw new ApiError(403, "You can only access refunds for your restaurants.");
    }
  }

  res.status(200).json(new ApiResponse(200, "Refund retrieved successfully.", { refund }));
};

export const getAll = async (req, res) => {
  const query = { ...req.validatedData };

  if (req.user.role === USER_ROLE.CUSTOMER) {
    query.customerId = req.user._id;
  } else if (req.user.role === USER_ROLE.OWNER) {
    if (query.restaurantId && query.restaurantId !== "all") {
      await assertRestaurantOwnedByUser(req, query.restaurantId);
    } else {
      query.restaurantId = { $in: await getOwnedRestaurantIds(req) };
    }
  }

  const result = await refundService.listRefunds(query);
  res.status(200).json(new ApiResponse(200, "Refunds retrieved successfully.", result));
};

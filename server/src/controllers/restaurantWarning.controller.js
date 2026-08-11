import * as restaurantWarningService from "../services/restaurantWarning.service.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import { USER_ROLE } from "../utils/constants.js";
import Restaurant from "../models/Restaurant.js";

export const create = async (req, res) => {
  const result = await restaurantWarningService.issueWarning({
    ...req.validatedData,
    issuedBy: req.user._id,
  });
  res.status(201).json(new ApiResponse(201, result.message, result));
};

export const update = async (req, res) => {
  const { warningId } = req.params;
  const result = await restaurantWarningService.updateWarning({
    warningId,
    updates: req.validatedData,
    performedBy: req.user._id,
  });
  res.status(200).json(new ApiResponse(200, result.message, result));
};

export const reply = async (req, res) => {
  const { warningId } = req.params;
  const result = await restaurantWarningService.addWarningReply({
    warningId,
    user: req.user,
    message: req.validatedData.message,
  });
  res.status(200).json(new ApiResponse(200, result.message, result));
};

export const getById = async (req, res) => {
  const { warningId } = req.params;
  const { warning } = await restaurantWarningService.getWarningById({ warningId });

  if (req.user.role === USER_ROLE.OWNER) {
    const owned = await Restaurant.exists({
      _id: warning.restaurantId,
      ownerId: req.user._id,
      isDeleted: false,
    });
    if (!owned) {
      throw new ApiError(
        403,
        "You can only view warnings for your own restaurants."
      );
    }
  } else if (req.user.role === USER_ROLE.CUSTOMER) {
    const linked = await restaurantWarningService.isCustomerLinkedToWarning(
      req.user._id,
      warning
    );
    if (!linked) {
      throw new ApiError(
        403,
        "You can only view warnings linked to your own reports."
      );
    }
  }

  res
    .status(200)
    .json(
      new ApiResponse(200, "Restaurant warning retrieved successfully.", {
        warning,
      })
    );
};

export const getAll = async (req, res) => {
  const isOwner = req.user.role === USER_ROLE.OWNER;
  const isCustomer = req.user.role === USER_ROLE.CUSTOMER;
  const result = await restaurantWarningService.getWarnings({
    ...req.query,
    isOwner,
    isCustomer,
    userId: isOwner || isCustomer ? req.user._id : null,
  });
  res
    .status(200)
    .json(new ApiResponse(200, "Restaurant warnings retrieved successfully.", result));
};
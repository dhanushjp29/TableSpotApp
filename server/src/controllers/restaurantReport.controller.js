import * as restaurantReportService from "../services/restaurantReport.service.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import { USER_ROLE } from "../utils/constants.js";
import Restaurant from "../models/Restaurant.js";

export const create = async (req, res) => {
  const result = await restaurantReportService.createReport({
    ...req.validatedData,
    userId: req.user._id,
  });
  res.status(201).json(new ApiResponse(201, result.message, result));
};

export const getEligibility = async (req, res) => {
  const { restaurantId } = req.params;
  const result = await restaurantReportService.getReportEligibility({
    userId: req.user._id,
    restaurantId,
  });
  res
    .status(200)
    .json(new ApiResponse(200, "Report eligibility retrieved successfully.", result));
};

export const updateStatus = async (req, res) => {
  const { reportId } = req.params;
  const result = await restaurantReportService.updateReportStatus({
    reportId,
    ...req.validatedData,
    adminId: req.user._id,
  });
  res.status(200).json(new ApiResponse(200, result.message, result));
};

export const getById = async (req, res) => {
  const { reportId } = req.params;
  const { report } = await restaurantReportService.getReportById({ reportId });

  if (req.user.role === USER_ROLE.CUSTOMER) {
    if (String(report.userId._id) !== String(req.user._id)) {
      throw new ApiError(403, "You can only view your own reports.");
    }
  }

  if (req.user.role === USER_ROLE.OWNER) {
    const owned = await Restaurant.exists({
      _id: report.restaurantId,
      ownerId: req.user._id,
      isDeleted: false,
    });
    if (!owned) {
      throw new ApiError(
        403,
        "You can only view reports against your own restaurants."
      );
    }
  }

  res
    .status(200)
    .json(new ApiResponse(200, "Restaurant report retrieved successfully.", { report }));
};

export const getMyReports = async (req, res) => {
  const result = await restaurantReportService.getMyReports({
    userId: req.user._id,
    ...req.query,
  });
  res
    .status(200)
    .json(new ApiResponse(200, "Reports retrieved successfully.", result));
};

export const getAll = async (req, res) => {
  if (req.user.role !== USER_ROLE.ADMIN) {
    throw new ApiError(403, "Only admins can view all restaurant reports.");
  }
  const result = await restaurantReportService.getReports({
    ...req.query,
  });
  res
    .status(200)
    .json(new ApiResponse(200, "Restaurant reports retrieved successfully.", result));
};
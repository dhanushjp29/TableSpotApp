import { buildOwnerReport, buildOwnerReportDetails } from "../services/analytics.service.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";

export const getOwnerReport = asyncHandler(async (req, res) => {
  const { restaurantId, startDate, endDate, groupBy } = req.query;
  const result = await buildOwnerReport({
    req,
    restaurantId,
    startDate,
    endDate,
    groupBy,
  });
  res.status(200).json(new ApiResponse(200, "Owner report retrieved successfully.", result));
});

export const getOwnerReportExport = asyncHandler(async (req, res) => {
  const { restaurantId, startDate, endDate } = req.query;
  const result = await buildOwnerReportDetails({
    req,
    restaurantId,
    startDate,
    endDate,
  });
  res
    .status(200)
    .json(new ApiResponse(200, "Owner report export data retrieved successfully.", result));
});

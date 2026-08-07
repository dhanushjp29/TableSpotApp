import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import { runDeadlineTasks } from "../services/deadlineCron.service.js";

/**
 * Manually trigger the scheduled deadline tasks (admin-only, useful for
 * testing and on-demand catch-up without waiting for the cron interval).
 */
export const runNow = asyncHandler(async (_req, res) => {
  const result = await runDeadlineTasks({ log: console });

  res
    .status(200)
    .json(new ApiResponse(200, "Deadline tasks executed.", result));
});

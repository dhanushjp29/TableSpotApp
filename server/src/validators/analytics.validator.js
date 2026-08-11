import { z } from "zod";

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format.");

export const ownerReportQuerySchema = z.object({
  restaurantId: z.string().optional(),
  startDate: dateString.optional(),
  endDate: dateString.optional(),
  groupBy: z.enum(["day", "week", "month"]).optional(),
});

import { z } from "zod";

import {
  capacitySchema,
  mongoIdSchema,
  tableNameSchema,
} from "./common.validator.js";

import {
  TABLE_TYPE_VALUES,
  TABLE_LOCATION_VALUES,
  TABLE_STATUS_VALUES,
} from "../utils/constants.js";

// Create Table
export const createTableSchema = z
  .object({
    restaurantId: mongoIdSchema,
    tableNumber: z
      .number({
        required_error: "Table number is required.",
        invalid_type_error: "Table number must be a number.",
      })
      .int("Table number must be a whole number.")
      .positive("Table number must be greater than 0."),
    tableName: tableNameSchema.optional().default(""),
    capacity: capacitySchema,
    minimumCapacity: z
      .number({
        invalid_type_error: "Minimum capacity must be a number.",
      })
      .int("Minimum capacity must be a whole number.")
      .min(1, "Minimum capacity must be at least 1.")
      .optional(),
    tableType: z.enum(TABLE_TYPE_VALUES).optional(),
    otherTableType: z.string().trim().max(50).optional().default(""),
    tableLocation: z.enum(TABLE_LOCATION_VALUES).optional(),
    otherTableLocation: z.string().trim().max(50).optional().default(""),
    floor: z.string().trim().max(50).optional().default(""),
    status: z.enum(TABLE_STATUS_VALUES).optional(),
    isReservable: z.boolean().optional(),
    isActive: z.boolean().optional(),
    displayOrder: z
      .number({
        invalid_type_error: "Display order must be a number.",
      })
      .int("Display order must be a whole number.")
      .min(1, "Display order must be at least 1.")
      .optional(),
    description: z.string().trim().max(500).optional().default(""),
  })
  .strict();

// Update Table
export const updateTableSchema =
  createTableSchema.partial().strict();

// Update Table Status
export const updateTableStatusSchema = z
  .object({
    status: z.enum(TABLE_STATUS_VALUES),
  })
  .strict();

// Table Id
export const tableIdSchema = z
  .object({
    tableId: mongoIdSchema,
  })
  .strict();

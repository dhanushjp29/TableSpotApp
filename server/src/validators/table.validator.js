import { z } from "zod";

import {
  capacitySchema,
  mongoIdSchema,
  tableNameSchema,
} from "./common.validator.js";

import {
  SEAT_SELECTION_MODE_VALUES,
  TABLE_LOCATION_VALUES,
  TABLE_SHAPE_VALUES,
  TABLE_STATUS_VALUES,
  TABLE_TYPE_VALUES,
} from "../utils/constants.js";

const seatSchema = z
  .object({
    _id: z
      .string({
        invalid_type_error: "Seat id must be a string.",
      })
      .optional(),
    seatIndex: z
      .number({
        invalid_type_error: "Seat index must be a number.",
      })
      .int("Seat index must be a whole number.")
      .min(1, "Seat index must be at least 1."),
    seatLabel: z
      .string({
        invalid_type_error: "Seat label must be a string.",
      })
      .trim()
      .min(1, "Seat label is required.")
      .max(10, "Seat label cannot exceed 10 characters."),
    position: z
      .object({
        x: z.number().min(0).max(100),
        y: z.number().min(0).max(100),
      })
      .strict(),
    isActive: z.boolean().optional(),
  })
  .strict();

const seatSyncRefinement = (data, ctx) => {
  if (Array.isArray(data.seats) && data.seats.length > 0) {
    if (data.capacity !== undefined && Number(data.capacity) !== data.seats.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["seats"],
        message: "Number of seats must match the table capacity.",
      });
    }

    const labels = data.seats.map((seat) => seat.seatLabel.toUpperCase());
    const uniqueLabels = new Set(labels);
    if (uniqueLabels.size !== labels.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["seats"],
        message: "Seat labels must be unique within a table.",
      });
    }

    const indices = data.seats.map((seat) => seat.seatIndex);
    if (new Set(indices).size !== indices.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["seats"],
        message: "Seat indices must be unique within a table.",
      });
    }
  }
};

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
    tableLabel: z
      .string()
      .trim()
      .max(3, "Table label cannot exceed 3 characters.")
      .optional()
      .default(""),
    shape: z.enum(TABLE_SHAPE_VALUES).optional(),
    seatSelectionMode: z.enum(SEAT_SELECTION_MODE_VALUES).optional(),
    seats: z.array(seatSchema).max(100, "A table cannot have more than 100 seats.").optional(),
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
  .strict()
  .superRefine(seatSyncRefinement);

// Update Table
export const updateTableSchema = z
  .object({
    restaurantId: mongoIdSchema.optional(),
    tableNumber: z
      .number({
        invalid_type_error: "Table number must be a number.",
      })
      .int("Table number must be a whole number.")
      .positive("Table number must be greater than 0.")
      .optional(),
    tableName: tableNameSchema.optional(),
    tableLabel: z
      .string()
      .trim()
      .max(3, "Table label cannot exceed 3 characters.")
      .optional(),
    shape: z.enum(TABLE_SHAPE_VALUES).optional(),
    seatSelectionMode: z.enum(SEAT_SELECTION_MODE_VALUES).optional(),
    seats: z.array(seatSchema).max(100, "A table cannot have more than 100 seats.").optional(),
    capacity: capacitySchema.optional(),
    minimumCapacity: z
      .number({
        invalid_type_error: "Minimum capacity must be a number.",
      })
      .int("Minimum capacity must be a whole number.")
      .min(1, "Minimum capacity must be at least 1.")
      .optional(),
    tableType: z.enum(TABLE_TYPE_VALUES).optional(),
    otherTableType: z.string().trim().max(50).optional(),
    tableLocation: z.enum(TABLE_LOCATION_VALUES).optional(),
    otherTableLocation: z.string().trim().max(50).optional(),
    floor: z.string().trim().max(50).optional(),
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
    description: z.string().trim().max(500).optional(),
  })
  .strict()
  .superRefine(seatSyncRefinement);

// Update Table Status
export const updateTableStatusSchema = z
  .object({
    status: z.enum(TABLE_STATUS_VALUES),
    revertAfterMinutes: z
      .number({
        invalid_type_error: "Revert duration must be a number.",
      })
      .int("Revert duration must be a whole number of minutes.")
      .min(1, "Revert duration must be at least 1 minute.")
      .max(720, "Revert duration cannot exceed 12 hours (720 minutes).")
      .optional(),
  })
  .strict();

// Update Individual Seat Statuses
export const updateSeatsStatusSchema = z
  .object({
    seatIds: z
      .array(mongoIdSchema, {
        required_error: "At least one seat is required.",
        invalid_type_error: "seatIds must be an array of seat ids.",
      })
      .min(1, "Select at least one seat.")
      .max(100, "A table cannot have more than 100 seats."),
    status: z.enum(TABLE_STATUS_VALUES),
    revertAfterMinutes: z
      .number({
        invalid_type_error: "Revert duration must be a number.",
      })
      .int("Revert duration must be a whole number of minutes.")
      .min(1, "Revert duration must be at least 1 minute.")
      .max(720, "Revert duration cannot exceed 12 hours (720 minutes).")
      .optional(),
  })
  .strict();

// Table Id
export const tableIdSchema = z
  .object({
    tableId: mongoIdSchema,
  })
  .strict();

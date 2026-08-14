import mongoose from "mongoose";
import RestaurantTable from "../models/RestaurantTable.js";
import ApiError from "../utils/ApiError.js";
import { SEAT_SELECTION_MODE } from "../utils/constants.js";

const roundDate = (value) => new Date(new Date(value).getTime());

const buildConflictFilter = ({ start, end, requestedSeatIds = [], fullTable }) => {
  const overlap = {
    bookingDateTime: { $lt: end },
    bookingEndTime: { $gt: start },
    expiresAt: { $gt: new Date() },
  };

  if (fullTable) {
    return {
      $elemMatch: {
        ...overlap,
      },
    };
  }

  const seatIds = requestedSeatIds.map((id) => new mongoose.Types.ObjectId(String(id)));

  return {
    $elemMatch: {
      ...overlap,
      $or: [{ fullTable: true }, { seatIds: { $in: seatIds } }],
    },
  };
};

const buildIndividualCapacityExpression = ({
  start,
  end,
  requestedSeatCount,
}) => ({
  $lte: [
    {
      $add: [
        requestedSeatCount,
        {
          $sum: {
            $map: {
              input: {
                $filter: {
                  input: { $ifNull: ["$bookingHolds", []] },
                  as: "hold",
                  cond: {
                    $and: [
                      { $lt: ["$$hold.bookingDateTime", end] },
                      { $gt: ["$$hold.bookingEndTime", start] },
                      { $gt: ["$$hold.expiresAt", new Date()] },
                      { $ne: ["$$hold.fullTable", true] },
                    ],
                  },
                },
              },
              as: "hold",
              in: {
                $size: { $ifNull: ["$$hold.seatIds", []] },
              },
            },
          },
        },
      ],
    },
    "$capacity",
  ],
});

const getHoldPayload = ({
  holdToken,
  table,
  entry,
  bookingAt,
  bookingEnd,
  customerId,
  paymentId = null,
  ttlMinutes = 20,
}) => ({
  holdToken,
  bookingDateTime: roundDate(bookingAt),
  bookingEndTime: roundDate(bookingEnd),
  seatSelectionMode: entry.seatSelectionMode || table.seatSelectionMode,
  seatIds:
    entry.seatSelectionMode === SEAT_SELECTION_MODE.INDIVIDUAL_SEATS
      ? (entry.seatIds || [])
          .map((id) => String(id))
          .sort()
          .map((id) => new mongoose.Types.ObjectId(id))
      : [],
  fullTable: (entry.seatSelectionMode || table.seatSelectionMode) === SEAT_SELECTION_MODE.FULL_TABLE,
  customerId: customerId || null,
  paymentId,
  bookingId: null,
  expiresAt: new Date(Date.now() + Number(ttlMinutes || 20) * 60 * 1000),
});

export const acquireBookingHolds = async ({
  restaurantId,
  tables = [],
  bookingAt,
  bookingEnd,
  customerId = null,
  paymentId = null,
  holdToken = new mongoose.Types.ObjectId().toString(),
  ttlMinutes = 20,
}) => {
  const acquiredTableIds = [];
  const orderedTables = [...tables].sort((a, b) =>
    String(a.tableId).localeCompare(String(b.tableId))
  );

  for (const entry of orderedTables) {
    const table = await RestaurantTable.findOne({
      _id: entry.tableId,
      restaurantId,
      isActive: true,
    }).select("_id seatSelectionMode capacity bookingHolds");

    if (!table) {
      await releaseBookingHolds({ tableIds: acquiredTableIds, holdToken });
      throw new ApiError(404, "Table not found.");
    }

    const fullTable =
      (entry.seatSelectionMode || table.seatSelectionMode) === SEAT_SELECTION_MODE.FULL_TABLE;

    const conflictFilter = buildConflictFilter({
      start: bookingAt,
      end: bookingEnd,
      requestedSeatIds: entry.seatIds || [],
      fullTable,
    });

    const holdQuery = {
      _id: table._id,
      restaurantId,
      isActive: true,
      bookingHolds: {
        $not: conflictFilter,
      },
    };

    if (!fullTable) {
      holdQuery.$expr = buildIndividualCapacityExpression({
        start: bookingAt,
        end: bookingEnd,
        requestedSeatCount: (entry.seatIds || []).length,
      });
    }

    const updated = await RestaurantTable.findOneAndUpdate(
      holdQuery,
      {
        $push: {
          bookingHolds: getHoldPayload({
            holdToken,
            table,
            entry,
            bookingAt,
            bookingEnd,
            customerId,
            paymentId,
            ttlMinutes,
          }),
        },
      },
      { new: true }
    );

    if (!updated) {
      await releaseBookingHolds({ tableIds: acquiredTableIds, holdToken });
      throw new ApiError(
        409,
        "The selected table or seat(s) are already reserved for this time."
      );
    }

    acquiredTableIds.push(table._id);
  }

  return { holdToken, tableIds: acquiredTableIds };
};

export const releaseBookingHolds = async ({ tableIds = [], holdToken }) => {
  if (!holdToken || !tableIds.length) return;

  await Promise.all(
    tableIds.map((tableId) =>
      RestaurantTable.updateOne(
        { _id: tableId },
        {
          $pull: {
            bookingHolds: { holdToken },
          },
        }
      )
    )
  );
};

export const findActiveHoldByToken = async ({ tableIds = [], holdToken }) => {
  if (!holdToken || !tableIds.length) return null;

  const tables = await RestaurantTable.find({
    _id: { $in: tableIds },
    "bookingHolds.holdToken": holdToken,
    "bookingHolds.expiresAt": { $gt: new Date() },
  }).lean();

  return tables.length === tableIds.length ? tables : null;
};

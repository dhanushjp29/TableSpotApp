import Booking from "../models/Booking.js";
import Food from "../models/food.js";
import Restaurant from "../models/Restaurant.js";
import RestaurantTable from "../models/RestaurantTable.js";
import User from "../models/User.js";

import ApiError from "../utils/ApiError.js";
import generateCode from "../utils/generateCode.js";
import { getIO } from "../sockets/socket.handler.js";
import { createNotification } from "./notification.service.js";

import {
  BOOKING_STATUS,
  CODE_PREFIX,
  TABLE_STATUS,
} from "../utils/constants.js";

const calculateOrderedFoodsTotal = (foods = []) =>
  foods.reduce(
    (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0),
    0
  );

const getBookingOrThrow = async (bookingId) => {
  const booking = await Booking.findById(bookingId);

  if (!booking || booking.isDeleted) {
    throw new ApiError(404, "Booking not found.");
  }

  return booking;
};

const getTableOrThrow = async (tableId) => {
  const table = await RestaurantTable.findById(tableId);

  if (!table || !table.isActive) {
    throw new ApiError(404, "Table not found.");
  }

  return table;
};

const getRestaurantOrThrow = async (restaurantId) => {
  const restaurant = await Restaurant.findById(restaurantId);

  if (!restaurant || restaurant.isDeleted) {
    throw new ApiError(404, "Restaurant not found.");
  }

  return restaurant;
};

const setTableStateForBookingStatus = async ({
  tableId,
  bookingStatus,
}) => {
  const table = await getTableOrThrow(tableId);

  switch (bookingStatus) {
    case BOOKING_STATUS.CONFIRMED:
      table.status = TABLE_STATUS.RESERVED;
      table.isReservable = false;
      break;
    case BOOKING_STATUS.CHECKED_IN:
      table.status = TABLE_STATUS.OCCUPIED;
      table.isReservable = false;
      break;
    case BOOKING_STATUS.COMPLETED:
    case BOOKING_STATUS.CANCELLED:
    case BOOKING_STATUS.NO_SHOW:
      table.status = TABLE_STATUS.AVAILABLE;
      table.isReservable = true;
      break;
    default:
      break;
  }

  await table.save();
  return table;
};

/**
 * Validate pre-ordered foods against the Food model and
 * use server-side prices (ignoring client-supplied prices).
 */
const validateAndResolveOrderedFoods = async ({
  foods = [],
  restaurantId,
}) => {
  if (foods.length === 0) return [];

  const foodIds = foods.map((item) => item.foodId);
  const validFoods = await Food.find({
    _id: { $in: foodIds },
    restaurantId,
    isDeleted: false,
    isAvailable: true,
  });

  if (validFoods.length !== foodIds.length) {
    throw new ApiError(
      400,
      "One or more pre-ordered food items are invalid or unavailable."
    );
  }

  const foodMap = new Map(validFoods.map((f) => [String(f._id), f]));

  return foods.map((item) => {
    const food = foodMap.get(String(item.foodId));
    const variantName = item.variantName?.trim() || "Regular";

    // Resolve price from the Food model (variant price or base price)
    let price = 0;
    if (food.hasVariants && food.variants?.length > 0) {
      const variant = food.variants.find(
        (v) => String(v.variantName).toLowerCase() === variantName.toLowerCase()
      );
      if (variant) {
        price = variant.offerPrice > 0 ? variant.offerPrice : variant.price;
      } else {
        throw new ApiError(
          400,
          `Variant "${variantName}" not found for food "${food.foodName}".`
        );
      }
    } else {
      price = food.variants?.[0]?.offerPrice > 0
        ? food.variants[0].offerPrice
        : food.variants?.[0]?.price || 0;
    }

    return {
      foodId: food._id,
      variantName,
      quantity: Number(item.quantity),
      price: Number(price),
    };
  });
};

export const createBooking = async ({
  userId,
  restaurantId,
  tableId,
  bookingDateTime,
  expectedDuration = 120,
  numberOfGuests,
  bookingStatus = BOOKING_STATUS.PENDING,
  bookingType = "Online",
  paymentStatus = "Pending",
  paymentMethod = "Cash",
  advanceAmount = 0,
  totalAmount = 0,
  specialRequest = "",
  preOrderedFoods = [],
  billId = null,
}) => {
  if (!userId) {
    throw new ApiError(400, "User is required.");
  }

  const user = await User.findById(userId).select("_id isActive isDeleted");

  if (!user || !user.isActive || user.isDeleted) {
    throw new ApiError(404, "User not found.");
  }

  const restaurant = await getRestaurantOrThrow(restaurantId);
  const table = await getTableOrThrow(tableId);

  if (String(table.restaurantId) !== String(restaurant._id)) {
    throw new ApiError(
      400,
      "Selected table does not belong to the chosen restaurant."
    );
  }

  if (!restaurant.isActive) {
    throw new ApiError(400, "Restaurant is not active.");
  }

  if (restaurant.verificationStatus !== "Verified") {
    throw new ApiError(
      403,
      "This restaurant is not verified for bookings."
    );
  }

  if (!table.isReservable || table.status !== TABLE_STATUS.AVAILABLE) {
    throw new ApiError(409, "Selected table is not available.");
  }

  const bookingAt = new Date(bookingDateTime);
  if (Number.isNaN(bookingAt.getTime())) {
    throw new ApiError(400, "Valid booking date and time is required.");
  }

  if (bookingAt.getTime() < Date.now() - 5 * 60 * 1000) {
    throw new ApiError(400, "Booking time cannot be in the past.");
  }

  if (Number(numberOfGuests) > table.capacity) {
    throw new ApiError(
      400,
      "Number of guests exceeds the selected table capacity."
    );
  }

  if (Number(numberOfGuests) < (table.minimumCapacity || 1)) {
    throw new ApiError(
      400,
      "Number of guests is below the minimum capacity for this table."
    );
  }

  // Validate pre-ordered foods and resolve server-side prices
  const orderedFoods = await validateAndResolveOrderedFoods({
    foods: preOrderedFoods,
    restaurantId: restaurant._id,
  });

  if (orderedFoods.length > 0 && !totalAmount) {
    totalAmount = calculateOrderedFoodsTotal(orderedFoods);
  }

  const bookingCode = await generateCode(
    Booking,
    "bookingCode",
    CODE_PREFIX.BOOKING
  );

  const booking = await Booking.create({
    bookingCode,
    userId,
    restaurantId: restaurant._id,
    tableId: table._id,
    bookingDateTime: bookingAt,
    expectedDuration,
    numberOfGuests,
    bookingStatus,
    bookingType,
    paymentStatus,
    paymentMethod,
    advanceAmount,
    totalAmount,
    specialRequest,
    preOrderedFoods: orderedFoods,
    billId,
  });

  await Promise.all([
    Restaurant.findByIdAndUpdate(restaurant._id, {
      $inc: { totalBookings: 1 },
    }),
    RestaurantTable.findByIdAndUpdate(table._id, {
      $inc: { totalBookings: 1 },
      $set: {
        status:
          bookingStatus === BOOKING_STATUS.CHECKED_IN
            ? TABLE_STATUS.OCCUPIED
            : TABLE_STATUS.RESERVED,
        isReservable: false,
      },
    }),
  ]);

  try {
    const io = getIO();
    io.to(`restaurant_${restaurant._id}`).emit("booking:created", {
      bookingId: booking._id,
      tableId: table._id,
      bookingDateTime: bookingAt,
    });
  } catch (error) {
    console.error("Socket error on booking creation:", error);
  }

  if (restaurant.ownerId) {
    try {
      await createNotification({
        userId: restaurant.ownerId,
        title: "New Booking Received",
        message: `A new booking request (${booking.bookingCode}) has been received for ${restaurant.restaurantName}.`,
        type: "Booking",
        linkId: booking._id,
        linkModel: "Booking",
      });
    } catch (error) {
      console.error("Notification error on booking creation:", error.message);
    }
  }

  return {
    booking: await Booking.findById(booking._id)
      .populate("userId", "userCode fullName email phoneNumber role profileImage")
      .populate("restaurantId", "restaurantCode restaurantName slug city state country coverImage averageRating")
      .populate("tableId", "tableCode tableNumber tableName capacity status tableType tableLocation")
      .populate("billId"),
    message: "Booking created successfully.",
  };
};

export const updateBooking = async ({
  bookingId,
  updates = {},
}) => {
  const booking = await getBookingOrThrow(bookingId);
  const currentTableId = booking.tableId;

  if (updates.restaurantId && String(updates.restaurantId) !== String(booking.restaurantId)) {
    const restaurant = await getRestaurantOrThrow(updates.restaurantId);
    booking.restaurantId = restaurant._id;
  }

  if (updates.tableId && String(updates.tableId) !== String(booking.tableId)) {
    const nextTable = await getTableOrThrow(updates.tableId);

    if (String(nextTable.restaurantId) !== String(booking.restaurantId)) {
      throw new ApiError(
        400,
        "Selected table does not belong to the booking restaurant."
      );
    }

    if (!nextTable.isReservable || nextTable.status !== TABLE_STATUS.AVAILABLE) {
      throw new ApiError(409, "Selected table is not available.");
    }

    if (Number(booking.numberOfGuests) > nextTable.capacity) {
      throw new ApiError(
        400,
        "Number of guests exceeds the selected table capacity."
      );
    }

    booking.tableId = nextTable._id;

    await RestaurantTable.findByIdAndUpdate(nextTable._id, {
      status: TABLE_STATUS.RESERVED,
      isReservable: false,
    });

    await RestaurantTable.findByIdAndUpdate(currentTableId, {
      status: TABLE_STATUS.AVAILABLE,
      isReservable: true,
    });
  }

  const dateFields = ["bookingDateTime", "checkedInAt", "completedAt", "cancelledAt"];
  for (const field of dateFields) {
    if (updates[field] !== undefined) {
      booking[field] = updates[field] ? new Date(updates[field]) : updates[field];
    }
  }

  const numericFields = [
    "expectedDuration",
    "numberOfGuests",
    "advanceAmount",
    "totalAmount",
  ];

  for (const field of numericFields) {
    if (updates[field] !== undefined) {
      booking[field] = Number(updates[field]);
    }
  }

  const stringFields = ["specialRequest", "cancellationReason", "bookingType", "paymentStatus", "paymentMethod"];
  for (const field of stringFields) {
    if (updates[field] !== undefined) {
      booking[field] = String(updates[field]).trim();
    }
  }

  if (updates.preOrderedFoods !== undefined) {
    const orderedFoods = await validateAndResolveOrderedFoods({
      foods: updates.preOrderedFoods,
      restaurantId: booking.restaurantId,
    });
    booking.preOrderedFoods = orderedFoods;
    if (!updates.totalAmount) {
      booking.totalAmount = calculateOrderedFoodsTotal(orderedFoods);
    }
  }

  if (updates.billId !== undefined) {
    booking.billId = updates.billId;
  }

  if (updates.isActive !== undefined) {
    booking.isActive = Boolean(updates.isActive);
  }

  if (updates.bookingStatus !== undefined) {
    booking.bookingStatus = updates.bookingStatus;
  }

  await booking.save();

  return {
    booking: await Booking.findById(booking._id)
      .populate("userId", "userCode fullName email phoneNumber role profileImage")
      .populate("restaurantId", "restaurantCode restaurantName slug city state country coverImage averageRating")
      .populate("tableId", "tableCode tableNumber tableName capacity status tableType tableLocation")
      .populate("billId"),
    message: "Booking updated successfully.",
  };
};

export const updateBookingStatus = async ({
  bookingId,
  bookingStatus,
  cancellationReason = "",
}) => {
  const booking = await getBookingOrThrow(bookingId);

  booking.bookingStatus = bookingStatus;

  if (bookingStatus === BOOKING_STATUS.CHECKED_IN) {
    booking.checkedInAt = new Date();
  }

  if (bookingStatus === BOOKING_STATUS.COMPLETED) {
    booking.completedAt = new Date();
    booking.isActive = false;
  }

  if (
    bookingStatus === BOOKING_STATUS.CANCELLED ||
    bookingStatus === BOOKING_STATUS.NO_SHOW
  ) {
    booking.cancelledAt = new Date();
    booking.cancellationReason = cancellationReason.trim();
    booking.isActive = false;
  }

  await booking.save();

  await setTableStateForBookingStatus({
    tableId: booking.tableId,
    bookingStatus,
  });

  const updatedBooking = await Booking.findById(booking._id)
    .populate("userId", "userCode fullName email phoneNumber role profileImage")
    .populate("restaurantId", "restaurantCode restaurantName slug city state country coverImage averageRating")
    .populate("tableId", "tableCode tableNumber tableName capacity status tableType tableLocation")
    .populate("billId");

  try {
    const io = getIO();
    io.to(`restaurant_${booking.restaurantId}`).emit("booking:statusUpdated", {
      bookingId: booking._id,
      status: booking.bookingStatus
    });
  } catch (error) {
    console.error("Socket error on booking status update:", error);
  }

  try {
    await createNotification({
      userId: booking.userId,
      title: "Booking Update",
      message: `Your booking (${booking.bookingCode}) has been ${booking.bookingStatus.toLowerCase()}.`,
      type: "Booking",
      linkId: booking._id,
      linkModel: "Booking",
    });
  } catch (error) {
    console.error("Notification error on booking status update:", error.message);
  }

  return {
    booking: updatedBooking,
    message: "Booking status updated successfully.",
  };
};

export const cancelBooking = async ({
  bookingId,
  cancellationReason = "",
}) => {
  return updateBookingStatus({
    bookingId,
    bookingStatus: BOOKING_STATUS.CANCELLED,
    cancellationReason,
  });
};

export const checkInBooking = async ({
  bookingId,
}) => {
  return updateBookingStatus({
    bookingId,
    bookingStatus: BOOKING_STATUS.CHECKED_IN,
  });
};

export const completeBooking = async ({
  bookingId,
}) => {
  return updateBookingStatus({
    bookingId,
    bookingStatus: BOOKING_STATUS.COMPLETED,
  });
};

export const getBookingById = async ({
  bookingId,
}) => {
  const booking = await Booking.findById(bookingId)
    .populate("userId", "userCode fullName email phoneNumber role profileImage")
    .populate("restaurantId", "restaurantCode restaurantName slug city state country coverImage averageRating")
    .populate("tableId", "tableCode tableNumber tableName capacity status tableType tableLocation")
    .populate("billId");

  if (!booking || booking.isDeleted) {
    throw new ApiError(404, "Booking not found.");
  }

  return {
    booking,
  };
};

export const getBookings = async ({
  page = 1,
  limit = 10,
  userId = null,
  restaurantId = null,
  tableId = null,
  bookingStatus = null,
  bookingType = null,
  paymentStatus = null,
}) => {
  const query = { isDeleted: false };

  if (userId) {
    query.userId = userId;
  }

  if (restaurantId) {
    query.restaurantId = restaurantId;
  }

  if (tableId) {
    query.tableId = tableId;
  }

  if (bookingStatus) {
    query.bookingStatus = bookingStatus;
  }

  if (bookingType) {
    query.bookingType = bookingType;
  }

  if (paymentStatus) {
    query.paymentStatus = paymentStatus;
  }

  const pageNumber = Math.max(Number(page) || 1, 1);
  const pageSize = Math.min(Math.max(Number(limit) || 10, 1), 100);
  const skip = (pageNumber - 1) * pageSize;

  const [bookings, total] = await Promise.all([
    Booking.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .populate("userId", "userCode fullName email phoneNumber role profileImage")
      .populate("restaurantId", "restaurantCode restaurantName slug city state country coverImage averageRating")
      .populate("tableId", "tableCode tableNumber tableName capacity status tableType tableLocation")
      .populate("billId"),
    Booking.countDocuments(query),
  ]);

  return {
    bookings,
    meta: {
      page: pageNumber,
      limit: pageSize,
      total,
      totalPages: Math.ceil(total / pageSize) || 1,
    },
  };
};

import Booking from "../models/Booking.js";
import Food from "../models/food.js";
import Restaurant from "../models/Restaurant.js";
import RestaurantTable from "../models/RestaurantTable.js";
import User from "../models/User.js";

import ApiError from "../utils/ApiError.js";
import generateCode from "../utils/generateCode.js";
import generateSlug from "../utils/generateSlug.js";
import { createNotification } from "./notification.service.js";
import {
    deriveTableLabel,
    generateSeats,
} from "../utils/seatLayout.js";

import {
  BOOKING_PAYMENT_POLICY,
  BOOKING_PAYMENT_TYPE,
  CODE_PREFIX,
  RAZORPAY_ACCOUNT_STATUS,
  SEAT_SELECTION_MODE,
  TABLE_SHAPE,
  TABLE_STATUS,
  USER_ROLE,
} from "../utils/constants.js";

const TABLE_DEFAULTS = {
  tableType: "Normal",
  tableLocation: "Indoor",
  status: TABLE_STATUS.AVAILABLE,
  shape: TABLE_SHAPE.SQUARE,
  seatSelectionMode: SEAT_SELECTION_MODE.FULL_TABLE,
};

const normalizeTableInput = (table = {}) => {
  const tableNumber = Number(table.tableNumber);
  const capacity = Number(table.capacity);
  const minimumCapacity = Number(table.minimumCapacity) || 1;

  if (!Number.isInteger(tableNumber) || tableNumber < 1) {
    throw new ApiError(
      400,
      "Each table needs a valid table number (positive whole number)."
    );
  }

  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 100) {
    throw new ApiError(
      400,
      "Each table needs a valid capacity between 1 and 100."
    );
  }

  if (
    !Number.isInteger(minimumCapacity) ||
    minimumCapacity < 1 ||
    minimumCapacity > capacity
  ) {
    throw new ApiError(
      400,
      "Minimum capacity must be at least 1 and not exceed the table capacity."
    );
  }

  const shape = table.shape || TABLE_DEFAULTS.shape;
  const tableLabel = deriveTableLabel({
    tableLabel: table.tableLabel,
    tableName: table.tableName,
    tableNumber,
  });
  const seats =
    Array.isArray(table.seats) && table.seats.length > 0
      ? table.seats
      : generateSeats({ label: tableLabel, count: capacity, shape });

  return {
    tableCode: "",
    restaurantId: null,
    tableNumber,
    tableName: String(table.tableName || "").trim(),
    tableLabel,
    shape,
    seatSelectionMode: table.seatSelectionMode || TABLE_DEFAULTS.seatSelectionMode,
    seats,
    capacity,
    minimumCapacity,
    tableType: table.tableType || TABLE_DEFAULTS.tableType,
    otherTableType: String(table.otherTableType || "").trim(),
    tableLocation: table.tableLocation || TABLE_DEFAULTS.tableLocation,
    otherTableLocation: String(table.otherTableLocation || "").trim(),
    floor: String(table.floor || "").trim(),
    status: table.status || TABLE_DEFAULTS.status,
    isReservable: table.isReservable !== false,
    displayOrder: Number(table.displayOrder) || 1,
    description: String(table.description || "").trim(),
  };
};

const normalizeStringArray = (values = []) =>
  values
    .map((value) => String(value).trim())
    .filter(Boolean);

const ensureUniqueSlug = async (baseSlug, excludeId = null) => {
  const cleanBaseSlug = baseSlug || "restaurant";
  let slug = cleanBaseSlug;
  let counter = 1;

  while (
    await Restaurant.findOne({
      slug,
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    }).select("_id")
  ) {
    slug = `${cleanBaseSlug}-${counter}`;
    counter += 1;
  }

  return slug;
};

const getRestaurantOrThrow = async (restaurantId) => {
  const restaurant = await Restaurant.findById(restaurantId);

  if (!restaurant || restaurant.isDeleted) {
    throw new ApiError(404, "Restaurant not found.");
  }

  return restaurant;
};

export const createRestaurant = async ({
  ownerId,
  restaurantName,
  description = "",
  contactPerson,
  phoneNumber,
  email,
  address,
  city,
  state,
  country,
  pincode,
  location,
  coverImage,
  galleryImages = [],
  cuisineTypes = [],
  operatingHours = [],
  amenities = [],
  services = [],
  currentOffers = [],
  priceRange,
  averageCostForTwo = 0,
  verificationStatus = "Pending",
  isFeatured = false,
  isActive = true,
  tables = [],
  bookingPaymentPolicy,
  cancellationPolicy,
  customerWaitingPeriod,
  gstin = "",
  requirePaymentAccount = true,
}) => {
  if (!ownerId) {
    throw new ApiError(400, "Owner is required.");
  }

  const owner = await User.findById(ownerId).select(
    "_id isActive isDeleted role razorpayAccountId razorpayAccountStatus"
  );

  if (!owner || !owner.isActive || owner.isDeleted) {
    throw new ApiError(404, "Owner not found.");
  }

  if (owner.role !== USER_ROLE.ADMIN && requirePaymentAccount) {
    if (
      !owner.razorpayAccountId ||
      owner.razorpayAccountStatus !== RAZORPAY_ACCOUNT_STATUS.CONNECTED
    ) {
      throw new ApiError(
        400,
        "Connect and verify your Razorpay payment account before creating a restaurant."
      );
    }
  }

  if (!restaurantName) {
    throw new ApiError(400, "Restaurant name is required.");
  }

  if (!Array.isArray(tables) || tables.length === 0) {
    throw new ApiError(
      400,
      "Add at least one table before submitting your restaurant for approval."
    );
  }

  const tableNumbers = tables.map((table) => Number(table.tableNumber));
  const duplicateTableNumber = tableNumbers.find(
    (number, index) => number && tableNumbers.indexOf(number) !== index
  );

  if (duplicateTableNumber !== undefined) {
    throw new ApiError(
      409,
      `Table number ${duplicateTableNumber} is duplicated. Each table needs a unique number.`
    );
  }

  const restaurantCode = await generateCode(
    Restaurant,
    "restaurantCode",
    CODE_PREFIX.RESTAURANT
  );

  const baseSlug = generateSlug(restaurantName);
  const slug = await ensureUniqueSlug(baseSlug);

  const baseTableCode = await generateCode(
    RestaurantTable,
    "tableCode",
    CODE_PREFIX.TABLE
  );
  const baseTableNumber = Number(baseTableCode.replace(CODE_PREFIX.TABLE, ""));
  const tableCodes = tables.map((_, index) => {
    const nextNumber = baseTableNumber + index;
    return `${CODE_PREFIX.TABLE}${String(nextNumber).padStart(6, "0")}`;
  });

  const normalizedTables = tables.map((table, index) => {
    const normalized = normalizeTableInput(table);
    normalized.tableCode = tableCodes[index];
    return normalized;
  });

  const restaurant = await Restaurant.create({
    restaurantCode,
    slug,
    ownerId,
    restaurantName: restaurantName.trim(),
    description: description.trim(),
    contactPerson: contactPerson.trim(),
    phoneNumber: phoneNumber.trim(),
    email: email.trim().toLowerCase(),
    address: address.trim(),
    city: city.trim(),
    state: state.trim(),
    country: country.trim(),
    pincode: pincode.trim(),
    location,
    coverImage: coverImage.trim(),
    galleryImages: normalizeStringArray(galleryImages),
    cuisineTypes: normalizeStringArray(cuisineTypes),
    operatingHours,
    amenities: normalizeStringArray(amenities),
    services: normalizeStringArray(services),
    currentOffers,
    priceRange,
    averageCostForTwo,
    gstin: gstin.trim(),
    razorpayAccountId:
      owner.role !== USER_ROLE.ADMIN ? owner.razorpayAccountId : "",
    razorpayAccountStatus:
      owner.role !== USER_ROLE.ADMIN ? owner.razorpayAccountStatus : "",
    bookingPaymentPolicy,
    cancellationPolicy,
    customerWaitingPeriod,
    verificationStatus,
    isFeatured,
    isActive,
  });

  try {
    await RestaurantTable.insertMany(
      normalizedTables.map((table) => ({ ...table, restaurantId: restaurant._id }))
    );
  } catch (error) {
    console.error("Failed to create restaurant tables:", error.message);
    await RestaurantTable.deleteMany({ restaurantId: restaurant._id });
    await Restaurant.findByIdAndUpdate(restaurant._id, {
      isActive: false,
      isDeleted: true,
      deletedAt: new Date(),
    });
    throw new ApiError(
      500,
      "Failed to create restaurant tables. Please try again."
    );
  }

  try {
    const admins = await User.find({
      role: USER_ROLE.ADMIN,
      isActive: true,
      isDeleted: false,
    }).select("_id");

    for (const admin of admins) {
      try {
        await createNotification({
          userId: admin._id,
          title: "New Restaurant for Approval",
          message: `"${restaurant.restaurantName}" (${restaurant.restaurantCode}) has been submitted for approval.`,
          type: "System",
          linkId: restaurant._id,
          linkModel: "Restaurant",
        });
      } catch (error) {
        console.error("Notification error on restaurant creation:", error.message);
      }
    }
  } catch (error) {
    console.error("Notification error on restaurant creation:", error.message);
  }

  return {
    restaurant,
    message: "Restaurant created successfully.",
  };
};

export const updateRestaurant = async ({
  restaurantId,
  updates = {},
}) => {
  const restaurant = await getRestaurantOrThrow(restaurantId);

  const nextName = updates.restaurantName?.trim();

  if (nextName && nextName !== restaurant.restaurantName) {
    restaurant.restaurantName = nextName;
    restaurant.slug = await ensureUniqueSlug(
      generateSlug(nextName),
      restaurant._id
    );
  }

  const stringFields = [
    "description",
    "contactPerson",
    "phoneNumber",
    "email",
    "address",
    "city",
    "state",
    "country",
    "pincode",
    "coverImage",
    "priceRange",
    "rejectionReason",
  ];

  for (const field of stringFields) {
    if (updates[field] !== undefined) {
      restaurant[field] = String(updates[field]).trim();
    }
  }

  if (updates.location !== undefined) {
    restaurant.location = updates.location;
  }

  if (updates.galleryImages !== undefined) {
    restaurant.galleryImages = normalizeStringArray(updates.galleryImages);
  }

  if (updates.cuisineTypes !== undefined) {
    restaurant.cuisineTypes = normalizeStringArray(updates.cuisineTypes);
  }

  if (updates.operatingHours !== undefined) {
    restaurant.operatingHours = updates.operatingHours;
  }

  if (updates.amenities !== undefined) {
    restaurant.amenities = normalizeStringArray(updates.amenities);
  }

  if (updates.services !== undefined) {
    restaurant.services = normalizeStringArray(updates.services);
  }

  if (updates.currentOffers !== undefined) {
    restaurant.currentOffers = updates.currentOffers;
  }

  const booleanFields = ["isFeatured", "isActive"];

  for (const field of booleanFields) {
    if (updates[field] !== undefined) {
      restaurant[field] = Boolean(updates[field]);
    }
  }

  if (updates.averageCostForTwo !== undefined) {
    restaurant.averageCostForTwo = updates.averageCostForTwo;
  }

  if (updates.gstin !== undefined) {
    restaurant.gstin = String(updates.gstin).trim();
  }

  if (updates.bookingPaymentPolicy !== undefined) {
    if (!restaurant.bookingPaymentPolicy) {
      restaurant.bookingPaymentPolicy = {};
    }

    const policy = updates.bookingPaymentPolicy;

    if (policy.type !== undefined) {
      restaurant.bookingPaymentPolicy.type = policy.type;
    }

    if (policy.type === BOOKING_PAYMENT_POLICY.PAY_ON_SPOT) {
      restaurant.bookingPaymentPolicy.paymentType = BOOKING_PAYMENT_TYPE.FIXED_AMOUNT;
      restaurant.bookingPaymentPolicy.fixedAmount = 0;
      restaurant.bookingPaymentPolicy.percentage = 0;
    } else {
      if (policy.paymentType !== undefined) {
        restaurant.bookingPaymentPolicy.paymentType = policy.paymentType;
      }

      if (policy.fixedAmount !== undefined) {
        restaurant.bookingPaymentPolicy.fixedAmount = policy.fixedAmount;
      }

      if (policy.percentage !== undefined) {
        restaurant.bookingPaymentPolicy.percentage = policy.percentage;
      }

      if (policy.maximumAmount !== undefined) {
        restaurant.bookingPaymentPolicy.maximumAmount = policy.maximumAmount;
      }
    }
  }

  if (updates.cancellationPolicy !== undefined) {
    if (!restaurant.cancellationPolicy) {
      restaurant.cancellationPolicy = {};
    }

    const cancellation = updates.cancellationPolicy;

    if (cancellation.isEnabled !== undefined) {
      restaurant.cancellationPolicy.isEnabled = cancellation.isEnabled;
    }

    if (cancellation.hoursBeforeBooking !== undefined) {
      restaurant.cancellationPolicy.hoursBeforeBooking =
        cancellation.hoursBeforeBooking;
    }

    if (cancellation.refundPercentage !== undefined) {
      restaurant.cancellationPolicy.refundPercentage =
        cancellation.refundPercentage;
    }

    if (cancellation.noShowRefundPercentage !== undefined) {
      restaurant.cancellationPolicy.noShowRefundPercentage =
        cancellation.noShowRefundPercentage;
    }
  }

  if (updates.customerWaitingPeriod !== undefined) {
    restaurant.customerWaitingPeriod = updates.customerWaitingPeriod;
  }

  if (updates.verificationStatus !== undefined) {
    restaurant.verificationStatus = updates.verificationStatus;
  }

  if (updates.verifiedBy !== undefined) {
    restaurant.verifiedBy = updates.verifiedBy;
  }

  if (updates.verifiedAt !== undefined) {
    restaurant.verifiedAt = updates.verifiedAt;
  }

  if (updates.deletedAt !== undefined) {
    restaurant.deletedAt = updates.deletedAt;
  }

  await restaurant.save();

  return {
    restaurant,
    message: "Restaurant updated successfully.",
  };
};

export const verifyRestaurant = async ({
  restaurantId,
  verificationStatus,
  verifiedBy = null,
  rejectionReason = "",
}) => {
  const restaurant = await getRestaurantOrThrow(restaurantId);

  restaurant.verificationStatus = verificationStatus;
  restaurant.verifiedBy = verifiedBy;
  restaurant.verifiedAt = verificationStatus === "Verified" ? new Date() : null;
  restaurant.rejectionReason = verificationStatus === "Rejected" ? rejectionReason.trim() : "";

  await restaurant.save();

  if (
    verificationStatus === "Verified" ||
    verificationStatus === "Rejected"
  ) {
    const isApproved = verificationStatus === "Verified";
    const reason = restaurant.rejectionReason
      ? ` Reason: ${restaurant.rejectionReason}`
      : "";

    try {
      await createNotification({
        userId: restaurant.ownerId,
        title: isApproved ? "Restaurant Approved" : "Restaurant Rejected",
        message: isApproved
          ? `Congratulations! "${restaurant.restaurantName}" has been approved and is now live.`
          : `"${restaurant.restaurantName}" was rejected.${reason}`,
        type: "System",
        linkId: restaurant._id,
        linkModel: "Restaurant",
      });
    } catch (error) {
      console.error(
        "Notification error on restaurant verification:",
        error.message
      );
    }
  }

  return {
    restaurant,
    message: "Restaurant verification updated successfully.",
  };
};

export const deleteRestaurant = async ({ restaurantId }) => {
  const restaurant = await getRestaurantOrThrow(restaurantId);
  const now = new Date();

  restaurant.isActive = false;
  restaurant.isDeleted = true;
  restaurant.deletedAt = now;
  await restaurant.save();

  await Promise.all([
    RestaurantTable.updateMany(
      { restaurantId: restaurant._id },
      {
        $set: {
          isActive: false,
          isReservable: false,
        },
      }
    ),
    Food.updateMany(
      { restaurantId: restaurant._id },
      {
        $set: {
          isActive: false,
          isDeleted: true,
          deletedAt: now,
        },
      }
    ),
    Booking.updateMany(
      { restaurantId: restaurant._id },
      {
        $set: {
          isActive: false,
          isDeleted: true,
          deletedAt: now,
        },
      }
    ),
  ]);

  return {
    restaurant,
    message: "Restaurant deleted successfully.",
  };
};

export const getRestaurantCities = async () => {
  const cities = await Restaurant.distinct("city", {
    isDeleted: false,
    isActive: true,
    verificationStatus: "Verified",
  });

  return { cities };
};

export const getRestaurantById = async ({
  restaurantId,
}) => {
  const restaurant = await Restaurant.findById(restaurantId)
    .populate("ownerId", "userCode fullName email phoneNumber role profileImage")
    .populate("verifiedBy", "userCode fullName email role profileImage");

  if (!restaurant || restaurant.isDeleted) {
    throw new ApiError(404, "Restaurant not found.");
  }

  return {
    restaurant,
  };
};

export const getRestaurantBySlug = async ({
  slug,
}) => {
  const restaurant = await Restaurant.findOne({ slug })
    .populate("ownerId", "userCode fullName email phoneNumber role profileImage")
    .populate("verifiedBy", "userCode fullName email role profileImage");

  if (!restaurant || restaurant.isDeleted) {
    throw new ApiError(404, "Restaurant not found.");
  }

  return {
    restaurant,
  };
};

export const getRestaurants = async ({
  page = 1,
  limit = 10,
  search = "",
  city = "",
  ownerId = null,
  verificationStatus = "",
  isActive = true,
  isFeatured,
  sortBy = "",
  includeDeleted = false,
}) => {
  const query = {};

  if (!includeDeleted) {
    query.isDeleted = false;
  }

  if (ownerId) {
    query.ownerId = ownerId;
  }

  if (city) {
    query.city = new RegExp(city.trim(), "i");
  }

  if (verificationStatus) {
    query.verificationStatus = verificationStatus;
  }

  if (isActive !== undefined) {
    query.isActive = isActive;
  }

  if (isFeatured !== undefined) {
    query.isFeatured = isFeatured;
  }

  if (search) {
    const searchRegex = new RegExp(search.trim(), "i");
    query.$or = [
      { restaurantName: searchRegex },
      { city: searchRegex },
      { state: searchRegex },
      { cuisineTypes: searchRegex },
    ];
  }

  const pageNumber = Math.max(Number(page) || 1, 1);
  const pageSize = Math.min(Math.max(Number(limit) || 10, 1), 100);
  const skip = (pageNumber - 1) * pageSize;

  const sortOptions = {
    rating: { averageRating: -1, totalReviews: -1 },
    bookings: { totalBookings: -1 },
    featured: { isFeatured: -1, averageRating: -1 },
  };

  const sort = sortOptions[sortBy] || { createdAt: -1 };

  const [restaurants, total] = await Promise.all([
    Restaurant.find(query)
      .sort(sort)
      .skip(skip)
      .limit(pageSize)
      .populate("ownerId", "userCode fullName email phoneNumber role profileImage")
      .populate("verifiedBy", "userCode fullName email role profileImage"),
    Restaurant.countDocuments(query),
  ]);

  return {
    restaurants,
    meta: {
      page: pageNumber,
      limit: pageSize,
      total,
      totalPages: Math.ceil(total / pageSize) || 1,
    },
  };
};

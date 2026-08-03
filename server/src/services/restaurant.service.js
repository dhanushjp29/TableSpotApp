import Booking from "../models/Booking.js";
import Food from "../models/food.js";
import Restaurant from "../models/Restaurant.js";
import RestaurantTable from "../models/RestaurantTable.js";
import User from "../models/User.js";

import ApiError from "../utils/ApiError.js";
import generateCode from "../utils/generateCode.js";
import generateSlug from "../utils/generateSlug.js";

import { CODE_PREFIX } from "../utils/constants.js";

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
}) => {
  if (!ownerId) {
    throw new ApiError(400, "Owner is required.");
  }

  const owner = await User.findById(ownerId).select("_id isActive isDeleted role");

  if (!owner || !owner.isActive || owner.isDeleted) {
    throw new ApiError(404, "Owner not found.");
  }

  if (!restaurantName) {
    throw new ApiError(400, "Restaurant name is required.");
  }

  const restaurantCode = await generateCode(
    Restaurant,
    "restaurantCode",
    CODE_PREFIX.RESTAURANT
  );

  const baseSlug = generateSlug(restaurantName);
  const slug = await ensureUniqueSlug(baseSlug);

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
    verificationStatus,
    isFeatured,
    isActive,
  });

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

  const [restaurants, total] = await Promise.all([
    Restaurant.find(query)
      .sort({ createdAt: -1 })
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

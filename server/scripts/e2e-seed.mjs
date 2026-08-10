/**
 * E2E QA seed for the TableSpot offers feature.
 *
 * Idempotent: wipes prior E2E data (prefix-scoped) then recreates the base
 * fixture set used by the Playwright suite (tests/e2e/offers).
 *
 * Run from the server directory:
 *   node scripts/e2e-seed.mjs
 */

process.env.MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/TableSpot";

import mongoose from "mongoose";
import bcrypt from "bcryptjs";

import User from "../src/models/User.js";
import Restaurant from "../src/models/Restaurant.js";
import RestaurantTable from "../src/models/RestaurantTable.js";
import Food from "../src/models/food.js";
import Booking from "../src/models/Booking.js";
import Offer from "../src/models/Offer.js";
import OfferRecipient from "../src/models/OfferRecipient.js";
import Notification from "../src/models/Notification.js";
import Session from "../src/models/Session.js";
import Bill from "../src/models/Bill.js";

import generateCode from "../src/utils/generateCode.js";
import { CODE_PREFIX, USER_ROLE, SALT_ROUNDS } from "../src/utils/constants.js";

const E2E_EMAIL_SUFFIX = "e2e@tablespot.test";
const E2E_RESTAURANT_SLUG_PREFIX = "e2e-";
const E2E_TABLE_CODE_PREFIX = "E2E-";
const E2E_OFFER_CODE_PREFIX = "TS_E2E";

const usersFixture = {
  owner: {
    fullName: "E2E Owner",
    email: "owner.e2e@tablespot.test",
    phoneNumber: "9990000001",
    password: "Test@12345",
    role: USER_ROLE.OWNER,
    city: "Mumbai",
  },
  customerA: {
    fullName: "E2E Customer A",
    email: "custa.e2e@tablespot.test",
    phoneNumber: "9990000002",
    password: "Test@12345",
    role: USER_ROLE.CUSTOMER,
    city: "Mumbai",
  },
  customerB: {
    fullName: "E2E Customer B",
    email: "custb.e2e@tablespot.test",
    phoneNumber: "9990000003",
    password: "Test@12345",
    role: USER_ROLE.CUSTOMER,
    city: "Mumbai",
  },
  customerC: {
    fullName: "E2E Customer C",
    email: "custc.e2e@tablespot.test",
    phoneNumber: "9990000004",
    password: "Test@12345",
    role: USER_ROLE.CUSTOMER,
    city: "Mumbai",
  },
};

const restaurantAFixture = {
  slug: "e2e-biryani-house-a",
  restaurantName: "E2E Biryani House",
  description: "E2E QA restaurant A.",
  contactPerson: "E2E Owner",
  phoneNumber: "9990000100",
  email: "resta.e2e@tablespot.test",
  address: "12 Test Road, Andheri West",
  city: "Mumbai",
  state: "Maharashtra",
  country: "India",
  pincode: "400001",
  location: { latitude: 19.1136, longitude: 72.8697 },
  coverImage: "https://picsum.photos/seed/e2e-a/800/500",
  galleryImages: [
    "https://picsum.photos/seed/e2e-a1/800/500",
    "https://picsum.photos/seed/e2e-a2/800/500",
    "https://picsum.photos/seed/e2e-a3/800/500",
  ],
  cuisineTypes: ["North Indian", "Biryani"],
  averageCostForTwo: 600,
  verificationStatus: "Verified",
  isActive: true,
};

const restaurantBFixture = {
  slug: "e2e-curry-junction-b",
  restaurantName: "E2E Curry Junction",
  description: "E2E QA restaurant B (cross-restaurant safety).",
  contactPerson: "E2E Owner",
  phoneNumber: "9990000101",
  email: "restb.e2e@tablespot.test",
  address: "34 Test Nagar, Borivali West",
  city: "Mumbai",
  state: "Maharashtra",
  country: "India",
  pincode: "400092",
  location: { latitude: 19.2297, longitude: 72.8569 },
  coverImage: "https://picsum.photos/seed/e2e-b/800/500",
  galleryImages: [
    "https://picsum.photos/seed/e2e-b1/800/500",
    "https://picsum.photos/seed/e2e-b2/800/500",
    "https://picsum.photos/seed/e2e-b3/800/500",
  ],
  cuisineTypes: ["South Indian"],
  averageCostForTwo: 500,
  verificationStatus: "Verified",
  isActive: true,
};

const tablesAFixture = [
  { tableCode: "E2E-T1", tableNumber: 101, capacity: 2 },
  { tableCode: "E2E-T2", tableNumber: 102, capacity: 4 },
  { tableCode: "E2E-T3", tableNumber: 103, capacity: 6 },
];

const tablesBFixture = [{ tableCode: "E2E-B1", tableNumber: 201, capacity: 4 }];

const foodsAFixture = [
  {
    foodName: "Butter Chicken",
    description: "Creamy tomato curry (E2E).",
    category: "Main Course",
    foodType: "Non-Veg",
    hasVariants: true,
    variants: [
      { variantName: "Half", price: 320 },
      { variantName: "Full", price: 500 },
    ],
    coverImage: "https://picsum.photos/seed/e2e-fa1/600/400",
  },
  {
    foodName: "Veg Biryani",
    description: "Aromatic veg biryani (E2E).",
    category: "Biryani",
    foodType: "Veg",
    hasVariants: true,
    variants: [{ variantName: "Regular", price: 220 }],
    coverImage: "https://picsum.photos/seed/e2e-fa2/600/400",
  },
  {
    foodName: "Paneer Tikka",
    description: "Grilled paneer starter (E2E).",
    category: "Starters",
    foodType: "Veg",
    hasVariants: false,
    variants: [],
    coverImage: "https://picsum.photos/seed/e2e-fa3/600/400",
  },
];

const foodsBFixture = [
  {
    foodName: "Masala Dosa",
    description: "Crispy dosa (E2E B).",
    category: "South Indian",
    foodType: "Veg",
    hasVariants: true,
    variants: [{ variantName: "Plain", price: 180 }],
    coverImage: "https://picsum.photos/seed/e2e-fb1/600/400",
  },
];

const cleanup = async () => {
  const e2eUsers = await User.find({
    email: { $regex: `${E2E_EMAIL_SUFFIX.replace(".", "\\.")}$` },
  }).select("_id");
  const userIds = e2eUsers.map((u) => u._id);

  const e2eRestaurants = await Restaurant.find({
    slug: { $regex: `^${E2E_RESTAURANT_SLUG_PREFIX}` },
  }).select("_id");
  const restaurantIds = e2eRestaurants.map((r) => r._id);

  const e2eTables = await RestaurantTable.find({
    tableCode: { $regex: `^${E2E_TABLE_CODE_PREFIX}` },
  }).select("_id");
  const tableIds = e2eTables.map((t) => t._id);

  const e2eOffers = await Offer.find({
    offerCode: { $regex: `^${E2E_OFFER_CODE_PREFIX}` },
  }).select("_id");
  const offerIds = e2eOffers.map((o) => o._id);

  const results = {};
  results.sessions = await Session.deleteMany({ userId: { $in: userIds } });
  results.notifications = await Notification.deleteMany({
    $or: [{ userId: { $in: userIds } }, { actorId: { $in: userIds } }],
  });
  results.offerRecipients = await OfferRecipient.deleteMany({
    $or: [{ customerId: { $in: userIds } }, { offerId: { $in: offerIds } }],
  });
  results.bills = await Bill.deleteMany({
    $or: [{ customerId: { $in: userIds } }, { restaurantId: { $in: restaurantIds } }],
  });
  results.bookings = await Booking.deleteMany({
    $or: [{ userId: { $in: userIds } }, { restaurantId: { $in: restaurantIds } }],
  });
  results.offers = await Offer.deleteMany({
    $or: [{ restaurantId: { $in: restaurantIds } }, { _id: { $in: offerIds } }],
  });
  results.foods = await Food.deleteMany({ restaurantId: { $in: restaurantIds } });
  results.tables = await RestaurantTable.deleteMany({
    $or: [{ _id: { $in: tableIds } }, { restaurantId: { $in: restaurantIds } }],
  });
  results.restaurants = await Restaurant.deleteMany({ _id: { $in: restaurantIds } });
  results.users = await User.deleteMany({ _id: { $in: userIds } });

  console.log("Cleanup summary:", JSON.stringify(results, null, 2));
};

const createUsers = async () => {
  const created = {};
  for (const [key, fixture] of Object.entries(usersFixture)) {
    const password = await bcrypt.hash(fixture.password, SALT_ROUNDS);
    const userCode = await generateCode(User, "userCode", CODE_PREFIX.USER);
    const user = await User.create({
      userCode,
      fullName: fixture.fullName,
      email: fixture.email,
      password,
      phoneNumber: fixture.phoneNumber,
      role: fixture.role,
      city: fixture.city,
      isEmailVerified: true,
      isActive: true,
    });
    created[key] = user;
    console.log(`Created ${key}: ${fixture.email} (${userCode})`);
  }
  return created;
};

const createRestaurants = async (users) => {
  const restaurants = {};
  for (const [key, fixture] of Object.entries({
    restaurantA: restaurantAFixture,
    restaurantB: restaurantBFixture,
  })) {
    const restaurantCode = await generateCode(Restaurant, "restaurantCode", CODE_PREFIX.RESTAURANT);
    const restaurant = await Restaurant.create({
      ...fixture,
      restaurantCode,
      ownerId: users.owner._id,
    });
    restaurants[key] = restaurant;
    console.log(`Created ${key}: ${fixture.restaurantName} (${restaurantCode})`);
  }
  return restaurants;
};

const createTables = async (users, restaurants) => {
  const tables = { restaurantA: [], restaurantB: [] };
  const byRestaurant = {
    restaurantA: { list: tablesAFixture, into: tables.restaurantA },
    restaurantB: { list: tablesBFixture, into: tables.restaurantB },
  };
  for (const [restaurantKey, { list, into }] of Object.entries(byRestaurant)) {
    for (const fixture of list) {
      const tableCode = await generateCode(RestaurantTable, "tableCode", CODE_PREFIX.TABLE);
      const table = await RestaurantTable.create({
        ...fixture,
        tableCode,
        restaurantId: restaurants[restaurantKey]._id,
        status: "Available",
      });
      into.push(table);
    }
  }
  console.log(`Created tables: A=${tables.restaurantA.length}, B=${tables.restaurantB.length}`);
  return tables;
};

const createFoods = async (restaurants) => {
  const foods = { restaurantA: [], restaurantB: [] };
  const byRestaurant = {
    restaurantA: { list: foodsAFixture, into: foods.restaurantA },
    restaurantB: { list: foodsBFixture, into: foods.restaurantB },
  };
  for (const [restaurantKey, { list, into }] of Object.entries(byRestaurant)) {
    for (const fixture of list) {
      const foodCode = await generateCode(Food, "foodCode", CODE_PREFIX.FOOD);
      const food = await Food.create({
        ...fixture,
        foodCode,
        restaurantId: restaurants[restaurantKey]._id,
      });
      into.push(food);
    }
  }
  console.log(`Created foods: A=${foods.restaurantA.length}, B=${foods.restaurantB.length}`);
  return foods;
};

const createBookings = async (users, restaurants, tables) => {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  const bookingFixtures = [
    // Customer A: recent confirmed (segment: recentWithinDays 30)
    {
      user: users.customerA,
      restaurant: restaurants.restaurantA,
      table: tables.restaurantA[0],
      date: new Date(now - 12 * day),
      guests: 2,
      totalAmount: 650,
      status: "Confirmed",
    },
    // Customer A: slightly older confirmed (segment: minBookings 2)
    {
      user: users.customerA,
      restaurant: restaurants.restaurantA,
      table: tables.restaurantA[1],
      date: new Date(now - 40 * day),
      guests: 4,
      totalAmount: 1200,
      status: "Confirmed",
    },
    // Customer A: completed (segment: hasCompletedBooking)
    {
      user: users.customerA,
      restaurant: restaurants.restaurantA,
      table: tables.restaurantA[2],
      date: new Date(now - 90 * day),
      guests: 3,
      totalAmount: 900,
      status: "Completed",
    },
    // Customer B: one old booking at restaurant A (should NOT satisfy segments)
    {
      user: users.customerB,
      restaurant: restaurants.restaurantA,
      table: tables.restaurantA[1],
      date: new Date(now - 200 * day),
      guests: 2,
      totalAmount: 300,
      status: "Cancelled",
    },
    // Customer C: active recent booking at restaurant B
    {
      user: users.customerC,
      restaurant: restaurants.restaurantB,
      table: tables.restaurantB[0],
      date: new Date(now - 5 * day),
      guests: 2,
      totalAmount: 400,
      status: "Confirmed",
    },
  ];

  for (const fixture of bookingFixtures) {
    const bookingCode = await generateCode(Booking, "bookingCode", CODE_PREFIX.BOOKING);
    await Booking.create({
      bookingCode,
      userId: fixture.user._id,
      restaurantId: fixture.restaurant._id,
      tableId: fixture.table._id,
      tableIds: [fixture.table._id],
      bookingDateTime: fixture.date,
      numberOfGuests: fixture.guests,
      totalAmount: fixture.totalAmount,
      bookingStatus: fixture.status,
      bookingType: "Online",
      paymentStatus: "Paid",
      isActive: true,
    });
  }
  console.log(`Created bookings: ${bookingFixtures.length}`);
};

const main = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB.");

  await cleanup();
  const users = await createUsers();
  const restaurants = await createRestaurants(users);
  const tables = await createTables(users, restaurants);
  const foods = await createFoods(restaurants);
  await createBookings(users, restaurants, tables);

  const summary = {
    users: Object.keys(users).length,
    restaurants: Object.keys(restaurants).length,
    tables: tables.restaurantA.length + tables.restaurantB.length,
    foods: foods.restaurantA.length + foods.restaurantB.length,
  };
  console.log("SEED COMPLETE:", JSON.stringify(summary));

  await mongoose.disconnect();
};

main().catch((error) => {
  console.error("SEED FAILED:", error);
  process.exitCode = 1;
});

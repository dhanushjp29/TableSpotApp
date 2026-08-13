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
import RestaurantReport from "../src/models/RestaurantReport.js";
import RestaurantWarning from "../src/models/RestaurantWarning.js";

import generateCode from "../src/utils/generateCode.js";
import { CODE_PREFIX, USER_ROLE, SALT_ROUNDS } from "../src/utils/constants.js";

const E2E_EMAIL_SUFFIX = "e2e@tablespot.test";
const E2E_RESTAURANT_SLUG_PREFIX = "e2e-";
const E2E_TABLE_CODE_PREFIX = "E2E-";
const E2E_OFFER_CODE_PREFIX = "TS_E2E";

const usersFixture = {
  admin: {
    fullName: "E2E Admin",
    email: "admin.e2e@tablespot.test",
    phoneNumber: "9990000000",
    password: "Test@12345",
    role: USER_ROLE.ADMIN,
  },
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
  results.warnings = await RestaurantWarning.deleteMany({
    $or: [
      { ownerId: { $in: userIds } },
      { restaurantId: { $in: restaurantIds } },
      { issuedBy: { $in: userIds } },
    ],
  });
  results.reports = await RestaurantReport.deleteMany({
    $or: [{ userId: { $in: userIds } }, { restaurantId: { $in: restaurantIds } }],
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
    // Customer A: completed (segment: hasCompletedBooking) + report eligibility
    {
      user: users.customerA,
      restaurant: restaurants.restaurantA,
      table: tables.restaurantA[2],
      date: new Date(now - 90 * day),
      guests: 3,
      totalAmount: 900,
      status: "Completed",
      completedAt: new Date(now - 89 * day),
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

  const createdBookings = [];
  for (const fixture of bookingFixtures) {
    const bookingCode = await generateCode(Booking, "bookingCode", CODE_PREFIX.BOOKING);
    const booking = await Booking.create({
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
      completedAt: fixture.completedAt || null,
      isActive: true,
    });
    createdBookings.push(booking);
  }
  console.log(`Created bookings: ${createdBookings.length}`);
  return createdBookings;
};

/**
 * A settled (Paid) bill for the customer A completed visit at restaurant A.
 * Unlocks report eligibility, review eligibility, and offer redemption flows.
 */
const createBills = async (users, restaurants, foods, bookings) => {
  const completed = bookings.find(
    (b) =>
      b.bookingStatus === "Completed" &&
      String(b.userId) === String(users.customerA._id) &&
      String(b.restaurantId) === String(restaurants.restaurantA._id)
  );

  if (!completed) {
    throw new Error("Completed booking for customer A not found; cannot seed bill.");
  }

  const butterChicken = foods.restaurantA.find((f) => f.foodName === "Butter Chicken");
  const vegBiryani = foods.restaurantA.find((f) => f.foodName === "Veg Biryani");

  const orderedItems = [
    {
      foodId: butterChicken._id,
      foodName: butterChicken.foodName,
      variantName: "Full",
      quantity: 1,
      unitPrice: 500,
      offerPrice: 0,
      totalPrice: 500,
      orderSource: "Spot Order",
      gstRate: 0,
    },
    {
      foodId: vegBiryani._id,
      foodName: vegBiryani.foodName,
      variantName: "Regular",
      quantity: 2,
      unitPrice: 220,
      offerPrice: 0,
      totalPrice: 440,
      orderSource: "Spot Order",
      gstRate: 0,
    },
  ];

  const billCode = await generateCode(Bill, "billCode", CODE_PREFIX.BILL);
  const bill = await Bill.create({
    billCode,
    bookingId: completed._id,
    billType: "ONLINE",
    tableId: completed.tableId,
    restaurantId: restaurants.restaurantA._id,
    customerName: "E2E Customer A",
    customerPhone: users.customerA.phoneNumber,
    customerEmail: users.customerA.email,
    orderedItems,
    subTotal: 940,
    discount: { type: "Amount", value: 0 },
    offer: {
      offerId: null,
      offerCode: "",
      title: "",
      discountType: "Amount",
      discountValue: 0,
      discountAmount: 0,
      isStackable: false,
      appliedAt: null,
    },
    taxAmount: 0,
    taxPercentage: 0,
    grandTotal: 940,
    payment: {
      totalPaid: 940,
      advancePaid: 940,
      spotPaid: 0,
      balanceDue: 0,
      paymentStatus: "Paid",
      payments: [{ paymentMethod: "UPI", amount: 940 }],
    },
    billStatus: "Paid",
    generatedBy: users.owner._id,
    generatedAt: completed.completedAt,
  });

  console.log(`Created bill: ${billCode} (${bill.grandTotal})`);
  return bill;
};

const createOffers = async (users, restaurants) => {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  const offerFixtures = [
    {
      offerCode: "TS_E2E10",
      title: "E2E 15% Off",
      description: "E2E flat 15% percentage offer.",
      discountType: "Percentage",
      discountValue: 15,
      minOrderAmount: 0,
      maxDiscountAmount: 300,
      maxRedemptions: 200,
      perUserRedemptionLimit: 1,
      targeting: "ALL",
      isStackable: false,
      isActive: true,
      validityStart: new Date(now - 1 * day),
      validityEnd: new Date(now + 364 * day),
    },
    {
      offerCode: "TS_E2E11",
      title: "E2E 150 Off",
      description: "E2E fixed amount offer with min order.",
      discountType: "Amount",
      discountValue: 150,
      minOrderAmount: 800,
      maxDiscountAmount: 150,
      maxRedemptions: 100,
      perUserRedemptionLimit: 2,
      targeting: "ALL",
      isStackable: false,
      isActive: true,
      validityStart: new Date(now - 1 * day),
      validityEnd: new Date(now + 364 * day),
    },
    {
      offerCode: "TS_E2E12",
      title: "E2E Loyalty 10%",
      description: "E2E segment offer (completed booking customers).",
      discountType: "Percentage",
      discountValue: 10,
      minOrderAmount: 0,
      maxDiscountAmount: 200,
      maxRedemptions: 100,
      perUserRedemptionLimit: 1,
      targeting: "SEGMENT",
      segmentRules: { minBookings: 1, minTotalSpent: 0, hasCompletedBooking: true, recentWithinDays: 0, inactiveSinceDays: 0 },
      isStackable: false,
      isActive: true,
      validityStart: new Date(now - 1 * day),
      validityEnd: new Date(now + 364 * day),
    },
    {
      offerCode: "TS_E2E13",
      title: "E2E Selected 20%",
      description: "E2E manual-select offer for customers A and B.",
      discountType: "Percentage",
      discountValue: 20,
      minOrderAmount: 0,
      maxDiscountAmount: 500,
      maxRedemptions: 100,
      perUserRedemptionLimit: 1,
      targeting: "SELECTED",
      targetUserIds: [users.customerA._id, users.customerB._id],
      isStackable: false,
      isActive: true,
      validityStart: new Date(now - 1 * day),
      validityEnd: new Date(now + 364 * day),
    },
    {
      offerCode: "TS_E2E14",
      title: "E2E Expired Offer",
      description: "E2E offer whose validity window has closed.",
      discountType: "Amount",
      discountValue: 50,
      minOrderAmount: 0,
      maxDiscountAmount: 50,
      maxRedemptions: 100,
      perUserRedemptionLimit: 1,
      targeting: "ALL",
      isStackable: false,
      isActive: true,
      validityStart: new Date(now - 60 * day),
      validityEnd: new Date(now - 10 * day),
    },
    {
      offerCode: "TS_E2E15",
      title: "E2E Paused Offer",
      description: "E2E offer paused by the owner.",
      discountType: "Amount",
      discountValue: 25,
      minOrderAmount: 0,
      maxDiscountAmount: 25,
      maxRedemptions: 100,
      perUserRedemptionLimit: 1,
      targeting: "ALL",
      isStackable: false,
      isActive: false,
      validityStart: new Date(now - 1 * day),
      validityEnd: new Date(now + 364 * day),
    },
  ];

  const created = [];
  for (const fixture of offerFixtures) {
    const offer = await Offer.create({
      ...fixture,
      restaurantId: restaurants.restaurantA._id,
      createdBy: users.owner._id,
    });
    created.push(offer);
  }

  console.log(`Created offers: ${created.length}`);
  return created;
};

const main = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB.");

  await cleanup();
  const users = await createUsers();
  const restaurants = await createRestaurants(users);
  const tables = await createTables(users, restaurants);
  const foods = await createFoods(restaurants);
  const bookings = await createBookings(users, restaurants, tables);
  const bill = await createBills(users, restaurants, foods, bookings);
  const offers = await createOffers(users, restaurants);

  const summary = {
    users: Object.keys(users).length,
    restaurants: Object.keys(restaurants).length,
    tables: tables.restaurantA.length + tables.restaurantB.length,
    foods: foods.restaurantA.length + foods.restaurantB.length,
    bookings: bookings.length,
    bills: 1,
    offers: offers.length,
  };
  console.log("SEED COMPLETE:", JSON.stringify(summary));

  await mongoose.disconnect();
};

main().catch(async (error) => {
  console.error("SEED FAILED:", error);
  try {
    await mongoose.disconnect();
  } finally {
    process.exit(1);
  }
});

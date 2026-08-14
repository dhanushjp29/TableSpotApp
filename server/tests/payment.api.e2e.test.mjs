import assert from "node:assert/strict";
import http from "node:http";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const mongoUri = process.env.TEST_MONGODB_URI || "mongodb://127.0.0.1:27017/tablespot_payment_api_test";
if (!/^(mongodb:\/\/)(localhost|127\.0\.0\.1)(?::\d+)?\//i.test(mongoUri)) {
  throw new Error("Payment E2E requires a localhost MongoDB URI before destructive test setup.");
}
process.env.NODE_ENV = "test";
process.env.MONGODB_URI = mongoUri;
process.env.ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || "payment-api-test-access-secret";
process.env.REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || "payment-api-test-refresh-secret";
process.env.ACCESS_TOKEN_EXPIRES_IN = "15m";
process.env.REFRESH_TOKEN_EXPIRES_IN = "7d";
process.env.SALT_ROUNDS = "4";
process.env.RAZORPAY_ORDER_MOCK ??= "true";

if (String(process.env.RAZORPAY_ORDER_MOCK).toLowerCase() === "false" &&
    !String(process.env.TEST_RAZORPAY_ACCOUNT_ID || "").trim()) {
  throw new Error("TEST_RAZORPAY_ACCOUNT_ID is required for a real Razorpay payment E2E run.");
}

const { default: app } = await import("../src/app.js");
const { default: User } = await import("../src/models/User.js");
const { default: Restaurant } = await import("../src/models/Restaurant.js");
const { default: RestaurantTable } = await import("../src/models/RestaurantTable.js");

const request = async (base, path, options = {}) => {
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: { "content-type": "application/json", ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
};

const main = async () => {
  await mongoose.connect(mongoUri);
  await mongoose.connection.dropDatabase();
  const password = await bcrypt.hash("PaymentApi!12345", 4);
  const owner = await User.create({
    userCode: "PAYOWNER1",
    fullName: "Payment Owner",
    email: "payment-owner@example.test",
    password,
    role: "owner",
    isEmailVerified: true,

    razorpayAccountId: process.env.TEST_RAZORPAY_ACCOUNT_ID,
    razorpayAccountStatus: "Connected & Verified",
  });
  const customer = await User.create({
    userCode: "PAYCUSTOM1", fullName: "Payment Customer", email: "payment-customer@example.test",
    password, role: "customer", isEmailVerified: true,
  });
  const restaurant = await Restaurant.create({
    restaurantCode: "PAYREST01", slug: "payment-api-restaurant", ownerId: owner._id,
    restaurantName: "Payment API Restaurant", contactPerson: "Payment Owner", phoneNumber: "9999999999",
    email: "payment-restaurant@example.test", address: "1 Test Street", city: "Test City",
    state: "Test State", country: "India", pincode: "600001", location: { latitude: 13, longitude: 80 },
    coverImage: "https://example.test/cover.jpg",
    galleryImages: ["https://example.test/1.jpg", "https://example.test/2.jpg", "https://example.test/3.jpg"],
    verificationStatus: "Verified", isActive: true,
    bookingPaymentPolicy: { type: "PAY_TO_BOOK", paymentType: "FIXED_AMOUNT", fixedAmount: 50, maximumAmount: 200 },
  });
  const table = await RestaurantTable.create({
    tableCode: "PAYTABLE01", restaurantId: restaurant._id, tableNumber: 1, capacity: 2,
    seats: [{ seatIndex: 1, seatLabel: "S1", position: { x: 20, y: 50 } }, { seatIndex: 2, seatLabel: "S2", position: { x: 80, y: 50 } }],
  });

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}/api/v1`;
  const login = await request(base, "/auth/login", {
    method: "POST", body: JSON.stringify({ email: "payment-customer@example.test", password: "PaymentApi!12345" }),
  });
  assert.equal(login.status, 200);
  const cookie = (login.headers?.getSetCookie?.() || []).map((value) => value.split(";")[0]).join("; ");
  // fetch Headers are not serializable through request(); repeat login with a direct response for cookies.
  const loginResponse = await fetch(`${base}/auth/login`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "payment-customer@example.test", password: "PaymentApi!12345" }),
  });
  const authCookie = (loginResponse.headers.getSetCookie?.() || []).map((value) => value.split(";")[0]).join("; ");
  assert.ok(authCookie || cookie, "login did not return authentication cookies");

  const response = await request(base, "/payments/create-order", {
    method: "POST", headers: { Cookie: authCookie || cookie },
    body: JSON.stringify({
      purpose: "BOOKING_ADVANCE", idempotencyKey: "payment-api-smoke-1",
      bookingData: {
        restaurantId: String(restaurant._id),
        tables: [{ tableId: String(table._id), seatIds: [] }],
        bookingDateTime: "2035-02-01T10:00:00.000Z", expectedDuration: 60, numberOfGuests: 1,
      },
    }),
  });
  console.log(`[PAYMENT-API] create-order status=${response.status} body=${JSON.stringify(response.body)}`);
  assert.equal(response.status, 200);
  assert.ok(response.body.data?.order?.id, "Razorpay order id missing");
  if (String(process.env.RAZORPAY_ORDER_MOCK).toLowerCase() === "false") {
    assert.match(response.body.data.order.id, /^order_/, "real mode returned a non-Razorpay order id");
  }
  assert.equal(response.body.data.order.amount, 5000);
  console.log(`[PASS] authenticated payment-first order created: ${response.body.data.order.id}`);

  await new Promise((resolve) => server.close(resolve));
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
};

try {
  await main();
} catch (error) {
  console.error(`[FAIL] payment API smoke: ${error.stack || error.message}`);
  try { await mongoose.disconnect(); } catch {}
  process.exitCode = 1;
}

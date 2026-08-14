import assert from "node:assert/strict";
import http from "node:http";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const mongoUri = process.env.TEST_MONGODB_URI ||
  "mongodb://127.0.0.1:27017/tablespot_payment_account_test";
if (!/^(mongodb:\/\/)(localhost|127\.0\.0\.1)(?::\d+)?\//i.test(mongoUri)) {
  throw new Error("Payment-account runtime tests require a localhost MongoDB URI before destructive test setup.");
}
process.env.NODE_ENV = "test";
process.env.MONGODB_URI = mongoUri;
process.env.ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || "payment-account-test-access-secret";
process.env.REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || "payment-account-test-refresh-secret";
process.env.ACCESS_TOKEN_EXPIRES_IN = "15m";
process.env.REFRESH_TOKEN_EXPIRES_IN = "7d";
process.env.SALT_ROUNDS = "4";
process.env.RAZORPAY_ONBOARDING_MOCK ??= "true";
process.env.RAZORPAY_ORDER_MOCK ??= "true";

const { default: app } = await import("../src/app.js");
const { default: User } = await import("../src/models/User.js");
const { default: Restaurant } = await import("../src/models/Restaurant.js");
const { default: RestaurantTable } = await import("../src/models/RestaurantTable.js");
const accountService = await import("../src/services/paymentAccount.service.js");
const { RAZORPAY_ACCOUNT_STATUS } = await import("../src/utils/constants.js");

const results = [];
const run = async (label, fn) => {
  try {
    await fn();
    results.push({ label, status: "PASS" });
    console.log(`[PASS] ${label}`);
  } catch (error) {
    results.push({ label, status: "FAIL", error: error.message });
    console.log(`[FAIL] ${label}: ${error.message}`);
  }
};

const request = async (base, path, options = {}) => {
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: { "content-type": "application/json", ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body, headers: response.headers };
};

const main = async () => {
  await mongoose.connect(mongoUri);
  await mongoose.connection.dropDatabase();
  const password = await bcrypt.hash("PaymentAccount!12345", 4);
  const createOwner = async (code, email) => User.create({
    userCode: code, fullName: code, email, password, role: "owner", isEmailVerified: true,
  });
  const ownerA = await createOwner("ACCOUNTOWNER1", "account-owner-a@example.test");
  const ownerB = await createOwner("ACCOUNTOWNER2", "account-owner-b@example.test");
  const ownerC = await createOwner("ACCOUNTOWNER3", "account-owner-c@example.test");
  const ownerD = await createOwner("ACCOUNTOWNER4", "account-owner-d@example.test");
  const ownerE = await createOwner("ACCOUNTOWNER5", "account-owner-e@example.test");

  await run("1. First connect creates one stored account reference", async () => {
    const result = await accountService.connectPaymentAccount({ ownerId: ownerA._id });
    const saved = await User.findById(ownerA._id).lean();
    assert.match(result.accountId, /^acc_mock_/);
    assert.equal(saved.razorpayAccountId, result.accountId);
    assert.equal(saved.razorpayAccountStatus, RAZORPAY_ACCOUNT_STATUS.VERIFICATION_PENDING);
  });

  await run("2. Repeated connect reuses the existing account reference", async () => {
    const before = await User.findById(ownerA._id).lean();
    const result = await accountService.connectPaymentAccount({ ownerId: ownerA._id });
    assert.equal(result.accountId, before.razorpayAccountId);
    assert.equal(await User.countDocuments({ _id: ownerA._id }), 1);
  });

  await run("3. Concurrent connect requests are checked", async () => {
    const resultsForOwnerB = await Promise.all([
      accountService.connectPaymentAccount({ ownerId: ownerB._id }),
      accountService.connectPaymentAccount({ ownerId: ownerB._id }),
    ]);
    const distinctIds = new Set(resultsForOwnerB.map((result) => result.accountId));
    const saved = await User.findById(ownerB._id).lean();
    assert.equal(distinctIds.size, 1, `concurrent requests returned ${distinctIds.size} account IDs`);
    assert.equal(saved.razorpayAccountId, resultsForOwnerB[0].accountId);
  });

  await run("4. Five concurrent requests create one external account reference", async () => {
    const resultsForOwnerC = await Promise.all(
      Array.from({ length: 5 }, () =>
        accountService.connectPaymentAccount({ ownerId: ownerC._id })
      )
    );
    const distinctIds = new Set(resultsForOwnerC.map((result) => result.accountId));
    const saved = await User.findById(ownerC._id).lean();
    assert.equal(distinctIds.size, 1, `concurrent requests returned ${distinctIds.size} account IDs`);
    assert.equal(saved.razorpayAccountId, resultsForOwnerC[0].accountId);
    console.log(`[INFO] inferred external/mock account creations: ${distinctIds.size}`);
  });

  await run("5. Failed creation clears the claim and permits retry", async () => {
    const previousMock = process.env.RAZORPAY_ONBOARDING_MOCK;
    const previousKeyId = process.env.RAZORPAY_KEY_ID;
    const previousKeySecret = process.env.RAZORPAY_KEY_SECRET;
    process.env.RAZORPAY_ONBOARDING_MOCK = "false";
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;
    await assert.rejects(() =>
      accountService.connectPaymentAccount({ ownerId: ownerD._id })
    );
    const failed = await User.findById(ownerD._id).select(
      "+razorpayAccountCreationAttemptId +razorpayAccountCreationStartedAt"
    ).lean();
    assert.equal(failed.razorpayAccountId, "");
    assert.equal(failed.razorpayAccountCreationStatus, "Idle");
    assert.equal(failed.razorpayAccountCreationAttemptId, "");
    process.env.RAZORPAY_ONBOARDING_MOCK = previousMock;
    if (previousKeyId === undefined) delete process.env.RAZORPAY_KEY_ID;
    else process.env.RAZORPAY_KEY_ID = previousKeyId;
    if (previousKeySecret === undefined) delete process.env.RAZORPAY_KEY_SECRET;
    else process.env.RAZORPAY_KEY_SECRET = previousKeySecret;
    const retried = await accountService.connectPaymentAccount({ ownerId: ownerD._id });
    assert.match(retried.accountId, /^acc_mock_/);
    assert.equal((await User.findById(ownerD._id)).razorpayAccountId, retried.accountId);
  });

  await run("6. Mock status refresh transitions pending to connected", async () => {
    const before = await User.findById(ownerA._id).lean();
    assert.equal(before.razorpayAccountStatus, RAZORPAY_ACCOUNT_STATUS.VERIFICATION_PENDING);
    const result = await accountService.refreshPaymentAccountStatus({ ownerId: ownerA._id });
    const saved = await User.findById(ownerA._id).lean();
    assert.equal(result.status, RAZORPAY_ACCOUNT_STATUS.CONNECTED);
    assert.equal(saved.razorpayAccountStatus, RAZORPAY_ACCOUNT_STATUS.CONNECTED);
  });

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/v1`;
  const login = async (email) => {
    const response = await request(base, "/auth/login", {
      method: "POST", body: JSON.stringify({ email, password: "PaymentAccount!12345" }),
    });
    assert.equal(response.status, 200);
    return (response.headers.getSetCookie?.() || []).map((value) => value.split(";")[0]).join("; ");
  };
  const ownerACookie = await login("account-owner-a@example.test");
  const ownerBCookie = await login("account-owner-b@example.test");
  const ownerECookie = await login("account-owner-e@example.test");

  await run("10. Authenticated concurrent connect endpoint calls share one account", async () => {
    const responses = await Promise.all(
      Array.from({ length: 5 }, () =>
        request(base, "/payments/account/connect", {
          method: "POST",
          headers: { Cookie: ownerECookie },
          body: JSON.stringify({ razorpayAccountId: "client_override_must_be_ignored" }),
        })
      )
    );
    assert.ok(responses.every((response) => response.status === 200));
    const returnedIds = new Set(responses.map((response) => response.body.data.accountId));
    const saved = await User.findById(ownerE._id).lean();
    assert.equal(returnedIds.size, 1);
    assert.equal(saved.razorpayAccountId, [...returnedIds][0]);
    assert.notEqual(saved.razorpayAccountId, "client_override_must_be_ignored");
  });

  await run("7. Account status endpoint is scoped to authenticated owner", async () => {
    const ownerAStatus = await request(base, "/payments/account/status", { headers: { Cookie: ownerACookie } });
    const ownerBStatus = await request(base, "/payments/account/status", { headers: { Cookie: ownerBCookie } });
    assert.equal(ownerAStatus.status, 200);
    assert.equal(ownerBStatus.status, 200);
    assert.equal(ownerAStatus.body.data.accountId, String((await User.findById(ownerA._id)).razorpayAccountId));
    assert.equal(ownerBStatus.body.data.accountId, String((await User.findById(ownerB._id)).razorpayAccountId));
    assert.notEqual(ownerAStatus.body.data.accountId, ownerBStatus.body.data.accountId);
  });

  const restaurant = await Restaurant.create({
    restaurantCode: "ACCOUNTREST01", slug: "account-runtime-restaurant", ownerId: ownerA._id,
    restaurantName: "Account Runtime Restaurant", contactPerson: "Account Owner", phoneNumber: "9999999999",
    email: "account-restaurant@example.test", address: "1 Test Street", city: "Test City",
    state: "Test State", country: "India", pincode: "600001", location: { latitude: 13, longitude: 80 },
    coverImage: "https://example.test/cover.jpg",
    galleryImages: ["https://example.test/1.jpg", "https://example.test/2.jpg", "https://example.test/3.jpg"],
    verificationStatus: "Verified", isActive: true,
    bookingPaymentPolicy: { type: "PAY_TO_BOOK", paymentType: "FIXED_AMOUNT", fixedAmount: 50 },
  });
  const table = await RestaurantTable.create({
    tableCode: "ACCOUNTTABLE01", restaurantId: restaurant._id, tableNumber: 1, capacity: 2,
  });
  const paymentPayload = {
    purpose: "BOOKING_ADVANCE", idempotencyKey: "account-prerequisite-test",
    bookingData: {
      restaurantId: String(restaurant._id), tables: [{ tableId: String(table._id), seatIds: [] }],
      bookingDateTime: "2035-03-01T10:00:00.000Z", expectedDuration: 60, numberOfGuests: 1,
    },
  };

  await run("8. Payment rejects missing or unverified account", async () => {
    await User.findByIdAndUpdate(ownerA._id, {
      razorpayAccountId: "", razorpayAccountStatus: RAZORPAY_ACCOUNT_STATUS.NOT_CONNECTED,
    });
    const missing = await request(base, "/payments/create-order", {
      method: "POST", headers: { Cookie: ownerACookie }, body: JSON.stringify(paymentPayload),
    });
    assert.equal(missing.status, 400);
    await User.findByIdAndUpdate(ownerA._id, {
      razorpayAccountId: "account-present-for-status-test", razorpayAccountStatus: RAZORPAY_ACCOUNT_STATUS.VERIFICATION_PENDING,
    });
    const pending = await request(base, "/payments/create-order", {
      method: "POST", headers: { Cookie: ownerACookie }, body: JSON.stringify({ ...paymentPayload, idempotencyKey: "account-prerequisite-pending" }),
    });
    assert.equal(pending.status, 400);
  });

  await run("9. Connected account permits payment order authorization", async () => {
    await User.findByIdAndUpdate(ownerA._id, {
      razorpayAccountId: "account-connected-for-mock-test", razorpayAccountStatus: RAZORPAY_ACCOUNT_STATUS.CONNECTED,
    });
    const allowed = await request(base, "/payments/create-order", {
      method: "POST", headers: { Cookie: ownerACookie }, body: JSON.stringify({ ...paymentPayload, idempotencyKey: "account-prerequisite-connected" }),
    });
    assert.equal(allowed.status, 200, JSON.stringify(allowed.body));
  });

  const userIndexes = await User.collection.indexes();
  const restaurantIndexes = await Restaurant.collection.indexes();
  console.log(`[INFO] User razorpayAccountId unique index: ${userIndexes.some((index) => index.unique && index.key?.razorpayAccountId === 1)}`);
  console.log(`[INFO] Restaurant razorpayAccountId unique index: ${restaurantIndexes.some((index) => index.unique && index.key?.razorpayAccountId === 1)}`);

  await new Promise((resolve) => server.close(resolve));
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  console.log(`RESULTS: ${results.map((result) => `${result.status} ${result.label}`).join(" | ")}`);
  if (results.some((result) => result.status === "FAIL")) process.exitCode = 1;
};

try {
  await main();
} catch (error) {
  console.error(`[BLOCKED] onboarding runtime harness: ${error.stack || error.message}`);
  try { await mongoose.disconnect(); } catch {}
  process.exitCode = 2;
}

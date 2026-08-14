import assert from "node:assert/strict";
import http from "node:http";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { io as socketClient } from "socket.io-client";

const mongoUri = process.env.TEST_MONGODB_URI ||
  "mongodb://127.0.0.1:27017/tablespot_booking_api_test";
if (!/^(mongodb:\/\/)(localhost|127\.0\.0\.1)(?::\d+)?\//i.test(mongoUri)) {
  throw new Error("Booking API E2E requires a localhost MongoDB URI before destructive test setup.");
}

process.env.NODE_ENV = "test";
process.env.MONGODB_URI = mongoUri;
process.env.ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || "api-e2e-access-secret";
process.env.REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || "api-e2e-refresh-secret";
process.env.ACCESS_TOKEN_EXPIRES_IN = "15m";
process.env.REFRESH_TOKEN_EXPIRES_IN = "7d";
process.env.SALT_ROUNDS = "4";
process.env.CLIENT_URL = "http://127.0.0.1:5000";

const { default: app } = await import("../src/app.js");
const { initSocket, closeSocket } = await import("../src/sockets/socket.handler.js");
const { default: User } = await import("../src/models/User.js");
const { default: Restaurant } = await import("../src/models/Restaurant.js");
const { default: RestaurantTable } = await import("../src/models/RestaurantTable.js");
const { default: Booking } = await import("../src/models/Booking.js");
const { SEAT_SELECTION_MODE } = await import("../src/utils/constants.js");

const results = [];
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const api = async (base, path, options = {}) => {
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: { "content-type": "application/json", ...(options.headers || {}) },
  });
  const text = await response.text();
  let body;
  try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
  return { status: response.status, body, headers: response.headers };
};

const cookieFrom = (headers) => {
  const values = headers.getSetCookie?.() || [];
  return values.map((value) => value.split(";")[0]).join("; ");
};

const expectStatus = (response, expected, label) => {
  assert.equal(response.status, expected, `${label}: expected ${expected}, got ${response.status}: ${JSON.stringify(response.body)}`);
};

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

const main = async () => {
  await mongoose.connect(mongoUri);
  await mongoose.connection.dropDatabase();

  const password = "ApiE2E!12345";
  const passwordHash = await bcrypt.hash(password, 4);
  const owner = await User.create({
    userCode: "E2EOWNER1", fullName: "API E2E Owner", email: "api-e2e-owner@example.test",
    password: passwordHash, role: "owner", isEmailVerified: true,
  });
  const customer = await User.create({
    userCode: "E2ECUSTOM1", fullName: "API E2E Customer", email: "api-e2e-customer@example.test",
    password: passwordHash, role: "customer", isEmailVerified: true,
  });
  const customerTwo = await User.create({
    userCode: "E2ECUSTOM2", fullName: "API E2E Customer Two", email: "api-e2e-customer2@example.test",
    password: passwordHash, role: "customer", isEmailVerified: true,
  });
  const restaurant = await Restaurant.create({
    restaurantCode: "E2EREST01", slug: "api-e2e-restaurant", ownerId: owner._id,
    restaurantName: "API E2E Restaurant", contactPerson: "API E2E Owner", phoneNumber: "9999999999",
    email: "api-e2e-restaurant@example.test", address: "1 Test Street", city: "Test City",
    state: "Test State", country: "India", pincode: "600001", location: { latitude: 13, longitude: 80 },
    coverImage: "https://example.test/cover.jpg",
    galleryImages: ["https://example.test/1.jpg", "https://example.test/2.jpg", "https://example.test/3.jpg"],
    verificationStatus: "Verified", isActive: true,
  });

  let tableNumber = 1;
  const createTable = async (mode) => RestaurantTable.create({
    tableCode: `E2ETABLE${String(tableNumber).padStart(3, "0")}`,
    restaurantId: restaurant._id, tableNumber: tableNumber++, capacity: 6,
    seatSelectionMode: mode,
    seats: Array.from({ length: 6 }, (_, index) => ({
      seatIndex: index + 1, seatLabel: `S${index + 1}`, position: { x: index * 15, y: 50 },
    })),
  });

  const server = http.createServer(app);
  initSocket(server);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const base = `http://127.0.0.1:${address.port}/api/v1`;

  const login = async (email) => {
    const response = await api(base, "/auth/login", {
      method: "POST", body: JSON.stringify({ email, password }),
    });
    expectStatus(response, 200, `login ${email}`);
    return cookieFrom(response.headers);
  };
  const ownerCookie = await login("api-e2e-owner@example.test");
  const customerCookie = await login("api-e2e-customer@example.test");
  const customerTwoCookie = await login("api-e2e-customer2@example.test");
  const booking = (cookie, table, seats, when, guests = seats.length || 1, extra = {}) => api(base, "/bookings", {
    method: "POST", headers: { Cookie: cookie, ...(extra.headers || {}) },
    body: JSON.stringify({ restaurantId: String(restaurant._id), tables: [{ tableId: String(table._id), seatIds: seats }],
      bookingDateTime: when.toISOString(), expectedDuration: 60, numberOfGuests: guests, bookingType: "Online", ...extra.body }),
  });
  const availability = async (table, when) => {
    const response = await api(base, `/tables/restaurant/${restaurant._id}/availability?datetime=${encodeURIComponent(when.toISOString())}&duration=60&guests=1`);
    expectStatus(response, 200, "availability");
    return response.body.data.tables.find((entry) => String(entry.table._id) === String(table._id));
  };

  const ownerSocket = socketClient(`http://127.0.0.1:${address.port}`, {
    transports: ["websocket"], extraHeaders: { Cookie: ownerCookie },
  });
  const socketEvents = [];
  ownerSocket.on("booking:created", (event) => socketEvents.push({ name: "booking:created", event }));
  ownerSocket.on("booking:updated", (event) => socketEvents.push({ name: "booking:updated", event }));
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("owner socket connection timeout")), 5000);
    ownerSocket.once("connect", () => ownerSocket.emit("subscribe:bookings", { restaurantId: String(restaurant._id) }, (ack) => {
      clearTimeout(timer);
      if (!ack?.success) reject(new Error(`socket subscribe failed: ${JSON.stringify(ack)}`));
      else resolve();
    }));
    ownerSocket.once("connect_error", (error) => { clearTimeout(timer); reject(error); });
  });

  const t1 = await createTable(SEAT_SELECTION_MODE.INDIVIDUAL_SEATS);
  const t1Seats = t1.seats.map((seat) => String(seat._id));
  const time1 = new Date("2035-01-01T10:00:00.000Z");
  await run("1. Individual-seat capacity: 2 + 3 + reject 2 + accept 1", async () => {
    const first = await booking(customerCookie, t1, t1Seats.slice(0, 2), time1, 2);
    expectStatus(first, 201, "individual first");
    assert.equal(await Booking.countDocuments({ tableId: t1._id, bookingStatus: { $in: ["Pending", "Confirmed"] } }), 1);
    const second = await booking(customerCookie, t1, t1Seats.slice(2, 5), time1, 3);
    expectStatus(second, 201, "individual second");
    assert.equal((await availability(t1, time1)).freeSeatCount, 1);
    const rejected = await booking(customerTwoCookie, t1, t1Seats.slice(4, 6), time1, 2);
    assert.ok([400, 409].includes(rejected.status), `expected conflict, got ${rejected.status}`);
    const final = await booking(customerTwoCookie, t1, [t1Seats[5]], time1, 1);
    expectStatus(final, 201, "individual final seat");
    assert.equal((await availability(t1, time1)).freeSeatCount, 0);
  });

  const t2 = await createTable(SEAT_SELECTION_MODE.FULL_TABLE);
  await run("2. Full-table booking blocks subsequent individual booking", async () => {
    const full = await booking(customerCookie, t2, [], new Date("2035-01-01T12:00:00.000Z"), 2);
    expectStatus(full, 201, "full table");
    const individual = await booking(customerTwoCookie, t2, [String(t2.seats[0]._id)], new Date("2035-01-01T12:00:00.000Z"), 1);
    assert.ok([400, 409].includes(individual.status), `expected full-table conflict, got ${individual.status}`);
    assert.equal(await Booking.countDocuments({ tableId: t2._id }), 1);
  });

  const t3 = await createTable(SEAT_SELECTION_MODE.INDIVIDUAL_SEATS);
  await run("3. Individual booking to full-table booking", async () => {
    const seat = String(t3.seats[0]._id);
    expectStatus(await booking(customerCookie, t3, [seat], new Date("2035-01-01T14:00:00.000Z"), 1), 201, "individual seed");
    const attempt = await booking(customerTwoCookie, t3, [], new Date("2035-01-01T14:00:00.000Z"), 6, { body: { bookingMode: "FULL_TABLE" } });
    assert.ok([400, 409].includes(attempt.status), `expected full-table conflict/rejection, got ${attempt.status}`);
    assert.equal(attempt.status, 400, "public API rejects full-table selection on an individual-seat table; it does not provide a mode override");
  });

  const t4 = await createTable(SEAT_SELECTION_MODE.INDIVIDUAL_SEATS);
  await run("4. Concurrent authenticated requests preserve remaining capacity", async () => {
    const seats = t4.seats.map((seat) => String(seat._id));
    expectStatus(await booking(customerCookie, t4, seats.slice(0, 4), new Date("2035-01-02T10:00:00.000Z"), 4), 201, "concurrency seed");
    const responses = await Promise.all([
      booking(customerCookie, t4, seats.slice(4, 6), new Date("2035-01-02T10:00:00.000Z"), 2),
      booking(customerTwoCookie, t4, seats.slice(4, 6), new Date("2035-01-02T10:00:00.000Z"), 2),
    ]);
    assert.equal(responses.filter((response) => response.status === 201).length, 1);
    assert.equal(responses.filter((response) => [400, 409].includes(response.status)).length, 1);
    assert.equal(await Booking.countDocuments({ tableId: t4._id, bookingStatus: { $in: ["Pending", "Confirmed"] } }), 2);
  });

  const t5 = await createTable(SEAT_SELECTION_MODE.INDIVIDUAL_SEATS);
  await run("5/6. Overlapping fails and non-overlapping succeeds", async () => {
    const seat = String(t5.seats[0]._id);
    const firstTime = new Date("2035-01-03T10:00:00.000Z");
    expectStatus(await booking(customerCookie, t5, [seat], firstTime, 1), 201, "overlap seed");
    const overlap = await booking(customerTwoCookie, t5, [seat], new Date("2035-01-03T10:30:00.000Z"), 1);
    assert.ok([400, 409].includes(overlap.status), `expected overlap rejection, got ${overlap.status}`);
    expectStatus(await booking(customerTwoCookie, t5, [seat], new Date("2035-01-03T12:00:00.000Z"), 1), 201, "non-overlap");
    assert.equal(await Booking.countDocuments({ tableId: t5._id }), 2);
  });

  const t6 = await createTable(SEAT_SELECTION_MODE.INDIVIDUAL_SEATS);
  await run("7. Cancellation restores availability", async () => {
    const seatIds = t6.seats.slice(0, 2).map((seat) => String(seat._id));
    const when = new Date("2035-01-04T10:00:00.000Z");
    const created = await booking(customerCookie, t6, seatIds, when, 2);
    expectStatus(created, 201, "cancellation create");
    const bookingId = created.body.data.booking?._id || created.body.data._id;
    assert.ok(bookingId, "booking id missing from create response");
    assert.equal((await availability(t6, when)).freeSeatCount, 4);
    const cancelled = await api(base, `/bookings/${bookingId}/cancel`, { method: "POST", headers: { Cookie: customerCookie }, body: JSON.stringify({ cancellationReason: "API E2E cancellation" }) });
    expectStatus(cancelled, 200, "cancel");
    const record = await Booking.findById(bookingId).lean();
    assert.equal(record.bookingStatus, "Cancelled");
    assert.equal((await availability(t6, when)).freeSeatCount, 6);
  });

  await run("8. Invalid and unauthorized requests are rejected", async () => {
    const t = await createTable(SEAT_SELECTION_MODE.INDIVIDUAL_SEATS);
    const when = new Date("2035-01-05T10:00:00.000Z");
    const payload = { restaurantId: String(restaurant._id), tables: [{ tableId: String(t._id), seatIds: [String(t.seats[0]._id)] }], bookingDateTime: when.toISOString(), numberOfGuests: 1 };
    expectStatus(await api(base, "/bookings", { method: "POST", body: JSON.stringify(payload) }), 401, "unauthenticated");
    const created = await api(base, "/bookings", { method: "POST", headers: { Cookie: customerCookie }, body: JSON.stringify(payload) });
    expectStatus(created, 201, "protected booking");
    const id = created.body.data.booking?._id || created.body.data._id;
    assert.equal((await api(base, `/bookings/${id}/cancel`, { method: "POST", headers: { Cookie: customerTwoCookie }, body: "{}" })).status, 403);
    assert.equal((await api(base, "/bookings", { method: "POST", headers: { Cookie: customerCookie }, body: JSON.stringify({ ...payload, restaurantId: "not-an-id" }) })).status, 400);
    assert.equal((await api(base, "/bookings", { method: "POST", headers: { Cookie: customerCookie }, body: JSON.stringify({ ...payload, numberOfGuests: 0 }) })).status, 400);
  });

  const t7 = await createTable(SEAT_SELECTION_MODE.INDIVIDUAL_SEATS);
  await run("9. Repeat request with idempotency key creates no duplicate", async () => {
    const seat = String(t7.seats[0]._id);
    const when = new Date("2035-01-06T10:00:00.000Z");
    const key = "api-e2e-idempotency-1";
    const first = await booking(customerCookie, t7, [seat], when, 1, { headers: { "Idempotency-Key": key } });
    expectStatus(first, 201, "idempotency first");
    const second = await booking(customerCookie, t7, [seat], when, 1, { headers: { "Idempotency-Key": key } });
    assert.ok([400, 409].includes(second.status), `repeat should not create a second booking, got ${second.status}`);
    assert.equal(await Booking.countDocuments({ tableId: t7._id }), 1);
  });

  await run("10. Socket owner room receives persisted booking update", async () => {
    const t = await createTable(SEAT_SELECTION_MODE.INDIVIDUAL_SEATS);
    const seat = String(t.seats[0]._id);
    const when = new Date("2035-01-07T10:00:00.000Z");
    const before = socketEvents.length;
    const created = await booking(customerCookie, t, [seat], when, 1);
    expectStatus(created, 201, "socket booking");
    const bookingId = String(created.body.data.booking?._id || created.body.data._id);
    const deadline = Date.now() + 3000;
    while (Date.now() < deadline && socketEvents.length === before) await wait(50);
    assert.ok(socketEvents.length > before, "owner received no booking event");
    const event = socketEvents.slice(before).find((entry) => String(entry.event?._id || entry.event?.bookingId) === bookingId) || socketEvents[socketEvents.length - 1];
    assert.ok(event, "booking event missing");
    assert.ok(await Booking.exists({ _id: bookingId, tableId: t._id }));
  });

  ownerSocket.disconnect();
  await closeSocket();
  await new Promise((resolve) => server.close(resolve));
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();

  console.log(`\nRESULTS: ${results.map((entry) => `${entry.status} ${entry.label}`).join(" | ")}`);
  if (results.some((entry) => entry.status === "FAIL")) process.exitCode = 1;
};

try {
  await main();
} catch (error) {
  console.error(`[BLOCKED] API harness could not complete: ${error.stack || error.message}`);
  try { await closeSocket(); } catch {}
  try { await mongoose.disconnect(); } catch {}
  process.exitCode = 2;
}

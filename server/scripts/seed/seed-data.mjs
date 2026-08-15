import { connectDatabase, disconnectDatabase, getMongoUri, isLocalMongoUri } from "./lib/connect.mjs";
import { assertSeedAllowed, confirmContinue } from "./lib/guards.mjs";
import { seedUsers } from "./data/users.mjs";
import { seedRestaurants } from "./data/restaurants.mjs";
import { seedTables } from "./data/tables.mjs";
import { seedFoods } from "./data/foods.mjs";
import { seedOffers } from "./data/offers.mjs";
import { seedBookings } from "./data/bookings.mjs";
import { seedBills } from "./data/bills.mjs";
import { seedPayments } from "./data/payments.mjs";
import { seedRefunds } from "./data/refunds.mjs";
import { seedReports } from "./data/reports.mjs";
import { seedWarnings } from "./data/warnings.mjs";
import { seedReviews } from "./data/reviews.mjs";
import { seedRatings } from "./data/ratings.mjs";
import { seedNotifications } from "./data/notifications.mjs";
import { seedAuditLogs } from "./data/audit-logs.mjs";
import { seedReconciliations } from "./data/reconciliations.mjs";
import { seedEmailDeliveries } from "./data/email-deliveries.mjs";
import { seedWebhookEvents } from "./data/webhook-events.mjs";
import { seedMisc } from "./data/misc.mjs";

const buildContext = () => ({
  users: new Map(),
  restaurants: new Map(),
  ownerByRestaurant: new Map(),
  tables: new Map(),
  foods: new Map(),
  offers: new Map(),
  bookings: new Map(),
  bills: new Map(),
  payments: [],
  refunds: new Map(),
  reports: new Map(),
  warnings: new Map(),
  restaurantReviews: new Map(),
  foodReviews: new Map(),
});

const runIntegrityChecks = (ctx) => {
  const issues = [];
  const warnings = [];

  for (const [bookingKey, entry] of ctx.bookings) {
    const booking = entry.doc;
    if (!ctx.users.get(entry.spec.customerKey)) {
      issues.push(`Booking ${booking.bookingCode} references unknown user ${entry.spec.customerKey}`);
    }
    const tableFound = [...ctx.tables.values()].some(
      (t) => t.doc.restaurantId && String(t.doc.restaurantId) === String(booking.restaurantId) && String(t.doc._id) === String(booking.tableId)
    );
    if (!tableFound) {
      issues.push(`Booking ${booking.bookingCode} has tableId not in seed context`);
    }
  }

  for (const [bookingKey, entry] of ctx.bookings) {
    if (entry.spec.phase !== "completed") continue;
    const bill = ctx.bills.get(bookingKey)?.doc;
    if (!bill || bill.billStatus !== "Paid") {
      issues.push(`Completed booking ${entry.doc.bookingCode} has no Paid bill`);
    }
  }

  const seenReview = new Set();
  for (const entry of ctx.restaurantReviews.values()) {
    const key = `${entry.doc.userId}|${entry.doc.bookingId}|${entry.doc.restaurantId}`;
    if (seenReview.has(key)) issues.push(`Duplicate restaurant review (${key})`);
    seenReview.add(key);
  }

  const tableSlots = new Map();
  for (const entry of ctx.bookings.values()) {
    const b = entry.doc;
    const activeStatuses = new Set(["Confirmed", "Completed"]);
    if (!activeStatuses.has(b.bookingStatus)) continue;
    const slot = `${b.restaurantId}|${b.tableId}|${b.bookingDateTime.toISOString()}`;
    if (tableSlots.has(slot)) {
      warnings.push(`Potential table overlap for ${b.bookingCode}`);
    }
    tableSlots.set(slot, b.bookingCode);
  }

  for (const [key, entry] of ctx.reports) {
    const warning = [...ctx.warnings.values()].find((w) => String(w.doc.relatedReportId) === String(entry.doc._id));
    if (entry.doc.status === "RESOLVED" && !warning) {
      warnings.push(`Resolved report ${entry.doc.reportCode} has no linked warning`);
    }
  }

  return { issues, warnings };
};

const main = async () => {
  const force = process.argv.includes("--yes");
  assertSeedAllowed({ force });
  if (!force) {
    const ok = await confirmContinue();
    if (!ok) {
      console.log("Aborted. No data was written.");
      process.exit(0);
    }
  }

  const isLocal = isLocalMongoUri(getMongoUri());
  if (!isLocal) {
    console.log("Target is a remote/Atlas database — proceeding as configured.");
  }

  await connectDatabase();
  const ctx = buildContext();

  const steps = [
    ["Users", seedUsers],
    ["Email Deliveries", seedEmailDeliveries],
    ["Restaurants", seedRestaurants],
    ["Tables", seedTables],
    ["Foods", seedFoods],
    ["Offers", seedOffers],
    ["Bookings", seedBookings],
    ["Bills", seedBills],
    ["Payments", seedPayments],
    ["Refunds", seedRefunds],
    ["Reports", seedReports],
    ["Warnings", seedWarnings],
    ["Reviews", seedReviews],
    ["Ratings", seedRatings],
    ["Notifications", seedNotifications],
    ["Audit Logs", seedAuditLogs],
    ["Reconciliations", seedReconciliations],
    ["Webhook Events", seedWebhookEvents],
    ["Misc (offer recipients + counters)", seedMisc],
  ];

  const summary = [];
  for (const [label, seedFn] of steps) {
    try {
      const result = await seedFn(ctx);
      const created = result?.created ?? 0;
      summary.push({ label, created });
      const updated = typeof result?.updated === "number" ? result.updated : null;
      const detail = updated !== null ? ` (${updated} recomputed)` : "";
      console.log(`[ok] ${label}: ${created} new records${detail}`);
    } catch (error) {
      console.error(`[FAIL] ${label}: ${error.message}`);
      await disconnectDatabase();
      process.exit(1);
    }
  }

  const { issues, warnings } = runIntegrityChecks(ctx);

  console.log("");
  console.log("============================================================");
  console.log("  SEED SUMMARY");
  console.log("============================================================");
  for (const { label, created } of summary) {
    console.log(`  ${label.padEnd(40)} +${created}`);
  }
  console.log("  ----------------------------------------------------------");
  console.log(`  Total bookings seeded: ${ctx.bookings.size}`);
  console.log(`  Total bills seeded:    ${ctx.bills.size}`);
  console.log(`  Total payments seeded: ${ctx.payments.length}`);

  if (warnings.length) {
    console.log("");
    console.log(`  Integrity warnings (${warnings.length}):`);
    for (const w of warnings) console.log(`    - ${w}`);
  }
  if (issues.length) {
    console.log("");
    console.log(`  INTEGRITY ERRORS (${issues.length}):`);
    for (const issue of issues) console.log(`    - ${issue}`);
  } else {
    console.log("");
    console.log("  Integrity: OK");
  }
  console.log("============================================================");

  await disconnectDatabase();
  console.log("Seed run complete. Disconnected.");
  process.exit(issues.length ? 1 : 0);
};

main().catch(async (error) => {
  console.error("Seed failed:", error);
  await disconnectDatabase().catch(() => {});
  process.exit(1);
});

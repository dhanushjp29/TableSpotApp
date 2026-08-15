import RestaurantReport from "../../../src/models/RestaurantReport.js";
import { CODE_PREFIX, REPORT_STATUS, REPORT_CATEGORY, REPORT_SEVERITY } from "../../../src/utils/constants.js";
import { codeFor } from "../lib/codes.mjs";
import { upsertOne, daysAgo } from "../lib/helpers.mjs";

const REPORTS = [
  {
    bookingKey: "flagship:c10:completed:20",
    category: REPORT_CATEGORY.FOOD_QUALITY,
    severity: REPORT_SEVERITY.HIGH,
    title: "Biryani arrived cold and late",
    description: "Ordered the Hyderabadi biryani but it arrived lukewarm and the serving took nearly an hour.",
    status: REPORT_STATUS.PENDING,
  },
  {
    bookingKey: "mumbai-tiffin:c8:completed:12",
    category: REPORT_CATEGORY.STAFF_BEHAVIOUR,
    severity: REPORT_SEVERITY.MEDIUM,
    title: "Rude staff during rush hour",
    description: "The counter staff was dismissive when we asked about a delayed order during the lunch rush.",
    status: REPORT_STATUS.PENDING,
  },
  {
    bookingKey: "green-leaf:c5:completed:15",
    category: REPORT_CATEGORY.HYGIENE,
    severity: REPORT_SEVERITY.HIGH,
    title: "Unclean table and crockery",
    description: "The table had leftover food stains and one of the glasses was not properly washed.",
    status: REPORT_STATUS.PENDING,
  },
  {
    bookingKey: "pune-thali:c13:completed:50",
    category: REPORT_CATEGORY.WRONG_BILLING,
    severity: REPORT_SEVERITY.MEDIUM,
    title: "Overcharged on the final bill",
    description: "The bill included an extra beverage we never ordered. The staff corrected it after a long wait.",
    status: REPORT_STATUS.RESOLVED,
    adminNotes: "Restaurant confirmed billing error, refunded the difference and issued a formal warning.",
  },
  {
    bookingKey: "street-wok:c9:completed:35",
    category: REPORT_CATEGORY.SERVICE_DELAY,
    severity: REPORT_SEVERITY.LOW,
    title: "Late delivery of starters",
    description: "Starters took over 40 minutes. Manager apologised and offered a complimentary dessert.",
    status: REPORT_STATUS.REJECTED,
    adminNotes: "No policy violation found after review. Restaurant offered compensation on its own.",
  },
  {
    bookingKey: "madras-cafe:c6:completed:40",
    category: REPORT_CATEGORY.HYGIENE,
    severity: REPORT_SEVERITY.MEDIUM,
    title: "Food stains on table",
    description: "The table was not wiped properly before we were seated. Cutlery needed a second look.",
    status: REPORT_STATUS.RESOLVED,
    adminNotes: "Restaurant deep-cleaned the outlet and retrained serving staff after the complaint.",
  },
  {
    bookingKey: "chai-co:customer:completed:12",
    category: REPORT_CATEGORY.SERVICE_DELAY,
    severity: REPORT_SEVERITY.LOW,
    title: "Slow refill of chai",
    description: "We asked for a refill twice before it arrived. Not a big deal, just wanted to flag it.",
    status: REPORT_STATUS.PENDING,
  },
];

export const seedReports = async (ctx) => {
  let codeIndex = 0;
  let createdCount = 0;

  for (const spec of REPORTS) {
    const entry = ctx.bookings.get(spec.bookingKey);
    if (!entry || entry.spec.phase !== "completed") continue;
    const booking = entry.doc;
    const bill = ctx.bills.get(spec.bookingKey)?.doc;
    if (!bill || bill.billStatus !== "Paid") continue;

    codeIndex += 1;
    const reportCode = codeFor(CODE_PREFIX.REPORT, codeIndex);

    const isResolved = spec.status === REPORT_STATUS.RESOLVED;
    const isRejected = spec.status === REPORT_STATUS.REJECTED;

    const doc = {
      reportCode,
      userId: booking.userId,
      restaurantId: booking.restaurantId,
      bookingId: booking._id,
      billId: bill._id,
      category: spec.category,
      severity: spec.severity,
      title: spec.title,
      description: spec.description,
      images: [],
      status: spec.status,
      adminId: isResolved || isRejected ? ctx.users.get("admin").doc._id : null,
      adminNotes: spec.adminNotes || "",
      statusChangedAt: isResolved || isRejected ? daysAgo(5, 12) : null,
      resolvedAt: isResolved ? daysAgo(5, 12) : null,
      rejectedAt: isRejected ? daysAgo(6, 12) : null,
      isActive: true,
    };

    const { created, doc: saved } = await upsertOne(RestaurantReport, { reportCode }, doc);
    if (created) createdCount += 1;
    ctx.reports.set(spec.bookingKey, { doc: saved, created });
  }

  return { created: createdCount };
};

export { REPORTS };

export default seedReports;

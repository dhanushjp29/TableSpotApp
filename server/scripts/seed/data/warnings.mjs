import RestaurantWarning from "../../../src/models/RestaurantWarning.js";
import RestaurantReport from "../../../src/models/RestaurantReport.js";
import { CODE_PREFIX, WARNING_LEVEL, WARNING_STATUS } from "../../../src/utils/constants.js";
import { codeFor } from "../lib/codes.mjs";
import { upsertOne, daysAgo, daysFromNow } from "../lib/helpers.mjs";

const WARNINGS = [
  {
    key: "pune-thali",
    level: WARNING_LEVEL.LEVEL_1,
    title: "Billing error confirmed",
    reason: "Confirmed overbilling incident on the customer's visit. Restaurant refunded the difference and was advised to re-train billing staff.",
    issuedDaysAgo: 20,
    status: WARNING_STATUS.ACTIVE,
    relatedReportKey: "pune-thali:c13:completed:50",
    replies: [
      { role: "admin", message: "Formal warning issued following the confirmed billing error." },
      { role: "owner", message: "We have accepted the finding and retrained our billing team. Apologies to the customer." },
      { role: "customer", message: "Thank you for resolving this quickly." },
    ],
  },
  {
    key: "green-leaf",
    level: WARNING_LEVEL.LEVEL_2,
    title: "Hygiene standards review",
    reason: "Second hygiene complaint within the verification period. Restaurant must complete a hygiene audit within 30 days.",
    issuedDaysAgo: 10,
    status: WARNING_STATUS.ACTIVE,
    relatedReportKey: "green-leaf:c5:completed:15",
    replies: [
      { role: "admin", message: "Please complete the hygiene audit and share the report with our team." },
      { role: "owner", message: "Audit scheduled for next week. We take this seriously." },
    ],
  },
  {
    key: "street-wok",
    level: WARNING_LEVEL.LEVEL_1,
    title: "Historic service delay complaint",
    reason: "Resolved service delay complaint from a previous quarter. Warning expired on its own after the window closed.",
    issuedDaysAgo: 120,
    status: WARNING_STATUS.EXPIRED,
    relatedReportKey: null,
    replies: [],
  },
  {
    key: "madras-cafe",
    level: WARNING_LEVEL.LEVEL_1,
    title: "Hygiene compliance reminder",
    reason: "A hygiene complaint was confirmed during inspection. Owner resolved it on the spot and retrained serving staff.",
    issuedDaysAgo: 6,
    status: WARNING_STATUS.ACTIVE,
    relatedReportKey: "madras-cafe:c6:completed:40",
    replies: [
      { role: "admin", message: "Please share the corrective action taken for the hygiene complaint." },
      { role: "owner", message: "We deep-cleaned the outlet and retrained the staff on table hygiene." },
    ],
  },
];

export const seedWarnings = async (ctx) => {
  let codeIndex = 0;
  let createdCount = 0;

  for (const spec of WARNINGS) {
    const restaurant = ctx.restaurants.get(spec.key).doc;
    const owner = ctx.users.get(ctx.ownerByRestaurant.get(spec.key)).doc;

    codeIndex += 1;
    const warningCode = codeFor(CODE_PREFIX.WARNING, codeIndex);

    const issuedAt = daysAgo(spec.issuedDaysAgo, 11);
    const expiresAt =
      spec.status === WARNING_STATUS.EXPIRED
        ? daysAgo(Math.max(1, spec.issuedDaysAgo - 90), 11)
        : daysFromNow(90 - Math.min(spec.issuedDaysAgo, 90), 11);

    const relatedReport = spec.relatedReportKey
      ? ctx.reports.get(spec.relatedReportKey)?.doc || null
      : null;

    const replies = spec.replies.map((r) => ({
      userId: r.role === "admin" ? ctx.users.get("admin").doc._id : r.role === "owner" ? owner._id : ctx.users.get("c13").doc._id,
      role: r.role,
      fullName: r.role === "admin" ? "TableSpot Admin" : r.role === "owner" ? owner.fullName : "Demo Customer",
      message: r.message,
      createdAt: daysAgo(Math.max(1, spec.issuedDaysAgo - spec.replies.indexOf(r)), 12),
    }));

    const doc = {
      warningCode,
      restaurantId: restaurant._id,
      ownerId: owner._id,
      reporterId: relatedReport ? relatedReport.userId : null,
      level: spec.level,
      title: spec.title,
      reason: spec.reason,
      issuedBy: ctx.users.get("admin").doc._id,
      issuedAt,
      expiresAt,
      status: spec.status,
      clearedBy: null,
      clearedAt: null,
      clearedReason: "",
      expiredAt: spec.status === WARNING_STATUS.EXPIRED ? expiresAt : null,
      relatedReportId: relatedReport ? relatedReport._id : null,
      replies,
      isActive: true,
    };

    const { created, doc: saved } = await upsertOne(RestaurantWarning, { warningCode }, doc);
    if (created) createdCount += 1;
    ctx.warnings.set(spec.key, { doc: saved, created });

    if (relatedReport) {
      await RestaurantReport.updateOne(
        { _id: relatedReport._id },
        { $set: { warningId: saved._id } }
      );
    }
  }

  return { created: createdCount };
};

export { WARNINGS };

export default seedWarnings;

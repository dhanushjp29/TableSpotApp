// Excel export for the Owner Reviews page - Restaurant Reviews + Food Reviews sheets.
import { addSheet, createWorkbook, exportFilename, saveWorkbook } from "./excel/excelExport.js";
import { toNumber } from "./excel/excelFormatters.js";

const money = (value) => toNumber(value) ?? 0;

export const reviewColumns = [
  { header: "Review Code", key: "reviewCode", width: 16 },
  { header: "Restaurant", key: "restaurant", width: 26 },
  { header: "Item", key: "item", width: 24 },
  { header: "Reviewer Code", key: "reviewerCode", width: 16 },
  { header: "Reviewer", key: "reviewer", width: 22 },
  { header: "Rating", key: "rating", type: "int", width: 10 },
  { header: "Title", key: "title", width: 22 },
  { header: "Comment", key: "comment", width: 40 },
  { header: "Status", key: "status", width: 14 },
  { header: "Owner Reply", key: "ownerReply", width: 28 },
  { header: "Date", key: "createdAt", type: "datetime", width: 18 },
];

const mapReview = (review, itemLabel) => ({
  reviewCode: review?.reviewCode || review?._id || "-",
  restaurant: review?.restaurantId?.restaurantName || "-",
  item: itemLabel,
  reviewerCode: review?.userId?.userCode || "-",
  reviewer: review?.userId?.fullName || "-",
  rating: review?.rating,
  title: review?.title || "-",
  comment: review?.comment || "-",
  status: review?.status || "Pending",
  ownerReply: review?.ownerReply || "-",
  createdAt: review?.createdAt,
});

export async function exportReviewsToExcel({ restaurantReviews = [], foodReviews = [] } = {}) {
  const restaurantRows = (Array.isArray(restaurantReviews) ? restaurantReviews : []).map((r) =>
    mapReview(r, "-")
  );
  const foodRows = (Array.isArray(foodReviews) ? foodReviews : []).map((r) =>
    mapReview(r, r?.foodId?.foodName || "-")
  );

  const workbook = createWorkbook();
  const subtitle = `Exported ${new Date().toLocaleString()}`;

  addSheet({
    workbook,
    sheetName: "Restaurant Reviews",
    title: "TableSpot - Restaurant Reviews",
    subtitle,
    columns: reviewColumns,
    rows: restaurantRows,
    summary: [
      { label: "Total Reviews", value: restaurantRows.length, type: "int" },
      { label: "Average Rating", value: restaurantRows.reduce((sum, r) => sum + money(r.rating), 0) / (restaurantRows.length || 1), type: "int" },
    ],
  });

  addSheet({
    workbook,
    sheetName: "Food Reviews",
    title: "TableSpot - Food Reviews",
    subtitle,
    columns: reviewColumns,
    rows: foodRows,
    summary: [
      { label: "Total Reviews", value: foodRows.length, type: "int" },
      { label: "Average Rating", value: foodRows.reduce((sum, r) => sum + money(r.rating), 0) / (foodRows.length || 1), type: "int" },
    ],
  });

  await saveWorkbook(workbook, exportFilename("Reviews"));
}

// Excel export for the Admin Restaurants page.
import { addSheet, createWorkbook, exportFilename, saveWorkbook } from "./excel/excelExport.js";
import { toNumber } from "./excel/excelFormatters.js";

const money = (value) => toNumber(value) ?? 0;

export const restaurantColumns = [
  { header: "Restaurant Code", key: "restaurantCode", width: 16 },
  { header: "Restaurant Name", key: "restaurantName", width: 28 },
  { header: "City", key: "city", width: 16 },
  { header: "State", key: "state", width: 16 },
  { header: "Country", key: "country", width: 12 },
  { header: "Rating", key: "averageRating", type: "number", width: 10 },
  { header: "Verification", key: "verificationStatus", width: 16 },
  { header: "Status", key: "isActive", width: 12 },
  { header: "Cover", key: "coverImage", width: 28 },
];

const mapRestaurant = (r) => ({
  restaurantCode: r?.restaurantCode || r?._id || "-",
  restaurantName: r?.restaurantName || "-",
  city: r?.city || "-",
  state: r?.state || "-",
  country: r?.country || "-",
  averageRating: Number(r?.averageRating) || 0,
  verificationStatus: r?.verificationStatus || "-",
  isActive: r?.isActive === false ? "Inactive" : "Active",
  coverImage: r?.coverImage || "-",
});

export async function exportRestaurantsToExcel(restaurants) {
  const list = Array.isArray(restaurants) ? restaurants : [];
  const rows = list.map(mapRestaurant);

  const active = rows.filter((r) => r.isActive === "Active").length;
  const pending = rows.filter((r) => r.verificationStatus === "Pending").length;

  const workbook = createWorkbook();
  const subtitle = `Exported ${new Date().toLocaleString()}`;

  addSheet({
    workbook,
    sheetName: "Restaurants",
    title: "TableSpot - Restaurants",
    subtitle,
    columns: restaurantColumns,
    rows,
    summary: [
      { label: "Total Restaurants", value: rows.length, type: "int" },
      { label: "Active", value: active, type: "int" },
      { label: "Pending Verification", value: pending, type: "int" },
      { label: "Average Rating", value: rows.reduce((sum, r) => sum + money(r.averageRating), 0) / (rows.length || 1), type: "number" },
    ],
  });

  await saveWorkbook(workbook, exportFilename("Restaurants"));
}

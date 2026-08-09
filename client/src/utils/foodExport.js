// Excel export for the Owner Food Menu page.
import { addSheet, createWorkbook, exportFilename, saveWorkbook } from "./excel/excelExport.js";
import { toNumber } from "./excel/excelFormatters.js";

const money = (value) => toNumber(value) ?? 0;

export const foodColumns = [
  { header: "Item Code", key: "foodCode", width: 14 },
  { header: "Item Name", key: "foodName", width: 26 },
  { header: "Category", key: "category", width: 16 },
  { header: "Restaurant", key: "restaurant", width: 24 },
  { header: "Price", key: "price", type: "money", width: 12 },
  { header: "Offer Price", key: "offerPrice", type: "money", width: 12 },
  { header: "GST %", key: "gstRate", type: "number", width: 10 },
  { header: "Type", key: "foodType", width: 10 },
  { header: "Available", key: "available", width: 12 },
  { header: "Description", key: "description", width: 36 },
];

const mapFood = (food) => ({
  foodCode: food?.foodCode || food?._id || "-",
  foodName: food?.foodName || "-",
  category: food?.category || food?.categoryName || "-",
  restaurant: food?.restaurantId?.restaurantName || "-",
  price: money(food?.price),
  offerPrice: money(food?.offerPrice),
  gstRate: Number(food?.gstRate) || 0,
  foodType: food?.isVeg === false ? "Non-Veg" : food?.isVeg ? "Veg" : "-",
  available: food?.isAvailable === false ? "No" : food?.isAvailable ? "Yes" : "-",
  description: food?.description || "-",
});

export async function exportFoodsToExcel(foods) {
  const list = Array.isArray(foods) ? foods : [];
  const rows = list.map(mapFood);

  const workbook = createWorkbook();
  const subtitle = `Exported ${new Date().toLocaleString()}`;

  addSheet({
    workbook,
    sheetName: "Food Items",
    title: "TableSpot - Food Menu",
    subtitle,
    columns: foodColumns,
    rows,
    summary: [
      { label: "Total Items", value: rows.length, type: "int" },
      { label: "Total Menu Value", value: rows.reduce((sum, r) => sum + money(r.price), 0), type: "money" },
    ],
  });

  await saveWorkbook(workbook, exportFilename("FoodMenu"));
}

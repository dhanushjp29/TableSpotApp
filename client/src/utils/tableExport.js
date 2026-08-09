// Excel export for the Owner Tables page.
import { addSheet, createWorkbook, exportFilename, saveWorkbook } from "./excel/excelExport.js";

export const tableColumns = [
  { header: "Table Code", key: "tableCode", width: 14 },
  { header: "Table Number", key: "tableNumber", width: 14 },
  { header: "Table Name", key: "tableName", width: 20 },
  { header: "Label", key: "tableLabel", width: 12 },
  { header: "Restaurant", key: "restaurant", width: 24 },
  { header: "Type", key: "tableType", width: 14 },
  { header: "Location", key: "tableLocation", width: 16 },
  { header: "Floor", key: "floor", width: 10 },
  { header: "Capacity", key: "capacity", type: "int", width: 12 },
  { header: "Min Capacity", key: "minimumCapacity", type: "int", width: 14 },
  { header: "Status", key: "status", width: 12 },
];

const mapTable = (table) => ({
  tableCode: table?.tableCode || table?._id || "-",
  tableNumber: table?.tableNumber ?? "-",
  tableName: table?.tableName || "-",
  tableLabel: table?.tableLabel || "-",
  restaurant: table?.restaurantId?.restaurantName || "-",
  tableType: table?.tableType || "-",
  tableLocation: table?.tableLocation || "-",
  floor: table?.floor ?? "-",
  capacity: table?.capacity,
  minimumCapacity: table?.minimumCapacity,
  status: table?.status || "-",
});

export async function exportTablesToExcel(tables) {
  const list = Array.isArray(tables) ? tables : [];
  const rows = list.map(mapTable);

  const workbook = createWorkbook();
  const subtitle = `Exported ${new Date().toLocaleString()}`;

  addSheet({
    workbook,
    sheetName: "Tables",
    title: "TableSpot - Restaurant Tables",
    subtitle,
    columns: tableColumns,
    rows,
    summary: [
      { label: "Total Tables", value: rows.length, type: "int" },
      { label: "Total Capacity", value: rows.reduce((sum, r) => sum + (Number(r.capacity) || 0), 0), type: "int" },
    ],
  });

  await saveWorkbook(workbook, exportFilename("Tables"));
}

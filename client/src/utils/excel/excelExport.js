// Core ExcelJS export builder shared by every TableSpot exporter.
// Usage:
//   const wb = createWorkbook();
//   addSheet({ workbook: wb, sheetName: "Bills", title: "TableSpot Billing", subtitle: "...", columns, rows, summary });
//   await saveWorkbook(wb, exportFilename("Billing"));
import ExcelJS from "exceljs";
import {
  BRAND_COLORS,
  BOX_BORDER,
  DATE_FORMAT,
  DATETIME_FORMAT,
  DEFAULT_COLUMN_WIDTH,
  FONT,
  HEADER_ALIGNMENT,
  HEADER_FONT,
  INT_FORMAT,
  MONEY_FORMAT,
  PERCENT_FORMAT,
  SUBTITLE_FONT,
  SUMMARY_FONT,
  THIN_BORDER,
  TITLE_FONT,
} from "./excelStyles.js";
import { toDate, toInt, toNumber } from "./excelFormatters.js";

export const createWorkbook = () => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "TableSpot";
  workbook.title = "TableSpot Export";
  workbook.company = "TableSpot";
  workbook.created = new Date();
  return workbook;
};

const sanitizeSheetName = (name) => {
  const cleaned = String(name || "Sheet").replace(/[\\/?*[\]:]/g, " ").trim();
  return (cleaned || "Sheet").slice(0, 31);
};

const COLUMN_TYPES = ["money", "int", "date", "datetime", "percentage", "text"];

const writeValue = (cell, rawValue, type) => {
  switch (type) {
    case "money": {
      const n = toNumber(rawValue);
      if (n === null) {
        cell.value = "-";
      } else {
        cell.value = n;
        cell.numFmt = MONEY_FORMAT;
      }
      break;
    }
    case "int": {
      const n = toInt(rawValue);
      if (n === null) {
        cell.value = "-";
      } else {
        cell.value = n;
        cell.numFmt = INT_FORMAT;
      }
      break;
    }
    case "percentage": {
      const n = toNumber(rawValue);
      if (n === null) {
        cell.value = "-";
      } else {
        cell.value = n / 100; // e.g. 18 => 0.18 => "18.00%"
        cell.numFmt = PERCENT_FORMAT;
      }
      break;
    }
    case "date": {
      const d = toDate(rawValue);
      if (d) {
        cell.value = d;
        cell.numFmt = DATE_FORMAT;
      } else {
        cell.value = "-";
      }
      break;
    }
    case "datetime": {
      const d = toDate(rawValue);
      if (d) {
        cell.value = d;
        cell.numFmt = DATETIME_FORMAT;
      } else {
        cell.value = "-";
      }
      break;
    }
    default: {
      const text = rawValue === null || rawValue === undefined || rawValue === "" ? "-" : String(rawValue);
      cell.value = text;
    }
  }
};

/**
 * Add a fully styled worksheet to a workbook.
 * columns: [{ header, key, width, type, align, wrap }]
 *   - key: property on each row object
 *   - type: money | int | date | datetime | percentage | text (default text)
 *   - align: "left" | "right" (money/int default to right when align not set)
 *   - wrap: false to disable text wrapping
 * rows: array of plain objects.
 * summary: [{ label, value, type }] rendered as a bold block after the data.
 */
export const addSheet = ({ workbook, sheetName, title, subtitle, columns = [], rows = [], summary = [], summaryTitle = "Summary" }) => {
  if (!workbook) throw new Error("addSheet: workbook is required.");
  const ws = workbook.addWorksheet(sanitizeSheetName(sheetName), {
    views: [{ state: "frozen", ySplit: 3 }],
  });

  const colCount = Math.max(1, columns.length);

  // Column widths (row objects are mapped by col.key in the data loop).
  columns.forEach((col, index) => {
    ws.getColumn(index + 1).width = col.width || DEFAULT_COLUMN_WIDTH;
  });

  // Row 1: Title
  ws.mergeCells(1, 1, 1, colCount);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = title || "TableSpot Export";
  titleCell.font = { ...TITLE_FONT, color: { argb: BRAND_COLORS.headerText } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_COLORS.primary } };
  titleCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  ws.getRow(1).height = 30;

  // Row 2: Subtitle
  if (subtitle) {
    ws.mergeCells(2, 1, 2, colCount);
    const subCell = ws.getCell(2, 1);
    subCell.value = subtitle;
    subCell.font = { ...SUBTITLE_FONT, color: { argb: BRAND_COLORS.mutedText } };
    subCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_COLORS.subtitleFill } };
    subCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    ws.getRow(2).height = 20;
  }

  // Row 3: Header
  const headerRow = ws.getRow(3);
  columns.forEach((col, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = col.header || "";
    cell.font = { ...HEADER_FONT, color: { argb: BRAND_COLORS.headerText } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_COLORS.primary } };
    cell.alignment = HEADER_ALIGNMENT;
    cell.border = BOX_BORDER;
  });
  headerRow.height = 32;

  // Data rows (start at row 4)
  const startRow = 4;
  rows.forEach((row, rIdx) => {
    const excelRow = ws.getRow(startRow + rIdx);
    excelRow.height = 20;
    columns.forEach((col, cIdx) => {
      const cell = excelRow.getCell(cIdx + 1);
      const type = COLUMN_TYPES.includes(col.type) ? col.type : "text";
      writeValue(cell, row[col.key], type);

      const numLike = type === "money" || type === "int" || type === "percentage";
      cell.font = FONT;
      const alignRight = col.align === "right" || (numLike && col.align !== "left");
      cell.alignment = {
        vertical: "middle",
        horizontal: alignRight ? "right" : "left",
        wrapText: col.wrap === false ? false : type === "text",
      };
      if (rIdx % 2 === 1) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_COLORS.bandFill } };
      }
      cell.border = BOX_BORDER;
    });
  });

  // Auto filter on the header row
  if (rows.length > 0) {
    ws.autoFilter = {
      from: { row: 3, column: 1 },
      to: { row: startRow + rows.length - 1, column: colCount },
    };
  }

  // Summary block
  if (Array.isArray(summary) && summary.length > 0) {
    const summaryStart = startRow + rows.length + 1;
    ws.mergeCells(summaryStart, 1, summaryStart, colCount);
    const sc = ws.getCell(summaryStart, 1);
    sc.value = summaryTitle || "Summary";
    sc.font = { ...SUMMARY_FONT, color: { argb: BRAND_COLORS.primaryDark } };
    sc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_COLORS.primaryLight } };
    sc.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    ws.getRow(summaryStart).height = 22;

    summary.forEach((item, idx) => {
      const row = ws.getRow(summaryStart + 1 + idx);
      const labelCell = row.getCell(1);
      labelCell.value = item.label || "";
      labelCell.font = { ...SUMMARY_FONT, color: { argb: BRAND_COLORS.text } };
      labelCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
      labelCell.border = THIN_BORDER;

      const valueCell = row.getCell(2);
      const type = COLUMN_TYPES.includes(item.type) ? item.type : "text";
      writeValue(valueCell, item.value, type);
      valueCell.font = { ...SUMMARY_FONT, color: { argb: BRAND_COLORS.primaryDark } };
      valueCell.alignment = { vertical: "middle", horizontal: "right" };
      valueCell.border = THIN_BORDER;
    });
  }

  return ws;
};

/** Trigger a browser download for the workbook. */
export const saveWorkbook = async (workbook, filename) => {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/** Standard TableSpot filename: TableSpot_<Entity>_YYYY-MM-DD.xlsx */
export const exportFilename = (entity) => {
  const date = new Date().toISOString().slice(0, 10);
  return `TableSpot_${entity}_${date}.xlsx`;
};

// Shared ExcelJS style constants - TableSpot brand theme.
// Brand colors mirror the app theme (client/src/index.css).

export const BRAND_COLORS = {
  primary: "C62828", // TableSpot red
  primaryDark: "8E0000",
  primaryLight: "FDE8E8", // light red tint for summary rows
  headerText: "FFFFFF",
  subtitleFill: "F7F5F4",
  bandFill: "FAF7F6", // alternating body row band
  border: "D9D9D9",
  text: "1F1F1F",
  mutedText: "6B6B6B",
};

export const FONT_NAME = "Calibri";

export const FONT = { name: FONT_NAME, size: 11 };
export const HEADER_FONT = { name: FONT_NAME, size: 11, bold: true };
export const TITLE_FONT = { name: FONT_NAME, size: 15, bold: true };
export const SUBTITLE_FONT = { name: FONT_NAME, size: 10, italic: true };
export const SUMMARY_FONT = { name: FONT_NAME, size: 11, bold: true };

export const THIN_BORDER = {
  style: "thin",
  color: { argb: BRAND_COLORS.border },
};

export const BOX_BORDER = {
  top: THIN_BORDER,
  left: THIN_BORDER,
  bottom: THIN_BORDER,
  right: THIN_BORDER,
};

export const BODY_ALIGNMENT = { vertical: "middle", horizontal: "left" };
export const BODY_ALIGNMENT_WRAP = { vertical: "middle", horizontal: "left", wrapText: true };
export const HEADER_ALIGNMENT = {
  vertical: "middle",
  horizontal: "center",
  wrapText: true,
};

// Excel number formats
export const MONEY_FORMAT = '"₹"#,##0.00';
export const INT_FORMAT = "#,##0";
export const PERCENT_FORMAT = "0.00%";
export const DATE_FORMAT = "dd-mm-yyyy";
export const DATETIME_FORMAT = "dd-mm-yyyy hh:mm AM/PM";

export const DEFAULT_COLUMN_WIDTH = 16;
export const WRAP_COLUMN_WIDTH = 32;

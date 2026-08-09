// Excel export for the Admin / Customers users list.
import { addSheet, createWorkbook, exportFilename, saveWorkbook } from "./excel/excelExport.js";
import { activeLabel, yesNo } from "./excel/excelFormatters.js";

export const userColumns = [
  { header: "User Code", key: "userCode", width: 16 },
  { header: "Full Name", key: "fullName", width: 22 },
  { header: "Email", key: "email", width: 28 },
  { header: "Phone", key: "phoneNumber", width: 16 },
  { header: "Role", key: "role", width: 12 },
  { header: "Status", key: "isActive", width: 12 },
  { header: "Email Verified", key: "isEmailVerified", width: 14 },
  { header: "Joined", key: "createdAt", type: "date", width: 14 },
];

const mapUser = (user) => ({
  userCode: user?.userCode || user?._id || "-",
  fullName: user?.fullName || "-",
  email: user?.email || "-",
  phoneNumber: user?.phoneNumber || "-",
  role: user?.role || "-",
  isActive: activeLabel(user?.isActive),
  isEmailVerified: yesNo(user?.isEmailVerified),
  createdAt: user?.createdAt,
});

export async function exportUsersToExcel(users) {
  const list = Array.isArray(users) ? users : [];
  const rows = list.map(mapUser);

  const workbook = createWorkbook();
  const subtitle = `Exported ${new Date().toLocaleString()}`;

  addSheet({
    workbook,
    sheetName: "Users",
    title: "TableSpot - Users",
    subtitle,
    columns: userColumns,
    rows,
    summary: [
      { label: "Total Users", value: rows.length, type: "int" },
      { label: "Active", value: rows.filter((r) => r.isActive === "Active").length, type: "int" },
      { label: "Inactive", value: rows.filter((r) => r.isActive === "Inactive").length, type: "int" },
    ],
  });

  await saveWorkbook(workbook, exportFilename("Users"));
}

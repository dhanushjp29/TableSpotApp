import { useCallback, useState } from "react";
import toast from "react-hot-toast";

import { useDownloadLoader } from "./useDownloadLoader.js";

/**
 * Shared state for Excel export buttons.
 * data: array exported by exportFn; when empty the button shows a toast instead.
 * exportFn: (rows) => Promise<void> (builds workbook + triggers download).
 */
export const useExcelExport = ({
  data,
  exportFn,
  emptyMessage = "No data available to export.",
  successMessage = "Excel file downloaded successfully.",
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const { isDownloading, runDownload } = useDownloadLoader();

  const handleExport = useCallback(async () => {
    if (!Array.isArray(data) || data.length === 0) {
      toast.error(emptyMessage);
      return;
    }
    if (isExporting || isDownloading) return;
    setIsExporting(true);
    try {
      await runDownload(async () => {
        await exportFn(data);
        toast.success(successMessage);
      });
    } catch (err) {
      toast.error(err?.message || "Export failed. Please try again.");
    } finally {
      setIsExporting(false);
    }
  }, [data, exportFn, isExporting, isDownloading, emptyMessage, successMessage, runDownload]);

  return { isExporting, handleExport };
};

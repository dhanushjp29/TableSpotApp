import { FileSpreadsheet } from "lucide-react";
import Button from "../ui/Button.jsx";

/**
 * Reusable Excel export button.
 * isExporting: boolean from useExcelExport().
 * onClick: handleExport from useExcelExport().
 * label: button text (default "Excel").
 */
function ExportButton({ isExporting = false, onClick, label = "Excel", disabled = false, variant = "primary", className = "" }) {
  return (
    <Button
      variant={variant}
      isLoading={isExporting}
      loadingText="Exporting..."
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 ${className}`}
    >
      <FileSpreadsheet size={16} aria-hidden="true" />
      {label}
    </Button>
  );
}

export default ExportButton;

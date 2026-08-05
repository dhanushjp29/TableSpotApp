import { memo } from "react";
import Badge from "../ui/Badge.jsx";
import { TABLE_STATUS } from "../../constants/table.js";

const statusConfig = {
  [TABLE_STATUS.AVAILABLE]: { label: "Available", variant: "success" },
  [TABLE_STATUS.RESERVED]: { label: "Reserved", variant: "warning" },
  [TABLE_STATUS.OCCUPIED]: { label: "Occupied", variant: "error" },
  [TABLE_STATUS.CLEANING]: { label: "Cleaning", variant: "neutral" },
  [TABLE_STATUS.MAINTENANCE]: { label: "Maintenance", variant: "error" },
};

function TableSelector({ tables = [], selectedTableId, onSelect, guestCount = 1 }) {
  const bookable = tables.filter(
    (t) => t.status === TABLE_STATUS.AVAILABLE && t.capacity >= guestCount
  );

  if (!tables.length) {
    return (
      <div className="card p-5">
        <p className="text-sm text-muted">No tables available for this restaurant.</p>
      </div>
    );
  }

  if (!bookable.length) {
    return (
      <div className="card p-5">
        <p className="text-sm text-muted">
          No tables available for {guestCount} guest(s) at the selected time.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
      {bookable.map((table) => {
        const isSelected = String(table._id) === String(selectedTableId);
        const cfg = statusConfig[table.status] || statusConfig[TABLE_STATUS.AVAILABLE];
        return (
          <div
            key={table._id}
            onClick={() => onSelect(table._id)}
            className={`relative cursor-pointer rounded-lg border-2 p-3 transition-all ${
              isSelected
                ? "border-primary bg-primary/5"
                : "border-gray-200 hover:border-primary hover:bg-gray-50"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-text">
                    Table {table.tableNumber || table.name || "?"}
                  </span>
                  {table.tableCode && (
                    <span className="rounded bg-gray-100 px-1 py-0.5 font-mono text-[9px] font-semibold text-muted">
                      {table.tableCode}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-muted">
                  <span>{table.capacity} seats</span>
                  {table.tableType && <span>• {table.tableType}</span>}
                  {table.location && <span>• {table.location}</span>}
                </div>
              </div>
              <Badge variant={cfg.variant} className="text-xs">
                {cfg.label}
              </Badge>
            </div>
            {isSelected && (
              <div className="mt-1.5">
                <Badge variant="primary" className="text-xs">
                  Selected
                </Badge>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default memo(TableSelector);

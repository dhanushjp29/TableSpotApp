import { memo } from "react";
import { Armchair, Users } from "lucide-react";

import Badge from "../ui/Badge.jsx";
import TableShape from "./TableShape.jsx";
import { SEAT_SELECTION_MODE } from "../../constants/table.js";

function TableSelector({
  tables = [],
  seatSelections = {},
  fullTableSelections = {},
  onToggleSeat,
  onToggleFullTable,
  guestCount = 1,
}) {
  const toggleSeat = (tableId, seat, freeSeatIdSet) => {
    const seatId = String(seat._id);

    if (freeSeatIdSet && !freeSeatIdSet.has(seatId)) {
      return;
    }

    const current = (seatSelections[String(tableId)] || []).map(String);
    const isSelecting = !current.includes(seatId);
    const totalSelected = Object.values(seatSelections).reduce(
      (sum, seats) => sum + (seats?.length || 0),
      0
    );
    if (isSelecting && totalSelected >= guestCount) return;

    const next = current.includes(seatId)
      ? current.filter((id) => id !== seatId)
      : [...current, seatId];

    onToggleSeat?.(tableId, next);
  };

  if (!tables.length) {
    return (
      <div className="card p-5">
        <p className="text-sm text-muted">
          No tables available for this restaurant.
        </p>
      </div>
    );
  }

  const anyAvailable = tables.some(
    (item) => item.available || (item.freeSeatIds && item.freeSeatIds.length > 0)
  );

  if (!anyAvailable) {
    return (
      <div className="card p-5">
        <p className="text-sm text-muted">
          No tables available for {guestCount} guest(s) at the selected time.
        </p>
      </div>
    );
  }

  const selectedSeatCount = Object.values(seatSelections).reduce(
    (sum, seats) => sum + (seats?.length || 0),
    0
  );
  const selectedFullTables = tables.filter(
    (item) => fullTableSelections[String(item.table?._id)]
  );
  const selectedFullCapacity = selectedFullTables.reduce(
    (sum, item) => sum + Number(item.table?.capacity || 0),
    0
  );
  const reservedSeatCount = selectedSeatCount + selectedFullCapacity;

  const tableName = (table) =>
    table?.tableLabel
      ? `Table ${table.tableLabel}`
      : `Table ${table.tableNumber || table?.name || "?"}`;

  const selectedEntries = tables
    .filter((item) => {
      const tid = String(item.table?._id);
      return (
        (seatSelections[tid]?.length || 0) > 0 || fullTableSelections[tid]
      );
    })
    .map((item) => {
      const tid = String(item.table?._id);
      const seats = (seatSelections[tid] || []).map(String);
      const labels = seats
        .map((seatId) =>
          (item.table?.seats || []).find(
            (seat) => String(seat._id) === seatId
          )
        )
        .filter(Boolean)
        .map((seat) => seat.seatLabel);
      return { table: item.table, labels, isWholeTable: fullTableSelections[tid] };
    });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
        {tables.map((item) => {
          const table = item.table || item;
          const isSeatMode =
            table.seatSelectionMode === SEAT_SELECTION_MODE.INDIVIDUAL_SEATS;

          if (isSeatMode) {
            const activeSeats = (table.seats || []).filter(
              (seat) => seat.isActive !== false
            );
            const isBlocked =
              item.blocked === true || item.available === false;
            const freeSet = new Set(
              (item.freeSeatIds || []).map((id) => String(id))
            );
            const occupiedSeatIds = activeSeats
              .filter((seat) => !freeSet.has(String(seat._id)))
              .map((seat) => seat._id);

            const selectedForTable = (seatSelections[String(table._id)] || []).map(String);
            const isActive = selectedForTable.length > 0;

            return (
              <div
                key={table._id}
                className={`rounded-lg border-2 p-3 transition-all ${
                  isBlocked
                    ? "border-gray-200 opacity-60"
                    : isActive
                      ? "border-primary bg-primary/5"
                      : "border-gray-200"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Armchair size={14} className="text-muted" />
                    <span className="text-sm font-semibold text-text">
                      {tableName(table)}
                    </span>
                  </div>
                  {isBlocked ? (
                    <Badge variant="neutral" className="text-xs">
                      {item.blockReason || "Unavailable"}
                    </Badge>
                  ) : (
                    <span className="text-xs font-medium text-success">
                      {item.freeSeatCount || 0} free
                    </span>
                  )}
                </div>

                <div className="mt-2 flex justify-center">
                  <TableShape
                    shape={table.shape}
                    seats={activeSeats}
                    size={170}
                    selectedSeatIds={isBlocked ? [] : selectedForTable}
                    unavailableSeatIds={
                      isBlocked
                        ? activeSeats.map((seat) => seat._id)
                        : occupiedSeatIds
                    }
                    onSeatClick={
                      isBlocked
                        ? undefined
                        : (seat) => toggleSeat(table._id, seat, freeSet)
                    }
                    showLabels={activeSeats.length <= 24}
                  />
                </div>

                {isBlocked ? (
                  <p className="mt-2 text-center text-xs font-medium text-error">
                    Unavailable — {item.blockReason || "Not reservable"}
                  </p>
                ) : isActive ? (
                  <p className="mt-2 text-center text-xs font-medium text-primary">
                    {selectedForTable.length} of {guestCount} guest(s) seated
                    here
                  </p>
                ) : (
                  <p className="mt-2 text-center text-xs text-muted">
                    Tap seats to select. You can pick from any table.
                  </p>
                )}
              </div>
            );
          }

          // Full-table booking
          const available = item.available !== false;
          const isSelected = Boolean(fullTableSelections[String(table._id)]);

          return (
            <div
              key={table._id}
              onClick={() => available && onToggleFullTable?.(table._id)}
              className={`relative cursor-pointer rounded-lg border-2 p-3 transition-all ${
                !available
                  ? "cursor-not-allowed border-gray-200 opacity-50"
                  : isSelected
                    ? "border-primary bg-primary/5"
                    : "border-gray-200 hover:border-primary hover:bg-gray-50"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-text">
                      {tableName(table)}
                    </span>
                    {table.tableCode && (
                      <span className="rounded bg-gray-100 px-1 py-0.5 font-mono text-[9px] font-semibold text-muted">
                        {table.tableCode}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-muted">
                    <span className="inline-flex items-center gap-1">
                      <Users size={12} />
                      {table.capacity} seats
                    </span>
                    {table.tableType && <span>• {table.tableType}</span>}
                  </div>
                </div>
                <Badge
                  variant={available ? "success" : "neutral"}
                  className="text-xs"
                >
                  {available
                    ? "Available"
                    : item.blocked
                      ? item.blockReason || "Unavailable"
                      : "Booked"}
                </Badge>
              </div>
              {isSelected && (
                <div className="mt-1.5">
                  <Badge variant="primary" className="text-xs">
                    Selected
                  </Badge>
                </div>
              )}
              {!isSelected && available && (
                <p className="mt-2 text-center text-xs text-muted">
                  Book this whole table. Combine with other tables if needed.
                </p>
              )}
              {!isSelected && !available && (
                <p className="mt-2 text-center text-xs text-muted">
                  {item.blocked
                    ? `Unavailable — ${item.blockReason || "Not reservable"}`
                    : "Not available at the selected time."}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {selectedEntries.length > 0 && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
          <p className="text-sm font-medium text-primary">
            Selected:{" "}
            <span className="font-semibold">
              {selectedSeatCount} seat(s){" "}
              {selectedFullTables.length > 0 &&
                `+ ${selectedFullTables.length} whole table(s) (${selectedFullCapacity} seat(s))`}
            </span>{" "}
            = {reservedSeatCount} of {guestCount} guest(s) reserved.
          </p>
          <ul className="mt-1 space-y-0.5">
            {selectedEntries.map((entry) => (
              <li key={String(entry.table?._id)} className="text-xs text-muted">
                <span className="font-medium text-primary">
                  {tableName(entry.table)}
                </span>
                {entry.isWholeTable
                  ? " — whole table"
                  : entry.labels.length > 0
                    ? ` — ${entry.labels.join(", ")}`
                    : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default memo(TableSelector);

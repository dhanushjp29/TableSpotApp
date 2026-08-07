import {
  Calendar,
  Clock,
  Edit2,
  Plus,
  Settings2,
  Trash2,
  Users,
  Utensils,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useDispatch, useSelector, useStore } from "react-redux";

import {
  createTable,
  deleteTable,
  fetchTables,
  setTables,
  updateSeatsStatus,
  updateTable,
  updateTableStatus,
} from "../../store/slices/tableSlice.js";
import { fetchRestaurants } from "../../store/slices/restaurantSlice.js";
import { subscribeToTableUpdates } from "../../services/socket/socketService.js";
import { bookingApi } from "../../api/booking.api.js";

import Badge from "../../components/ui/Badge.jsx";
import Button from "../../components/ui/Button.jsx";
import Card from "../../components/ui/Card.jsx";
import ConfirmDialog from "../../components/ui/ConfirmDialog.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import ErrorState from "../../components/ui/ErrorState.jsx";
import Input from "../../components/ui/Input.jsx";
import Modal from "../../components/ui/Modal.jsx";
import Select from "../../components/ui/Select.jsx";
import TimePicker from "../../components/ui/TimePicker.jsx";
import { SkeletonText } from "../../components/ui/Skeleton.jsx";
import TableShape from "../../components/restaurant/TableShape.jsx";
import { formatDate, formatTime } from "../../utils/formatDate.js";
import { formatCurrency } from "../../utils/formatCurrency.js";
import {
  TABLE_LOCATION_VALUES,
  TABLE_SHAPE,
  TABLE_SHAPE_LABELS,
  TABLE_STATUS,
  TABLE_STATUS_VALUES,
  TABLE_TYPE_VALUES,
  SEAT_SELECTION_MODE,
  SEAT_SELECTION_MODE_LABELS,
  MAX_SEATS_SINGLE_ROW,
  MAX_SEATS_PER_TABLE,
} from "../../constants/table.js";
import {
  buildSeatLabel,
  generateSeats,
  getMaxSeatsForShape,
  getPositionsForShape,
} from "../../utils/seatLayout.js";

const MAX_REVERT_MINUTES = 720; // 12 hours
const DURATION_PRESETS = [15, 30, 45, 60, 90, 120];

const formatCountdown = (ms) => {
  if (ms <= 0) return "0s";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  }
  return `${seconds}s`;
};

const minutesLabel = (minutes) => {
  if (!minutes) return "";
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
  }
  return `${minutes}m`;
};

const statusBadge = {
  [TABLE_STATUS.AVAILABLE]: { label: "Available", variant: "success" },
  [TABLE_STATUS.RESERVED]: { label: "Reserved", variant: "warning" },
  [TABLE_STATUS.OCCUPIED]: { label: "Occupied", variant: "error" },
  [TABLE_STATUS.CLEANING]: { label: "Cleaning", variant: "neutral" },
  [TABLE_STATUS.MAINTENANCE]: { label: "Maintenance", variant: "error" },
};

const checkboxClass =
  "h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary";

const SHAPE_OPTIONS = [
  { value: TABLE_SHAPE.ROUND, label: "Round", hint: "Seats around a circle" },
  { value: TABLE_SHAPE.SQUARE, label: "Square", hint: "Seats on all sides" },
  { value: TABLE_SHAPE.RECTANGLE, label: "Rectangle", hint: "Seats along the edges" },
  { value: TABLE_SHAPE.OVAL, label: "Oval", hint: "Smooth curved edges" },
  { value: TABLE_SHAPE.BOAT, label: "Boat", hint: "Rounded ends, large groups" },
  { value: TABLE_SHAPE.SINGLE_ROW, label: "Single Row", hint: "Bar-style counter" },
];

const rebuildSeats = (prev, { label, count, shape, regenerateLabels }) => {
  const layout = getPositionsForShape(shape, count);

  return layout.map((item, index) => {
    const existing = prev[index];

    return {
      _id: existing?._id,
      seatIndex: index + 1,
      seatLabel: regenerateLabels
        ? buildSeatLabel(label, index + 1)
        : existing?.seatLabel || buildSeatLabel(label, index + 1),
      position: item.position,
      isActive: true,
    };
  });
};

function ShapePicker({ value, onChange }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {SHAPE_OPTIONS.map((option) => {
        const isSelected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`flex flex-col items-center gap-1 rounded-lg border-2 p-3 transition-colors ${
              isSelected
                ? "border-primary bg-primary/5"
                : "border-gray-200 hover:border-primary/50 hover:bg-gray-50"
            }`}
          >
            <TableShape
              shape={option.value}
              seats={generateSeats({ label: "A", count: 6, shape: option.value })}
              size={72}
              showLabels={false}
              neutral
            />
            <span
              className={`text-xs font-semibold ${
                isSelected ? "text-primary" : "text-text"
              }`}
            >
              {option.label}
            </span>
            <span className="text-center text-[10px] leading-tight text-muted">
              {option.hint}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function SeatEditor({ seats, tableLabel, shape, onChange }) {
  const handleCountChange = (raw) => {
    const maxSeats = getMaxSeatsForShape(shape);
    const count = Math.min(Math.max(Number(raw) || 1, 1), maxSeats);
    onChange(rebuildSeats(seats, { label: tableLabel, count, shape, regenerateLabels: false }));
  };

  const duplicateLabels = useMemo(() => {
    const seen = new Map();
    (seats || []).forEach((seat) => {
      const key = String(seat.seatLabel || "").trim().toUpperCase();
      if (key) seen.set(key, (seen.get(key) || 0) + 1);
    });
    return [...seen.entries()].filter(([, n]) => n > 1).map(([label]) => label);
  }, [seats]);

  const handleLabelChange = (index, label) => {
    const next = seats.map((seat, i) =>
      i === index
        ? { ...seat, seatLabel: label.toUpperCase().slice(0, 10) }
        : seat
    );
    onChange(next);
  };

  const handleRemove = (index) => {
    if (seats.length <= 1) {
      toast.error("A table needs at least one seat.");
      return;
    }
    const next = seats
      .filter((_, i) => i !== index)
      .map((seat, i) => ({ ...seat, seatIndex: i + 1 }));
    onChange(next);
  };

  const handleAdd = () => {
    const count = seats.length + 1;
    onChange(rebuildSeats(seats, { label: tableLabel, count, shape, regenerateLabels: false }));
  };

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="flex flex-col items-center justify-center rounded-lg border border-gray-200 bg-surface p-3">
        <TableShape
          shape={shape}
          seats={seats}
          size={240}
          showLabels
          neutral
        />
        <div className="mt-2 flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleCountChange(seats.length - 1)}
            disabled={seats.length <= 1}
          >
            −
          </Button>
          <span className="min-w-16 text-center text-sm font-semibold text-text">
            {seats.length} seats
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAdd}
            disabled={seats.length >= getMaxSeatsForShape(shape)}
          >
            +
          </Button>
        </div>
      </div>

      <div>
        <p className="input-label">Seat Labels</p>
        <div className="grid max-h-44 grid-cols-3 gap-2 overflow-y-auto rounded-lg border border-gray-200 p-2">
          {seats.map((seat, index) => (
            <div key={seat.seatIndex} className="flex items-center gap-1">
              <input
                type="text"
                value={seat.seatLabel}
                onChange={(e) => handleLabelChange(index, e.target.value)}
                maxLength={10}
                className="input-field px-2 py-1.5 text-center text-sm"
                aria-label={`Seat ${index + 1} label`}
              />
              <button
                type="button"
                onClick={() => handleRemove(index)}
                disabled={seats.length <= 1}
                aria-label={`Remove seat ${seat.seatLabel}`}
                className="text-muted transition-colors hover:text-error disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">
          Seats are auto-numbered from the table label (e.g. A → A1, A2). You can
          rename individual seats. Seats with upcoming bookings cannot be removed.
        </p>
        {duplicateLabels.length > 0 && (
          <p className="mt-2 text-xs font-medium text-error" role="alert">
            Duplicate seat labels: {duplicateLabels.join(", ")}. Each seat must
            have a unique label.
          </p>
        )}
      </div>
    </div>
  );
}

function TableForm({
  table = null,
  restaurants,
  defaultRestaurantId = "",
  onSuccess,
  onCancel,
}) {
  const isEdit = Boolean(table);
  const dispatch = useDispatch();

  const [serverErrors, setServerErrors] = useState([]);

  const initialShape = table?.shape || TABLE_SHAPE.SQUARE;
  const initialLabel = table?.tableLabel || "";

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      restaurantId:
        table?.restaurantId?._id ||
        defaultRestaurantId ||
        (restaurants.length === 1 ? restaurants[0]?._id || "" : ""),
      tableNumber: table?.tableNumber ?? "",
      tableName: table?.tableName || "",
      tableLabel: initialLabel,
      shape: initialShape,
      seatSelectionMode:
        table?.seatSelectionMode || SEAT_SELECTION_MODE.FULL_TABLE,
      capacity: table?.capacity ?? "",
      minimumCapacity: table?.minimumCapacity ?? 1,
      tableType: table?.tableType || "Normal",
      otherTableType: table?.otherTableType || "",
      tableLocation: table?.tableLocation || "Indoor",
      otherTableLocation: table?.otherTableLocation || "",
      floor: table?.floor || "",
      status: table?.status || TABLE_STATUS.AVAILABLE,
      isReservable: table?.isReservable ?? true,
      isActive: table?.isActive ?? true,
      displayOrder: table?.displayOrder ?? 1,
      description: table?.description || "",
    },
  });

  const tableType = watch("tableType");
  const tableLocation = watch("tableLocation");
  const seatSelectionMode = watch("seatSelectionMode");

  const [shape, setShape] = useState(initialShape);
  const [tableLabel, setTableLabel] = useState(initialLabel);
  const [seats, setSeats] = useState(() =>
    table?.seats?.length
      ? table.seats.map((seat) => ({
          _id: seat._id,
          seatIndex: seat.seatIndex,
          seatLabel: seat.seatLabel,
          position: { ...seat.position },
          isActive: seat.isActive,
        }))
      : generateSeats({
          label: initialLabel || "T",
          count: table?.capacity || 6,
          shape: initialShape,
        })
  );

  const shapeMax = useMemo(() => getMaxSeatsForShape(shape), [shape]);
  const maxSeatsLabel = useMemo(
    () => (shape === TABLE_SHAPE.SINGLE_ROW ? MAX_SEATS_SINGLE_ROW : MAX_SEATS_PER_TABLE),
    [shape]
  );

  const handleShapeChange = (nextShape) => {
    setShape(nextShape);
    setSeats((prev) =>
      rebuildSeats(prev, { label: tableLabel, count: prev.length, shape: nextShape })
    );
  };

  const handleLabelChange = (value) => {
    const clean = value.toUpperCase().replace(/[^a-zA-Z0-9]/g, "").slice(0, 3);
    setTableLabel(clean);
    setSeats((prev) =>
      rebuildSeats(prev, { label: clean, count: prev.length, shape, regenerateLabels: true })
    );
  };

  const onSubmit = async (data) => {
    setServerErrors([]);
    try {
      const trimmedLabel = tableLabel.trim();
      const seatLabels = seats.map((seat) =>
        String(seat.seatLabel || "").trim().toUpperCase()
      );
      if (new Set(seatLabels).size !== seatLabels.length) {
        toast.error("Seat labels must be unique within a table.");
        return;
      }

      const payload = {
        restaurantId: data.restaurantId,
        tableNumber: Number(data.tableNumber),
        tableName: (data.tableName || "").trim(),
        tableLabel: trimmedLabel,
        shape,
        seatSelectionMode: data.seatSelectionMode,
        seats: seats.map((seat) => ({
          _id: seat._id,
          seatIndex: seat.seatIndex,
          seatLabel: seat.seatLabel,
          position: { x: seat.position.x, y: seat.position.y },
          isActive: seat.isActive !== false,
        })),
        capacity: seats.length,
        minimumCapacity: Math.min(
          Number(data.minimumCapacity) || 1,
          seats.length
        ),
        tableType: data.tableType,
        otherTableType:
          data.tableType === "Other" ? (data.otherTableType || "").trim() : "",
        tableLocation: data.tableLocation,
        otherTableLocation:
          data.tableLocation === "Other"
            ? (data.otherTableLocation || "").trim()
            : "",
        floor: (data.floor || "").trim(),
        status: data.status,
        isReservable: Boolean(data.isReservable),
        isActive: Boolean(data.isActive),
        displayOrder: Number(data.displayOrder) || 1,
        description: (data.description || "").trim(),
      };

      if (isEdit) {
        await dispatch(updateTable(table._id, payload));
        toast.success("Table updated successfully!");
      } else {
        await dispatch(createTable(payload));
        toast.success("Table created successfully!");
      }
      onSuccess();
    } catch (err) {
      setServerErrors(err?.response?.data?.errors || []);
      toast.error(
        err?.response?.data?.message || err?.message || "Failed to save table."
      );
    }
  };

  const missingRequired = ["restaurantId", "tableNumber"].filter(
    (name) => errors[name]
  );
  const requiredLabels = {
    restaurantId: "Restaurant",
    tableNumber: "Table Number",
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      {missingRequired.length > 0 && (
        <div
          role="alert"
          className="rounded-lg border border-error bg-error/5 p-3 text-sm text-error"
        >
          Please fill the required field{missingRequired.length > 1 ? "s" : ""}:{" "}
          <strong>{missingRequired.map((n) => requiredLabels[n]).join(", ")}</strong>
        </div>
      )}
      {serverErrors.length > 0 && (
        <div
          role="alert"
          className="rounded-lg border border-error bg-error/5 p-3 text-sm text-error"
        >
          <p className="font-semibold">
            The server could not save this table:
          </p>
          <ul className="mt-1 list-inside list-disc space-y-0.5">
            {serverErrors.map((fieldError, index) => (
              <li key={index}>
                {fieldError.path ? (
                  <>
                    <strong>{fieldError.path}:</strong>{" "}
                  </>
                ) : null}
                {fieldError.message}
              </li>
            ))}
          </ul>
        </div>
      )}
      <Select
        label="Restaurant *"
        error={errors.restaurantId?.message}
        {...register("restaurantId", { required: "Restaurant is required." })}
      >
        <option value="">Select a restaurant</option>
        {restaurants.map((r) => (
          <option key={r._id} value={r._id}>
            {r.restaurantCode} - {r.restaurantName} - {r.city}
          </option>
        ))}
      </Select>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Input
          label="Table Number *"
          type="number"
          min={1}
          error={errors.tableNumber?.message}
          {...register("tableNumber", { required: "Table number is required." })}
        />
        <Input
          label="Table Name"
          {...register("tableName")}
          placeholder="e.g. Window 1"
        />
        <Input
          label="Table Label"
          value={tableLabel}
          onChange={(e) => handleLabelChange(e.target.value)}
          maxLength={3}
          placeholder="e.g. A, B, W1"
          hint={
            tableLabel
              ? `Seats will be labeled ${tableLabel}1, ${tableLabel}2...`
              : 'Leave empty to use "T" prefix (T1, T2...). Max 3 chars.'
          }
        />
      </div>

      <div>
        <p className="input-label">Table Shape</p>
        <ShapePicker value={shape} onChange={handleShapeChange} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <p className="input-label">Booking Mode</p>
          <div className="grid grid-cols-2 gap-2">
            {[SEAT_SELECTION_MODE.FULL_TABLE, SEAT_SELECTION_MODE.INDIVIDUAL_SEATS].map(
              (mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setValue("seatSelectionMode", mode)}
                  className={`rounded-lg border-2 p-3 text-left transition-colors ${
                    seatSelectionMode === mode
                      ? "border-primary bg-primary/5"
                      : "border-gray-200 hover:border-primary/50 hover:bg-gray-50"
                  }`}
                >
                  <p className="text-sm font-semibold text-text">
                    {SEAT_SELECTION_MODE_LABELS[mode]}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {mode === SEAT_SELECTION_MODE.FULL_TABLE
                      ? "Customers book the entire table."
                      : "Customers pick specific seats (e.g. A1, A2)."}
                  </p>
                </button>
              )
            )}
          </div>
        </div>
        <Input
          label="Number of Seats"
          type="number"
          min={1}
          max={shapeMax}
          value={seats.length}
          onChange={(e) => {
            const count = Math.min(
              Math.max(Number(e.target.value) || 1, 1),
              shapeMax
            );
            setSeats((prev) =>
              rebuildSeats(prev, { label: tableLabel, count, shape })
            );
          }}
          hint={`Max ${maxSeatsLabel} seats for ${TABLE_SHAPE_LABELS[shape]?.toLowerCase() || shape} tables.`}
        />
      </div>

      <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-4">
        <p className="mb-3 text-sm font-semibold text-text">
          Layout Preview
        </p>
        <SeatEditor
          seats={seats}
          tableLabel={tableLabel}
          shape={shape}
          onChange={setSeats}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select label="Table Type" {...register("tableType")}>
          {TABLE_TYPE_VALUES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
        {tableType === "Other" && (
          <Input label="Other Table Type" {...register("otherTableType")} />
        )}
        <Select label="Table Location" {...register("tableLocation")}>
          {TABLE_LOCATION_VALUES.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </Select>
        {tableLocation === "Other" && (
          <Input label="Other Location" {...register("otherTableLocation")} />
        )}
        <Input
          label="Floor"
          {...register("floor")}
          placeholder="e.g. 1st Floor"
        />
        <Select
          label="Status"
          disabled={isEdit}
          hint={isEdit ? "Change status via the Status button on the table card." : undefined}
          {...register("status")}
        >
          {TABLE_STATUS_VALUES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
        <Input
          label="Display Order"
          type="number"
          min={1}
          {...register("displayOrder")}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex items-center gap-2 text-sm font-medium text-text">
          <input
            type="checkbox"
            {...register("isReservable")}
            className={checkboxClass}
          />
          Reservable
        </label>
        <label className="flex items-center gap-2 text-sm font-medium text-text">
          <input type="checkbox" {...register("isActive")} className={checkboxClass} />
          Active
        </label>
      </div>

      <div>
        <label className="input-label">Description</label>
        <textarea {...register("description")} rows={3} className="input-field w-full" />
      </div>

      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="submit"
          isLoading={isSubmitting}
          loadingText={isEdit ? "Saving..." : "Creating..."}
        >
          {isEdit ? "Save Changes" : "Create Table"}
        </Button>
      </div>
    </form>
  );
}

function StatusControlModal({ table, onClose, onApplied }) {
  const dispatch = useDispatch();

  const [status, setStatus] = useState(table.status || TABLE_STATUS.AVAILABLE);
  const [mode, setMode] = useState("none");
  const [customMinutes, setCustomMinutes] = useState("");
  const [customRevertTime, setCustomRevertTime] = useState("");
  const [applying, setApplying] = useState(false);

  const isSeatMode =
    table.seatSelectionMode === SEAT_SELECTION_MODE.INDIVIDUAL_SEATS;
  const activeSeats = (table.seats || []).filter(
    (seat) => seat.isActive !== false
  );
  const unavailableSeatIds = activeSeats
    .filter(
      (seat) => seat.status && seat.status !== TABLE_STATUS.AVAILABLE
    )
    .map((seat) => seat._id);
  const [selectedSeatIds, setSelectedSeatIds] = useState([]);
  const [seatSelectionError, setSeatSelectionError] = useState("");

  const isBlockedStatus = status !== TABLE_STATUS.AVAILABLE;

  const staysUntilReleased = isSeatMode
    ? `Selected seats stay ${status} until you release them manually.`
    : `The table stays ${status} until you release it manually.`;

  const noAutoReturn = isSeatMode
    ? `No auto-return set — selected seats stay ${status} until you release them manually.`
    : `No auto-return set — the table stays ${status} until you release it manually.`;

  const computeCustomMinutes = () => {
    if (customRevertTime) {
      const [h, m] = customRevertTime.split(":").map(Number);
      if (Number.isNaN(h) || Number.isNaN(m)) {
        return { minutes: null, error: "" };
      }
      const now = new Date();
      const target = h * 60 + m;
      const current = now.getHours() * 60 + now.getMinutes();
      let diff = target - current;
      if (diff <= 0) diff += 1440;
      if (diff === 0) {
        return { minutes: null, error: "Pick a time that is not right now." };
      }
      if (diff > MAX_REVERT_MINUTES) {
        return {
          minutes: null,
          error: "Auto-return time must be within the next 12 hours.",
        };
      }
      return { minutes: diff, error: "" };
    }

    if (customMinutes) {
      const m = Number(customMinutes);
      if (!Number.isFinite(m) || m < 1) {
        return { minutes: null, error: "Enter at least 1 minute." };
      }
      if (m > MAX_REVERT_MINUTES) {
        return {
          minutes: null,
          error: `Maximum is 12 hours (${MAX_REVERT_MINUTES} minutes).`,
        };
      }
      return { minutes: Math.round(m), error: "" };
    }

    return { minutes: null, error: "" };
  };

  let effectiveMinutes = null;
  let durationError = "";
  if (isBlockedStatus) {
    if (mode === "custom") {
      const result = computeCustomMinutes();
      effectiveMinutes = result.minutes;
      durationError = result.error;
    } else if (typeof mode === "number") {
      effectiveMinutes = mode;
    }
  }

  const handleStatusChange = (event) => {
    const next = event.target.value;
    setStatus(next);
    if (next === TABLE_STATUS.AVAILABLE) {
      setMode("none");
      setCustomMinutes("");
      setCustomRevertTime("");
    }
  };

  const toggleSeat = (seat) => {
    const id = String(seat._id);
    setSelectedSeatIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
    setSeatSelectionError("");
  };

  const toggleAllSeats = () => {
    setSelectedSeatIds((prev) =>
      prev.length === activeSeats.length && activeSeats.length > 0
        ? []
        : activeSeats.map((seat) => String(seat._id))
    );
    setSeatSelectionError("");
  };

  const handleApply = async () => {
    if (durationError) {
      toast.error(durationError);
      return;
    }
    if (isSeatMode && selectedSeatIds.length === 0) {
      setSeatSelectionError("Select at least one seat.");
      return;
    }
    setApplying(true);
    try {
      const revertPayload = effectiveMinutes
        ? { revertAfterMinutes: effectiveMinutes }
        : {};
      if (isSeatMode) {
        await dispatch(
          updateSeatsStatus(table._id, {
            seatIds: selectedSeatIds,
            status,
            ...revertPayload,
          })
        );
        toast.success(
          selectedSeatIds.length === 1
            ? "Seat status updated successfully!"
            : `${selectedSeatIds.length} seats updated successfully!`
        );
      } else {
        await dispatch(
          updateTableStatus(table._id, {
            status,
            ...revertPayload,
          })
        );
        toast.success("Table status updated successfully!");
      }
      onApplied();
    } catch (err) {
      toast.error(
        err?.response?.data?.message || err?.message || "Failed to update status."
      );
    } finally {
      setApplying(false);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleApply();
      }}
      className="space-y-5"
    >
      {isSeatMode && (
        <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-text">Select Seats</p>
            <button
              type="button"
              onClick={toggleAllSeats}
              className="text-xs font-semibold text-primary transition-colors hover:text-primary/80"
            >
              {selectedSeatIds.length === activeSeats.length &&
              activeSeats.length > 0
                ? "Clear all"
                : "Select all"}
            </button>
          </div>

          <div className="mt-2 flex justify-center">
            <TableShape
              shape={table.shape || TABLE_SHAPE.SQUARE}
              seats={activeSeats}
              size={200}
              selectedSeatIds={selectedSeatIds}
              unavailableSeatIds={unavailableSeatIds}
              onSeatClick={toggleSeat}
              allowUnavailableClick
              showLabels={activeSeats.length <= 24}
            />
          </div>

          <p className="mt-2 text-center text-xs text-muted">
            {selectedSeatIds.length > 0
              ? `${selectedSeatIds.length} seat(s) selected: `
              : "Click seats to include them in this status update."}
            {selectedSeatIds.length > 0 && (
              <span className="font-medium text-primary">
                {activeSeats
                  .filter((seat) =>
                    selectedSeatIds.includes(String(seat._id))
                  )
                  .map((seat) => seat.seatLabel)
                  .join(", ")}
              </span>
            )}
          </p>

          {seatSelectionError && (
            <p
              className="mt-1 text-center text-xs font-medium text-error"
              role="alert"
            >
              {seatSelectionError}
            </p>
          )}

          <div className="mt-2 flex items-center justify-center gap-3 text-xs text-muted">
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-[#16a34a]" />
              Available
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-[#d6d3d1]" />
              Not available
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-[#c62828]" />
              Selected
            </span>
          </div>
        </div>
      )}

      <div>
        <Select
          label={isSeatMode ? "Seat Status" : "Status"}
          value={status}
          onChange={handleStatusChange}
        >
          {TABLE_STATUS_VALUES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
        <p className="mt-2 text-xs text-muted">
          {isSeatMode
            ? "Non-Available seats are hidden from new bookings until released or the timer below expires."
            : "Non-Available statuses block new bookings until released or the timer below expires."}
        </p>
      </div>

      {isBlockedStatus && (
        <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-4">
          <p className="mb-3 text-sm font-semibold text-text">
            Auto-return to Available (optional)
          </p>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {DURATION_PRESETS.map((preset) => {
              const isActive = mode === preset;
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setMode(preset);
                    setCustomMinutes("");
                    setCustomRevertTime("");
                  }}
                  className={`rounded-lg border-2 p-3 text-sm font-semibold transition-colors ${
                    isActive
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-gray-200 text-text hover:border-primary/50 hover:bg-gray-50"
                  }`}
                >
                  {preset} min
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setMode("custom")}
              className={`rounded-lg border-2 p-3 text-sm font-semibold transition-colors ${
                mode === "custom"
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-gray-200 text-text hover:border-primary/50 hover:bg-gray-50"
              }`}
            >
              Custom
            </button>
          </div>

          {mode === "custom" && (
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  label="Duration (minutes)"
                  type="number"
                  min={1}
                  max={MAX_REVERT_MINUTES}
                  value={customMinutes}
                  onChange={(e) => {
                    setCustomMinutes(e.target.value);
                    setCustomRevertTime("");
                  }}
                  hint={`Max ${MAX_REVERT_MINUTES} minutes (12 hours).`}
                />
                <TimePicker
                  label="Or pick a return time"
                  value={customRevertTime}
                  onChange={(e) => {
                    setCustomRevertTime(e.target.value);
                    setCustomMinutes("");
                  }}
                  hint={
                    isSeatMode
                      ? "Selected seats become Available at this time."
                      : "The table becomes Available at this time."
                  }
                />
              </div>
              {durationError && (
                <p className="text-xs font-medium text-error" role="alert">
                  {durationError}
                </p>
              )}
              {!durationError && effectiveMinutes && (
                <p className="text-xs font-medium text-text">
                  Returns to Available in{" "}
                  <span className="text-primary">
                    {minutesLabel(effectiveMinutes)}
                  </span>
                  .
                </p>
              )}
              {!durationError && !effectiveMinutes && (
                <p className="text-xs text-muted">{noAutoReturn}</p>
              )}
            </div>
          )}

          {mode !== "custom" && typeof mode === "number" && (
            <p className="mt-3 text-xs font-medium text-text">
              Returns to Available in{" "}
              <span className="text-primary">{minutesLabel(mode)}</span>.
            </p>
          )}
          {mode === "none" && (
            <p className="mt-3 text-xs text-muted">{staysUntilReleased}</p>
          )}
        </div>
      )}

      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" isLoading={applying} loadingText="Updating...">
          Apply Status
        </Button>
      </div>
    </form>
  );
}

function UpcomingBookingRow({ booking, table }) {
  const bDate = booking.bookingDateTime
    ? new Date(booking.bookingDateTime)
    : null;
  const customer = typeof booking.userId === "object" ? booking.userId : null;

  const entry = (booking.tables || []).find(
    (e) => String(e.tableId?._id || e.tableId) === String(table._id)
  );

  const isFullTable =
    (entry?.seatSelectionMode || booking.bookingMode) !==
    SEAT_SELECTION_MODE.INDIVIDUAL_SEATS;

  const labels = entry?.seatLabels?.length
    ? entry.seatLabels
    : booking.seatLabels?.length
      ? booking.seatLabels
      : [];

  const seatInfo = (() => {
    if (isFullTable) {
      return `Full table (${table.capacity} seats)`;
    }
    if (labels.length > 0) {
      return `${labels.length} seat${labels.length === 1 ? "" : "s"} (${labels.join(", ")})`;
    }
    return "Individual seats";
  })();

  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50/40 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <h3 className="truncate text-sm font-semibold text-text">
            {customer?.fullName || customer?.name || "Guest Customer"}
          </h3>
          {booking.bookingCode && (
            <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted">
              {booking.bookingCode}
            </span>
          )}
        </div>
        <Badge variant="success">{booking.bookingStatus}</Badge>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        {bDate && (
          <span className="inline-flex items-center gap-1">
            <Calendar size={13} className="text-primary" />
            {formatDate(bDate)} at {formatTime(bDate)}
          </span>
        )}
        <span className="inline-flex items-center gap-1">
          <Users size={13} className="text-primary" />
          {booking.numberOfGuests} member
          {booking.numberOfGuests === 1 ? "" : "s"}
        </span>
        {seatInfo && (
          <span className="inline-flex items-center gap-1 font-medium text-text">
            <Utensils size={13} className="text-primary" />
            {seatInfo}
          </span>
        )}
        {Number(booking.expectedDuration) > 0 && (
          <span>{booking.expectedDuration} min</span>
        )}
        {Number(booking.advanceAmount) > 0 && (
          <span>Advance: {formatCurrency(booking.advanceAmount)}</span>
        )}
      </div>
    </div>
  );
}

function OwnerTablesPage() {
  const user = useSelector((state) => state.auth.user);
  const dispatch = useDispatch();
  const store = useStore();
  const tables = useSelector((state) => state.table.tables);
  const tableLoading = useSelector((state) => state.table.isLoading);
  const tableError = useSelector((state) => state.table.error);
  const restaurants = useSelector((state) => state.restaurant.restaurants);
  const restaurantLoading = useSelector((state) => state.restaurant.isLoading);
  const restaurantError = useSelector((state) => state.restaurant.error);
  const [showCreate, setShowCreate] = useState(false);
  const [editTable, setEditTable] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedRestaurant, setSelectedRestaurant] = useState("");
  const [statusTarget, setStatusTarget] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const [upcomingTable, setUpcomingTable] = useState(null);
  const [upcomingBookings, setUpcomingBookings] = useState([]);
  const [upcomingLoading, setUpcomingLoading] = useState(false);
  const [upcomingError, setUpcomingError] = useState("");

  const isLoading = tableLoading || restaurantLoading;
  const error = tableError || restaurantError;

  const fetchData = async () => {
    await Promise.all([
      dispatch(fetchTables()),
      dispatch(fetchRestaurants({ ownerId: user?.id, isActive: true })),
    ]).catch(() => {});
  };

  const openUpcomingBookings = async (table) => {
    setUpcomingTable(table);
    setUpcomingBookings([]);
    setUpcomingError("");
    setUpcomingLoading(true);
    try {
      const response = await bookingApi.getAll({
        tableId: table._id,
        from: new Date().toISOString(),
        bookingStatus: "Confirmed",
        sort: "bookingDateTime",
        limit: 50,
      });
      setUpcomingBookings(response.data?.bookings || []);
    } catch (err) {
      setUpcomingError(
        err?.response?.data?.message || "Failed to load upcoming bookings."
      );
    } finally {
      setUpcomingLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToTableUpdates("all", (updatedTable) => {
      const current = store.getState().table.tables;
      const id = updatedTable?._id;
      if (!id) return;
      let next;
      if (updatedTable.isActive === false) {
        next = current.filter((t) => t._id !== id);
      } else if (current.some((t) => t._id === id)) {
        next = current.map((t) => (t._id === id ? { ...t, ...updatedTable } : t));
      } else {
        next = [...current, updatedTable];
      }
      dispatch(
        setTables({
          tables: next,
          meta: store.getState().table.meta,
        })
      );
    });
    return unsubscribe;
  }, [dispatch, store]);

  // Tick once a second only while any card has an active revert timer.
  useEffect(() => {
    const hasTimers = tables.some(
      (t) => t.statusScheduledUntil && t.status !== TABLE_STATUS.AVAILABLE
    );
    if (!hasTimers) return undefined;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [tables]);

  // When a timer expires locally, mark the table Available and reconcile with
  // the server (the scheduler + socket keep other clients in sync).
  useEffect(() => {
    const expiredIds = new Set(
      tables
        .filter(
          (t) =>
            t.statusScheduledUntil &&
            new Date(t.statusScheduledUntil).getTime() <= now &&
            t.status !== TABLE_STATUS.AVAILABLE
        )
        .map((t) => String(t._id))
    );
    if (expiredIds.size === 0) return;
    const current = store.getState().table.tables;
    dispatch(
      setTables({
        tables: current.map((t) =>
          expiredIds.has(String(t._id))
            ? {
                ...t,
                status: TABLE_STATUS.AVAILABLE,
                isReservable: true,
                statusScheduledUntil: null,
              }
            : t
        ),
        meta: store.getState().table.meta,
      })
    );
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now]);

  const visibleTables = selectedRestaurant
    ? tables.filter(
        (table) => String(table.restaurantId?._id) === selectedRestaurant
      )
    : tables;

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await dispatch(deleteTable(deleteTarget._id));
      toast.success("Table deleted successfully!");
      setDeleteTarget(null);
      fetchData();
    } catch (err) {
      toast.error(
        err?.response?.data?.message || err?.message || "Failed to delete table."
      );
    } finally {
      setDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-4">
              <SkeletonText lines={3} />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <ErrorState
          title="Unable to load tables"
          description={error}
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  }

  if (restaurants.length === 0) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <EmptyState
          title="Create a restaurant first"
          description="You need at least one restaurant before you can add tables to it."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">Tables</h1>
          <p className="mt-1 text-sm text-muted">
            Manage your restaurant tables, shapes and seats.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus size={16} />
          Add Table
        </Button>
      </div>

      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full sm:max-w-xs">
          <Select
            label="Restaurant"
            value={selectedRestaurant}
            onChange={(event) => setSelectedRestaurant(event.target.value)}
          >
            <option value="">All restaurants ({tables.length})</option>
            {restaurants.map((restaurant) => (
              <option key={restaurant._id} value={restaurant._id}>
                {restaurant.restaurantName}
                {restaurant.city ? ` - ${restaurant.city}` : ""}
              </option>
            ))}
          </Select>
        </div>
        <p className="text-sm text-muted">
          Showing {visibleTables.length} of {tables.length} table
          {tables.length === 1 ? "" : "s"}
        </p>
      </div>

      {showCreate && (
        <Modal
          isOpen={showCreate}
          onClose={() => setShowCreate(false)}
          title="Add Table"
          size="lg"
        >
          <TableForm
            restaurants={restaurants}
            defaultRestaurantId={selectedRestaurant}
            onSuccess={() => {
              setShowCreate(false);
              fetchData();
            }}
            onCancel={() => setShowCreate(false)}
          />
        </Modal>
      )}

      {editTable && (
        <Modal
          isOpen={Boolean(editTable)}
          onClose={() => setEditTable(null)}
          title="Edit Table"
          size="lg"
        >
          <TableForm
            table={editTable}
            restaurants={restaurants}
            onSuccess={() => {
              setEditTable(null);
              fetchData();
            }}
            onCancel={() => setEditTable(null)}
          />
        </Modal>
      )}

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        isLoading={deleting}
        title="Delete Table"
        description={`Are you sure you want to delete ${deleteTarget?.tableName ? `"${deleteTarget.tableName}"` : `Table ${deleteTarget?.tableNumber || "?"}`}? This action cannot be undone.`}
        confirmText="Delete"
      />

      {statusTarget && (
        <Modal
          isOpen={Boolean(statusTarget)}
          onClose={() => setStatusTarget(null)}
          title={`Set Status — ${
            statusTarget.tableName || `Table ${statusTarget.tableNumber}`
          }`}
          size="md"
        >
          <StatusControlModal
            table={statusTarget}
            onClose={() => setStatusTarget(null)}
            onApplied={() => {
              setStatusTarget(null);
              fetchData();
            }}
          />
        </Modal>
      )}

      {upcomingTable && (
        <Modal
          isOpen={Boolean(upcomingTable)}
          onClose={() => setUpcomingTable(null)}
          title={`Upcoming Bookings — ${
            upcomingTable.tableName || `Table ${upcomingTable.tableNumber}`
          }`}
          size="lg"
        >
          <div className="space-y-3">
            {upcomingLoading ? (
              <SkeletonText lines={3} />
            ) : upcomingError ? (
              <ErrorState
                title="Unable to load upcoming bookings"
                description={upcomingError}
                onRetry={() => openUpcomingBookings(upcomingTable)}
              />
            ) : upcomingBookings.length === 0 ? (
              <EmptyState
                title="No upcoming bookings"
                description="There are no confirmed upcoming bookings for this table."
              />
            ) : (
              upcomingBookings.map((booking) => (
                <UpcomingBookingRow
                  key={booking._id}
                  booking={booking}
                  table={upcomingTable}
                />
              ))
            )}
          </div>
        </Modal>
      )}

      {visibleTables.length === 0 ? (
        <EmptyState
          title={selectedRestaurant ? "No tables for this restaurant" : "No tables yet"}
          description={
            selectedRestaurant
              ? "Add tables to this restaurant to start accepting bookings."
              : "Add tables to your restaurant to start accepting bookings."
          }
          action={
            <Button onClick={() => setShowCreate(true)}>
              <Plus size={16} />
              Add Table
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleTables.map((table) => {
            const cfg =
              statusBadge[table.status] || statusBadge[TABLE_STATUS.AVAILABLE];
            const seats = table.seats?.length ? table.seats : [];
            const manualBlockedSeats = seats.filter(
              (seat) =>
                seat.status && seat.status !== TABLE_STATUS.AVAILABLE
            );
            const unavailableSeatIds =
              table.status === TABLE_STATUS.OCCUPIED ||
              table.status === TABLE_STATUS.RESERVED
                ? seats.map((seat) => seat._id)
                : manualBlockedSeats.map((seat) => seat._id);
            return (
              <Card key={table._id} className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-text">
                        {table.tableName
                          ? `${table.tableName} (Table ${table.tableNumber})`
                          : `Table ${table.tableNumber}`}
                      </h3>
                      {table.tableCode && (
                        <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted">
                          {table.tableCode}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {table.capacity} seats •{" "}
                      {TABLE_SHAPE_LABELS[table.shape] || table.shape || "Square"} •{" "}
                      {SEAT_SELECTION_MODE_LABELS[table.seatSelectionMode] || "Full Table"} •{" "}
                      {table.tableLocation || "Indoor"}
                    </p>
                    {table.tableLabel && (
                      <Badge variant="neutral" className="mt-1 text-[10px]">
                        Label: {table.tableLabel}
                      </Badge>
                    )}
                    {table.restaurantId?.restaurantName && (
                      <p className="mt-1 text-xs text-muted">
                        {table.restaurantId.restaurantCode
                          ? `${table.restaurantId.restaurantCode} - `
                          : ""}
                        {table.restaurantId.restaurantName}
                        {table.restaurantId.city ? ` - ${table.restaurantId.city}` : ""}
                      </p>
                    )}
                  </div>
                  <Badge variant={cfg.variant} className="text-xs">
                    {cfg.label}
                  </Badge>
                </div>

                {seats.length > 0 && (
                  <div className="mt-3 flex justify-center rounded-lg border border-gray-100 bg-gray-50/60 py-2">
                    <TableShape
                      shape={table.shape || TABLE_SHAPE.SQUARE}
                      seats={seats}
                      size={150}
                      unavailableSeatIds={unavailableSeatIds}
                      showLabels={false}
                    />
                  </div>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {table.statusScheduledUntil &&
                    table.status !== TABLE_STATUS.AVAILABLE && (
                      <Badge
                        variant="warning"
                        className="inline-flex items-center gap-1 text-xs"
                      >
                        <Clock size={12} />
                        Available in{" "}
                        {formatCountdown(
                          new Date(table.statusScheduledUntil).getTime() - now
                        )}
                      </Badge>
                    )}
                  {table.status === TABLE_STATUS.AVAILABLE &&
                    table.isReservable === false && (
                      <Badge variant="neutral" className="text-xs">
                        Not reservable
                      </Badge>
                    )}
                  {manualBlockedSeats.length > 0 && (
                    <Badge variant="neutral" className="text-xs">
                      {manualBlockedSeats.length} seat
                      {manualBlockedSeats.length > 1 ? "s" : ""} unavailable
                    </Badge>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openUpcomingBookings(table)}
                  >
                    <Calendar size={14} />
                    Upcoming Bookings
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setStatusTarget(table)}
                  >
                    <Settings2 size={14} />
                    Status
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditTable(table)}
                  >
                    <Edit2 size={14} />
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setDeleteTarget(table)}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default OwnerTablesPage;

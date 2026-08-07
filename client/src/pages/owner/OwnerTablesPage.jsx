import { Edit2, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useSelector } from "react-redux";

import { restaurantApi } from "../../api/restaurant.api.js";
import { tableApi } from "../../api/table.api.js";
import { subscribeToTableUpdates } from "../../services/socket/socketService.js";

import Badge from "../../components/ui/Badge.jsx";
import Button from "../../components/ui/Button.jsx";
import Card from "../../components/ui/Card.jsx";
import ConfirmDialog from "../../components/ui/ConfirmDialog.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import ErrorState from "../../components/ui/ErrorState.jsx";
import Input from "../../components/ui/Input.jsx";
import Modal from "../../components/ui/Modal.jsx";
import Select from "../../components/ui/Select.jsx";
import { SkeletonText } from "../../components/ui/Skeleton.jsx";
import TableShape from "../../components/restaurant/TableShape.jsx";
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
        await tableApi.update(table._id, payload);
        toast.success("Table updated successfully!");
      } else {
        await tableApi.create(payload);
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
        <Select label="Status" {...register("status")}>
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

function OwnerTablesPage() {
  const user = useSelector((state) => state.auth.user);
  const [tables, setTables] = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editTable, setEditTable] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedRestaurant, setSelectedRestaurant] = useState("");

  const fetchData = async () => {
    try {
      const [tablesResponse, restaurantsResponse] = await Promise.all([
        tableApi.getAll(),
        restaurantApi.getAll({ ownerId: user?.id, isActive: true }),
      ]);
      setTables(tablesResponse?.data?.tables || []);
      setRestaurants(restaurantsResponse?.data?.restaurants || []);
      setError(null);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load tables.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const loadTables = async () => {
      try {
        const [tablesResponse, restaurantsResponse] = await Promise.all([
          tableApi.getAll(),
          restaurantApi.getAll({ ownerId: user?.id, isActive: true }),
        ]);
        if (isMounted) {
          setTables(tablesResponse?.data?.tables || []);
          setRestaurants(restaurantsResponse?.data?.restaurants || []);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          setError(err?.response?.data?.message || "Failed to load tables.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadTables();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToTableUpdates("all", (updatedTable) => {
      setTables((prev) =>
        prev.map((t) => (t._id === updatedTable._id ? updatedTable : t))
      );
    });
    return unsubscribe;
  }, []);

  const visibleTables = selectedRestaurant
    ? tables.filter(
        (table) => String(table.restaurantId?._id) === selectedRestaurant
      )
    : tables;

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await tableApi.remove(deleteTarget._id);
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
            const unavailableSeatIds =
              table.status === TABLE_STATUS.OCCUPIED ||
              table.status === TABLE_STATUS.RESERVED
                ? seats.map((seat) => seat._id)
                : [];
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

                <div className="mt-4 flex gap-2">
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

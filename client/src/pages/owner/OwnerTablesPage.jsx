import { Edit2, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
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
import {
  TABLE_LOCATION_VALUES,
  TABLE_STATUS,
  TABLE_STATUS_VALUES,
  TABLE_TYPE_VALUES,
} from "../../constants/table.js";

const statusBadge = {
  [TABLE_STATUS.AVAILABLE]: { label: "Available", variant: "success" },
  [TABLE_STATUS.RESERVED]: { label: "Reserved", variant: "warning" },
  [TABLE_STATUS.OCCUPIED]: { label: "Occupied", variant: "error" },
  [TABLE_STATUS.CLEANING]: { label: "Cleaning", variant: "neutral" },
  [TABLE_STATUS.MAINTENANCE]: { label: "Maintenance", variant: "error" },
};

const checkboxClass =
  "h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary";

function TableForm({ table = null, restaurants, onSuccess, onCancel }) {
  const isEdit = Boolean(table);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      restaurantId: table?.restaurantId?._id || restaurants[0]?._id || "",
      tableNumber: table?.tableNumber ?? "",
      tableName: table?.tableName || "",
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

  const onSubmit = async (data) => {
    try {
      const payload = {
        restaurantId: data.restaurantId,
        tableNumber: Number(data.tableNumber),
        tableName: (data.tableName || "").trim(),
        capacity: Number(data.capacity),
        minimumCapacity: Number(data.minimumCapacity) || 1,
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
      toast.error(
        err?.response?.data?.message || err?.message || "Failed to save table."
      );
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
          label="Capacity *"
          type="number"
          min={1}
          error={errors.capacity?.message}
          {...register("capacity", { required: "Capacity is required." })}
        />
        <Input
          label="Minimum Capacity"
          type="number"
          error={errors.minimumCapacity?.message}
          {...register("minimumCapacity", {
            valueAsNumber: true,
            min: { value: 1, message: "Minimum capacity must be at least 1." },
          })}
        />
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
            Manage your restaurant tables.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus size={16} />
          Add Table
        </Button>
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

      {tables.length === 0 ? (
        <EmptyState
          title="No tables yet"
          description="Add tables to your restaurant to start accepting bookings."
          action={
            <Button onClick={() => setShowCreate(true)}>
              <Plus size={16} />
              Add Table
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tables.map((table) => {
            const cfg =
              statusBadge[table.status] || statusBadge[TABLE_STATUS.AVAILABLE];
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
                      {table.capacity} seats • {table.tableType} •{" "}
                      {table.tableLocation || "Indoor"}
                    </p>
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

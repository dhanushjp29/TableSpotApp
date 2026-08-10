import { Search, UserCheck, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { fetchOwnerCustomers } from "../../store/slices/offerSlice.js";
import Button from "../ui/Button.jsx";
import Select from "../ui/Select.jsx";

function CustomerPicker({
  restaurants = [],
  selectedIds = [],
  onChange,
  restaurantId = "",
  onRestaurantChange,
}) {
  const dispatch = useDispatch();
  const customers = useSelector((state) => state.offer.customers);
  const customersMeta = useSelector((state) => state.offer.customersMeta);
  const isLoading = useSelector((state) => state.offer.customersLoading);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const debounceRef = useRef(null);

  useEffect(() => {
    dispatch(
      fetchOwnerCustomers({
        restaurantId: restaurantId || undefined,
        search: search || undefined,
        page,
        limit: 20,
      })
    ).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId, page]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      dispatch(
        fetchOwnerCustomers({
          restaurantId: restaurantId || undefined,
          search: search || undefined,
          page: 1,
          limit: 20,
        })
      ).catch(() => {});
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const toggle = (userId) => {
    if (selectedIds.includes(userId)) {
      onChange(selectedIds.filter((id) => id !== userId));
    } else {
      onChange([...selectedIds, userId]);
    }
  };

  const selectedCount = selectedIds.length;
  const totalPages = customersMeta?.totalPages || 1;

  return (
    <div className="space-y-3">
      {restaurants.length > 1 && (
        <Select
          label="Restaurant"
          value={restaurantId}
          onChange={(e) => {
            onRestaurantChange?.(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All my restaurants</option>
          {restaurants.map((r) => (
            <option key={r._id} value={r._id}>
              {r.restaurantName}
              {r.city ? ` - ${r.city}` : ""}
            </option>
          ))}
        </Select>
      )}

      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
        />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search customers by name, email or phone..."
          className="input-field w-full pl-9"
        />
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border bg-surface-secondary/40 px-3 py-2 text-sm">
        <span className="inline-flex items-center gap-1.5 text-muted">
          <Users size={15} />
          {selectedCount} selected
        </span>
        {selectedCount > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onChange([])}
          >
            Clear all
          </Button>
        )}
      </div>

      {isLoading && customers.length === 0 ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-12 animate-pulse rounded-xl border border-border bg-surface"
            />
          ))}
        </div>
      ) : customers.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted">
          No customers found. Customers appear here after they make a booking at
          your restaurant.
        </p>
      ) : (
        <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
          {customers.map((customer) => {
            const selected = selectedIds.includes(customer._id);
            const name =
              customer.fullName ||
              customer.firstName ||
              customer.name ||
              "Customer";
            return (
              <button
                key={customer._id}
                type="button"
                onClick={() => toggle(customer._id)}
                className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                  selected
                    ? "border-primary bg-primary/10"
                    : "border-border bg-surface hover:border-primary/50"
                }`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    selected
                      ? "bg-primary text-white"
                      : "bg-surface-secondary text-muted"
                  }`}
                >
                  {name.charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-text">
                    {name}
                  </span>
                  <span className="block truncate text-xs text-muted">
                    {customer.email || "No email"} · {customer.phoneNumber || "No phone"}
                  </span>
                </span>
                {selected && <UserCheck size={18} className="shrink-0 text-primary" />}
              </button>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page <= 1 || isLoading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <span className="text-xs text-muted">
            Page {page} of {totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page >= totalPages || isLoading}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

export default CustomerPicker;

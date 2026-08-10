import { useState } from "react";

const RULE_FIELDS = [
  {
    key: "minBookings",
    label: "Minimum bookings",
    placeholder: "e.g. 3",
    hint: "Customers who made at least this many bookings.",
  },
  {
    key: "minTotalSpent",
    label: "Minimum total spent (₹)",
    placeholder: "e.g. 1500",
    hint: "Customers who spent at least this amount in total.",
  },
  {
    key: "recentWithinDays",
    label: "Active within last (days)",
    placeholder: "e.g. 30",
    hint: "Customers who visited within the last N days.",
  },
  {
    key: "inactiveSinceDays",
    label: "Inactive for (days)",
    placeholder: "e.g. 60",
    hint: "Customers who have not visited in the last N days.",
  },
];

function SegmentRulesBuilder({ value = {}, onChange }) {
  const [hasCompletedBooking, setHasCompletedBooking] = useState(
    Boolean(value.hasCompletedBooking)
  );

  const updateField = (key, rawValue) => {
    const next = { ...value };
    if (rawValue === "" || rawValue === null || rawValue === undefined) {
      delete next[key];
    } else {
      next[key] = Number(rawValue);
    }
    onChange(next);
  };

  const updateCompleted = (checked) => {
    setHasCompletedBooking(checked);
    const next = { ...value };
    if (checked) next.hasCompletedBooking = true;
    else delete next.hasCompletedBooking;
    onChange(next);
  };

  const activeCount =
    RULE_FIELDS.filter(
      (f) => value[f.key] !== undefined && value[f.key] !== null && value[f.key] !== ""
    ).length + (hasCompletedBooking ? 1 : 0);

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm font-medium text-text">
        <input
          type="checkbox"
          checked={hasCompletedBooking}
          onChange={(e) => updateCompleted(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
        />
        Only customers with a completed booking
      </label>

      {RULE_FIELDS.map((field) => {
        const hasValue =
          value[field.key] !== undefined &&
          value[field.key] !== null &&
          value[field.key] !== "";
        return (
          <div
            key={field.key}
            className="rounded-xl border border-border bg-surface p-3"
          >
            <label className="input-label">
              <span className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={hasValue}
                  onChange={(e) =>
                    updateField(field.key, e.target.checked ? 1 : undefined)
                  }
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                {field.label}
              </span>
            </label>
            {hasValue && (
              <>
                <input
                  type="number"
                  min={1}
                  value={value[field.key] ?? ""}
                  placeholder={field.placeholder}
                  onChange={(e) => updateField(field.key, e.target.value)}
                  className="input-field mt-2 w-full"
                />
                <p className="mt-1 text-xs text-muted">{field.hint}</p>
              </>
            )}
          </div>
        );
      })}

      <p className="text-xs text-muted">
        {activeCount === 0
          ? "Add at least one rule. Offers apply to customers who match all selected rules."
          : `${activeCount} rule${activeCount === 1 ? "" : "s"} selected. Customers must match all of them.`}
      </p>
    </div>
  );
}

export default SegmentRulesBuilder;

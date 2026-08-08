import { useRef, useState } from "react";
import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

import { formatDate } from "../../utils/formatDate.js";
import { usePopupPosition } from "./usePopupPosition.js";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const toIso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

function DatePicker({
  label,
  value = "",
  onChange,
  min,
  max,
  error,
  hint,
  disabled = false,
  placeholder = "Select a date",
  icon,
  className = "",
  id,
  name,
  ref,
  ...rest
}) {
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() =>
    value ? new Date(value + "T00:00:00") : new Date()
  );
  const inputRef = useRef(null);
  const { triggerRef, popupRef, popupStyle } = usePopupPosition(open, 300, 330);

  const minDate = min ? new Date(min + "T00:00:00") : null;
  const maxDate = max ? new Date(max + "T00:00:00") : null;

  const toggle = () => {
    if (disabled) return;
    if (!open) {
      setViewDate(value ? new Date(value + "T00:00:00") : new Date());
    }
    setOpen((o) => !o);
  };

  const emit = (iso) => {
    if (onChange) onChange({ target: { value: iso, name } });
    if (inputRef.current) inputRef.current.value = iso;
    setOpen(false);
  };

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const todayIso = toIso(new Date());
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const canGoPrev =
    !minDate ||
    new Date(year, month - 1, 1) >=
      new Date(minDate.getFullYear(), minDate.getMonth(), 1);
  const canGoNext =
    !maxDate ||
    new Date(year, month + 1, 1) <=
      new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);

  const cells = [];
  for (let i = 0; i < firstWeekday; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(new Date(year, month, d));

  return (
    <div className={className?.includes("w-") ? className : `w-full ${className}`}>
      {label && (
        <label htmlFor={id || name} className="input-label">
          {label}
        </label>
      )}

      <input
        ref={(el) => {
          inputRef.current = el;
          if (typeof ref === "function") ref(el);
          else if (ref) ref.current = el;
        }}
        id={id || name}
        type="text"
        name={name}
        value={value}
        readOnly
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
        {...rest}
      />

      <button
        type="button"
        ref={triggerRef}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            setOpen(false);
          }
        }}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`input-field flex items-center justify-between gap-2 text-left ${
          error ? "border-error focus:border-error focus:ring-error" : ""
        } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
      >
        <span
          className={`flex min-w-0 items-center gap-2 ${
            value ? "text-text" : "text-muted"
          }`}
        >
          {icon || <Calendar size={16} className="shrink-0 text-muted" />}
          <span className="truncate">
            {value ? formatDate(value + "T00:00:00") : placeholder}
          </span>
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-muted transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div
          ref={popupRef}
          role="dialog"
          style={{ position: "fixed", ...popupStyle, width: 300 }}
          className="dropdown-popup z-50 max-h-[80vh] overflow-y-auto p-3"
        >
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setViewDate(new Date(year, month - 1, 1))}
              disabled={!canGoPrev}
              className="rounded-md p-1 text-muted transition-colors hover:bg-surface-hover hover:text-text disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="text-sm font-semibold text-text">
              {MONTHS[month]} {year}
            </span>
            <button
              type="button"
              onClick={() => setViewDate(new Date(year, month + 1, 1))}
              disabled={!canGoNext}
              className="rounded-md p-1 text-muted transition-colors hover:bg-surface-hover hover:text-text disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-1">
            {WEEKDAYS.map((d) => (
              <span
                key={d}
                className="text-center text-xs font-medium text-muted"
              >
                {d}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {cells.map((d, i) => {
              if (!d) return <span key={`blank-${i}`} />;
              const iso = toIso(d);
              const isSelected = iso === value;
              const isToday = iso === todayIso;
              const dayDisabled = (minDate && d < minDate) || (maxDate && d > maxDate);
              return (
                <button
                  key={iso}
                  type="button"
                  disabled={dayDisabled}
                  onClick={() => emit(iso)}
                  className={`h-9 w-full rounded-md text-xs font-medium transition-colors ${
                    isSelected
                      ? "bg-primary text-white"
                      : dayDisabled
                        ? "cursor-not-allowed text-muted opacity-50"
                        : isToday
                          ? "border border-primary text-primary hover:bg-primary/10"
                          : "text-text hover:bg-primary/10"
                  }`}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {error && (
        <p className="input-error" role="alert">
          {error}
        </p>
      )}
      {hint && !error && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export default DatePicker;

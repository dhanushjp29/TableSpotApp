import { useEffect, useRef, useState } from "react";
import { Clock, ChevronDown } from "lucide-react";

import { usePopupPosition } from "./usePopupPosition.js";

const toTime12 = (t) => {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m).padStart(2, "0")} ${period}`;
};

const toParts = (t) => {
  const [h, m] = (t || "00:00").split(":").map(Number);
  return { h24: h, minutes: m };
};

const DIAL_SIZE = 220;
const CENTER = DIAL_SIZE / 2;
const MARK_RADIUS = 82;

const markPosition = (index, count) => {
  const angle = (index / count) * 360 - 90;
  const rad = (angle * Math.PI) / 180;
  return {
    x: CENTER + MARK_RADIUS * Math.cos(rad),
    y: CENTER + MARK_RADIUS * Math.sin(rad),
    angle,
  };
};

function TimePicker({
  label,
  value = "",
  onChange,
  error,
  hint,
  disabled = false,
  placeholder = "Select a time",
  icon,
  className = "",
  id,
  name,
  intervalMinutes = 5,
  startTime = "00:00",
  endTime = "23:59",
  ref,
  ...rest
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("hour");
  const [draftHour, setDraftHour] = useState(null);
  const [draftMinute, setDraftMinute] = useState(null);
  const [period, setPeriod] = useState("PM");
  const inputRef = useRef(null);
  const rootRef = useRef(null);
  const { triggerRef, popupRef, popupStyle } = usePopupPosition(open, 252, 420);

  const step = 60 % intervalMinutes === 0 ? intervalMinutes : 5;
  const minuteMarks = Array.from({ length: 60 / step }, (_, i) => i * step);

  const { h24: startH, minutes: startM } = toParts(startTime);
  const { h24: endH, minutes: endM } = toParts(endTime);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  const hasRange = startTime !== "00:00" || endTime !== "23:59";

  useEffect(() => {
    if (!open) return;
    const handle = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const openPopup = () => {
    if (disabled) return;
    if (!open) {
      const { h24, minutes } = toParts(value);
      setDraftHour(value ? h24 % 12 || 12 : null);
      setDraftMinute(value ? minutes : null);
      setPeriod(value ? (h24 >= 12 ? "PM" : "AM") : "PM");
      setMode("hour");
    }
    setOpen((o) => !o);
  };

  const hourToMinute = (h) => ((h % 12) + (period === "PM" ? 12 : 0)) * 60;

  const hourEnabled = (h) =>
    !hasRange ||
    (hourToMinute(h) >= startMinutes && hourToMinute(h) + 55 <= endMinutes);

  const minuteEnabled = (m) => {
    if (draftHour == null) return false;
    const t = hourToMinute(draftHour) + m;
    return !hasRange || (t >= startMinutes && t <= endMinutes);
  };

  const commitValue = (h24, minute) => {
    const out = `${String(h24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    if (onChange) onChange({ target: { value: out, name } });
    if (inputRef.current) inputRef.current.value = out;
  };

  const commitMinute = (m) => {
    if (draftHour == null) return;
    const h24 = (draftHour % 12) + (period === "PM" ? 12 : 0);
    commitValue(h24, m);
    setOpen(false);
  };

  const handlePeriodChange = (p) => {
    setPeriod(p);
    if (draftHour != null && draftMinute != null) {
      const h24 = (draftHour % 12) + (p === "PM" ? 12 : 0);
      commitValue(h24, draftMinute);
    }
  };

  const marks =
    mode === "hour"
      ? Array.from({ length: 12 }, (_, i) => i + 1)
      : minuteMarks;

  const selectedIndex =
    mode === "hour"
      ? draftHour != null
        ? ((draftHour + 11) % 12)
        : null
      : draftMinute != null
        ? Math.round(draftMinute / step) % marks.length
        : null;

  const preview =
    draftHour != null && draftMinute != null
      ? `${draftHour}:${String(draftMinute).padStart(2, "0")} ${period}`
      : value
        ? toTime12(value)
        : placeholder;

  const handMark =
    mode === "hour"
      ? draftHour != null
        ? { index: (draftHour + 11) % 12, count: 12 }
        : null
      : draftMinute != null
        ? { index: Math.round(draftMinute / step) % marks.length, count: marks.length }
        : null;

  const handPos = handMark
    ? markPosition(handMark.index, handMark.count)
    : null;

  return (
    <div ref={rootRef} className={className?.includes("w-") ? className : `w-full ${className}`}>
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
        onClick={openPopup}
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
          {icon || <Clock size={16} className="shrink-0 text-muted" />}
          <span className="truncate">{value ? toTime12(value) : placeholder}</span>
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
          style={{ position: "fixed", ...popupStyle, width: 252 }}
          className="z-50 max-h-[80vh] overflow-y-auto rounded-lg border border-gray-200 bg-surface p-3 shadow-lg"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setMode("hour")}
              className={`rounded px-2 py-1 text-xs font-semibold transition-colors ${
                mode === "hour"
                  ? "bg-primary text-white"
                  : "text-muted hover:bg-gray-100 hover:text-text"
              }`}
            >
              Hour
            </button>
            <span className="text-base font-semibold tabular-nums text-text">
              {preview}
            </span>
            <button
              type="button"
              onClick={() => draftHour != null && setMode("minute")}
              disabled={draftHour == null}
              className={`rounded px-2 py-1 text-xs font-semibold transition-colors ${
                mode === "minute"
                  ? "bg-primary text-white"
                  : "text-muted hover:bg-gray-100 hover:text-text"
              } ${
                draftHour == null
                  ? "cursor-not-allowed opacity-40"
                  : ""
              }`}
            >
              Minute
            </button>
          </div>

          <div className="relative mx-auto h-[220px] w-[220px]">
            <div className="absolute inset-0 rounded-full border border-gray-200 bg-background" />
            {handPos && (
              <div
                className="absolute top-0 left-0 h-0.5 rounded-full bg-primary/80"
                style={{
                  width: MARK_RADIUS - 6,
                  transform: `translate(${CENTER}px, ${CENTER - 1}px) rotate(${handPos.angle}deg)`,
                  transformOrigin: "0 50%",
                }}
              />
            )}
            <div className="absolute top-1/2 left-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary" />
            {marks.map((mark, i) => {
              const isSelected = selectedIndex === i;
              const enabled =
                mode === "hour"
                  ? hourEnabled(mark)
                  : minuteEnabled(mark);
              const angleDeg = (i / marks.length) * 360 - 90;
              const rad = (angleDeg * Math.PI) / 180;
              return (
                <button
                  key={mark}
                  type="button"
                  disabled={!enabled}
                  onClick={() =>
                    mode === "hour"
                      ? (setDraftHour(mark), setMode("minute"))
                      : commitMinute(mark)
                  }
                  style={{
                    left: CENTER + MARK_RADIUS * Math.cos(rad),
                    top: CENTER + MARK_RADIUS * Math.sin(rad),
                  }}
                  className={`absolute flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-xs font-semibold tabular-nums transition-colors ${
                    isSelected
                      ? "bg-primary text-white"
                      : enabled
                        ? "text-text hover:bg-primary/10"
                        : "cursor-not-allowed text-gray-300"
                  }`}
                >
                  {mark}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-center gap-2">
            <span className="text-xs font-medium text-muted">Period</span>
            <div className="flex overflow-hidden rounded-lg border border-gray-200">
              {["AM", "PM"].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => handlePeriodChange(p)}
                  className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                    period === p
                      ? "bg-primary text-white"
                      : "text-text hover:bg-gray-100"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
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

export default TimePicker;

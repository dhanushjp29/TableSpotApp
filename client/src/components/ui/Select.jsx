import { Children, useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

import { usePopupPosition } from "./usePopupPosition.js";

function Select({
  label,
  error,
  hint,
  id,
  children,
  className = "",
  value,
  onChange,
  name,
  ref,
  disabled = false,
  ...rest
}) {
  const inputId = id || name;
  const inputRef = useRef(null);
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [displayValue, setDisplayValue] = useState(value ?? "");
  const [prevValue, setPrevValue] = useState(value);
  const [popupWidth, setPopupWidth] = useState(280);
  const { triggerRef, popupRef, popupStyle } = usePopupPosition(open, popupWidth, 320);

  const options = Children.toArray(children)
    .filter(
      (child) =>
        child &&
        typeof child === "object" &&
        child.type === "option"
    )
    .map((child, index) => ({
      index,
      value: child.props?.value ?? "",
      label: child.props?.children,
      disabled: Boolean(child.props?.disabled),
    }));

  if (prevValue !== value) {
    setPrevValue(value);
    setDisplayValue(value ?? "");
  }

  useEffect(() => {
    if (open) {
      const el = triggerRef.current;
      if (el) setPopupWidth(el.getBoundingClientRect().width || 280);
    }
  }, [open, triggerRef]);

  useEffect(() => {
    if (value !== undefined) return;
    const current = inputRef.current?.value;
    if (current && current !== displayValue) {
      setDisplayValue(current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const selectedOption =
    displayValue === ""
      ? options.find((o) => o.value === "") || options[0] || null
      : options.find((o) => String(o.value) === String(displayValue)) || null;

  const toggle = () => {
    if (disabled) return;
    setOpen((o) => !o);
  };

  const emit = (opt) => {
    if (opt.disabled) return;
    if (inputRef.current) inputRef.current.value = opt.value;
    setDisplayValue(opt.value);
    if (onChange) onChange({ target: { value: opt.value, name } });
    setOpen(false);
  };

  return (
    <div ref={rootRef} className={className?.includes("w-") ? className : `w-full ${className}`}>
      {label && (
        <label htmlFor={inputId} className="input-label">
          {label}
        </label>
      )}

      <input
        ref={(el) => {
          inputRef.current = el;
          if (typeof ref === "function") ref(el);
          else if (ref) ref.current = el;
        }}
        id={inputId}
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
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`input-field flex items-center justify-between gap-2 text-left ${
          error ? "border-error focus:border-error focus:ring-error" : ""
        } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
      >
        <span
          className={`min-w-0 truncate ${
            displayValue !== "" ? "text-text" : "text-muted"
          }`}
        >
          {selectedOption ? selectedOption.label : "Select"}
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
          role="listbox"
          style={{
            position: "fixed",
            ...popupStyle,
            width: popupWidth,
            maxHeight: Math.min(popupStyle.maxHeight, 256),
          }}
          className="dropdown-popup max-h-64"
        >
          {options.length === 0 && (
            <p className="px-3 py-2 text-sm text-muted">No options</p>
          )}
          {options.map((opt) => {
            const isSelected = String(opt.value) === String(displayValue);
            return (
              <button
                key={`${opt.value}-${opt.index}`}
                type="button"
                role="option"
                aria-selected={isSelected}
                disabled={opt.disabled}
                onClick={() => emit(opt)}
                className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors ${
                  isSelected
                    ? "bg-primary text-white"
                    : opt.disabled
                      ? "cursor-not-allowed text-muted opacity-50"
                      : "text-text hover:bg-surface-hover"
                }`}
              >
                <span className="truncate">{opt.label}</span>
                {isSelected && <Check size={16} className="shrink-0" />}
              </button>
            );
          })}
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

export default Select;

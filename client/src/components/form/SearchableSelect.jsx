import { Check, ChevronDown, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

function SearchableSelect({
  label,
  placeholder = "Select / Search...",
  options = [],
  value,
  onChange,
  error,
  disabled = false,
  className = "",
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const rootRef = useRef(null);
  const listRef = useRef(null);

  const selected = useMemo(
    () => options.find((opt) => opt.value === value) || null,
    [options, value]
  );

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.slice(0, 250);
    return options
      .filter((opt) => String(opt.label).toLowerCase().includes(q))
      .slice(0, 250);
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const node = listRef.current?.children?.[highlightedIndex];
    node?.scrollIntoView({ block: "nearest" });
  }, [open, highlightedIndex]);

  const select = (opt) => {
    if (!opt) return;
    onChange(opt.value);
    setOpen(false);
    setQuery("");
    setHighlightedIndex(0);
  };

  const clear = () => {
    onChange(null);
    setQuery("");
  };

  const handleKeyDown = (e) => {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[highlightedIndex]) select(filtered[highlightedIndex]);
    }
  };

  return (
    <div ref={rootRef} className={`relative w-full ${className}`}>
      {label && <label className="input-label">{label}</label>}
      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
        />
        <input
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          value={open ? query : selected?.label || ""}
          readOnly={!open}
          placeholder={open ? "Type to search..." : placeholder}
          disabled={disabled}
          onChange={(e) => {
            setQuery(e.target.value);
            setHighlightedIndex(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          className={`input-field w-full cursor-pointer pl-9 pr-9 ${open ? "cursor-text" : ""}`}
        />
        {selected && !disabled && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              clear();
            }}
            className="absolute right-8 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted transition-colors hover:bg-gray-100 hover:text-text"
            aria-label={`Clear ${label}`}
          >
            <X size={14} />
          </button>
        )}
        <ChevronDown
          size={16}
          className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </div>

      {open && (
        <ul
          role="listbox"
          ref={listRef}
          className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-surface shadow-lg"
        >
          {filtered.length === 0 ? (
            <li className="px-3.5 py-2.5 text-sm text-muted">
              No results found
            </li>
          ) : (
            filtered.map((opt, index) => {
              const isSelected = opt.value === value;
              const isHighlighted = index === highlightedIndex;
              return (
                <li key={opt.key ?? opt.label} role="option" aria-selected={isSelected}>
                  <button
                    type="button"
                    onMouseEnter={() => setHighlightedIndex(index)}
                    onClick={() => select(opt)}
                    className={`flex w-full items-center justify-between gap-2 px-3.5 py-2 text-left text-sm transition-colors ${
                      isHighlighted ? "bg-primary/5 text-primary" : "text-text"
                    }`}
                  >
                    <span className="truncate">{opt.label}</span>
                    {isSelected && <Check size={15} className="shrink-0 text-primary" />}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      )}

      {error && <p className="input-error">{error}</p>}
    </div>
  );
}

export default SearchableSelect;

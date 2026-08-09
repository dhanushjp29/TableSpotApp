import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import Select from "../ui/Select.jsx";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const pad = (value) => String(value).padStart(2, "0");
const toISO = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const parseDate = (value) => value ? new Date(`${value}T00:00:00`) : null;

export default function InvoiceDatePicker({ label, value, onChange, placeholder = "Select date" }) {
  const ref = useRef(null);
  const today = useMemo(() => new Date(), []);
  const selected = parseDate(value);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(selected || today);

  useEffect(() => {
    const close = (event) => {
      if (!ref.current || ref.current.contains(event.target)) return;
      if (event.target instanceof Element && event.target.closest(".dropdown-popup, [role='listbox']")) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const cells = useMemo(() => {
    const first = new Date(view.getFullYear(), view.getMonth(), 1);
    const days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
    const cellsForMonth = [];
    for (let i = 0; i < first.getDay(); i += 1) cellsForMonth.push(new Date(view.getFullYear(), view.getMonth(), i - first.getDay() + 1));
    for (let day = 1; day <= days; day += 1) cellsForMonth.push(new Date(view.getFullYear(), view.getMonth(), day));
    while (cellsForMonth.length % 7) cellsForMonth.push(new Date(view.getFullYear(), view.getMonth() + 1, cellsForMonth.length - days - first.getDay() + 1));
    return cellsForMonth;
  }, [view]);

  return <div ref={ref} className="relative flex min-w-0 flex-col gap-1">
    {label && <label className="text-xs font-semibold uppercase tracking-wide text-primary">{label}</label>}
    <button type="button" className="input-field flex w-full cursor-pointer items-center justify-between gap-2 text-left" onClick={() => { setView(selected || today); setOpen((current) => !current); }}>
      <span className={value ? "text-text" : "text-muted"}>{selected ? selected.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }) : placeholder}</span>
      <CalendarDays size={16} className="shrink-0 text-primary" />
    </button>
    {open && <div className="absolute left-0 top-full z-[80] mt-1 w-72 max-w-[calc(100vw-24px)] rounded-2xl border border-border bg-surface p-3 shadow-lg">
      <div className="mb-3 flex items-center justify-between"><button type="button" className="flex h-7 w-7 items-center justify-center rounded-lg text-muted transition hover:bg-surface-hover hover:text-primary" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}><ChevronLeft size={16} /></button><div className="flex items-center gap-2"><Select aria-label="Month" value={String(view.getMonth())} onChange={(event) => setView(new Date(view.getFullYear(), Number(event.target.value), 1))} className="w-[132px]">{MONTHS.map((month, index) => <option key={month} value={String(index)}>{month}</option>)}</Select><input aria-label="Year" type="number" value={view.getFullYear()} onChange={(event) => setView(new Date(Number(event.target.value) || view.getFullYear(), view.getMonth(), 1))} className="input-field w-20 px-2 py-2 text-center text-sm font-semibold" /></div><button type="button" className="flex h-7 w-7 items-center justify-center rounded-lg text-muted transition hover:bg-surface-hover hover:text-primary" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}><ChevronRight size={16} /></button></div>
      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase tracking-wide text-muted">{WEEKDAYS.map((day) => <span key={day} className="py-1">{day}</span>)}</div>
      <div className="grid grid-cols-7 gap-1">{cells.map((date) => { const iso = toISO(date); const isSelected = iso === value; const isCurrentMonth = date.getMonth() === view.getMonth(); const isToday = toISO(today) === iso; return <button type="button" key={iso} onClick={() => { onChange(iso); setOpen(false); }} className={`h-8 rounded-lg text-xs font-medium transition ${isSelected ? "bg-primary text-white shadow-sm hover:bg-primary-dark" : isCurrentMonth ? isToday ? "bg-primary/10 text-primary ring-1 ring-primary/20 hover:bg-primary/15" : "text-text hover:bg-surface-hover hover:text-primary" : "text-muted/60 hover:bg-surface-hover"}`}>{date.getDate()}</button>; })}</div>
      <div className="mt-3 flex items-center justify-between border-t border-border pt-3"><button type="button" className="text-xs font-semibold text-muted transition hover:text-error" onClick={() => { onChange(""); setOpen(false); }}><X size={13} className="mr-1 inline" />Clear</button><button type="button" className="text-xs font-semibold text-primary transition hover:text-primary-dark" onClick={() => { onChange(toISO(today)); setOpen(false); }}>Today</button></div>
    </div>}
  </div>;
}

import { ChevronLeft, ChevronRight } from "lucide-react";

function Pagination({ page = 1, totalPages = 1, onPageChange, className = "" }) {
  if (totalPages <= 1) return null;

  const pages = [];
  const maxVisible = 5;
  let start = Math.max(1, page - Math.floor(maxVisible / 2));
  const end = Math.min(totalPages, start + maxVisible - 1);
  start = Math.max(1, end - maxVisible + 1);

  for (let i = start; i <= end; i += 1) {
    pages.push(i);
  }

  const navBtnClass =
    "inline-flex items-center justify-center rounded-lg border border-border bg-surface p-2 text-text transition-all duration-200 hover:-translate-y-px hover:bg-surface-hover hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-40";
  const pageBtnClass = (isActive) =>
    `rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200 ${
      isActive
        ? "bg-primary text-white shadow-sm"
        : "text-text-secondary hover:bg-surface-hover hover:text-text"
    }`;

  return (
    <nav
      className={`flex flex-wrap items-center justify-center gap-1 ${className}`}
      aria-label="Pagination"
    >
      <button
        onClick={() => onPageChange?.(page - 1)}
        disabled={page <= 1}
        className={navBtnClass}
        aria-label="Previous page"
      >
        <ChevronLeft size={16} />
      </button>

      {start > 1 && (
        <>
          <button
            onClick={() => onPageChange?.(1)}
            className={pageBtnClass(false)}
            aria-label="Page 1"
          >
            1
          </button>
          {start > 2 && <span className="px-1 text-muted">...</span>}
        </>
      )}

      {pages.map((p) => (
        <button
          key={p}
          onClick={() => onPageChange?.(p)}
          className={pageBtnClass(p === page)}
          aria-label={`Page ${p}`}
          aria-current={p === page ? "page" : undefined}
        >
          {p}
        </button>
      ))}

      {end < totalPages && (
        <>
          {end < totalPages - 1 && <span className="px-1 text-muted">...</span>}
          <button
            onClick={() => onPageChange?.(totalPages)}
            className={pageBtnClass(false)}
            aria-label={`Page ${totalPages}`}
          >
            {totalPages}
          </button>
        </>
      )}

      <button
        onClick={() => onPageChange?.(page + 1)}
        disabled={page >= totalPages}
        className={navBtnClass}
        aria-label="Next page"
      >
        <ChevronRight size={16} />
      </button>
    </nav>
  );
}

export default Pagination;

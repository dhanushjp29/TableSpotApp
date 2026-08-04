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

  return (
    <nav
      className={`flex items-center justify-center gap-1 ${className}`}
      aria-label="Pagination"
    >
      <button
        onClick={() => onPageChange?.(page - 1)}
        disabled={page <= 1}
        className="p-2 rounded-lg border border-gray-200 bg-surface text-text hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
        aria-label="Previous page"
      >
        <ChevronLeft size={16} />
      </button>

      {start > 1 && (
        <>
          <button
            onClick={() => onPageChange?.(1)}
            className="px-3 py-1.5 rounded-lg text-sm text-text hover:bg-gray-50"
            aria-label="Page 1"
          >
            1
          </button>
          {start > 2 && <span className="px-1 text-muted">…</span>}
        </>
      )}

      {pages.map((p) => (
        <button
          key={p}
          onClick={() => onPageChange?.(p)}
          className={`px-3 py-1.5 rounded-lg text-sm ${
            p === page
              ? "bg-primary text-white font-semibold"
              : "text-text hover:bg-gray-50"
          }`}
          aria-label={`Page ${p}`}
          aria-current={p === page ? "page" : undefined}
        >
          {p}
        </button>
      ))}

      {end < totalPages && (
        <>
          {end < totalPages - 1 && <span className="px-1 text-muted">…</span>}
          <button
            onClick={() => onPageChange?.(totalPages)}
            className="px-3 py-1.5 rounded-lg text-sm text-text hover:bg-gray-50"
            aria-label={`Page ${totalPages}`}
          >
            {totalPages}
          </button>
        </>
      )}

      <button
        onClick={() => onPageChange?.(page + 1)}
        disabled={page >= totalPages}
        className="p-2 rounded-lg border border-gray-200 bg-surface text-text hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
        aria-label="Next page"
      >
        <ChevronRight size={16} />
      </button>
    </nav>
  );
}

export default Pagination;

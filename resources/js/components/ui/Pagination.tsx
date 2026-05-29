import { ChevronLeft, ChevronRight } from "lucide-react";

export function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (next: number) => void;
}) {
  // Compact pager with first/prev/next/last + sibling-aware numeric range.
  const pages: number[] = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, page + 2);
  for (let i = start; i <= end; i += 1) pages.push(i);

  return (
    <nav className="booking-pagination" aria-label="Pagination booking">
      <button
        type="button"
        onClick={() => onChange(1)}
        disabled={page === 1}
        aria-label="Halaman pertama"
      >
        <ChevronLeft size={14} aria-hidden="true" />
        <ChevronLeft size={14} aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={page === 1}
        aria-label="Halaman sebelumnya"
      >
        <ChevronLeft size={14} aria-hidden="true" />
      </button>
      {start > 1 && <span className="booking-pagination-gap">…</span>}
      {pages.map((p) => (
        <button
          key={p}
          type="button"
          aria-current={p === page ? "page" : undefined}
          className={p === page ? "is-current" : undefined}
          onClick={() => onChange(p)}
        >
          {p}
        </button>
      ))}
      {end < totalPages && <span className="booking-pagination-gap">…</span>}
      <button
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={page === totalPages}
        aria-label="Halaman selanjutnya"
      >
        <ChevronRight size={14} aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => onChange(totalPages)}
        disabled={page === totalPages}
        aria-label="Halaman terakhir"
      >
        <ChevronRight size={14} aria-hidden="true" />
        <ChevronRight size={14} aria-hidden="true" />
      </button>
    </nav>
  );
}

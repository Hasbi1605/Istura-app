import { Loader2 } from "lucide-react";

export function InlineSpinner({ label = "Memuat" }: { label?: string }) {
  return (
    <span className="inline-spinner" role="status" aria-live="polite">
      <Loader2 size={16} aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

export function ButtonSpinner({ label }: { label: string }) {
  return (
    <>
      <Loader2 size={16} aria-hidden="true" className="button-spinner" />
      <span>{label}</span>
    </>
  );
}

export function StatCardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div className="stat-card stat-card--loading" key={index} aria-hidden="true">
          <span className="skeleton-line skeleton-line--short" />
          <strong className="skeleton-line skeleton-line--value" />
        </div>
      ))}
    </>
  );
}

export function SectionSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="section-skeleton" aria-hidden="true">
      {Array.from({ length: rows }).map((_, index) => (
        <span
          className={`skeleton-line${index === rows - 1 ? " skeleton-line--medium" : ""}`}
          key={index}
        />
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="table-skeleton" aria-hidden="true">
      {Array.from({ length: rows }).map((_, index) => (
        <span className="skeleton-line" key={index} />
      ))}
    </div>
  );
}

export function SavingStatus({ status }: { status?: "idle" | "saving" | "saved" | "error" }) {
  if (!status || status === "idle") return null;
  const label =
    status === "saving"
      ? "Menyimpan ke server..."
      : status === "saved"
        ? "Tersimpan di server."
        : "Gagal menyimpan ke server.";
  return (
    <small className={`saving-status saving-status--${status}`} role="status" aria-live="polite">
      {status === "saving" && <Loader2 size={13} aria-hidden="true" className="button-spinner" />}
      {label}
    </small>
  );
}

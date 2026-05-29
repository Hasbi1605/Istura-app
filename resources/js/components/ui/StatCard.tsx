import { formatCount } from "../../lib/date";

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  // Format raw numbers with the id-ID locale so KPI cards stay readable when
  // counts reach the thousands (e.g. "1.234" instead of "1234"). Strings pass
  // through untouched so callers can still render values like "88%" or "—".
  const display = typeof value === "number" ? formatCount(value) : value;
  return (
    <div className="stat-card">
      <span>{label}</span>
      <strong>{display}</strong>
      {hint && <small className="stat-card-hint">{hint}</small>}
    </div>
  );
}

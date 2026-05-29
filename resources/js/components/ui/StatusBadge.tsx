import type { BookingStatus } from "../../domain/types";

export function StatusBadge({ status }: { status: BookingStatus }) {
  return <span className={`status-badge status-${status.toLowerCase()}`}>{status}</span>;
}

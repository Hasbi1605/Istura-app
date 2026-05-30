import type { BookingStatus } from "../../domain/types";
import { BOOKING_STATUS_LABELS } from "../../domain/booking";

export function StatusBadge({ status }: { status: BookingStatus }) {
  return <span className={`status-badge status-${status.toLowerCase()}`}>{BOOKING_STATUS_LABELS[status]}</span>;
}

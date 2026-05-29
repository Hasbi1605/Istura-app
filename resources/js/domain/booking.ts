// Pure booking domain logic: sorting, filtering, date parsing. No React.
import { monthNames, parseDateKey } from "../lib/date";
import type { Booking, BookingDateRange, BookingSort, BookingStatus, VisitDay } from "./types";

export const BOOKING_STATUS_CHIPS: { value: BookingStatus; label: string }[] = [
  { value: "Pending", label: "Pending" },
  { value: "Accepted", label: "Accepted" },
  { value: "Reschedule", label: "Reschedule" },
  { value: "Completed", label: "Completed" },
  { value: "Rejected", label: "Rejected" },
];

// "Butuh tindakan" surfaces work-in-progress bookings the admin still owns.
export const isActionNeeded = (status: BookingStatus) =>
  status === "Pending" || status === "Accepted" || status === "Reschedule";

// Parse the human-readable submittedAt ("23 Mei 2026, 14.12 WIB") into a Date
// for sorting. Returns epoch 0 if it cannot parse so legacy data still sorts
// deterministically (oldest-last).
export const parseSubmittedAt = (value: string): Date => {
  if (!value) return new Date(0);
  const cleaned = value.replace(/\s*WIB\s*$/i, "").trim();
  const match = cleaned.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})(?:,\s*(\d{1,2})[.:](\d{2}))?/);
  if (!match) return new Date(0);
  const [, dayRaw, monthName, yearRaw, hourRaw, minuteRaw] = match;
  const monthIndex = monthNames.findIndex(
    (name) => name.toLowerCase() === monthName.toLowerCase(),
  );
  if (monthIndex < 0) return new Date(0);
  return new Date(
    Number(yearRaw),
    monthIndex,
    Number(dayRaw),
    Number(hourRaw ?? 0),
    Number(minuteRaw ?? 0),
  );
};

// Lower = surfaced higher in "smart" sort.
export const SMART_BUCKET_ORDER: Record<BookingStatus, number> = {
  Pending: 0,
  Accepted: 1,
  Reschedule: 2,
  Completed: 3,
  Rejected: 4,
};

export const sortBookings = (list: Booking[], sort: BookingSort): Booking[] => {
  const items = [...list];
  if (sort === "smart") {
    items.sort((a, b) => {
      const bucketDiff = SMART_BUCKET_ORDER[a.status] - SMART_BUCKET_ORDER[b.status];
      if (bucketDiff !== 0) return bucketDiff;
      if (a.status === "Pending") {
        return parseSubmittedAt(a.submittedAt).getTime() - parseSubmittedAt(b.submittedAt).getTime();
      }
      if (a.status === "Accepted" || a.status === "Reschedule") {
        return a.date.localeCompare(b.date);
      }
      if (a.status === "Completed") {
        return parseSubmittedAt(b.completedAt ?? b.submittedAt).getTime() -
          parseSubmittedAt(a.completedAt ?? a.submittedAt).getTime();
      }
      return parseSubmittedAt(b.submittedAt).getTime() - parseSubmittedAt(a.submittedAt).getTime();
    });
    return items;
  }
  if (sort === "submitted-desc") {
    items.sort(
      (a, b) =>
        parseSubmittedAt(b.submittedAt).getTime() - parseSubmittedAt(a.submittedAt).getTime(),
    );
    return items;
  }
  if (sort === "submitted-asc") {
    items.sort(
      (a, b) =>
        parseSubmittedAt(a.submittedAt).getTime() - parseSubmittedAt(b.submittedAt).getTime(),
    );
    return items;
  }
  if (sort === "date-asc") {
    items.sort((a, b) => a.date.localeCompare(b.date));
    return items;
  }
  // date-desc
  items.sort((a, b) => b.date.localeCompare(a.date));
  return items;
};

export const inDateRange = (
  booking: Booking,
  range: BookingDateRange,
  customFrom: string,
  customTo: string,
): boolean => {
  if (range === "all") return true;
  const visit = parseDateKey(booking.date);
  visit.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (range === "today") return visit.getTime() === today.getTime();
  if (range === "week") {
    const start = new Date(today);
    start.setDate(start.getDate() - start.getDay());
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return visit >= start && visit < end;
  }
  if (range === "month") {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    return visit >= start && visit < end;
  }
  if (range === "custom") {
    if (customFrom && parseDateKey(customFrom) > visit) return false;
    if (customTo && parseDateKey(customTo) < visit) return false;
    return true;
  }
  return true;
};

// AdminActionModal stores the proposed reschedule slot as the visible label
// (e.g. "Senin, 1 Juni 2026, 09.00 WIB"). Parse back to ISO date + time.
export function parseProposedSlot(
  label: string,
  schedules: VisitDay[],
): { date: string; dateLabel: string; time: string } | null {
  const trimmed = label.replace(/\s*WIB\s*$/i, "").trim();
  for (const day of schedules) {
    if (trimmed.startsWith(day.label + ",")) {
      const time = trimmed.slice(day.label.length + 1).trim();
      return { date: day.date, dateLabel: day.label, time };
    }
  }
  const lastComma = trimmed.lastIndexOf(",");
  if (lastComma === -1) return null;
  const dateLabel = trimmed.slice(0, lastComma).trim();
  const time = trimmed.slice(lastComma + 1).trim();
  const day = schedules.find((d) => d.label === dateLabel);
  if (!day) return null;
  return { date: day.date, dateLabel, time };
}

export const PAGE_SIZE_BOOKING_SPLIT = 10;
export const PAGE_SIZE_BOOKING_TABLE = 20;
export const PAGE_SIZE_FEEDBACK = 8;
export const VIRTUALIZE_THRESHOLD = 80;

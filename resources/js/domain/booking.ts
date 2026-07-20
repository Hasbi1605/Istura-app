// Pure booking domain logic: sorting, filtering, date parsing. No React.
import { monthNames, parseDateKey } from "../lib/date";
import type { Booking, BookingDateRange, BookingSegment, BookingSort, BookingStatus, VisitDay } from "./types";

export const SLOT_CAPACITY = 80;
export const PUBLIC_MAX_BOOKING_GROUP_SIZE = 480;
export const ADMIN_MAX_BOOKING_GROUP_SIZE = 560;
export const PUBLIC_MIN_LEAD_DAYS = 3;
export const PUBLIC_EARLY_MAX_DAYS = 2;

export const BOOKING_STATUS_CHIPS: { value: BookingStatus; label: string }[] = [
  { value: "Pending", label: "Menunggu" },
  { value: "Accepted", label: "Disetujui" },
  { value: "Reschedule", label: "Penjadwalan ulang" },
  { value: "Expired", label: "Kedaluwarsa" },
  { value: "Completed", label: "Selesai" },
  { value: "Rejected", label: "Ditolak" },
];

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  Pending: "Menunggu",
  Accepted: "Disetujui",
  Rejected: "Ditolak",
  Reschedule: "Penjadwalan ulang",
  Completed: "Selesai",
  Expired: "Kedaluwarsa",
};

// "Butuh tindakan" surfaces work-in-progress bookings the admin still owns.
export const isActionNeeded = (status: BookingStatus) =>
  status === "Pending" || status === "Accepted" || status === "Reschedule";

export const requiredSlotCount = (groupSize: number): number =>
  Math.max(1, Math.ceil(Math.max(0, Number.isFinite(groupSize) ? groupSize : 0) / SLOT_CAPACITY));

export const splitGroupSizes = (groupSize: number): number[] => {
  const normalizedSize = Math.max(0, Number.isFinite(groupSize) ? groupSize : 0);
  if (normalizedSize < 1) return [0];
  const slotCount = requiredSlotCount(normalizedSize);
  const baseSize = Math.floor(normalizedSize / slotCount);
  const remainder = normalizedSize % slotCount;
  return Array.from({ length: slotCount }, (_, index) => baseSize + (index < remainder ? 1 : 0));
};

export const canFitConsecutiveSlots = (
  day: VisitDay | undefined,
  startTime: string,
  slotCount: number,
  _segmentSizes?: number[],
): boolean => {
  if (!day || !startTime) return false;
  const startIndex = day.slots.findIndex((slot) => slot.time === startTime);
  if (startIndex < 0) return false;
  const candidates = day.slots.slice(startIndex, startIndex + slotCount);
  return candidates.length === slotCount && candidates.every((slot) => slot.status === "Available");
};

export const hasConsecutiveAvailableSlots = (day: VisitDay | undefined, slotCount: number, segmentSizes?: number[]): boolean =>
  Boolean(day?.slots.some((slot) => canFitConsecutiveSlots(day, slot.time, slotCount, segmentSizes)));

export const previewSegmentsForSelection = (
  day: VisitDay | undefined,
  startTime: string,
  groupSize: number,
): BookingSegment[] => {
  if (!day || !startTime || groupSize < 1) return [];
  const sizes = splitGroupSizes(groupSize);
  const startIndex = day.slots.findIndex((slot) => slot.time === startTime);
  if (startIndex < 0) return [];
  const slots = day.slots.slice(startIndex, startIndex + sizes.length);
  if (slots.length !== sizes.length) return [];
  return slots.map((slot, index) => ({
    order: index + 1,
    date: day.date,
    dateLabel: day.label,
    time: slot.time,
    groupSize: sizes[index],
  }));
};

export const bookingSegments = (booking: Booking): BookingSegment[] =>
  booking.segments?.length
    ? booking.segments
    : [
        {
          order: 1,
          date: booking.date,
          dateLabel: booking.dateLabel,
          time: booking.time,
          groupSize: booking.groupSize,
        },
      ];

export const segmentListLabel = (segments: BookingSegment[]): string =>
  segments
    .map((segment) => `Kloter ${segment.order}: ${segment.time} WIB (${segment.groupSize} orang)`)
    .join("; ");

export const bookingKloterSummary = (booking: Booking): string => {
  const segments = bookingSegments(booking);
  return segments.length > 1
    ? `${booking.groupSize} orang (${segments.length} kloter)`
    : `${booking.groupSize} orang`;
};

export const bookingTimeSummary = (booking: Booking): string => {
  const segments = bookingSegments(booking);
  if (segments.length <= 1) return `${booking.time} WIB`;
  return `${segments[0].time}-${segments[segments.length - 1].time} WIB (${segments.length} kloter)`;
};

export const bookingScheduleSummary = (booking: Booking): string =>
  `${booking.dateLabel}, ${bookingTimeSummary(booking)}`;

export const isShortNoticeBooking = (booking: Booking): boolean =>
  booking.isShortNotice === true ||
  (typeof booking.leadTimeDays === "number" && booking.leadTimeDays >= 0 && booking.leadTimeDays < 5);

export const bookingLeadTimeLabel = (booking: Booking): string => {
  if (typeof booking.leadTimeDays !== "number") return "Pengajuan mendadak";
  const leadTime = booking.leadTimeDays === 0 ? "H-0" : `H-${booking.leadTimeDays}`;
  return `${leadTime} mendadak`;
};

// Parse the human-readable submittedAt ("23 Mei 2026, 14.12 WIB") into a Date
// for sorting. Returns epoch 0 if it cannot parse so legacy data still sorts
// deterministically (oldest-last).
export const parseSubmittedAt = (value: string | null): Date => {
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

const bookingScheduleSortKey = (booking: Booking): string =>
  `${booking.date}T${booking.time}`;

export const comparePendingBookings = (a: Booking, b: Booking): number =>
  bookingScheduleSortKey(a).localeCompare(bookingScheduleSortKey(b)) ||
  parseSubmittedAt(a.submittedAt).getTime() - parseSubmittedAt(b.submittedAt).getTime();

// Lower = surfaced higher in "smart" sort.
export const SMART_BUCKET_ORDER: Record<BookingStatus, number> = {
  Pending: 0,
  Accepted: 1,
  Reschedule: 2,
  Expired: 3,
  Completed: 4,
  Rejected: 5,
};

export const sortBookings = (list: Booking[], sort: BookingSort): Booking[] => {
  const items = [...list];
  if (sort === "smart") {
    items.sort((a, b) => {
      const bucketDiff = SMART_BUCKET_ORDER[a.status] - SMART_BUCKET_ORDER[b.status];
      if (bucketDiff !== 0) return bucketDiff;
      if (a.status === "Pending") {
        return comparePendingBookings(a, b);
      }
      if (a.status === "Accepted" || a.status === "Reschedule") {
        return a.date.localeCompare(b.date);
      }
      if (a.status === "Completed") {
        return parseSubmittedAt(b.completedAt ?? b.submittedAt).getTime() -
          parseSubmittedAt(a.completedAt ?? a.submittedAt).getTime();
      }
      if (a.status === "Expired") {
        return parseSubmittedAt(b.expiredAt ?? b.submittedAt).getTime() -
          parseSubmittedAt(a.expiredAt ?? a.submittedAt).getTime();
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

export const reportDateKeyForBooking = (booking: Booking): string => {
  if (booking.reportDate) return booking.reportDate;
  if (booking.status === "Reschedule" && booking.proposedDate) return booking.proposedDate;

  return booking.date;
};

export const inDateRange = (
  booking: Booking,
  range: BookingDateRange,
  customFrom: string,
  customTo: string,
): boolean => {
  if (range === "all") return true;
  const visit = parseDateKey(reportDateKeyForBooking(booking));
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
/** Table view only: above this many visible rows, switch to windowed list. */
export const VIRTUALIZE_THRESHOLD = 1000;

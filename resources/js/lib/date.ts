// Pure date utilities (no React). Diekstrak dari App.tsx; perilaku identik.
import type { PublicDateStatus, VisitDay, VisitStatus } from "../domain/types";

export const monthNames = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

export const fullDayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

export const calendarWeekdays = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

export const padDatePart = (value: number) => String(value).padStart(2, "0");

export const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());
export const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
export const getMonthLength = (year: number, month: number) => new Date(year, month + 1, 0).getDate();

export const addMonths = (date: Date, amount: number) => {
  const targetMonth = date.getMonth() + amount;
  const monthStart = new Date(date.getFullYear(), targetMonth, 1);
  const day = Math.min(date.getDate(), getMonthLength(monthStart.getFullYear(), monthStart.getMonth()));

  return new Date(monthStart.getFullYear(), monthStart.getMonth(), day);
};

export const formatDateKey = (date: Date) =>
  `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;

export const parseDateKey = (key: string) => {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
};

export const isSameMonth = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();

export const isWithinRange = (date: Date, minDate: Date, maxDate: Date) =>
  date >= minDate && date <= maxDate;

export const isDefaultHoliday = (date: Date) => [0, 5, 6].includes(date.getDay());

export const formatMonthTitle = (date: Date) =>
  `${monthNames[date.getMonth()]} ${date.getFullYear()}`;

export const formatLongDate = (date: Date) =>
  `${fullDayNames[date.getDay()]}, ${date.getDate()} ${monthNames[date.getMonth()]} ${date.getFullYear()}`;

// Locale number formatters. Indonesian uses "." as thousands separator.
const numberFormatId = new Intl.NumberFormat("id-ID");
export const formatCount = (value: number) => numberFormatId.format(value);

// Compact formatter for chip badges (1rb, 12rb, 1jt).
export const formatCountShort = (value: number) => {
  if (value < 1000) return formatCount(value);
  if (value < 10_000) {
    const v = value / 1000;
    return `${v.toFixed(v < 10 ? 1 : 0).replace(/\.0$/, "")}rb`;
  }
  if (value < 1_000_000) return `${Math.round(value / 1000)}rb`;
  const v = value / 1_000_000;
  return `${v.toFixed(v < 10 ? 1 : 0).replace(/\.0$/, "")}jt`;
};

export const getPublicDateStatus = (
  date: Date,
  minDate: Date,
  maxDate: Date,
  visibleMonth: Date,
  scheduleByKey?: Map<string, VisitDay>,
): PublicDateStatus => {
  if (!isSameMonth(date, visibleMonth) || !isWithinRange(date, minDate, maxDate)) {
    return "outside";
  }

  if (scheduleByKey) {
    const day = scheduleByKey.get(formatDateKey(date));
    if (!day) return "closed";
    const hasAvailable = day.slots.some((slot) => slot.status === "Available");
    const hasPending = day.slots.some(
      (slot) => slot.status === "Held" || slot.status === "Reschedule Hold",
    );
    if (hasAvailable) return "available";
    if (hasPending) return "processing";
    const allClosed = day.slots.every((slot) => slot.status === "Closed");
    if (allClosed) return "closed";
    return "full";
  }

  if (isDefaultHoliday(date)) {
    return "closed";
  }

  if (date.getDate() % 11 === 0) {
    return "full";
  }

  if (date.getDate() % 7 === 0) {
    return "processing";
  }

  return "available";
};

export const getFirstAvailableDate = (
  minDate: Date,
  maxDate: Date,
  visibleMonth = minDate,
  scheduleByKey?: Map<string, VisitDay>,
) => {
  const cursor = startOfDay(new Date(Math.max(minDate.getTime(), startOfMonth(visibleMonth).getTime())));
  const monthEnd = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0);
  const end = new Date(Math.min(maxDate.getTime(), monthEnd.getTime()));

  while (cursor <= end) {
    if (
      getPublicDateStatus(cursor, minDate, maxDate, startOfMonth(cursor), scheduleByKey) ===
      "available"
    ) {
      return new Date(cursor);
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return minDate;
};

export const createCalendarDays = (
  visibleMonth: Date,
  minDate: Date,
  maxDate: Date,
  scheduleByKey?: Map<string, VisitDay>,
) => {
  const firstDay = startOfMonth(visibleMonth);
  const gridStart = new Date(firstDay);
  gridStart.setDate(firstDay.getDate() - firstDay.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);

    return {
      date,
      key: formatDateKey(date),
      status: getPublicDateStatus(date, minDate, maxDate, visibleMonth, scheduleByKey),
    };
  });
};

// Public slot/status mapping helpers.
export const publicSlotStatusToClass = (status: VisitStatus): PublicDateStatus => {
  if (status === "Available") return "available";
  if (status === "Held" || status === "Reschedule Hold") return "processing";
  if (status === "Booked") return "full";
  return "closed";
};

export const publicSlotStatusLabel: Record<VisitStatus, string> = {
  Available: "Tersedia",
  Held: "Sedang diproses",
  "Reschedule Hold": "Sedang diproses",
  Booked: "Sudah terisi",
  Closed: "Tidak dibuka",
};

export const publicStatusMeta: Record<PublicDateStatus, { label: string }> = {
  available: { label: "Tersedia" },
  processing: { label: "Sedang Diproses" },
  full: { label: "Penuh" },
  closed: { label: "Tutup" },
  outside: { label: "Tidak tersedia" },
};

export const legendStatuses: PublicDateStatus[] = ["available", "processing", "full", "closed"];

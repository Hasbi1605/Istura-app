// Pure schedule domain logic (no React). Mirror dari ScheduleService di
// backend; tetap dipakai di frontend untuk render kalender publik & admin.
import {
  addMonths,
  formatDateKey,
  formatLongDate,
  isDefaultHoliday,
  monthNames,
  startOfDay,
} from "../lib/date";
import type { Booking, VisitDay, VisitStatus } from "./types";

export const VISIT_TIME_SLOTS = ["08.00", "09.00", "10.00", "11.00", "13.00", "14.00"];

export function buildScheduleHorizon(today: Date): VisitDay[] {
  // Generate every calendar day for the next 2 months. Default operating
  // days (Senin-Jumat) buka 08.00-11.00 dan 13.00-14.00 WIB; default libur
  // (Sabtu/Minggu) tetap dibuat tapi semua slotnya Closed sehingga
  // admin bisa membukanya kapan saja jika perlu.
  const start = startOfDay(today);
  const end = addMonths(start, 2);
  const days: VisitDay[] = [];
  const cursor = new Date(start);

  while (cursor <= end) {
    const closedByDefault = isDefaultHoliday(cursor);
    days.push({
      date: formatDateKey(cursor),
      label: formatLongDate(cursor),
      short: `${cursor.getDate()} ${monthNames[cursor.getMonth()].slice(0, 3)}`,
      slots: VISIT_TIME_SLOTS.map((time) => ({
        time,
        status: (closedByDefault ? "Closed" : "Available") as VisitStatus,
      })),
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

export function applyBookingsToSchedule(schedule: VisitDay[], bookings: Booking[]): VisitDay[] {
  return schedule.map((day) => {
    const dayBookings = bookings.filter((booking) => booking.date === day.date);
    if (dayBookings.length === 0) return day;
    return {
      ...day,
      slots: day.slots.map((slot) => {
        const booking = dayBookings.find((entry) => entry.time === slot.time);
        if (!booking) return slot;
        if (booking.status === "Pending") return { ...slot, status: "Held" as VisitStatus };
        if (booking.status === "Accepted" || booking.status === "Completed") {
          return { ...slot, status: "Booked" as VisitStatus };
        }
        if (booking.status === "Reschedule") {
          return { ...slot, status: "Reschedule Hold" as VisitStatus };
        }
        return slot;
      }),
    };
  });
}

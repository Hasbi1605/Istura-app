// Pure builder for the weekly agenda poster shared to WhatsApp groups.
//
// Sumber data: booking berstatus "Accepted" (jadwal yang akan datang, bukan
// yang sudah selesai). Hanya hari yang punya minimal satu agenda yang
// ditampilkan — meniru poster manual yang selama ini dibuat admin.
//
// Tidak ada React/DOM di sini supaya logikanya gampang dipakai ulang & diuji.
import {
  addDays,
  formatDateKey,
  fullDayNames,
  monthNames,
  parseDateKey,
  startOfDay,
} from "../lib/date";
import type { Booking } from "./types";

export const POSTER_TITLE_DEFAULT = "AGENDA ISTURA GEDUNG AGUNG";

// Satu baris agenda di dalam satu hari: jam, deskripsi (bisa multi-bullet),
// dan jumlah peserta. Semua field bersifat editable di modal sebelum diekspor.
export type PosterRow = {
  id: string;
  time: string;
  agenda: string[];
  people: string;
};

export type PosterDay = {
  dateKey: string;
  dayName: string; // "SENIN"
  dateNum: number; // 25
  rows: PosterRow[];
};

export type PosterModel = {
  title: string;
  monthLabel: string; // "MEI 2026"
  weekStartKey: string;
  weekEndKey: string;
  days: PosterDay[];
};

// Awal minggu mengikuti konvensi dashboard (Minggu sebagai hari pertama),
// sehingga "minggu ini" di poster identik dengan card "Minggu ini".
export function startOfWeek(reference: Date): Date {
  const base = startOfDay(reference);
  const result = new Date(base);
  result.setDate(base.getDate() - base.getDay());
  return result;
}

export function buildWeeklyPoster(bookings: Booking[], weekStart: Date): PosterModel {
  const start = startOfWeek(weekStart);
  const end = addDays(start, 6);
  const startKey = formatDateKey(start);
  const endKey = formatDateKey(end);

  // Accepted only, di dalam rentang minggu, dikelompokkan per tanggal.
  const byDate = new Map<string, Booking[]>();
  for (const booking of bookings) {
    if (booking.status !== "Accepted") continue;
    if (booking.date < startKey || booking.date > endKey) continue;
    const list = byDate.get(booking.date) ?? [];
    list.push(booking);
    byDate.set(booking.date, list);
  }

  const days: PosterDay[] = [];
  for (let offset = 0; offset < 7; offset += 1) {
    const date = addDays(start, offset);
    const key = formatDateKey(date);
    const list = byDate.get(key);
    if (!list || list.length === 0) continue; // hanya hari yang ada agenda

    const rows: PosterRow[] = [...list]
      .sort((a, b) => a.time.localeCompare(b.time))
      .map((booking) => ({
        id: booking.code,
        time: booking.time,
        agenda: [booking.institution],
        people: `${booking.groupSize} Orang`,
      }));

    days.push({
      dateKey: key,
      dayName: fullDayNames[date.getDay()].toUpperCase(),
      dateNum: date.getDate(),
      rows,
    });
  }

  // Label bulan diambil dari hari pertama yang punya agenda (lebih akurat saat
  // minggu menjorok ke dua bulan); fallback ke awal minggu kalau kosong.
  const labelDate = days.length ? parseDateKey(days[0].dateKey) : start;
  const monthLabel = `${monthNames[labelDate.getMonth()].toUpperCase()} ${labelDate.getFullYear()}`;

  return {
    title: POSTER_TITLE_DEFAULT,
    monthLabel,
    weekStartKey: startKey,
    weekEndKey: endKey,
    days,
  };
}

// Hitung jumlah agenda (baris) pada model — dipakai untuk preview count &
// menonaktifkan tombol unduh saat kosong.
export function posterRowCount(model: PosterModel): number {
  return model.days.reduce((sum, day) => sum + day.rows.length, 0);
}

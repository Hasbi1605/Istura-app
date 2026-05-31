// Admin schedule manager + sub-dialogs. Extracted from App.tsx.
import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, Lock, X } from "lucide-react";
import type { Booking, Slot, VisitDay, VisitStatus } from "../../domain/types";
import { bookingKloterSummary, bookingSegments, bookingTimeSummary } from "../../domain/booking";
import {
  addMonths,
  calendarWeekdays,
  createCalendarDays,
  formatDateKey,
  formatLongDate,
  formatMonthTitle,
  isDefaultHoliday,
  isSameMonth,
  parseDateKey,
  startOfDay,
  startOfMonth,
} from "../../lib/date";
import { VISIT_TIME_SLOTS } from "../../domain/schedule";
import {
  deleteScheduleSlot,
  fetchAdminSchedule,
  upsertScheduleRange,
  upsertScheduleSlot,
} from "../../api/schedule";
import { apiVisitDayToLocal } from "../../api/adapters";
import { StatCard } from "../ui/StatCard";
import { InlineSpinner, SectionSkeleton, StatCardSkeleton } from "../ui/LoadingStates";

export function AdminScheduleManager({
	schedules,
	bookings,
	loading = false,
	onSchedulesChange,
  onOpenBooking,
}: {
	schedules: VisitDay[];
	bookings: Booking[];
	loading?: boolean;
	onSchedulesChange: (next: VisitDay[]) => void;
  onOpenBooking: (bookingCode: string) => void;
}) {
  const today = useState(() => startOfDay(new Date()))[0];
  const minMonth = startOfMonth(today);
  const maxScheduleDate = addMonths(today, 2);
  const maxMonth = startOfMonth(maxScheduleDate);
  const [visibleMonth, setVisibleMonth] = useState(() => minMonth);

  // Map booking by `${date}|${time}` agar lookup detail booking di slot
  // Booked/Held murah dan eksak.
  const bookingByKey = useMemo(() => {
    const map = new Map<string, Booking>();
    for (const booking of bookings) {
      for (const segment of bookingSegments(booking)) {
        map.set(`${segment.date}|${segment.time}`, booking);
      }
    }
    return map;
  }, [bookings]);

  // Booking aktif per tanggal (Pending/Accepted/Reschedule) untuk indikator
  // dampak saat admin menutup hari.
  const activeBookingsByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const booking of bookings) {
      if (
        booking.status === "Pending" ||
        booking.status === "Accepted" ||
        booking.status === "Reschedule"
      ) {
        map.set(booking.date, (map.get(booking.date) ?? 0) + 1);
      }
    }
    return map;
  }, [bookings]);

  const scheduleByDate = new Map(schedules.map((day) => [day.date, day] as const));
  // Default ke hari ini agar sinkron dengan highlight kalender.
  // Fallback ke hari aktif terdekat jika hari ini tidak ada di daftar jadwal.
  const todayKey = formatDateKey(today);
  const firstActive =
    schedules.find(
      (day) =>
        parseDateKey(day.date) >= today &&
        day.slots.some((slot) => slot.status === "Available"),
    )?.date ??
    schedules.find((day) => parseDateKey(day.date) >= today)?.date ??
    schedules[0]?.date ??
    "";
  const [selectedDate, setSelectedDate] = useState(() =>
    schedules.some((day) => day.date === todayKey) ? todayKey : firstActive
  );
  const [customDraft, setCustomDraft] = useState("");
	const [customError, setCustomError] = useState<string | null>(null);
	const [savingLabel, setSavingLabel] = useState<string | null>(null);
  // Slot detail popover (untuk slot Booked/Held).
  const [slotInfoTime, setSlotInfoTime] = useState<string | null>(null);
  // Range modal (#1) state.
  const [showRangeModal, setShowRangeModal] = useState(false);
  // Confirm dialog generic (#3).
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    body: string;
    confirmLabel: string;
    confirmVariant?: "default" | "danger";
    onConfirm: () => void;
  } | null>(null);
  // Sumber kebenaran "sekarang" untuk menandai jam yang sudah lewat di hari
  // ini. Diperbarui per menit.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!firstActive) return;
    if (!selectedDate || !scheduleByDate.has(selectedDate)) {
      setSelectedDate(firstActive);
    }
  }, [firstActive, scheduleByDate, selectedDate]);
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  // Highlight slot baru selama beberapa detik (#10).
  const [newlyAddedSlot, setNewlyAddedSlot] = useState<{
    date: string;
    time: string;
  } | null>(null);
  useEffect(() => {
    if (!newlyAddedSlot) return;
    const id = window.setTimeout(() => setNewlyAddedSlot(null), 1800);
    return () => window.clearTimeout(id);
  }, [newlyAddedSlot]);

  const canGoPrev = visibleMonth > minMonth;
  const canGoNext = visibleMonth < maxMonth;

  const calendarDays = createCalendarDays(visibleMonth, today, maxScheduleDate);
  const selectedDay = scheduleByDate.get(selectedDate);

  // Helper: parse "HH.MM" jadi menit total dalam hari.
  const parseTimeToMinutes = (hhmm: string) => {
    const [h, m] = hhmm.split(".").map(Number);
    return h * 60 + (m || 0);
  };

  // Slot lewat = slot di hari ini yang jamnya sudah lewat dari "now".
  const isSlotPast = (dateKey: string, time: string) => {
    const dateObj = parseDateKey(dateKey);
    if (
      dateObj.getFullYear() !== now.getFullYear() ||
      dateObj.getMonth() !== now.getMonth() ||
      dateObj.getDate() !== now.getDate()
    ) {
      return false;
    }
    return parseTimeToMinutes(time) <= now.getHours() * 60 + now.getMinutes();
  };

  // Setiap mutasi melalui helper ini agar optimistic update konsisten.
  const applyChange = (next: VisitDay[]) => {
    onSchedulesChange(next);
  };

  const refreshFromApi = () =>
    fetchAdminSchedule().then((days) => onSchedulesChange(days.map(apiVisitDayToLocal)));

	const applyPersistedChange = (
		label: string,
		next: VisitDay[],
		persist: () => Promise<unknown>,
	) => {
		if (savingLabel) return;
		const snapshot = schedules;
		applyChange(next);
		setSavingLabel(`Menyimpan ${label.toLowerCase()}...`);
		persist()
			.then(() => refreshFromApi())
			.catch(() => {
				void refreshFromApi().catch(() => onSchedulesChange(snapshot));
				setCustomError("Gagal menyimpan jadwal. Coba lagi.");
			})
			.finally(() => setSavingLabel(null));
	};

  const toggleSlot = (dayDate: string, time: string) => {
    if (isSlotPast(dayDate, time)) return;
    const day = scheduleByDate.get(dayDate);
    const slot = day?.slots.find((item) => item.time === time);
    if (!slot) return;
    const nextStatus: VisitStatus =
      slot.status === "Closed" ? "Available" : slot.status === "Available" ? "Closed" : slot.status;
    const next = schedules.map((day) =>
        day.date === dayDate
          ? {
              ...day,
              slots: day.slots.map((slot) =>
                slot.time === time
                  ? {
                      ...slot,
                      status: nextStatus,
                    }
                  : slot,
              ),
            }
          : day,
      );
    applyPersistedChange(
      `Slot ${time} diperbarui`,
      next,
      () => upsertScheduleSlot(dayDate, time, nextStatus),
    );
  };

  const forceSetSlotStatus = (dayDate: string, time: string, status: VisitStatus) => {
    const next = schedules.map((day) =>
        day.date === dayDate
          ? {
              ...day,
              slots: day.slots.map((slot) =>
                slot.time === time
                  ? {
                      ...slot,
                      status,
                    }
                  : slot,
              ),
            }
          : day,
      );
    applyPersistedChange(
      `Override slot ${time}`,
      next,
      () => upsertScheduleSlot(dayDate, time, status),
    );
  };

  // Bulk action di satu hari, dengan optional konfirmasi.
  const performSetDayAll = (dayDate: string, action: "open" | "close") => {
    const targetStatus: VisitStatus = action === "open" ? "Available" : "Closed";
    const next = schedules.map((day) =>
        day.date === dayDate
          ? {
              ...day,
              slots: day.slots.map((slot) =>
                slot.status === "Booked" || slot.status === "Held" || slot.status === "Reschedule Hold"
                  ? slot
                  : isSlotPast(dayDate, slot.time)
                    ? slot
                    : {
                        ...slot,
                        status: targetStatus,
                      },
              ),
            }
          : day,
      );
    applyPersistedChange(
      action === "open" ? "Slot dibuka" : "Slot ditutup",
      next,
      () => upsertScheduleRange({ from: dayDate, to: dayDate, status: action === "open" ? "Available" : "Closed" }),
    );
  };

  const setDayAll = (dayDate: string, action: "open" | "close") => {
    const day = scheduleByDate.get(dayDate);
    if (!day) return;
    if (action === "close") {
      const willClose = day.slots.filter(
        (slot) =>
          slot.status === "Available" && !isSlotPast(dayDate, slot.time),
      ).length;
      const activeBooking = activeBookingsByDate.get(dayDate) ?? 0;
      // Konfirmasi hanya kalau ada banyak slot yang akan tertutup atau ada
      // booking aktif di hari itu (#3, #4).
      if (willClose >= 3 || activeBooking > 0) {
        setConfirmDialog({
          title: "Tutup semua slot?",
          body:
            `Pada ${day.label}, ${willClose} slot tersedia akan ditutup. ` +
            (activeBooking > 0
              ? `Ada ${activeBooking} booking aktif di tanggal ini yang tidak terpengaruh.`
              : "Slot yang sudah ada booking tidak terpengaruh."),
          confirmLabel: "Tutup semua",
          confirmVariant: "danger",
          onConfirm: () => performSetDayAll(dayDate, "close"),
        });
        return;
      }
    }
    performSetDayAll(dayDate, action);
  };

  // Normalisasi input "08", "8", "8:00", "8.00", "08:0" menjadi format
  // "HH.MM" 24 jam. Mengembalikan null jika input tidak valid.
  const normalizeTimeInput = (raw: string): string | null => {
    const value = raw.trim();
    if (!value) return null;
    const match = value.match(/^(\d{1,2})(?:[.:](\d{1,2}))?$/);
    if (!match) return null;
    const hour = Number(match[1]);
    const minute = match[2] ? Number(match[2]) : 0;
    if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
    if (hour < 0 || hour > 23) return null;
    if (minute < 0 || minute > 59) return null;
    return `${String(hour).padStart(2, "0")}.${String(minute).padStart(2, "0")}`;
  };

  const sortSlots = (slots: Slot[]) =>
    [...slots].sort((a, b) => a.time.localeCompare(b.time));

  const addCustomSlot = (dayDate: string, raw: string) => {
    const normalized = normalizeTimeInput(raw);
    if (!normalized) {
      setCustomError("Format jam tidak valid. Gunakan HH.MM, contoh 15.30.");
      return;
    }
    const day = scheduleByDate.get(dayDate);
    if (!day) return;
    if (day.slots.some((slot) => slot.time === normalized)) {
      setCustomError(`Jam ${normalized} sudah ada di daftar.`);
      return;
    }
    if (isSlotPast(dayDate, normalized)) {
      setCustomError("Jam tersebut sudah lewat untuk hari ini.");
      return;
    }
    setCustomError(null);
    setCustomDraft("");
    const next = schedules.map((d) =>
        d.date === dayDate
          ? {
              ...d,
              slots: sortSlots([
                ...d.slots,
                { time: normalized, status: "Available", custom: true },
              ]),
            }
          : d,
      );
    applyPersistedChange(
      `Jam khusus ${normalized} ditambahkan`,
      next,
      () => upsertScheduleSlot(dayDate, normalized, "Available"),
    );
    // Beri tanda highlight singkat ke slot baru.
    setNewlyAddedSlot({ date: dayDate, time: normalized });
  };

  const removeCustomSlot = (dayDate: string, time: string) => {
    const next = schedules.map((d) =>
        d.date === dayDate
          ? {
              ...d,
              slots: d.slots.filter(
                (slot) => !(slot.time === time && slot.custom),
              ),
            }
          : d,
      );
    applyPersistedChange(
      `Jam khusus ${time} dihapus`,
      next,
      () => deleteScheduleSlot(dayDate, time),
    );
  };

  // Apply pengaturan rentang (#1): rentang tanggal + hari minggu yang
  // dipilih, lalu buka/tutup. Slot Booked/Held tetap aman.
  const applyRange = (params: {
    from: string;
    to: string;
    weekdays: number[]; // 0=Min...6=Sab
    action: "open" | "close";
  }) => {
    const fromDate = parseDateKey(params.from);
    const toDate = parseDateKey(params.to);
    const action = params.action;
    const weekdaySet = new Set(params.weekdays);
    const next = schedules.map((day) => {
      const d = parseDateKey(day.date);
      if (d < fromDate || d > toDate) return day;
      if (!weekdaySet.has(d.getDay())) return day;
      return {
        ...day,
        slots: day.slots.map((slot): Slot =>
          slot.status === "Booked" || slot.status === "Held" || slot.status === "Reschedule Hold"
            ? slot
            : isSlotPast(day.date, slot.time)
              ? slot
              : {
                  ...slot,
                  status: action === "open" ? "Available" : "Closed",
                },
        ),
      };
    });
    applyPersistedChange(
      action === "open"
        ? "Rentang tanggal dibuka"
        : "Rentang tanggal ditutup",
      next,
      () => upsertScheduleRange({
        from: params.from,
        to: params.to,
        weekdays: params.weekdays,
        status: action === "open" ? "Available" : "Closed",
      }),
    );
  };

  const totalAvailable = schedules.reduce(
    (sum, day) => sum + day.slots.filter((slot) => slot.status === "Available").length,
    0,
  );
  const totalBooked = schedules.reduce(
    (sum, day) => sum + day.slots.filter((slot) => slot.status === "Booked").length,
    0,
  );
  // Hari aktif = hari (>= hari ini) yang punya minimal satu slot Available.
  const totalActiveDays = schedules.reduce(
    (sum, day) =>
      parseDateKey(day.date) >= today &&
      day.slots.some((slot) => slot.status === "Available")
        ? sum + 1
        : sum,
    0,
  );

  // KPI hari ini untuk kartu "Hari ini".
	const todaySchedule = scheduleByDate.get(todayKey);
	const todayAvailable = todaySchedule?.slots.filter((s) => s.status === "Available").length ?? 0;
	const scheduleBusy = Boolean(savingLabel);

  const dayKpi = selectedDay
    ? {
        available: selectedDay.slots.filter((slot) => slot.status === "Available").length,
        booked: selectedDay.slots.filter((slot) => slot.status === "Booked").length,
        held: selectedDay.slots.filter((slot) => slot.status === "Held").length,
        closed: selectedDay.slots.filter((slot) => slot.status === "Closed").length,
      }
    : null;

  return (
    <div className="admin-cms-page">
		<div className="admin-heading">
			<div>
				<h1>Jadwal Kunjungan</h1>
				<p>Atur slot kunjungan untuk 2 bulan ke depan.</p>
				{loading && <InlineSpinner label="Memuat jadwal terbaru" />}
			</div>
		</div>

		<div className="admin-stats" aria-busy={loading}>
			{loading && schedules.length === 0 ? (
				<StatCardSkeleton />
			) : (
				<>
					<StatCard label="Slot tersedia" value={totalAvailable} />
					<StatCard label="Hari ini" value={todaySchedule ? todayAvailable : "—"} />
					<StatCard label="Sudah terisi" value={totalBooked} />
					<StatCard label="Hari aktif" value={totalActiveDays} />
				</>
			)}
		</div>

		<section className="admin-schedule-shell" aria-busy={loading || scheduleBusy}>
			{loading && schedules.length === 0 ? (
				<>
					<div className="admin-schedule-calendar">
						<SectionSkeleton rows={10} />
					</div>
					<div className="admin-schedule-day-panel">
						<SectionSkeleton rows={8} />
					</div>
				</>
			) : (
			<>
			<div className="admin-schedule-calendar">
          <header className="admin-schedule-cal-head">
            <div className="admin-schedule-cal-head-nav">
              <button
                type="button"
                onClick={() => canGoPrev && setVisibleMonth(addMonths(visibleMonth, -1))}
                disabled={!canGoPrev}
                aria-label="Bulan sebelumnya"
              >
                <ChevronLeft size={16} aria-hidden="true" />
              </button>
              <strong>{formatMonthTitle(visibleMonth)}</strong>
              <button
                type="button"
                onClick={() => canGoNext && setVisibleMonth(addMonths(visibleMonth, 1))}
                disabled={!canGoNext}
                aria-label="Bulan berikutnya"
              >
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </div>
			<button
				type="button"
				className="admin-pill-button"
				disabled={scheduleBusy}
				onClick={() => setShowRangeModal(true)}
            >
              Pengaturan rentang
            </button>
          </header>
          <div className="admin-schedule-cal-weekdays" aria-hidden="true">
            {calendarWeekdays.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
          <div className="admin-schedule-cal-grid">
            {calendarDays.map((cell) => {
              const inMonth = isSameMonth(cell.date, visibleMonth);
              const day = scheduleByDate.get(cell.key);
              const isPast = cell.date < today;
              const isToday =
                cell.date.getFullYear() === today.getFullYear() &&
                cell.date.getMonth() === today.getMonth() &&
                cell.date.getDate() === today.getDate();
              const totalSlots = day?.slots.length ?? 0;
              const openSlots = day?.slots.filter((slot) => slot.status === "Available").length ?? 0;
              const closedSlots = day?.slots.filter((slot) => slot.status === "Closed").length ?? 0;
              // Hari Jum/Sab/Min default tertutup; tandai berbeda dari hari
              // kerja yang sengaja ditutup admin agar admin tahu itu libur
              // default yang bisa dibuka kapan saja.
              const isDefaultOff = isDefaultHoliday(cell.date);
              const fullyClosed = totalSlots > 0 && closedSlots === totalSlots;

              const summaryClass = !inMonth
                ? "is-outside"
                : isPast
                  ? "is-past"
                  : !day
                    ? "is-past"
                    : fullyClosed
                      ? isDefaultOff
                        ? "is-holiday"
                        : "is-closed"
                      : openSlots === 0
                        ? "is-full"
                        : "is-open";

              const clickable = inMonth && !isPast && Boolean(day);

              return (
                <button
                  type="button"
                  key={cell.key}
                  className={`admin-schedule-cal-cell ${summaryClass}${
                    selectedDate === cell.key ? " is-selected" : ""
                  }${isToday ? " is-today" : ""}`}
                  disabled={!clickable}
                  onClick={() => clickable && setSelectedDate(cell.key)}
                  aria-pressed={selectedDate === cell.key}
                  aria-label={
                    inMonth
                      ? `${formatLongDate(cell.date)}${
                          isPast
                            ? ", sudah lewat"
                            : isDefaultOff && fullyClosed
                              ? ", libur default, klik untuk membuka"
                              : `, ${openSlots} slot tersedia`
                        }`
                      : ""
                  }
                >
                  <span className="admin-schedule-cal-num">{cell.date.getDate()}</span>
                </button>
              );
            })}
          </div>
          <div className="admin-schedule-cal-legend" aria-hidden="true">
            <span><i className="swatch is-open" /> Buka</span>
            <span><i className="swatch is-full" /> Penuh</span>
            <span><i className="swatch is-closed" /> Tutup</span>
            <span><i className="swatch is-holiday" /> Libur default</span>
          </div>
        </div>

        <div className="admin-schedule-day-panel">
          {selectedDay && dayKpi ? (
            (() => {
              const totalSlots = selectedDay.slots.length;
              const fullyClosed = totalSlots > 0 && dayKpi.closed === totalSlots;
              const fullyOpen =
                totalSlots > 0 && dayKpi.available + dayKpi.booked + dayKpi.held === totalSlots;
              return (
                <>
                  <header className="admin-schedule-day-head">
                    <div className="admin-schedule-day-head-title">
                      <strong>{selectedDay.label}</strong>
                      <div className="admin-schedule-day-counters">
                        {(() => {
                          const items: Array<{ key: string; n: number; label: string }> = [
                            { key: "a", n: dayKpi.available, label: "tersedia" },
                            { key: "b", n: dayKpi.booked, label: "sudah terisi" },
                            { key: "c", n: dayKpi.held, label: "diproses" },
                            { key: "d", n: dayKpi.closed, label: "ditutup" },
                          ].filter((entry) => entry.n > 0);
                          if (items.length === 0) {
                            return <span className="is-empty">Belum ada slot di hari ini.</span>;
                          }
                          return items.map((entry, index) => (
                            <span key={entry.key}>
                              <strong>{entry.n}</strong> {entry.label}
                              {index < items.length - 1 && (
                                <em aria-hidden="true">·</em>
                              )}
                            </span>
                          ));
                        })()}
                      </div>
                    </div>
                    <div
                      className="admin-schedule-day-bulk admin-schedule-segment"
                      role="group"
                      aria-label="Bulk action hari ini"
                    >
                      <button
                        type="button"
                        className={`admin-segment-button${fullyClosed ? " is-active" : ""}`}
                        onClick={() => setDayAll(selectedDay.date, "close")}
							disabled={fullyClosed || scheduleBusy}
                        aria-pressed={fullyClosed}
                      >
                        Tutup semua
                      </button>
                      <button
                        type="button"
                        className={`admin-segment-button${fullyOpen ? " is-active" : ""}`}
                        onClick={() => setDayAll(selectedDay.date, "open")}
							disabled={fullyOpen || scheduleBusy}
                        aria-pressed={fullyOpen}
                      >
                        Buka semua
                      </button>
                    </div>
                  </header>

                  <div className="admin-schedule-slots">
                    {selectedDay.slots.map((slot) => {
                      const locked = slot.status === "Booked" || slot.status === "Held" || slot.status === "Reschedule Hold";
                      const past = isSlotPast(selectedDay.date, slot.time);
                      const disabled = locked || past;
                      const isOpen = slot.status === "Available" && !past;
                      const statusClass = past
                        ? "is-past"
                        : slot.status === "Available"
                          ? "is-available"
                          : slot.status === "Closed"
                            ? "is-closed"
                            : slot.status === "Booked"
                              ? "is-full"
                              : "is-processing";
                      const statusLabel = past
                        ? "Lewat"
                        : slot.status === "Available"
                          ? "Tersedia"
                          : slot.status === "Closed"
                            ? "Ditutup"
                            : slot.overbooked
                              ? `Terisi (${slot.bookingCount})`
                              : slot.status === "Booked"
                              ? "Sudah terisi"
                              : "Sedang diproses";
                      const StatusIcon = past
                        ? Clock3
                        : slot.status === "Available"
                          ? Check
                          : slot.status === "Closed"
                            ? X
                            : slot.status === "Booked"
                              ? Lock
                              : Clock3;
                      const booking = locked
                        ? bookingByKey.get(`${selectedDay.date}|${slot.time}`)
                        : undefined;
                      // Deteksi multi-kloter: cari kloter ke-berapa dari booking ini
                      const segments = booking ? bookingSegments(booking) : [];
                      const isMultiKloter = segments.length > 1;
                      const kloterIndex = isMultiKloter
                        ? segments.findIndex((s) => s.time === slot.time) + 1
                        : 0;
                      const isHighlight =
                        newlyAddedSlot?.date === selectedDay.date &&
                        newlyAddedSlot?.time === slot.time;
                      return (
                        <div
                          key={slot.time}
                          className={`admin-schedule-slot ${statusClass}${
                            disabled ? " is-locked" : ""
                          }${slot.custom ? " is-custom" : ""}${
                            slot.overbooked ? " is-overbooked" : ""
                          }${
                            isMultiKloter && kloterIndex > 0 ? " is-multi-kloter" : ""
                          }${
                            isHighlight ? " is-highlight" : ""
                          }`}
                        >
                          <button
                            type="button"
                            className="admin-schedule-slot-main"
                            onClick={() => {
                              if (locked) {
                                setSlotInfoTime(slot.time);
                                return;
                              }
                              if (past) return;
                              toggleSlot(selectedDay.date, slot.time);
                            }}
							disabled={scheduleBusy || (past && !locked)}
                            aria-label={`${slot.time} ${statusLabel}${
                              isMultiKloter && kloterIndex > 0
                                ? `, Kloter ${kloterIndex} dari ${segments.length}`
                                : ""
                            }${
                              locked
                                ? ", klik untuk lihat detail booking"
                                : past
                                  ? ""
                                  : isOpen
                                    ? ", klik untuk menutup"
                                    : ", klik untuk membuka"
                            }`}
                          >
                            <Clock3 size={18} aria-hidden="true" />
                            <span className="admin-schedule-slot-text">
                              <strong>{slot.time}</strong>
                              <small>
                                <StatusIcon size={11} aria-hidden="true" /> {statusLabel}
                              </small>
                            </span>
                            {!disabled && (
                              <em className="admin-schedule-slot-action">
                                {isOpen ? "Tutup slot" : "Buka slot"}
                              </em>
                            )}
                            {locked && (
                              <em className="admin-schedule-slot-action">Lihat detail</em>
                            )}
                          </button>
                          {isMultiKloter && kloterIndex > 0 && (
                            <span className="admin-schedule-slot-kloter" aria-hidden="true">
                              K{kloterIndex}/{segments.length}
                            </span>
                          )}
                          {slot.custom && (
                            <span className="admin-schedule-slot-tag" aria-hidden="true">
                              Khusus
                            </span>
                          )}
                          {slot.custom && !locked && !past && (
                            <button
                              type="button"
								className="admin-schedule-slot-remove"
								onClick={() => removeCustomSlot(selectedDay.date, slot.time)}
								disabled={scheduleBusy}
								aria-label={`Hapus jam khusus ${slot.time}`}
                              title="Hapus jam khusus"
                            >
                              <X size={14} aria-hidden="true" />
                            </button>
                          )}
                          {slotInfoTime === slot.time && booking && (
                            <SlotBookingPopover
                              booking={booking}
                              onClose={() => setSlotInfoTime(null)}
                              onForceOpen={() => {
                                forceSetSlotStatus(selectedDay.date, slot.time, "Available");
                                setSlotInfoTime(null);
                              }}
                              onForceClose={() => {
                                forceSetSlotStatus(selectedDay.date, slot.time, "Closed");
                                setSlotInfoTime(null);
                              }}
                              onOpen={() => {
                                onOpenBooking(booking.code);
                                setSlotInfoTime(null);
                              }}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <form
                    className="admin-schedule-add"
					onSubmit={(event) => {
						event.preventDefault();
						if (scheduleBusy) return;
						addCustomSlot(selectedDay.date, customDraft);
					}}
                  >
                    <label className="admin-schedule-add-field">
                      <span>Tambah jam khusus</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="Contoh: 15.30"
                        value={customDraft}
                        onChange={(event) => {
                          setCustomDraft(event.target.value);
                          if (customError) setCustomError(null);
                        }}
                        list="admin-schedule-time-suggestions"
                        aria-invalid={Boolean(customError)}
                      />
                      <datalist id="admin-schedule-time-suggestions">
                        <option value="15.00" />
                        <option value="15.30" />
                        <option value="16.00" />
                        <option value="16.30" />
                        <option value="19.00" />
                        <option value="19.30" />
                      </datalist>
                    </label>
			<button
				type="submit"
				className="admin-pill-button admin-pill-button--primary"
				disabled={scheduleBusy}
			>
				Tambah
                    </button>
                    {customError && (
                      <small className="admin-schedule-add-error">{customError}</small>
                    )}
                    <small className="admin-schedule-add-hint">
                      Jam default {VISIT_TIME_SLOTS[0]}-{VISIT_TIME_SLOTS[VISIT_TIME_SLOTS.length - 1]}.
                      Tambahkan jam khusus jika ada keperluan di luar jam tersebut.
                    </small>
                  </form>
                </>
              );
            })()
          ) : (
            <div className="admin-schedule-empty">
              <CalendarDays size={28} aria-hidden="true" />
              <strong>Pilih tanggal</strong>
              <p>Pilih tanggal pada kalender untuk melihat dan mengatur slot.</p>
            </div>
          )}
        </div>
			</>
			)}
		</section>

		{savingLabel && (
			<div className="admin-schedule-toast admin-schedule-toast--saving" role="status" aria-live="polite">
				<InlineSpinner label={savingLabel} />
			</div>
		)}

      {showRangeModal && (
        <ScheduleRangeModal
          minDate={today}
          maxDate={maxScheduleDate}
          activeBookingsByDate={activeBookingsByDate}
          schedules={schedules}
          onClose={() => setShowRangeModal(false)}
          onConfirm={(params) => {
            applyRange(params);
            setShowRangeModal(false);
          }}
        />
      )}

      {confirmDialog && (
        <ScheduleConfirmDialog
          title={confirmDialog.title}
          body={confirmDialog.body}
          confirmLabel={confirmDialog.confirmLabel}
          variant={confirmDialog.confirmVariant}
          onCancel={() => setConfirmDialog(null)}
          onConfirm={() => {
            confirmDialog.onConfirm();
            setConfirmDialog(null);
          }}
        />
      )}
    </div>
  );
}

export function SlotBookingPopover({
  booking,
  onClose,
  onForceOpen,
  onForceClose,
  onOpen,
}: {
  booking: Booking;
  onClose: () => void;
  onForceOpen: () => void;
  onForceClose: () => void;
  onOpen: () => void;
}) {
  // Tutup popover saat klik di luar atau Esc.
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose();
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("mousedown", handleClick);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("mousedown", handleClick);
      window.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);
  return (
    <div ref={ref} className="admin-schedule-slot-popover" role="dialog">
      <header>
        <strong>{booking.code}</strong>
        <span className={`admin-schedule-slot-popover-status is-${booking.status.toLowerCase()}`}>
          {booking.status}
        </span>
      </header>
      <dl>
        <div>
          <dt>CP</dt>
          <dd>{booking.contactName}</dd>
        </div>
        <div>
          <dt>Rombongan</dt>
          <dd>
            {booking.institution} · {bookingKloterSummary(booking)}
          </dd>
        </div>
        <div>
          <dt>WhatsApp</dt>
          <dd>{booking.whatsapp}</dd>
        </div>
        <div>
          <dt>Jam</dt>
          <dd>{bookingTimeSummary(booking)}</dd>
        </div>
      </dl>
      <div className="admin-schedule-slot-popover-actions">
        <button type="button" className="admin-pill-button" onClick={onClose}>
          Tutup
        </button>
        <button type="button" className="admin-pill-button" onClick={onForceOpen}>
          Paksa buka
        </button>
        <button type="button" className="admin-pill-button admin-pill-button--danger" onClick={onForceClose}>
          Paksa tutup
        </button>
        <button
          type="button"
          className="admin-pill-button admin-pill-button--primary"
          onClick={onOpen}
        >
          Buka di Booking
        </button>
      </div>
    </div>
  );
}

export function ScheduleConfirmDialog({
  title,
  body,
  confirmLabel,
  variant,
  onCancel,
  onConfirm,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  variant?: "default" | "danger";
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
      if (event.key === "Enter") onConfirm();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onCancel, onConfirm]);
  return (
    <div className="admin-modal-backdrop" onClick={onCancel} role="presentation">
      <div
        className="admin-modal admin-modal--confirm"
        role="alertdialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <h2>{title}</h2>
        <p>{body}</p>
        <div className="admin-modal-actions">
          <button type="button" className="admin-pill-button" onClick={onCancel}>
            Batal
          </button>
          <button
            type="button"
            className={`admin-pill-button ${
              variant === "danger" ? "admin-pill-button--danger" : "admin-pill-button--primary"
            }`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ScheduleRangeModal({
  minDate,
  maxDate,
  activeBookingsByDate,
  schedules,
  onClose,
  onConfirm,
}: {
  minDate: Date;
  maxDate: Date;
  activeBookingsByDate: Map<string, number>;
  schedules: VisitDay[];
  onClose: () => void;
  onConfirm: (params: {
    from: string;
    to: string;
    weekdays: number[];
    action: "open" | "close";
  }) => void;
}) {
  const [from, setFrom] = useState(formatDateKey(minDate));
  const [to, setTo] = useState(formatDateKey(maxDate));
  // Default kosong agar admin sengaja memilih hari yang ingin diubah.
  // Tidak menebak intent (lihat juga quick-pick di bawah).
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [action, setAction] = useState<"open" | "close">("close");

  const dayLabels = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
  const dayOrder = [1, 2, 3, 4, 5, 6, 0];

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Preview: hitung jumlah hari yang akan diubah dan jumlah booking aktif
  // di rentang itu untuk peringatan.
  const preview = (() => {
    if (!from || !to) return null;
    const fromDate = parseDateKey(from);
    const toDate = parseDateKey(to);
    if (fromDate > toDate) return null;
    const set = new Set(weekdays);
    let days = 0;
    let bookingsInRange = 0;
    for (const day of schedules) {
      const d = parseDateKey(day.date);
      if (d < fromDate || d > toDate) continue;
      if (!set.has(d.getDay())) continue;
      days += 1;
      bookingsInRange += activeBookingsByDate.get(day.date) ?? 0;
    }
    return { days, bookingsInRange };
  })();

  const toggleWeekday = (value: number) => {
    setWeekdays((current) =>
      current.includes(value)
        ? current.filter((day) => day !== value)
        : [...current, value],
    );
  };

  const fromDateInput = formatDateKey(minDate);
  const toDateInput = formatDateKey(maxDate);
  const canSubmit =
    Boolean(from) &&
    Boolean(to) &&
    parseDateKey(from) <= parseDateKey(to) &&
    weekdays.length > 0;

  return (
    <div className="admin-modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="admin-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="schedule-range-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="admin-modal-head">
          <h2 id="schedule-range-title">Pengaturan rentang</h2>
          <button
            type="button"
            className="admin-modal-close"
            onClick={onClose}
            aria-label="Tutup"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </header>

        <div className="admin-modal-grid">
          <label className="admin-modal-field">
            <span>Dari tanggal</span>
            <input
              type="date"
              value={from}
              min={fromDateInput}
              max={toDateInput}
              onChange={(event) => setFrom(event.target.value)}
            />
          </label>
          <label className="admin-modal-field">
            <span>Sampai tanggal</span>
            <input
              type="date"
              value={to}
              min={fromDateInput}
              max={toDateInput}
              onChange={(event) => setTo(event.target.value)}
            />
          </label>
        </div>

        <fieldset className="admin-modal-fieldset">
          <legend>Hari yang dipilih</legend>
          <div className="admin-modal-quickpick">
            <button
              type="button"
              onClick={() => setWeekdays([1, 2, 3, 4])}
              aria-pressed={
                weekdays.length === 4 && [1, 2, 3, 4].every((d) => weekdays.includes(d))
              }
            >
              Hari kerja
            </button>
            <button
              type="button"
              onClick={() => setWeekdays([5, 6, 0])}
              aria-pressed={
                weekdays.length === 3 && [5, 6, 0].every((d) => weekdays.includes(d))
              }
            >
              Akhir pekan
            </button>
            <button
              type="button"
              onClick={() => setWeekdays([0, 1, 2, 3, 4, 5, 6])}
              aria-pressed={weekdays.length === 7}
            >
              Semua
            </button>
          </div>
          <div className="admin-modal-weekdays">
            {dayOrder.map((value) => (
              <label key={value}>
                <input
                  type="checkbox"
                  checked={weekdays.includes(value)}
                  onChange={() => toggleWeekday(value)}
                />
                <span>{dayLabels[value]}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="admin-modal-fieldset">
          <legend>Aksi</legend>
          <div
            className="admin-schedule-segment admin-modal-segment"
            role="radiogroup"
            aria-label="Aksi"
          >
            <button
              type="button"
              role="radio"
              aria-checked={action === "close"}
              className={`admin-segment-button${action === "close" ? " is-active" : ""}`}
              onClick={() => setAction("close")}
            >
              Tutup hari
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={action === "open"}
              className={`admin-segment-button${action === "open" ? " is-active" : ""}`}
              onClick={() => setAction("open")}
            >
              Buka hari
            </button>
          </div>
        </fieldset>

        <div className="admin-modal-preview">
          {weekdays.length === 0 ? null : preview ? (
            <p>
              Akan {action === "close" ? "menutup" : "membuka"} <strong>{preview.days}</strong>{" "}
              hari.
              {preview.bookingsInRange > 0 && action === "close" && (
                <>
                  {" "}
                  <strong>{preview.bookingsInRange}</strong> booking aktif tetap aman.
                </>
              )}
            </p>
          ) : (
            <p className="admin-modal-preview-error">Rentang tanggal belum valid.</p>
          )}
        </div>

        <div className="admin-modal-actions">
          <button type="button" className="admin-pill-button" onClick={onClose}>
            Batal
          </button>
          <button
            type="button"
            className={`admin-pill-button ${
              action === "close"
                ? "admin-pill-button--danger"
                : "admin-pill-button--primary"
            }`}
            disabled={!canSubmit}
            onClick={() =>
              canSubmit && onConfirm({ from, to, weekdays, action })
            }
          >
            {action === "close" ? "Tutup hari" : "Buka hari"}
          </button>
        </div>
      </div>
    </div>
  );
}

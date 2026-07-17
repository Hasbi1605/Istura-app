// Admin schedule manager + sub-dialogs. Extracted from App.tsx.
import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, Lock, X } from "lucide-react";
import type { Booking, SchedulePolicy, Slot, VisitDay, VisitStatus } from "../../domain/types";
import {
  bookingKloterSummary,
  bookingSegments,
  bookingTimeSummary,
  PUBLIC_EARLY_MAX_DAYS,
  PUBLIC_MIN_LEAD_DAYS,
} from "../../domain/booking";
import {
  addDays,
  addMonths,
  calendarWeekdays,
  createCalendarDays,
  formatDateKey,
  fullDayNames,
  formatLongDate,
  formatMonthTitle,
  isDefaultHoliday,
  isSameMonth,
  parseDateKey,
  startOfDay,
  startOfMonth,
} from "../../lib/date";
import {
  deleteScheduleSlot,
  fetchAdminSchedule,
  fetchSchedulePolicy,
  updateSchedulePolicy,
  upsertScheduleRange,
  upsertScheduleSlot,
} from "../../api/schedule";
import { apiVisitDayToLocal } from "../../api/adapters";
import { StatCard } from "../ui/StatCard";
import { InlineSpinner, SectionSkeleton, StatCardSkeleton } from "../ui/LoadingStates";

const bookableSlots = (slots: Slot[]): Slot[] => slots.filter((slot) => slot.time !== "12.00");

function closureReasonLabel(day?: VisitDay): string | null {
  return day?.closureReason?.label ?? day?.holiday?.label ?? null;
}

function closureReasonBadge(day?: VisitDay): string | null {
  const type = day?.closureReason?.type ?? day?.holiday?.type;
  if (type === "national_holiday") return "Libur Nasional";
  if (type === "collective_leave") return "Cuti Bersama";
  if (type === "operational_closed") return "Libur";
  return null;
}

function slotClosureLabel(slot: Slot, day?: VisitDay): string | null {
  return slot.closureReason?.label ?? closureReasonLabel(day);
}

const DEFAULT_SCHEDULE_POLICY: SchedulePolicy = {
  openWeekdays: [1, 2, 3, 4, 5],
  closedLabels: {
    "0": "Akhir pekan",
    "1": "Libur operasional",
    "2": "Libur operasional",
    "3": "Libur operasional",
    "4": "Libur operasional",
    "5": "Libur operasional",
    "6": "Akhir pekan",
  },
  weekdayOptions: [1, 2, 3, 4, 5, 6, 0].map((value) => ({
    value,
    label: fullDayNames[value],
    isOpen: [1, 2, 3, 4, 5].includes(value),
    closedLabel:
      value === 0 || value === 6
        ? "Akhir pekan"
        : "Libur operasional",
  })),
};

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

function sameWeekdays(left: number[], right: number[]) {
  const a = [...left].sort().join(",");
  const b = [...right].sort().join(",");
  return a === b;
}

function weekdaySummary(weekdays: number[]) {
  return DAY_ORDER.filter((day) => weekdays.includes(day))
    .map((day) => fullDayNames[day])
    .join(", ");
}

export function AdminScheduleManager({
	schedules,
	bookings,
	loading = false,
	onSchedulesChange,
  onOpenBooking,
  readOnly = false,
}: {
	schedules: VisitDay[];
	bookings: Booking[];
	loading?: boolean;
	onSchedulesChange: (next: VisitDay[]) => void;
  onOpenBooking: (bookingCode: string) => void;
  readOnly?: boolean;
}) {
	  const [now, setNow] = useState(() => new Date());
	  const today = startOfDay(now);
	  const minMonth = startOfMonth(today);
  const maxScheduleDate = addMonths(today, 2);
  const maxMonth = startOfMonth(maxScheduleDate);
  const earlyMaxDate = addDays(today, PUBLIC_EARLY_MAX_DAYS);
  const earlyMaxKey = formatDateKey(earlyMaxDate);
  const todayKeyEarly = formatDateKey(today);
  const isEarlyDateKey = (dateKey: string) => dateKey >= todayKeyEarly && dateKey <= earlyMaxKey;
  const earlyLabel = PUBLIC_EARLY_MAX_DAYS === 2 ? "H/H+1/H+2" : `H..H+${PUBLIC_EARLY_MAX_DAYS}`;
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
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [schedulePolicy, setSchedulePolicy] = useState<SchedulePolicy>(DEFAULT_SCHEDULE_POLICY);
  const [policyError, setPolicyError] = useState<string | null>(null);
  // Confirm dialog generic (#3).
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    body: string;
    confirmLabel: string;
    confirmVariant?: "default" | "danger";
    onConfirm: () => void;
  } | null>(null);
	  // Sumber kebenaran "sekarang" untuk jam lewat dan batas kalender. Karena
	  // diperbarui per menit, halaman yang dibiarkan terbuka ikut berganti hari.
	  useEffect(() => {
	    if (!firstActive) return;
	    if (!selectedDate || selectedDate < todayKey || !scheduleByDate.has(selectedDate)) {
	      setSelectedDate(firstActive);
	    }
	  }, [firstActive, scheduleByDate, selectedDate, todayKey]);
	  useEffect(() => {
	    const id = window.setInterval(() => setNow(new Date()), 60_000);
	    return () => window.clearInterval(id);
	  }, []);
	  const minMonthKey = formatDateKey(minMonth);
	  const maxMonthKey = formatDateKey(maxMonth);
	  useEffect(() => {
	    setVisibleMonth((current) => {
	      if (current < minMonth) return minMonth;
	      if (current > maxMonth) return maxMonth;
	      return current;
	    });
	  }, [maxMonthKey, minMonthKey]);
  useEffect(() => {
    let active = true;
    fetchSchedulePolicy()
      .then((policy) => {
        if (!active) return;
        setSchedulePolicy(policy);
        setPolicyError(null);
      })
      .catch(() => {
        if (!active) return;
        setPolicyError("Gagal memuat pola operasional. Kalender tetap memakai data jadwal terbaru.");
      });
    return () => {
      active = false;
    };
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

  const applySchedulePolicy = (payload: {
    openWeekdays: number[];
    closedLabels: Record<string, string>;
  }) => {
    if (savingLabel) return;
    setSavingLabel("Menyimpan pola operasional...");
    setPolicyError(null);
    updateSchedulePolicy(payload)
      .then((policy) => {
        setSchedulePolicy(policy);
        setShowPolicyModal(false);
        return refreshFromApi();
      })
      .catch(() => {
        setPolicyError("Gagal menyimpan pola operasional. Coba lagi.");
      })
      .finally(() => setSavingLabel(null));
  };

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

    if (nextStatus === "Available" && isEarlyDateKey(dayDate)) {
      const dayLabel = day?.label ?? dayDate;
      setConfirmDialog({
        title: `Buka slot ${earlyLabel} untuk publik?`,
        body: `Slot ${dayLabel} jam ${time} termasuk ${earlyLabel} (minimal publik sekarang H+${PUBLIC_MIN_LEAD_DAYS}). Jika dibuka, pengunjung bisa langsung booking jam ini. Lanjutkan?`,
        confirmLabel: "Ya, buka untuk publik",
        onConfirm: () => {
          const next = schedules.map((d) =>
            d.date === dayDate
              ? {
                  ...d,
                  slots: d.slots.map((s) => (s.time === time ? { ...s, status: nextStatus } : s)),
                }
              : d,
          );
          applyPersistedChange(`Slot ${time} diperbarui`, next, () => upsertScheduleSlot(dayDate, time, nextStatus));
        },
      });
      return;
    }

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
      if (willClose >= 3 || activeBooking > 0) {
        setConfirmDialog({
          title: "Tutup semua slot?",
          body:
            `Pada ${day.label}, ${willClose} slot tersedia akan ditutup. ` +
            (activeBooking > 0
              ? `Ada ${activeBooking} booking aktif di tanggal ini yang tetap ditampilkan sebagai terisi.`
              : "Slot yang sudah ada booking tidak terpengaruh."),
          confirmLabel: "Tutup semua",
          confirmVariant: "danger",
          onConfirm: () => performSetDayAll(dayDate, "close"),
        });
        return;
      }
    }
    if (action === "open" && isEarlyDateKey(dayDate)) {
      const willOpen = day.slots.filter(
        (slot) => slot.status !== "Available" && !isSlotPast(dayDate, slot.time) && slot.status !== "Booked" && slot.status !== "Held" && slot.status !== "Reschedule Hold",
      ).length;
      if (willOpen > 0) {
        setConfirmDialog({
          title: `Buka ${earlyLabel} untuk publik?`,
          body: `Anda akan membuka ${willOpen} slot pada ${day.label} yang termasuk ${earlyLabel}. Slot ini akan langsung bisa dibooking publik (minimal normal H+${PUBLIC_MIN_LEAD_DAYS}). Lanjutkan?`,
          confirmLabel: "Ya, buka untuk publik",
          onConfirm: () => performSetDayAll(dayDate, "open"),
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
    if (isEarlyDateKey(dayDate)) {
      const day = scheduleByDate.get(dayDate);
      setConfirmDialog({
        title: `Buka jam khusus ${earlyLabel} untuk publik?`,
        body: `Jam khusus ${normalized} pada ${day?.label ?? dayDate} termasuk ${earlyLabel} dan akan langsung bisa dibooking publik. Lanjutkan?`,
        confirmLabel: "Ya, buka untuk publik",
        onConfirm: () => {
          setCustomError(null);
          setCustomDraft("");
          const next = schedules.map((d) =>
            d.date === dayDate
              ? {
                  ...d,
                  slots: sortSlots([...d.slots, { time: normalized, status: "Available", custom: true }]),
                }
              : d,
          );
          applyPersistedChange(`Jam khusus ${normalized} ditambahkan`, next, () =>
            upsertScheduleSlot(dayDate, normalized, "Available"),
          );
          setNewlyAddedSlot({ date: dayDate, time: normalized });
        },
      });
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

    if (action === "open") {
      const overlapsEarly = !(params.to < todayKeyEarly || params.from > earlyMaxKey);
      if (overlapsEarly) {
        // Hitung estimasi slot yang akan jadi publik
        let earlyCount = 0;
        for (const day of schedules) {
          if (day.date < params.from || day.date > params.to) continue;
          if (!isEarlyDateKey(day.date)) continue;
          const d = parseDateKey(day.date);
          if (!weekdaySet.has(d.getDay())) continue;
          if (day.holiday) continue;
          const openable = day.slots.filter(
            (slot) =>
              slot.status !== "Booked" &&
              slot.status !== "Held" &&
              slot.status !== "Reschedule Hold" &&
              !isSlotPast(day.date, slot.time),
          ).length;
          earlyCount += openable;
        }
        if (earlyCount > 0) {
          setConfirmDialog({
            title: `Buka rentang termasuk ${earlyLabel} untuk publik?`,
            body: `Rentang ${params.from} s/d ${params.to} mencakup ${earlyLabel} (${earlyCount} slot potensial). Slot ${earlyLabel} yang dibuka akan langsung bisa dibooking publik (minimal H+${PUBLIC_MIN_LEAD_DAYS}). Lanjutkan?`,
            confirmLabel: "Ya, buka termasuk H/H+1/H+2",
            onConfirm: () => {
              doApplyRange();
            },
          });
          return;
        }
      }
    }

    const doApplyRange = () => {
      const next = schedules.map((day) => {
        const d = parseDateKey(day.date);
        if (d < fromDate || d > toDate) return day;
        if (!weekdaySet.has(d.getDay())) return day;
        if (action === "open" && day.holiday) return day;
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
        action === "open" ? "Rentang tanggal dibuka" : "Rentang tanggal ditutup",
        next,
        () =>
          upsertScheduleRange({
            from: params.from,
            to: params.to,
            weekdays: params.weekdays,
            status: action === "open" ? "Available" : "Closed",
          }),
      );
    };

    doApplyRange();
  };

  const totalAvailable = schedules.reduce(
    (sum, day) => sum + bookableSlots(day.slots).filter((slot) => slot.status === "Available").length,
    0,
  );
  const totalBooked = schedules.reduce(
    (sum, day) => sum + bookableSlots(day.slots).filter((slot) => slot.status === "Booked").length,
    0,
  );
  // Hari aktif = hari (>= hari ini) yang punya minimal satu slot Available.
  const totalActiveDays = schedules.reduce(
    (sum, day) =>
      parseDateKey(day.date) >= today &&
      bookableSlots(day.slots).some((slot) => slot.status === "Available")
        ? sum + 1
        : sum,
    0,
  );

  // KPI hari ini untuk kartu "Hari ini".
	const todaySchedule = scheduleByDate.get(todayKey);
	const todayAvailable = todaySchedule ? bookableSlots(todaySchedule.slots).filter((s) => s.status === "Available").length : 0;
	const scheduleBusy = Boolean(savingLabel);
  const defaultOpenWeekdays = schedulePolicy.openWeekdays;

  const operationalSummary = weekdaySummary(defaultOpenWeekdays) || "Belum diatur";

  const selectedSlots = selectedDay ? bookableSlots(selectedDay.slots) : [];
  const dayKpi = selectedDay
    ? {
        available: selectedSlots.filter((slot) => slot.status === "Available").length,
        booked: selectedSlots.filter((slot) => slot.status === "Booked").length,
        held: selectedSlots.filter((slot) => slot.status === "Held").length,
        closed: selectedSlots.filter((slot) => slot.status === "Closed").length,
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

		<section className="admin-card admin-schedule-policy-card">
			<div>
				<strong>Pola operasional default</strong>
				<p>Hari buka default: {operationalSummary}.</p>
				{policyError && <small className="admin-info-note">{policyError}</small>}
			</div>
			{!readOnly && (
				<button
					type="button"
					className="admin-pill-button"
					disabled={scheduleBusy}
					onClick={() => setShowPolicyModal(true)}
				>
					Atur pola
				</button>
			)}
		</section>

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
			{!readOnly && <button
				type="button"
				className="admin-pill-button"
				disabled={scheduleBusy}
				onClick={() => setShowRangeModal(true)}
            >
              Pengaturan rentang
            </button>}
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
              const slots = day ? bookableSlots(day.slots) : [];
              const totalSlots = slots.length;
              const openSlots = slots.filter((slot) => slot.status === "Available").length;
              const closedSlots = slots.filter((slot) => slot.status === "Closed").length;
              // Hari di luar pola operasional default ditandai berbeda dari
              // hari operasional yang sengaja ditutup admin.
              const isDefaultOff = isDefaultHoliday(cell.date, defaultOpenWeekdays);
              const isNationalHoliday = Boolean(day?.holiday);
              const dayClosureLabel = closureReasonLabel(day);
              const dayClosureBadge = closureReasonBadge(day);
              const fullyClosed = totalSlots > 0 && closedSlots === totalSlots;

              const summaryClass = !inMonth
                ? "is-outside"
                : isPast
                  ? "is-past"
                  : !day
                    ? "is-past"
                    : fullyClosed
                      ? isDefaultOff || isNationalHoliday
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
                            : dayClosureLabel && fullyClosed
                              ? `, ${dayClosureLabel}, klik untuk membuka`
                              : `, ${openSlots} slot tersedia`
                        }`
                      : ""
                  }
                >
                  <span className="admin-schedule-cal-num">{cell.date.getDate()}</span>
                  {dayClosureBadge && <small className="admin-schedule-cal-note">{dayClosureBadge}</small>}
                </button>
              );
            })}
          </div>
          <div className="admin-schedule-cal-legend" aria-hidden="true">
            <span><i className="swatch is-open" /> Buka</span>
            <span><i className="swatch is-full" /> Penuh</span>
            <span><i className="swatch is-closed" /> Tutup</span>
            <span><i className="swatch is-holiday" /> Libur nasional/default</span>
          </div>
        </div>

        <div className="admin-schedule-day-panel">
          {selectedDay && dayKpi ? (
            (() => {
              const totalSlots = selectedSlots.length;
              const selectedClosureLabel = closureReasonLabel(selectedDay);
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
                      {selectedClosureLabel && (
                        <small className="admin-schedule-day-reason">{selectedClosureLabel}</small>
                      )}
                    </div>
                    <div
                      className="admin-schedule-day-bulk admin-schedule-segment"
                      role="group"
                      aria-label="Bulk action hari ini"
                    >
                      {!readOnly && (<><button
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
                      </button></>)}
                    </div>
                  </header>

                  <div className="admin-schedule-slots">
                    {selectedSlots.map((slot) => {
                      const locked = slot.status === "Booked" || slot.status === "Held" || slot.status === "Reschedule Hold";
                      const past = isSlotPast(selectedDay.date, slot.time);
                      const disabled = locked || past;
                      const isOpen = slot.status === "Available" && !past;
                      const closedLabel = slotClosureLabel(slot, selectedDay);
                      const manuallyClosedActiveSlot =
                        slot.status !== "Closed" && slot.closureReason?.type === "manual_closed";
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
                            ? closedLabel ?? "Ditutup"
                            : slot.overbooked
                              ? `Terisi (${slot.bookingCount})${manuallyClosedActiveSlot ? " · ditutup" : ""}`
                              : slot.status === "Booked"
                              ? `Sudah terisi${manuallyClosedActiveSlot ? " · ditutup" : ""}`
                              : `Sedang diproses${manuallyClosedActiveSlot ? " · ditutup" : ""}`;
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
                      const showPublicBadge =
                        isEarlyDateKey(selectedDay.date) &&
                        slot.status === "Available" &&
                        slot.publicStatus === "Available" &&
                        !past;
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
                              if (readOnly) return;
                              if (locked) {
                                setSlotInfoTime(slot.time);
                                return;
                              }
                              if (past) return;
                              toggleSlot(selectedDay.date, slot.time);
                            }}
							disabled={readOnly || scheduleBusy || (past && !locked)}
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
                          {showPublicBadge && (
                            <span className="admin-schedule-slot-tag is-public" aria-hidden="true">
                              Publik
                            </span>
                          )}
                          {slot.custom && !locked && !past && !readOnly && (
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

                  {!readOnly && <form
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
                      Jam default 08.00-11.00 dan 13.00-14.00.
                      Tambahkan jam khusus jika ada keperluan di luar jam tersebut.
                    </small>
                  </form>}
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

      {showPolicyModal && (
        <SchedulePolicyModal
          policy={schedulePolicy}
          busy={scheduleBusy}
          onClose={() => setShowPolicyModal(false)}
          onConfirm={applySchedulePolicy}
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
  onOpen,
}: {
  booking: Booking;
  onClose: () => void;
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

export function SchedulePolicyModal({
  policy,
  busy,
  onClose,
  onConfirm,
}: {
  policy: SchedulePolicy;
  busy: boolean;
  onClose: () => void;
  onConfirm: (payload: { openWeekdays: number[]; closedLabels: Record<string, string> }) => void;
}) {
  const [openWeekdays, setOpenWeekdays] = useState<number[]>(policy.openWeekdays);
  const [closedLabels, setClosedLabels] = useState<Record<string, string>>(policy.closedLabels);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  useEffect(() => {
    setOpenWeekdays(policy.openWeekdays);
    setClosedLabels(policy.closedLabels);
  }, [policy]);

  const toggleWeekday = (value: number) => {
    setOpenWeekdays((current) =>
      current.includes(value)
        ? current.filter((day) => day !== value)
        : DAY_ORDER.filter((day) => [...current, value].includes(day)),
    );
  };

  const setLabel = (weekday: number, value: string) => {
    setClosedLabels((current) => ({
      ...current,
      [String(weekday)]: value,
    }));
  };

  const canSubmit = openWeekdays.length > 0 && !busy;

  return (
    <div className="admin-modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="admin-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="schedule-policy-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="admin-modal-head">
          <h2 id="schedule-policy-title">Pola operasional default</h2>
          <button
            type="button"
            className="admin-modal-close"
            onClick={onClose}
            aria-label="Tutup"
            disabled={busy}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </header>

        <fieldset className="admin-modal-fieldset">
          <legend>Hari buka default</legend>
          <div className="admin-modal-quickpick">
            <button
              type="button"
              onClick={() => setOpenWeekdays([1, 2, 3, 4, 5])}
              aria-pressed={sameWeekdays(openWeekdays, [1, 2, 3, 4, 5])}
              disabled={busy}
            >
              Senin-Jumat
            </button>
          </div>
          <div className="admin-modal-weekdays">
            {DAY_ORDER.map((value) => (
              <label key={value}>
                <input
                  type="checkbox"
                  checked={openWeekdays.includes(value)}
                  onChange={() => toggleWeekday(value)}
                  disabled={busy}
                />
                <span>{fullDayNames[value]}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="admin-modal-fieldset">
          <legend>Alasan tutup default</legend>
          <div className="admin-modal-grid">
            {DAY_ORDER.map((value) => {
              const isOpen = openWeekdays.includes(value);
              return (
                <label className="admin-modal-field" key={value}>
                  <span>{fullDayNames[value]}</span>
                  <input
                    value={isOpen ? "-" : closedLabels[String(value)] ?? ""}
                    placeholder={isOpen ? "" : "Libur operasional"}
                    onChange={(event) => setLabel(value, event.target.value)}
                    disabled={busy || isOpen}
                    maxLength={80}
                  />
                </label>
              );
            })}
          </div>
          {openWeekdays.length === 0 && (
            <p className="admin-modal-preview-error">Minimal satu hari operasional harus dipilih.</p>
          )}
        </fieldset>

        <div className="admin-modal-preview">
          <p>
            Kalender default akan membuka <strong>{weekdaySummary(openWeekdays) || "belum ada hari"}</strong>.
          </p>
        </div>

        <div className="admin-modal-actions">
          <button type="button" className="admin-pill-button" onClick={onClose} disabled={busy}>
            Batal
          </button>
          <button
            type="button"
            className="admin-pill-button admin-pill-button--primary"
            disabled={!canSubmit}
            onClick={() => canSubmit && onConfirm({ openWeekdays, closedLabels })}
          >
            Simpan pola
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
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [action, setAction] = useState<"open" | "close">("close");

  useEffect(() => {
    if (action === "open") {
      const safeFrom = formatDateKey(addDays(minDate, PUBLIC_MIN_LEAD_DAYS));
      if (from === formatDateKey(minDate) || parseDateKey(from) < parseDateKey(safeFrom)) {
        // Jangan paksa kalau admin sudah pilih manual lebih jauh
        // tapi geser minimal ke H+3 untuk cegah accident H/H+1/H+2
        if (from < safeFrom) setFrom(safeFrom);
      }
    }
  }, [action, minDate, from]);

  const dayLabels = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
  const dayOrder = DAY_ORDER;

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
    let holidaysInRange = 0;
    let earlyInRange = 0;
    const todayDate = startOfDay(new Date());
    const earlyMax = addDays(todayDate, PUBLIC_EARLY_MAX_DAYS);
    for (const day of schedules) {
      const d = parseDateKey(day.date);
      if (d < fromDate || d > toDate) continue;
      if (!set.has(d.getDay())) continue;
      days += 1;
      bookingsInRange += activeBookingsByDate.get(day.date) ?? 0;
      if (day.holiday) holidaysInRange += 1;
      if (d >= todayDate && d <= earlyMax) earlyInRange += 1;
    }
    return { days, bookingsInRange, holidaysInRange, earlyInRange };
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
          <p className="admin-modal-helper">
            Mengubah tanggal tertentu saja (pengecualian). Untuk mengatur hari buka
            rutin, gunakan <strong>Pola operasional default</strong>.
          </p>
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
            <div>
              <p>
                Akan {action === "close" ? "menutup" : "membuka"} <strong>{preview.days}</strong>{" "}
                hari.
                {preview.bookingsInRange > 0 && action === "close" && (
                  <>
                    {" "}
                    <strong>{preview.bookingsInRange}</strong> booking aktif tetap aman.
                  </>
                )}
                {action === "open" && preview.holidaysInRange > 0 && (
                  <>
                    {" "}
                    <strong>{preview.holidaysInRange}</strong> tanggal merah nasional dilewati
                    (tetap tutup).
                  </>
                )}
              </p>
              {action === "open" && preview.earlyInRange > 0 && (
                <p className="admin-modal-preview-error" style={{ marginTop: 6 }}>
                  ⚠️ Termasuk <strong>{preview.earlyInRange}</strong> hari H/H+1/H+2 (sampai {formatDateKey(addDays(startOfDay(new Date()), PUBLIC_EARLY_MAX_DAYS))}) yang akan langsung bisa dibooking publik (minimal H+{PUBLIC_MIN_LEAD_DAYS}). Pastikan ini disengaja.
                </p>
              )}
            </div>
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

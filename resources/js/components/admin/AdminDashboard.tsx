import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ClipboardCheck,
  Clock3,
  FileText,
  ImageDown,
  Star,
} from "lucide-react";
import type { AdminTab, Booking, Feedback } from "../../domain/types";
import {
  formatDateKey,
  formatLongDate,
  fullDayNames,
  monthNames,
  parseDateKey,
  startOfDay,
} from "../../lib/date";
import { bookingTimeSummary, parseSubmittedAt, sortBookings } from "../../domain/booking";
import { StatCard } from "../ui/StatCard";
import { StatusBadge } from "../ui/StatusBadge";
import { MonthlyReportModal } from "./ExportModals";
import { WeeklyPosterModal } from "./WeeklyPosterModal";
import { InlineSpinner, SectionSkeleton, StatCardSkeleton } from "../ui/LoadingStates";

const AGENDA_SLOT_DURATION_MINUTES = 60;
const AGENDA_CLOCK_REFRESH_MS = 60_000;

type AgendaVisualPhase = "upcoming" | "ongoing" | "completed" | "reschedule";

const visitDateTime = (dateKey: string, time: string): Date | null => {
  const match = time.match(/^(\d{2})\.(\d{2})$/);
  if (!match) return null;

  const date = parseDateKey(dateKey);
  date.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return date;
};

const addMinutes = (date: Date, minutes: number) =>
  new Date(date.getTime() + minutes * 60_000);

export function AdminDashboard({
  bookings,
	feedbacks,
	loading = false,
	onJumpTab,
  adminName,
}: {
	bookings: Booking[];
	feedbacks: Feedback[];
	loading?: boolean;
	onJumpTab: (tab: AdminTab) => void;
  adminName?: string;
}) {
  const [showReportModal, setShowReportModal] = useState(false);
  const [showPosterModal, setShowPosterModal] = useState(false);
  const [agendaNow, setAgendaNow] = useState(() => new Date());

  useEffect(() => {
    const intervalId = window.setInterval(
      () => setAgendaNow(new Date()),
      AGENDA_CLOCK_REFRESH_MS,
    );
    return () => window.clearInterval(intervalId);
  }, []);

  const today = startOfDay(agendaNow);
  const todayKey = formatDateKey(today);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowKey = formatDateKey(tomorrow);

  const pendingBookings = sortBookings(
    bookings.filter((booking) => booking.status === "Pending"),
    "smart",
  );
  const acceptedBookings = bookings.filter((booking) => booking.status === "Accepted");
  const rescheduleBookings = bookings.filter((booking) => booking.status === "Reschedule");

  const pendingCount = pendingBookings.length;
  const heroPending = pendingBookings[0];

  // Agenda = kunjungan terkonfirmasi/dalam proses dengan tanggal di depan.
  // Untuk Reschedule, gunakan tanggal usulan baru sebagai acuan.
  type AgendaItem = Booking & {
    sortKey: string;
    displayDate: string;
    displayDateLabel: string;
    displayTime: string;
  };
  const agendaItems: AgendaItem[] = [...acceptedBookings, ...rescheduleBookings]
    .map((booking) => {
      const isReschedule =
        booking.status === "Reschedule" && booking.proposedDate && booking.proposedTime;
      const displayDate = isReschedule ? booking.proposedDate! : booking.date;
      const displayDateLabel = isReschedule
        ? booking.proposedDateLabel ?? booking.dateLabel
        : booking.dateLabel;
      const displayTime = isReschedule ? booking.proposedTime! : booking.time;
      return {
        ...booking,
        displayDate,
        displayDateLabel,
        displayTime,
        sortKey: `${displayDate}T${displayTime}`,
      };
    })
    .filter((item) => parseDateKey(item.displayDate) >= today)
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  const todayVisits = agendaItems.filter((item) => item.displayDate === todayKey);

  // Total kunjungan minggu berjalan (Accepted + Completed + Reschedule) —
  // sudut pandang planning untuk admin: berapa kunjungan akan/telah terjadi
  // minggu ini. Reschedule ikut dihitung memakai tanggal usulan baru kalau
  // tersedia, sehingga distribusi harian mencerminkan rencana terkini.
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);

  const getEffectiveVisitDate = (booking: Booking) =>
    booking.status === "Reschedule" && booking.proposedDate
      ? booking.proposedDate
      : booking.date;

  const isCountableForWeek = (booking: Booking) =>
    booking.status === "Accepted" ||
    booking.status === "Completed" ||
    booking.status === "Reschedule";

  // Semua kunjungan dalam rentang minggu berjalan, sudah dipetakan ke
  // tanggal/jam efektif. Dipakai sekaligus untuk hitungan total, distribusi
  // harian, dan navigasi antar hari di strip "Minggu ini".
  type WeekVisit = Booking & {
    displayDate: string;
    displayDateLabel: string;
    displayTime: string;
    sortKey: string;
  };
  const weekVisits: WeekVisit[] = bookings
    .filter((booking) => {
      if (!isCountableForWeek(booking)) return false;
      const d = parseDateKey(getEffectiveVisitDate(booking));
      return d >= startOfWeek && d <= endOfWeek;
    })
    .map((booking) => {
      const isReschedule =
        booking.status === "Reschedule" && booking.proposedDate && booking.proposedTime;
      const displayDate = isReschedule ? booking.proposedDate! : booking.date;
      const displayDateLabel = isReschedule
        ? booking.proposedDateLabel ?? booking.dateLabel
        : booking.dateLabel;
      const displayTime = isReschedule ? booking.proposedTime! : booking.time;
      return {
        ...booking,
        displayDate,
        displayDateLabel,
        displayTime,
        sortKey: `${displayDate}T${displayTime}`,
      };
    })
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  const visitsThisWeek = weekVisits.length;

  // Distribusi per hari untuk strip "Minggu ini" (Min..Sab). Hari yang sudah
  // lewat ditampilkan redup, hari ini ditandai, hari kosong pakai "—".
  const weekDistribution = Array.from({ length: 7 }, (_, offset) => {
    const dayDate = new Date(startOfWeek);
    dayDate.setDate(startOfWeek.getDate() + offset);
    const key = formatDateKey(dayDate);
    const count = weekVisits.filter((visit) => visit.displayDate === key).length;
    return {
      key,
      date: dayDate,
      count,
      isToday: key === todayKey,
      isPast: dayDate < today,
    };
  });

  // Hari yang sedang dijelajahi admin di strip minggu. Default-nya hari ini,
  // tapi admin bisa klik hari lain untuk melihat agenda harinya tanpa pindah
  // tab. Kalau tanggal tersimpan tidak lagi di minggu berjalan (misal user
  // membuka dashboard di awal minggu baru), fallback ke hari ini.
  const [selectedDayKey, setSelectedDayKey] = useState(todayKey);
  const isSelectedInWeek = weekDistribution.some((day) => day.key === selectedDayKey);
  const activeDayKey = isSelectedInWeek ? selectedDayKey : todayKey;
  const activeDayInfo =
    weekDistribution.find((day) => day.key === activeDayKey) ?? weekDistribution[today.getDay()];
  const activeDayDate = activeDayInfo.date;

  // Heading kompak yang muncul di header detail hari aktif. Untuk hari
  // istimewa (hari ini / besok) cukup label singkat; untuk hari lain pakai
  // "Selasa, 26 Mei" supaya tetap self-contained tanpa ngintip ke strip.
  const activeDayHeading = activeDayInfo.isToday
    ? "Hari ini"
    : activeDayKey === tomorrowKey
      ? "Besok"
      : `${fullDayNames[activeDayDate.getDay()]}, ${activeDayDate.getDate()} ${monthNames[activeDayDate.getMonth()]}`;

  // Subline status temporal supaya admin yang menjelajah ke hari lain tidak
  // bingung apakah hari itu sudah lewat / akan datang. Untuk Hari ini & Besok
  // kita pakai tanggal lengkap (heading sudah kontekstual).
  const activeDaySubline =
    activeDayInfo.isToday || activeDayKey === tomorrowKey
      ? `${fullDayNames[activeDayDate.getDay()]}, ${activeDayDate.getDate()} ${monthNames[activeDayDate.getMonth()]}`
      : activeDayInfo.isPast
        ? "Sudah lewat"
        : "Akan datang";

  const activeDayStatusKey: "today" | "past" | "future" = activeDayInfo.isToday
    ? "today"
    : activeDayInfo.isPast
      ? "past"
      : "future";

  // Label fallback untuk pesan empty-state ("tidak ada kunjungan pada
  // <hari>"). Sengaja terpisah dari heading supaya kalimat tetap natural.
  const activeDayShortLabel = activeDayInfo.isToday
    ? "hari ini"
    : activeDayKey === tomorrowKey
      ? "besok"
      : fullDayNames[activeDayDate.getDay()].toLowerCase();

  const selectedDayVisits = weekVisits.filter((visit) => visit.displayDate === activeDayKey);

  const getAgendaVisualPhase = (item: WeekVisit): AgendaVisualPhase => {
    if (item.status === "Completed") return "completed";
    if (item.status === "Reschedule") return "reschedule";

    const segmentStarts = (item.segments?.length ? item.segments : [item])
      .map((segment) => visitDateTime(segment.date, segment.time))
      .filter((date): date is Date => date !== null);
    const isOngoing = segmentStarts.some(
      (start) => agendaNow >= start && agendaNow < addMinutes(start, AGENDA_SLOT_DURATION_MINUTES),
    );

    return isOngoing ? "ongoing" : "upcoming";
  };

  // Rentang minggu untuk header card, mis. "24 – 30 Mei 2026". Tetap ramah
  // saat minggu menjorok ke bulan / tahun berbeda.
  const weekRangeLabel = (() => {
    const s = startOfWeek;
    const e = endOfWeek;
    if (s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth()) {
      return `${s.getDate()} – ${e.getDate()} ${monthNames[s.getMonth()]} ${s.getFullYear()}`;
    }
    if (s.getFullYear() === e.getFullYear()) {
      return `${s.getDate()} ${monthNames[s.getMonth()].slice(0, 3)} – ${e.getDate()} ${monthNames[e.getMonth()].slice(0, 3)} ${s.getFullYear()}`;
    }
    return `${s.getDate()} ${monthNames[s.getMonth()].slice(0, 3)} ${s.getFullYear()} – ${e.getDate()} ${monthNames[e.getMonth()].slice(0, 3)} ${e.getFullYear()}`;
  })();

  const averageRating = feedbacks.length
    ? (feedbacks.reduce((sum, feedback) => sum + feedback.rating, 0) / feedbacks.length).toFixed(1)
    : "0.0";

  // Feedback urut kronologis (terbaru dulu). Rating rendah tetap dapat
  // styling .is-low + badge "Perlu tindak lanjut" sehingga tidak hilang.
  const sortedFeedbacks = [...feedbacks].sort(
    (a, b) =>
      parseSubmittedAt(b.submittedAt ?? "").getTime() -
      parseSubmittedAt(a.submittedAt ?? "").getTime(),
  );
  const recentFeedbacks = sortedFeedbacks.slice(0, 3);
  const lowRatingCount = sortedFeedbacks.filter((feedback) => feedback.rating <= 3).length;

  return (
    <div className="admin-cms-page admin-dashboard">
		<div className="admin-heading">
			<div>
				<h1>Dashboard</h1>
				<p>Ringkasan operasional kunjungan ISTURA hari ini.</p>
				{loading && <InlineSpinner label="Memuat data operasional" />}
			</div>
        <div className="admin-heading-actions">
          <button
            type="button"
            className="booking-export-button"
            onClick={() => setShowReportModal(true)}
            title="Cetak laporan eksekutif (PDF)"
          >
            <FileText size={14} aria-hidden="true" />
            Laporan Bulanan
          </button>
        </div>
      </div>

		<div className="admin-stats" aria-busy={loading}>
			{loading && bookings.length === 0 && feedbacks.length === 0 ? (
				<StatCardSkeleton />
			) : (
				<>
					<StatCard label="Menunggu" value={pendingCount} />
					<StatCard label="Hari ini" value={todayVisits.length} />
					<StatCard label="Minggu ini" value={visitsThisWeek} />
					<StatCard label="Rating Rata-rata" value={averageRating} />
				</>
			)}
		</div>

      {heroPending ? (
        <section className="admin-dashboard-alert" role="status">
          <span className="admin-dashboard-alert-icon" aria-hidden="true">
            <ClipboardCheck size={18} />
          </span>
          <div className="admin-dashboard-alert-body">
            <strong>
              {pendingCount === 1
                ? "1 permohonan menunggu keputusan"
                : `${pendingCount} permohonan menunggu keputusan`}
            </strong>
            <small>
              {heroPending.code} · {heroPending.institution} · {heroPending.dateLabel},{" "}
              {bookingTimeSummary(heroPending)}
              {pendingCount > 1 ? <em> · +{pendingCount - 1} lagi</em> : null}
            </small>
          </div>
          <button
            type="button"
            className="admin-dashboard-alert-cta"
            onClick={() => onJumpTab("bookings")}
          >
            Tinjau permohonan
            <ArrowRight size={14} aria-hidden="true" />
          </button>
        </section>
      ) : null}

      <div className="admin-dashboard-grid">
        <section className="admin-card admin-dashboard-agenda">
          {/* Strip minggu di paling atas: berfungsi sebagai navigator + ringkasan
              distribusi. Detail agenda di bawah baru ikut konteks hari aktif. */}
          <div className="admin-dashboard-week">
            <div className="admin-dashboard-week-head">
              <div>
                <h3>Minggu ini</h3>
                <small>{weekRangeLabel}</small>
              </div>
              <div className="admin-dashboard-week-actions">
                <button
                  type="button"
                  className="admin-dashboard-week-poster"
                  onClick={() => setShowPosterModal(true)}
                  title="Buat poster agenda mingguan untuk dibagikan ke grup WA"
                >
                  <ImageDown size={14} aria-hidden="true" />
                  Poster agenda
                </button>
                <button
                  type="button"
                  className="admin-dashboard-week-cta"
                  onClick={() => onJumpTab("schedule")}
                >
                  Atur jadwal
                  <ArrowRight size={14} aria-hidden="true" />
                </button>
              </div>
            </div>
            <ol className="admin-dashboard-week-strip" aria-label="Pilih hari di minggu ini">
              {weekDistribution.map((day) => {
                const isActive = day.key === activeDayKey;
                const className = [
                  "admin-dashboard-week-cell",
                  day.isToday ? "is-today" : "",
                  day.isPast && !day.isToday ? "is-past" : "",
                  day.count === 0 ? "is-empty" : "",
                  isActive ? "is-active" : "",
                ]
                  .filter(Boolean)
                  .join(" ");
                // Preview tooltip: 2 kunjungan pertama + jumlah sisa, supaya
                // admin bisa intip isi hari lain tanpa harus klik dulu.
                const cellVisits = weekVisits.filter((v) => v.displayDate === day.key);
                const preview = cellVisits
                  .slice(0, 2)
                  .map((v) => `${v.displayTime} ${v.institution}`)
                  .join("\n");
                const more =
                  cellVisits.length > 2 ? `\n+${cellVisits.length - 2} lainnya` : "";
                const title =
                  cellVisits.length === 0
                    ? `${formatLongDate(day.date)} · tidak ada kunjungan`
                    : `${formatLongDate(day.date)}\n${preview}${more}`;
                // Tampilan jumlah: 0 -> kosong (cell di-mute), 1-3 -> dots,
                // 4+ -> "3+". Ini menggantikan angka besar yang sebelumnya
                // mudah ketuker dengan tanggal.
                const dotCount = Math.min(day.count, 3);
                return (
                  <li key={day.key}>
                    <button
                      type="button"
                      className={className}
                      aria-pressed={isActive}
                      aria-label={`${formatLongDate(day.date)}, ${day.count} kunjungan`}
                      title={title}
                      onClick={() => setSelectedDayKey(day.key)}
                    >
                      <span className="admin-dashboard-week-day">
                        {fullDayNames[day.date.getDay()].slice(0, 3)}
                      </span>
                      <span className="admin-dashboard-week-date">
                        {day.date.getDate()}
                      </span>
                      <span
                        className="admin-dashboard-week-load"
                        aria-hidden="true"
                      >
                        {day.count === 0 ? (
                          <span className="admin-dashboard-week-load-empty" />
                        ) : day.count > 3 ? (
                          <span className="admin-dashboard-week-load-more">3+</span>
                        ) : (
                          Array.from({ length: dotCount }).map((_, i) => (
                            <span key={i} className="admin-dashboard-week-dot" />
                          ))
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>

          <header className="admin-card-head admin-dashboard-day-head">
            <div className="admin-dashboard-day-title">
              <div className="admin-dashboard-day-heading">
                <h2>{activeDayHeading}</h2>
                <span
                  className={`admin-dashboard-day-status admin-dashboard-day-status--${activeDayStatusKey}`}
                >
                  {activeDaySubline}
                </span>
              </div>
              {!activeDayInfo.isToday ? (
                <button
                  type="button"
                  className="admin-dashboard-day-reset"
                  onClick={() => setSelectedDayKey(todayKey)}
                >
                  <ArrowLeft size={12} aria-hidden="true" />
                  Hari ini
                </button>
              ) : null}
            </div>
            <button
              type="button"
              className="admin-card-link"
              onClick={() => onJumpTab("bookings")}
            >
              {activeDayInfo.isPast ? "Lihat riwayat" : "Buka booking"}
              <ArrowRight size={14} aria-hidden="true" />
            </button>
          </header>

			<div className="admin-card-body" aria-busy={loading}>
				{loading && bookings.length === 0 ? (
					<SectionSkeleton rows={5} />
				) : selectedDayVisits.length === 0 ? (
              <p className="admin-card-empty admin-dashboard-empty">
                <Clock3 size={14} aria-hidden="true" />
                <span>
                  {activeDayInfo.isToday
                    ? "Tidak ada kunjungan terjadwal hari ini."
                    : `Tidak ada kunjungan pada ${activeDayShortLabel}.`}
                </span>
              </p>
            ) : (
              <ul className="admin-agenda-list">
                {selectedDayVisits.map((item) => {
                  const visualPhase = getAgendaVisualPhase(item);
                  const itemClassName = [
                    "admin-agenda-item",
                    `admin-agenda-item--${visualPhase}`,
                    activeDayInfo.isToday ? "is-today" : "",
                  ]
                    .filter(Boolean)
                    .join(" ");

                  return (
                    <li
                      key={item.code}
                      className={itemClassName}
                    >
                      <span className="admin-agenda-tag">
                        <Clock3 size={14} aria-hidden="true" />
                        <strong>{item.displayTime} WIB</strong>
                      </span>
                      <div className="admin-agenda-meta">
                        <strong>{item.institution}</strong>
                        <small>
                          {item.code} · {item.groupSize} orang
                        </small>
                      </div>
                      <StatusBadge status={item.status} />
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        <section className="admin-card">
          <header className="admin-card-head">
            <div>
              <h2>Feedback terbaru</h2>
              {lowRatingCount > 0 ? (
                <p>
                  {lowRatingCount} ulasan rating rendah perlu tindak lanjut.
                </p>
              ) : null}
            </div>
            <button
              type="button"
              className="admin-card-link"
              onClick={() => onJumpTab("feedback")}
            >
              Lihat semua
              <ArrowRight size={14} aria-hidden="true" />
            </button>
          </header>

			<div className="admin-card-body" aria-busy={loading}>
				{loading && feedbacks.length === 0 ? (
					<SectionSkeleton rows={5} />
				) : recentFeedbacks.length === 0 ? (
              <p className="admin-card-empty">Belum ada feedback masuk.</p>
            ) : (
              <ul className="admin-feedback-list">
                {recentFeedbacks.map((feedback) => (
                  <li
                    key={feedback.code}
                    className={feedback.rating <= 3 ? "is-low" : undefined}
                  >
                    <div className="admin-feedback-head">
                      <strong>{feedback.code}</strong>
                      <span
                        className="admin-feedback-rating"
                        aria-label={`${feedback.rating} dari 5`}
                      >
                        {Array.from({ length: 5 }).map((_, idx) => (
                          <Star
                            key={idx}
                            size={14}
                            fill={idx < feedback.rating ? "currentColor" : "none"}
                            aria-hidden="true"
                          />
                        ))}
                      </span>
                    </div>
                    {feedback.comment ? (
                      <p>"{feedback.comment}"</p>
                    ) : (
                      <p className="admin-feedback-empty">Tanpa komentar.</p>
                    )}
                    <div className="admin-feedback-foot">
                      <small>{feedback.submittedAt ?? "Tanggal tidak tercatat"}</small>
                      {feedback.rating <= 3 ? (
                        <span className="admin-feedback-flag">
                          Perlu tindak lanjut
                        </span>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      {showReportModal && (
        <MonthlyReportModal
          bookings={bookings}
          feedbacks={feedbacks}
          adminName={adminName}
          onClose={() => setShowReportModal(false)}
        />
      )}

      {showPosterModal && (
        <WeeklyPosterModal
          bookings={bookings}
          onClose={() => setShowPosterModal(false)}
        />
      )}
    </div>
  );
}

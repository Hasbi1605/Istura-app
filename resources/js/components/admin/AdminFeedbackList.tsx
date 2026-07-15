import { useEffect, useMemo, useState } from "react";
import { FileSpreadsheet, Search, Star, X } from "lucide-react";
import type { Booking, Feedback, FeedbackWizardContent } from "../../domain/types";
import { formatCount, formatCountShort } from "../../lib/date";
import { PAGE_SIZE_FEEDBACK } from "../../domain/booking";
import { useMediaQuery } from "../../hooks";
import { StatCard } from "../ui/StatCard";
import { Pagination } from "../ui/Pagination";
import { InlineSpinner, StatCardSkeleton, TableSkeleton } from "../ui/LoadingStates";
import { FeedbackExportModal } from "./ExportModals";

export function AdminFeedbackList({
  bookings,
  feedbacks,
  feedbackContent,
  loading = false,
  adminName,
}: {
  bookings: Booking[];
  feedbacks: Feedback[];
  feedbackContent: FeedbackWizardContent;
  loading?: boolean;
  adminName?: string;
}) {
  const [ratingFilter, setRatingFilter] = useState<"all" | "low" | "high">("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest" | "rating-desc" | "rating-asc">(
    "newest",
  );
  const [page, setPage] = useState(1);
  const [showExportModal, setShowExportModal] = useState(false);
  // Mobile breakpoint: split-pane tidak cukup di viewport sempit, jadi
  // pakai slideover. State terbuka digerakkan oleh klik baris saja, agar
  // panel tidak muncul otomatis saat halaman dibuka.
  const isCompactScreen = useMediaQuery("(max-width: 980px)");
  const [showSlideOver, setShowSlideOver] = useState(false);

  const safeFeedbacks = useMemo(
    () =>
      feedbacks.map((feedback) => ({
        ...feedback,
        highlights: Array.isArray(feedback.highlights)
          ? feedback.highlights
          : [],
        improvements: Array.isArray(feedback.improvements)
          ? feedback.improvements
          : [],
      })),
    [feedbacks],
  );

  const enriched = useMemo(
    () =>
      safeFeedbacks.map((feedback) => {
        const booking = bookings.find((item) => item.code === feedback.code);
        return {
          ...feedback,
          institution: booking?.institution ?? "—",
          dateLabel: booking?.dateLabel ?? "—",
          contactName: booking?.contactName ?? "—",
          // ISO key dipakai untuk sort kronologis. Kalau booking sudah dihapus
          // kita fallback ke string kosong agar entry-nya jatuh ke akhir.
          dateKey: booking?.date ?? "",
        };
      }),
    [safeFeedbacks, bookings],
  );

  // Counts dipakai sebagai badge angka di chip filter, sama seperti pola
  // booking. Hitung dari dataset penuh agar tidak berubah saat user
  // mempersempit filter lain.
  const counts = useMemo(() => {
    let high = 0;
    let low = 0;
    enriched.forEach((feedback) => {
      if (feedback.rating >= 4) high += 1;
      if (feedback.rating <= 3) low += 1;
    });
    return { all: enriched.length, high, low };
  }, [enriched]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matched = enriched.filter((feedback) => {
      if (ratingFilter === "low" && feedback.rating > 3) return false;
      if (ratingFilter === "high" && feedback.rating < 4) return false;
      if (q) {
        const haystack =
          `${feedback.code} ${feedback.institution} ${feedback.contactName} ${feedback.visitorName ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
    const sorted = [...matched];
    sorted.sort((a, b) => {
      if (sort === "newest") return b.dateKey.localeCompare(a.dateKey);
      if (sort === "oldest") return a.dateKey.localeCompare(b.dateKey);
      if (sort === "rating-desc") {
        if (b.rating !== a.rating) return b.rating - a.rating;
        return b.dateKey.localeCompare(a.dateKey);
      }
      // rating-asc
      if (a.rating !== b.rating) return a.rating - b.rating;
      return b.dateKey.localeCompare(a.dateKey);
    });
    return sorted;
  }, [enriched, ratingFilter, search, sort]);

  // Reset pagination whenever the underlying list changes shape so the user
  // is never stranded on an empty page.
  useEffect(() => {
    setPage(1);
  }, [search, ratingFilter, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE_FEEDBACK));
  const safePage = Math.min(page, totalPages);
  const pagedFeedbacks = filtered.slice(
    (safePage - 1) * PAGE_SIZE_FEEDBACK,
    safePage * PAGE_SIZE_FEEDBACK,
  );

  // Default selection follows the filtered/paged list so the panel never
  // points at a hidden row.
  const [selectedId, setSelectedId] = useState<number>(0);
  const selected =
    pagedFeedbacks.find((feedback) => feedback.id === selectedId) ??
    pagedFeedbacks[0] ??
    null;

  const hasFeedbacks = safeFeedbacks.length > 0;

  // KPI: agregat dipakai untuk evaluasi internal, jadi kita pakai dataset
  // penuh, bukan hasil filter.
  const averageRating = safeFeedbacks.length
    ? (
        safeFeedbacks.reduce((sum, feedback) => sum + feedback.rating, 0) /
        safeFeedbacks.length
      ).toFixed(1)
    : "0.0";
  const needsAttention = feedbacks.filter((feedback) => feedback.rating <= 3).length;
  // Tingkat Respons: jumlah feedback / total kuota peserta completed
  const totalCompletedQuota = bookings
    .filter((booking) => booking.status === "Completed")
    .reduce((sum, booking) => sum + booking.groupSize, 0);
  const responseRate = totalCompletedQuota
    ? Math.round((safeFeedbacks.length / totalCompletedQuota) * 100)
    : 0;

  const filtersActive = ratingFilter !== "all" || search.trim().length > 0;

  return (
    <div className="admin-cms-page admin-feedback-page">
      <div className="admin-heading">
        <div>
          <h1>Feedback Pengunjung</h1>
          <p>Masukan dari kunjungan yang sudah selesai. Hanya untuk evaluasi internal.</p>
          {loading && <InlineSpinner label="Memuat feedback terbaru" />}
        </div>
        <div className="admin-heading-actions">
          <div className="search-box">
            <Search size={18} aria-hidden="true" />
            <input
              placeholder="Cari kode, instansi, CP"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <button
            type="button"
            className="booking-export-button"
            onClick={() => setShowExportModal(true)}
            title="Ekspor ringkasan & detail feedback ke Excel"
          >
            <FileSpreadsheet size={14} aria-hidden="true" />
            Ekspor
          </button>
        </div>
      </div>

      <div className="admin-stats" aria-busy={loading}>
        {loading && feedbacks.length === 0 ? (
          <StatCardSkeleton />
        ) : (
          <>
            <StatCard label="Total Masukan" value={feedbacks.length} />
            <StatCard label="Rating Rata-rata" value={averageRating} />
            <StatCard label="Perlu Perhatian" value={needsAttention} />
            <StatCard label="Tingkat Respons" value={`${responseRate}%`} />
          </>
        )}
      </div>

      <div className="booking-toolbar" role="region" aria-label="Filter feedback">
        <div className="booking-chip-group" role="tablist" aria-label="Filter rating">
          <button
            type="button"
            role="tab"
            aria-selected={ratingFilter === "all"}
            data-empty={counts.all === 0 ? "true" : undefined}
            className={`booking-chip booking-chip--all${ratingFilter === "all" ? " is-active" : ""}`}
            onClick={() => setRatingFilter("all")}
            title="Tampilkan semua rating"
          >
            <span>Semua</span>
            <em>{formatCountShort(counts.all)}</em>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={ratingFilter === "high"}
            data-empty={counts.high === 0 ? "true" : undefined}
            className={`booking-chip booking-chip--positive${ratingFilter === "high" ? " is-active" : ""}`}
            onClick={() => setRatingFilter(ratingFilter === "high" ? "all" : "high")}
            title="Filter rating positif"
          >
            <span>Positif (4-5)</span>
            <em>{formatCountShort(counts.high)}</em>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={ratingFilter === "low"}
            data-empty={counts.low === 0 ? "true" : undefined}
            className={`booking-chip booking-chip--attention${ratingFilter === "low" ? " is-active" : ""}`}
            onClick={() => setRatingFilter(ratingFilter === "low" ? "all" : "low")}
            title="Filter rating perlu perhatian"
          >
            <span>Perlu perhatian (1-3)</span>
            <em>{formatCountShort(counts.low)}</em>
          </button>
        </div>

        <div className="booking-toolbar-spacer" aria-hidden="true" />

        <label className="admin-feedback-sort">
          <span className="visually-hidden">Urutkan feedback</span>
          <select
            value={sort}
            onChange={(event) =>
              setSort(event.target.value as typeof sort)
            }
            aria-label="Urutkan feedback"
          >
            <option value="newest">Terbaru</option>
            <option value="oldest">Terlama</option>
            <option value="rating-desc">Rating tertinggi</option>
            <option value="rating-asc">Rating terendah</option>
          </select>
        </label>

        <div className="booking-summary" aria-live="polite">
          {filtered.length === counts.all ? (
            <>
              <strong>{formatCount(counts.all)}</strong> feedback
            </>
          ) : (
            <>
              <strong>{formatCount(filtered.length)}</strong> dari{" "}
              <strong>{formatCount(counts.all)}</strong>
            </>
          )}
        </div>
      </div>

      {loading && feedbacks.length === 0 ? (
        <TableSkeleton rows={7} />
      ) : filtered.length === 0 ? (
        <div className="admin-card admin-card--empty">
          <p>
            {filtersActive
              ? "Tidak ada feedback yang cocok dengan filter."
              : "Belum ada feedback masuk."}
          </p>
        </div>
      ) : (
        <div className="admin-workspace admin-feedback-workspace">
          <div className="booking-split-list">
            <div className="booking-table">
              {pagedFeedbacks.map((feedback) => {
                const isSelected = selected?.id === feedback.id;
                return (
                  <button
                    key={feedback.id}
                    type="button"
                    className={`booking-row${isSelected ? " is-selected" : ""}`}
                    onClick={() => {
                      setSelectedId(feedback.id);
                      if (isCompactScreen) setShowSlideOver(true);
                    }}
                  >
                    <span className="booking-row-main">
                      <strong title={feedback.institution}>{feedback.institution}</strong>
                      <small>{feedback.code}{feedback.visitorName ? ` · ${feedback.visitorName}` : ""}</small>
                      <small className="admin-feedback-row-date">{feedback.dateLabel}</small>
                    </span>
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
                  </button>
                );
              })}
            </div>

            {totalPages > 1 && (
              <Pagination page={safePage} totalPages={totalPages} onChange={setPage} />
            )}
          </div>

          <div className="booking-split-detail">
            {selected ? (
              <FeedbackDetailPanel feedback={selected} feedbackContent={feedbackContent} />
            ) : (
              <div className="booking-detail booking-detail--empty">
                <p>Pilih feedback untuk melihat detail.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {showExportModal && (
        <FeedbackExportModal
          bookings={bookings}
          feedbacks={safeFeedbacks}
          feedbackContent={feedbackContent}
          adminName={adminName}
          onClose={() => setShowExportModal(false)}
        />
      )}

      {isCompactScreen && showSlideOver && selected && (
        <FeedbackSlideOver
          feedback={selected}
          feedbackContent={feedbackContent}
          onClose={() => setShowSlideOver(false)}
        />
      )}
    </div>
  );
}

function FeedbackDetailPanel({
  feedback,
  feedbackContent,
}: {
  feedback: Feedback & { institution: string; dateLabel: string; contactName: string };
  feedbackContent: FeedbackWizardContent;
}) {
  const scores: Array<{ label: string; value: number | null; max: number }> = [
    { label: "Kemudahan booking", value: feedback.bookingEase, max: 5 },
    { label: "Layanan petugas", value: feedback.service, max: 5 },
    { label: "Kualitas pemandu", value: feedback.guideQuality, max: 5 },
    { label: "Kebersihan & fasilitas", value: feedback.facilityComfort, max: 5 },
    { label: "Skor rekomendasi", value: feedback.recommend, max: 5 },
  ];
  const discoverySourceLabel = feedback.discoverySource
    ? feedbackContent.options.discoverySources.find(
        (option) => option.value === feedback.discoverySource,
      )?.label ?? feedback.discoverySource
    : "—";
  const discoverySource =
    feedback.discoverySource === "other" && feedback.discoverySourceOther
      ? `${discoverySourceLabel}: ${feedback.discoverySourceOther}`
      : discoverySourceLabel;

  return (
    <div className="booking-detail admin-feedback-detail">
      <header className="detail-head">
        <div>
          <strong title={feedback.institution}>{feedback.institution}</strong>
          <small>
            {feedback.code} · {feedback.dateLabel}
          </small>
        </div>
        <span
          className="admin-feedback-rating admin-feedback-rating--lg"
          aria-label={`${feedback.rating} dari 5`}
        >
          {Array.from({ length: 5 }).map((_, idx) => (
            <Star
              key={idx}
              size={18}
              fill={idx < feedback.rating ? "currentColor" : "none"}
              aria-hidden="true"
            />
          ))}
        </span>
      </header>

      {(feedback.visitorName || feedback.origin) && (
        <section className="admin-feedback-aspects" aria-label="Data pengunjung">
          {feedback.visitorName && (
            <div>
              <span className="admin-feedback-aspect-label">Nama</span>
              <p className="admin-feedback-aspect-empty">{feedback.visitorName}</p>
            </div>
          )}
          {feedback.gender && (
            <div>
              <span className="admin-feedback-aspect-label">Jenis kelamin</span>
              <p className="admin-feedback-aspect-empty">
                {feedback.gender === "male" ? "Laki-laki" : "Perempuan"}
              </p>
            </div>
          )}
          {feedback.age != null && (
            <div>
              <span className="admin-feedback-aspect-label">Usia</span>
              <p className="admin-feedback-aspect-empty">{feedback.age} tahun</p>
            </div>
          )}
          {feedback.origin && (
            <div>
              <span className="admin-feedback-aspect-label">Alamat / Asal</span>
              <p className="admin-feedback-aspect-empty">{feedback.origin}</p>
            </div>
          )}
        </section>
      )}

      <section className="admin-feedback-scores" aria-label="Breakdown skor">
        {scores.map((score) => (
          <div key={score.label} className="admin-feedback-score">
            <div className="admin-feedback-score-label">
              <span>{score.label}</span>
              <strong>
                {score.value === null ? "—" : `${score.value}/${score.max}`}
              </strong>
            </div>
            <div
              className="admin-feedback-score-bar"
              role="presentation"
              aria-hidden="true"
            >
              <div
                className="admin-feedback-score-fill"
                style={{ width: `${score.value === null ? 0 : (score.value / score.max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </section>

      <section className="admin-feedback-aspects" aria-label="Profil kunjungan">
        <div>
          <span className="admin-feedback-aspect-label">Riwayat kunjungan</span>
          <p className="admin-feedback-aspect-empty">
            {feedback.visitedBefore === null
              ? "—"
              : feedback.visitedBefore
                ? feedbackContent.fields.visitedBeforeReturnLabel
                : feedbackContent.fields.visitedBeforeFirstLabel}
          </p>
        </div>
        <div>
          <span className="admin-feedback-aspect-label">Sumber informasi</span>
          <p className="admin-feedback-aspect-empty">{discoverySource}</p>
        </div>
      </section>

      <section className="admin-feedback-aspects">
        <div>
          <span className="admin-feedback-aspect-label">Aspek terbaik</span>
          {feedback.highlights.length > 0 ? (
            <ul className="admin-feedback-chiplist">
              {feedback.highlights.map((item) => (
                <li key={item} className="admin-feedback-chip admin-feedback-chip--positive">
                  {item}
                </li>
              ))}
            </ul>
          ) : (
            <p className="admin-feedback-aspect-empty">Tidak disebutkan.</p>
          )}
        </div>
        <div>
          <span className="admin-feedback-aspect-label">Perlu diperbaiki</span>
          {feedback.improvements.length > 0 ? (
            <ul className="admin-feedback-chiplist">
              {feedback.improvements.map((item) => (
                <li key={item} className="admin-feedback-chip admin-feedback-chip--warn">
                  {item}
                </li>
              ))}
            </ul>
          ) : (
            <p className="admin-feedback-aspect-empty">Tidak disebutkan.</p>
          )}
        </div>
      </section>

      {feedback.comment && (
        <section className="admin-feedback-comment">
          <span className="admin-feedback-aspect-label">Komentar pengunjung</span>
          <blockquote>"{feedback.comment}"</blockquote>
        </section>
      )}

      <footer className="admin-feedback-detail-foot">
        <small>
          Diisi {feedback.submittedAt ?? feedback.dateLabel} · CP {feedback.contactName}
        </small>
      </footer>
    </div>
  );
}

// Mobile slideover untuk feedback — pola sama persis dengan BookingSlideOver:
// dipakai sebagai panel detail di viewport sempit (≤980px) karena split-pane
// tidak punya cukup ruang horizontal.
function FeedbackSlideOver({
  feedback,
  feedbackContent,
  onClose,
}: {
  feedback: Feedback & { institution: string; dateLabel: string; contactName: string };
  feedbackContent: FeedbackWizardContent;
  onClose: () => void;
}) {
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      className="booking-slideover"
      role="dialog"
      aria-modal="true"
      aria-label="Detail feedback"
    >
      <button
        type="button"
        className="booking-slideover-backdrop"
        aria-label="Tutup detail"
        onClick={onClose}
      />
      <aside className="booking-slideover-panel">
        <header>
          <span>
            <strong>{feedback.code}</strong>
            <small>
              {feedback.institution} · {feedback.dateLabel}
            </small>
          </span>
          <button
            type="button"
            className="booking-slideover-close"
            onClick={onClose}
            aria-label="Tutup"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <FeedbackDetailPanel feedback={feedback} feedbackContent={feedbackContent} />
      </aside>
    </div>
  );
}

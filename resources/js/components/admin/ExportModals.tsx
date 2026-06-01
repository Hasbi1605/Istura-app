// Export modals (Booking ZIP, Feedback XLSX, Monthly PDF). Extracted from App.tsx.
import { useEffect, useMemo, useState } from "react";
import { Download, Loader2, X } from "lucide-react";
import type { Booking, Feedback } from "../../domain/types";
import {
  bookingReportDate,
  feedbackReportDate,
  isWithinRangeByDate,
  parseDateKey,
  resolveRange,
} from "../../exportShared";
import { ASSETS } from "../../lib/assets";
import { exportBookingsToZip } from "../../exportBookings";
import type { ExportRange, ExportScope } from "../../exportBookings";
import { exportFeedbackToXlsx } from "../../exportFeedback";
import type { FeedbackExportScope } from "../../exportFeedback";
import { exportMonthlyReport } from "../../exportMonthlyReport";
import type { MonthlyReportRange } from "../../exportMonthlyReport";

// Modal export laporan booking. Lingkup ada 3 (semua/completed/rejected) dan
// rentang waktu ada 4 preset (minggu ini / bulan ini / tahun ini / custom).
// Hasil download adalah ZIP berisi file Excel + folder surat-permohonan/.
export function BookingExportModal({
  bookings,
  adminName,
  documentUrlFor,
  onClose,
}: {
  bookings: Booking[];
  adminName?: string;
  documentUrlFor: (booking: Booking) => string;
  onClose: () => void;
}) {
  const [scope, setScope] = useState<ExportScope>("all");
  const [range, setRange] = useState<ExportRange>("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, busy]);

  // Hitung perkiraan jumlah baris secara client-side supaya admin tahu apa
  // yang akan keluar sebelum klik "Unduh". Logika harus identik dengan
  // exportBookingsToZip biar angkanya jujur.
  const previewCount = useMemo(() => {
    const scoped = bookings.filter((b) => {
      if (scope === "all") return b.status === "Completed" || b.status === "Rejected";
      if (scope === "completed") return b.status === "Completed";
      return b.status === "Rejected";
    });
    const { from, to } = resolveRange(range, customFrom, customTo);
    return scoped.filter((b) => isWithinRangeByDate(bookingReportDate(b), from, to)).length;
  }, [bookings, scope, range, customFrom, customTo]);

  const customRangeInvalid =
    range === "custom" &&
    Boolean(customFrom) &&
    Boolean(customTo) &&
    parseDateKey(customFrom) > parseDateKey(customTo);

  const canSubmit =
    !busy &&
    previewCount > 0 &&
    (range !== "custom" || (Boolean(customFrom) && Boolean(customTo) && !customRangeInvalid));

  const handleSubmit = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await exportBookingsToZip({
        bookings,
        scope,
        range,
        customFrom: range === "custom" ? customFrom : undefined,
        customTo: range === "custom" ? customTo : undefined,
        documentUrlFor: (b) => documentUrlFor(b as Booking),
        generatedBy: adminName,
      });
      if (result.missingDocuments.length > 0) {
        setError(
          `Berhasil unduh ${result.filename}, namun ${result.missingDocuments.length} surat ` +
            `gagal disertakan: ${result.missingDocuments.slice(0, 5).join(", ")}` +
            (result.missingDocuments.length > 5 ? ", ..." : "") +
            ". Tautan di Excel tetap ada, tapi file fisik tidak ikut di ZIP.",
        );
        setBusy(false);
        return;
      }
      onClose();
    } catch (err) {
      console.error("[BookingExportModal] export failed", err);
      setError("Ekspor gagal. Coba sebentar lagi atau periksa koneksi.");
      setBusy(false);
    }
  };

  const scopeOptions: Array<{ value: ExportScope; label: string; hint: string }> = [
    {
      value: "all",
      label: "Semua",
      hint: "Berisi booking selesai dan ditolak.",
    },
    {
      value: "completed",
      label: "Selesai saja",
      hint: "Hanya kunjungan yang sudah benar-benar terjadi.",
    },
    {
      value: "rejected",
      label: "Ditolak saja",
      hint: "Hanya permohonan yang ditolak.",
    },
  ];

  const rangeOptions: Array<{ value: ExportRange; label: string }> = [
    { value: "week", label: "Minggu ini" },
    { value: "month", label: "Bulan ini" },
    { value: "year", label: "Tahun ini" },
    { value: "custom", label: "Kustom" },
  ];

  return (
    <div
      className="admin-modal-backdrop"
      role="presentation"
      onClick={busy ? undefined : onClose}
    >
      <div
        className="admin-modal booking-export-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-export-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="admin-modal-head">
          <h2 id="booking-export-title">Ekspor laporan booking</h2>
          <button
            type="button"
            className="admin-modal-close"
            onClick={onClose}
            disabled={busy}
            aria-label="Tutup"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </header>

        <fieldset className="admin-modal-fieldset">
          <legend>Lingkup data</legend>
          <div className="booking-export-options">
            {scopeOptions.map((opt) => (
              <label key={opt.value} className="booking-export-option">
                <input
                  type="radio"
                  name="export-scope"
                  value={opt.value}
                  checked={scope === opt.value}
                  onChange={() => setScope(opt.value)}
                  disabled={busy}
                />
                <span>
                  <strong>{opt.label}</strong>
                  <small>{opt.hint}</small>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="admin-modal-fieldset">
          <legend>Periode</legend>
          <div className="booking-export-range" role="radiogroup" aria-label="Periode">
            {rangeOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={range === opt.value}
                className={`booking-export-range-button${range === opt.value ? " is-active" : ""}`}
                onClick={() => setRange(opt.value)}
                disabled={busy}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {range === "custom" && (
            <div className="admin-modal-grid booking-export-custom">
              <label className="admin-modal-field">
                <span>Dari tanggal</span>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(event) => setCustomFrom(event.target.value)}
                  disabled={busy}
                />
              </label>
              <label className="admin-modal-field">
                <span>Sampai tanggal</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={(event) => setCustomTo(event.target.value)}
                  disabled={busy}
                />
              </label>
              {customRangeInvalid && (
                <p className="admin-modal-preview-error" style={{ gridColumn: "1 / -1" }}>
                  Tanggal "dari" harus sebelum atau sama dengan tanggal "sampai".
                </p>
              )}
            </div>
          )}
        </fieldset>

        <div className="admin-modal-preview booking-export-preview">
          {previewCount > 0 ? (
            <p>
              <strong>{previewCount}</strong> baris akan diekspor, diurutkan dari
              tanggal laporan terbaru ke terlama.
            </p>
          ) : (
            <p className="admin-modal-preview-error">
              Tidak ada booking pada lingkup &amp; periode ini.
            </p>
          )}
        </div>

        {error && (
          <div className="booking-export-error" role="status">
            {error}
          </div>
        )}

        <div className="admin-modal-actions">
          <button
            type="button"
            className="admin-pill-button"
            onClick={onClose}
            disabled={busy}
          >
            Batal
          </button>
          <button
            type="button"
            className="admin-pill-button admin-pill-button--primary"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {busy ? (
              <>
                <Loader2 size={14} aria-hidden="true" className="booking-export-spinner" />
                Memproses...
              </>
            ) : (
              <>
                <Download size={14} aria-hidden="true" />
                Unduh ZIP
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Modal export laporan feedback. Lingkup ada 3 (semua/positif/perhatian) dengan
// threshold rating yang sama dengan chip filter di list (>=4 / <=3). Output
// adalah satu file .xlsx multi-sheet (Ringkasan, Detail, Highlights,
// Improvements). Tidak perlu ZIP karena feedback tidak punya lampiran.
export function FeedbackExportModal({
  bookings,
  feedbacks,
  adminName,
  onClose,
}: {
  bookings: Booking[];
  feedbacks: Feedback[];
  adminName?: string;
  onClose: () => void;
}) {
  const [scope, setScope] = useState<FeedbackExportScope>("all");
  const [range, setRange] = useState<ExportRange>("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, busy]);

  // Pre-join with bookings sekali, biar preview count + payload export pakai
  // data yang sama. Field institution/contactName/dateLabel diambil dari
  // booking pasangan; kalau tidak ada (legacy), default ke "—".
  const enriched = useMemo(
    () =>
      feedbacks.map((feedback) => {
        const booking = bookings.find((b) => b.code === feedback.code);
        return {
          ...feedback,
          institution: booking?.institution,
          contactName: booking?.contactName,
          dateLabel: booking?.dateLabel,
          dateKey: booking?.date,
        };
      }),
    [feedbacks, bookings],
  );

  // Hitung perkiraan jumlah baris secara client-side. Logika harus identik
  // dengan exportFeedbackToXlsx supaya angkanya jujur.
  const previewCount = useMemo(() => {
    const scoped = enriched.filter((f) => {
      if (scope === "all") return true;
      if (scope === "positive") return f.rating >= 4;
      return f.rating <= 3;
    });
    const { from, to } = resolveRange(range, customFrom, customTo);
    return scoped.filter((f) => isWithinRangeByDate(feedbackReportDate(f), from, to)).length;
  }, [enriched, scope, range, customFrom, customTo]);

  const customRangeInvalid =
    range === "custom" &&
    Boolean(customFrom) &&
    Boolean(customTo) &&
    parseDateKey(customFrom) > parseDateKey(customTo);

  const canSubmit =
    !busy &&
    previewCount > 0 &&
    (range !== "custom" || (Boolean(customFrom) && Boolean(customTo) && !customRangeInvalid));

  const handleSubmit = async () => {
    setBusy(true);
    setError(null);
    try {
      await exportFeedbackToXlsx({
        feedbacks: enriched,
        scope,
        range,
        customFrom: range === "custom" ? customFrom : undefined,
        customTo: range === "custom" ? customTo : undefined,
        generatedBy: adminName,
      });
      onClose();
    } catch (err) {
      console.error("[FeedbackExportModal] export failed", err);
      setError("Ekspor gagal. Coba sebentar lagi atau periksa koneksi.");
      setBusy(false);
    }
  };

  const scopeOptions: Array<{ value: FeedbackExportScope; label: string; hint: string }> = [
    { value: "all", label: "Semua", hint: "Semua feedback masuk pada periode." },
    {
      value: "positive",
      label: "Positif",
      hint: "Rating ≥ 4. Cocok untuk laporan ke pimpinan & publikasi.",
    },
    {
      value: "attention",
      label: "Perlu perhatian",
      hint: "Rating ≤ 3. Bahan tindak lanjut perbaikan layanan.",
    },
  ];

  const rangeOptions: Array<{ value: ExportRange; label: string }> = [
    { value: "week", label: "Minggu ini" },
    { value: "month", label: "Bulan ini" },
    { value: "year", label: "Tahun ini" },
    { value: "custom", label: "Kustom" },
  ];

  return (
    <div
      className="admin-modal-backdrop"
      role="presentation"
      onClick={busy ? undefined : onClose}
    >
      <div
        className="admin-modal booking-export-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-export-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="admin-modal-head">
          <h2 id="feedback-export-title">Ekspor laporan feedback</h2>
          <button
            type="button"
            className="admin-modal-close"
            onClick={onClose}
            disabled={busy}
            aria-label="Tutup"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </header>

        <fieldset className="admin-modal-fieldset">
          <legend>Lingkup data</legend>
          <div className="booking-export-options">
            {scopeOptions.map((opt) => (
              <label key={opt.value} className="booking-export-option">
                <input
                  type="radio"
                  name="feedback-export-scope"
                  value={opt.value}
                  checked={scope === opt.value}
                  onChange={() => setScope(opt.value)}
                  disabled={busy}
                />
                <span>
                  <strong>{opt.label}</strong>
                  <small>{opt.hint}</small>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="admin-modal-fieldset">
          <legend>Periode</legend>
          <div className="booking-export-range" role="radiogroup" aria-label="Periode">
            {rangeOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={range === opt.value}
                className={`booking-export-range-button${range === opt.value ? " is-active" : ""}`}
                onClick={() => setRange(opt.value)}
                disabled={busy}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {range === "custom" && (
            <div className="admin-modal-grid booking-export-custom">
              <label className="admin-modal-field">
                <span>Dari tanggal</span>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(event) => setCustomFrom(event.target.value)}
                  disabled={busy}
                />
              </label>
              <label className="admin-modal-field">
                <span>Sampai tanggal</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={(event) => setCustomTo(event.target.value)}
                  disabled={busy}
                />
              </label>
              {customRangeInvalid && (
                <p className="admin-modal-preview-error" style={{ gridColumn: "1 / -1" }}>
                  Tanggal "dari" harus sebelum atau sama dengan tanggal "sampai".
                </p>
              )}
            </div>
          )}
        </fieldset>

        <div className="admin-modal-preview booking-export-preview">
          {previewCount > 0 ? (
            <p>
              <strong>{previewCount}</strong> feedback akan diekspor sebagai
              file Excel berisi 4 sheet: Ringkasan, Detail, Highlights, Improvements.
            </p>
          ) : (
            <p className="admin-modal-preview-error">
              Tidak ada feedback pada lingkup &amp; periode ini.
            </p>
          )}
        </div>

        {error && (
          <div className="booking-export-error" role="status">
            {error}
          </div>
        )}

        <div className="admin-modal-actions">
          <button
            type="button"
            className="admin-pill-button"
            onClick={onClose}
            disabled={busy}
          >
            Batal
          </button>
          <button
            type="button"
            className="admin-pill-button admin-pill-button--primary"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {busy ? (
              <>
                <Loader2 size={14} aria-hidden="true" className="booking-export-spinner" />
                Memproses...
              </>
            ) : (
              <>
                <Download size={14} aria-hidden="true" />
                Unduh Excel
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Modal "Laporan Bulanan" — eksekutif summary dalam bentuk PDF, untuk dibaca
// (bukan diolah). Output: A4 portrait dengan cover, KPI, breakdown booking,
// suara pengunjung, dan halaman tindak lanjut. Lingkup data tidak ada karena
// laporan ini selalu komprehensif (booking + feedback gabung); yang dipilih
// admin cuma periode (Minggu/Bulan/Triwulan/Tahun/Custom).
export function MonthlyReportModal({
  bookings,
  feedbacks,
  adminName,
  onClose,
}: {
  bookings: Booking[];
  feedbacks: Feedback[];
  adminName?: string;
  onClose: () => void;
}) {
  const [range, setRange] = useState<MonthlyReportRange>("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, busy]);

  // Hitung perkiraan jumlah baris secara client-side. Logika harus identik
  // dengan exportMonthlyReport supaya angkanya jujur.
  const preview = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let from: Date;
    let to: Date;
    if (range === "week") {
      const offsetToMonday = (today.getDay() + 6) % 7;
      from = new Date(today);
      from.setDate(today.getDate() - offsetToMonday);
      to = new Date(from);
      to.setDate(from.getDate() + 6);
    } else if (range === "month") {
      from = new Date(today.getFullYear(), today.getMonth(), 1);
      to = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    } else if (range === "quarter") {
      const startMonth = Math.floor(today.getMonth() / 3) * 3;
      from = new Date(today.getFullYear(), startMonth, 1);
      to = new Date(today.getFullYear(), startMonth + 3, 0);
    } else if (range === "year") {
      from = new Date(today.getFullYear(), 0, 1);
      to = new Date(today.getFullYear(), 11, 31);
    } else {
      from = customFrom ? parseDateKey(customFrom) : new Date(0);
      to = customTo ? parseDateKey(customTo) : new Date(8640000000000000);
    }
    const inWindow = (d: Date) => isWithinRangeByDate(d, from, to);
    const bookingCount = bookings.filter((b) => inWindow(bookingReportDate(b))).length;
    const bookingDateByCode = new Map(bookings.map((booking) => [booking.code, booking.date]));
    const feedbackCount = feedbacks.filter((f) =>
      inWindow(feedbackReportDate({ ...f, dateKey: bookingDateByCode.get(f.code) })),
    ).length;
    return { bookingCount, feedbackCount };
  }, [bookings, feedbacks, range, customFrom, customTo]);

  const customRangeInvalid =
    range === "custom" &&
    Boolean(customFrom) &&
    Boolean(customTo) &&
    parseDateKey(customFrom) > parseDateKey(customTo);

  const hasData = preview.bookingCount > 0 || preview.feedbackCount > 0;

  const canSubmit =
    !busy &&
    hasData &&
    (range !== "custom" || (Boolean(customFrom) && Boolean(customTo) && !customRangeInvalid));

  const handleSubmit = async () => {
    setBusy(true);
    setError(null);
    try {
      await exportMonthlyReport({
        bookings,
        feedbacks,
        range,
        customFrom: range === "custom" ? customFrom : undefined,
        customTo: range === "custom" ? customTo : undefined,
        generatedBy: adminName,
        logoUrl: ASSETS.logoGold,
      });
      onClose();
    } catch (err) {
      console.error("[MonthlyReportModal] export failed", err);
      setError("Pembuatan PDF gagal. Coba sebentar lagi atau periksa koneksi.");
      setBusy(false);
    }
  };

  const rangeOptions: Array<{ value: MonthlyReportRange; label: string }> = [
    { value: "week", label: "Minggu ini" },
    { value: "month", label: "Bulan ini" },
    { value: "quarter", label: "Triwulan ini" },
    { value: "year", label: "Tahun ini" },
    { value: "custom", label: "Custom" },
  ];

  return (
    <div
      className="admin-modal-backdrop"
      role="presentation"
      onClick={busy ? undefined : onClose}
    >
      <div
        className="admin-modal booking-export-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-export-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="admin-modal-head">
          <h2 id="report-export-title">Laporan Bulanan</h2>
          <button
            type="button"
            className="admin-modal-close"
            onClick={onClose}
            disabled={busy}
            aria-label="Tutup"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </header>

        <fieldset className="admin-modal-fieldset">
          <legend>Periode</legend>
          <div className="booking-export-range" role="radiogroup" aria-label="Periode">
            {rangeOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={range === opt.value}
                className={`booking-export-range-button${range === opt.value ? " is-active" : ""}`}
                onClick={() => setRange(opt.value)}
                disabled={busy}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {range === "custom" && (
            <div className="admin-modal-grid booking-export-custom">
              <label className="admin-modal-field">
                <span>Dari tanggal</span>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(event) => setCustomFrom(event.target.value)}
                  disabled={busy}
                />
              </label>
              <label className="admin-modal-field">
                <span>Sampai tanggal</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={(event) => setCustomTo(event.target.value)}
                  disabled={busy}
                />
              </label>
              {customRangeInvalid && (
                <p className="admin-modal-preview-error" style={{ gridColumn: "1 / -1" }}>
                  Tanggal "dari" harus sebelum atau sama dengan tanggal "sampai".
                </p>
              )}
            </div>
          )}
        </fieldset>

        <div className="admin-modal-preview booking-export-preview">
          {hasData ? (
            <p>
              Akan merangkum <strong>{preview.bookingCount}</strong> booking
              dan <strong>{preview.feedbackCount}</strong> feedback ke dalam
              PDF A4 (3 halaman: ringkasan eksekutif, suara pengunjung,
              tindak lanjut).
            </p>
          ) : (
            <p className="admin-modal-preview-error">
              Tidak ada data pada periode ini.
            </p>
          )}
        </div>

        {error && (
          <div className="booking-export-error" role="status">
            {error}
          </div>
        )}

        <div className="admin-modal-actions">
          <button
            type="button"
            className="admin-pill-button"
            onClick={onClose}
            disabled={busy}
          >
            Batal
          </button>
          <button
            type="button"
            className="admin-pill-button admin-pill-button--primary"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {busy ? (
              <>
                <Loader2 size={14} aria-hidden="true" className="booking-export-spinner" />
                Membuat PDF...
              </>
            ) : (
              <>
                <Download size={14} aria-hidden="true" />
                Unduh PDF
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

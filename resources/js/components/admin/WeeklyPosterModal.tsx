// Modal "Poster Agenda Mingguan" — generate gambar agenda kunjungan satu
// minggu (hanya hari yang ada booking Accepted) bergaya poster Gedung Agung
// untuk di-share manual ke grup WA.
//
// Alur: data ditarik otomatis dari booking → admin bisa edit teks/jam/jumlah
// inline pada preview → klik "Unduh Gambar" → PNG terunduh. Pengiriman ke WA
// dilakukan admin secara manual (tempel gambar ke grup).
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Maximize2,
  Minus,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import type { Booking } from "../../domain/types";
import { addDays, monthNames } from "../../lib/date";
import {
  buildWeeklyPoster,
  posterRowCount,
  startOfWeek,
  type PosterModel,
} from "../../domain/weeklyPoster";
import { ASSETS } from "../../lib/assets";
import { exportPosterToPng, fetchImageAsDataUrl } from "../../exportWeeklyPoster";

// Lebar asli canvas poster (px). PNG diekspor pada lebar ini supaya tajam &
// deterministik; preview di layar di-scale agar muat di modal.
const POSTER_WIDTH = 1024;
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 1.5;
const ZOOM_STEP = 0.1;

export function WeeklyPosterModal({
  bookings,
  onClose,
}: {
  bookings: Booking[];
  onClose: () => void;
}) {
  // Anchor minggu yang sedang ditampilkan. Default minggu berjalan; admin bisa
  // geser maju/mundur untuk membuat poster minggu depan.
  const [weekAnchor, setWeekAnchor] = useState(() => startOfWeek(new Date()));
  const [model, setModel] = useState<PosterModel | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const posterRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  // Zoom preview. `fitZoom` = skala "Sesuaikan" yang dihitung dari lebar area
  // yang tersedia; `zoom` = skala aktif (bisa diubah manual via +/-).
  const [zoom, setZoom] = useState(0.5);
  const [fitZoom, setFitZoom] = useState(0.5);
  const [autoFit, setAutoFit] = useState(true);
  // Tinggi natural canvas (sebelum scale). Dipakai untuk memesan ruang pada
  // wrapper karena CSS transform tidak memengaruhi layout flow.
  const [naturalHeight, setNaturalHeight] = useState(0);

  // Rebuild model setiap kali minggu berubah. Edit manual admin di-reset ke
  // data asli saat pindah minggu (perilaku yang diharapkan).
  useEffect(() => {
    setModel(buildWeeklyPoster(bookings, weekAnchor));
  }, [bookings, weekAnchor]);

  // Pre-fetch logo jadi data URL sekali, supaya tersemat mulus di PNG.
  useEffect(() => {
    let active = true;
    fetchImageAsDataUrl(ASSETS.logoWhite).then((url) => {
      if (active) setLogoDataUrl(url);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, busy]);

  const rowCount = model ? posterRowCount(model) : 0;

  // Hitung skala "fit" dari lebar area preview yang tersedia. Dipanggil saat
  // mount, resize window, ganti minggu (tinggi berubah), dan saat model siap.
  useLayoutEffect(() => {
    const recompute = () => {
      const stage = stageRef.current;
      if (!stage) return;
      // Sisakan sedikit padding supaya poster tidak menempel ke tepi.
      const available = stage.clientWidth - 32;
      const next = Math.max(ZOOM_MIN, Math.min(1, available / POSTER_WIDTH));
      setFitZoom(next);
      setZoom((prev) => (autoFit ? next : prev));
      // offsetHeight = tinggi layout (tidak terpengaruh transform scale),
      // jadi ini tinggi natural canvas pada 1024px.
      if (posterRef.current) {
        setNaturalHeight(posterRef.current.offsetHeight);
      }
    };
    recompute();
    window.addEventListener("resize", recompute);
    return () => window.removeEventListener("resize", recompute);
  }, [autoFit, rowCount, model]);

  const effectiveZoom = autoFit ? fitZoom : zoom;

  const zoomIn = () => {
    setAutoFit(false);
    setZoom((prev) => Math.min(ZOOM_MAX, Number((prev + ZOOM_STEP).toFixed(2))));
  };
  const zoomOut = () => {
    setAutoFit(false);
    setZoom((prev) => Math.max(ZOOM_MIN, Number((prev - ZOOM_STEP).toFixed(2))));
  };
  const zoomFit = () => {
    setAutoFit(true);
    setZoom(fitZoom);
  };

  // Zoom dengan Ctrl/Cmd + scroll, pola yang familiar dari editor/peta.
  // Tanpa modifier, scroll tetap menggulung preview seperti biasa.
  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (!(event.ctrlKey || event.metaKey)) return;
    event.preventDefault();
    setAutoFit(false);
    const delta = event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
    setZoom((prev) => {
      const base = autoFit ? fitZoom : prev;
      return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Number((base + delta).toFixed(2))));
    });
  };

  // Textarea agenda auto-tinggi supaya teks multi-baris tidak terpotong, baik
  // di preview maupun di PNG hasil ekspor.
  const autoResize = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  const weekRangeLabel = useMemo(() => {
    const start = startOfWeek(weekAnchor);
    const end = addDays(start, 6);
    if (start.getMonth() === end.getMonth()) {
      return `${start.getDate()} – ${end.getDate()} ${monthNames[start.getMonth()]} ${start.getFullYear()}`;
    }
    return `${start.getDate()} ${monthNames[start.getMonth()].slice(0, 3)} – ${end.getDate()} ${monthNames[end.getMonth()].slice(0, 3)} ${end.getFullYear()}`;
  }, [weekAnchor]);

  const shiftWeek = (direction: -1 | 1) => {
    setWeekAnchor((prev) => addDays(startOfWeek(prev), direction * 7));
  };

  // ---- editor helpers (immutable update on model) ----
  const updateModel = (next: PosterModel) => setModel(next);

  const editTitle = (title: string) => {
    if (!model) return;
    updateModel({ ...model, title });
  };
  const editMonth = (monthLabel: string) => {
    if (!model) return;
    updateModel({ ...model, monthLabel });
  };
  const editRowField = (
    dayKey: string,
    rowId: string,
    field: "time" | "people",
    value: string,
  ) => {
    if (!model) return;
    updateModel({
      ...model,
      days: model.days.map((day) =>
        day.dateKey !== dayKey
          ? day
          : {
              ...day,
              rows: day.rows.map((row) =>
                row.id === rowId ? { ...row, [field]: value } : row,
              ),
            },
      ),
    });
  };
  const editAgendaLine = (dayKey: string, rowId: string, lineIndex: number, value: string) => {
    if (!model) return;
    updateModel({
      ...model,
      days: model.days.map((day) =>
        day.dateKey !== dayKey
          ? day
          : {
              ...day,
              rows: day.rows.map((row) =>
                row.id !== rowId
                  ? row
                  : {
                      ...row,
                      agenda: row.agenda.map((line, idx) =>
                        idx === lineIndex ? value : line,
                      ),
                    },
              ),
            },
      ),
    });
  };
  const addAgendaLine = (dayKey: string, rowId: string) => {
    if (!model) return;
    updateModel({
      ...model,
      days: model.days.map((day) =>
        day.dateKey !== dayKey
          ? day
          : {
              ...day,
              rows: day.rows.map((row) =>
                row.id === rowId ? { ...row, agenda: [...row.agenda, ""] } : row,
              ),
            },
      ),
    });
  };
  const removeAgendaLine = (dayKey: string, rowId: string, lineIndex: number) => {
    if (!model) return;
    updateModel({
      ...model,
      days: model.days.map((day) =>
        day.dateKey !== dayKey
          ? day
          : {
              ...day,
              rows: day.rows.map((row) =>
                row.id !== rowId
                  ? row
                  : {
                      ...row,
                      agenda:
                        row.agenda.length > 1
                          ? row.agenda.filter((_, idx) => idx !== lineIndex)
                          : row.agenda,
                    },
              ),
            },
      ),
    });
  };

  const handleDownload = async () => {
    if (!posterRef.current || !model) return;
    setBusy(true);
    setError(null);
    try {
      const start = startOfWeek(weekAnchor);
      const base = `ISTURA-Agenda-${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
      await exportPosterToPng(posterRef.current, { filenameBase: base });
      onClose();
    } catch (err) {
      console.error("[WeeklyPosterModal] export failed", err);
      setError("Gagal membuat gambar. Coba sebentar lagi.");
      setBusy(false);
    }
  };

  return (
    <div
      className="admin-modal-backdrop"
      role="presentation"
      onClick={busy ? undefined : onClose}
    >
      <div
        className="admin-modal poster-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="poster-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="admin-modal-head">
          <div>
            <h2 id="poster-modal-title">Poster Agenda Mingguan</h2>
            <p className="poster-modal-sub">
              Otomatis dari kunjungan disetujui. Bisa diedit, lalu unduh untuk
              dibagikan ke grup WA. Tip: agar tetap HD, kirim di WhatsApp sebagai
              <strong> Dokumen</strong>, bukan lewat Foto/Galeri.
            </p>
          </div>
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

        <div className="poster-modal-toolbar">
          <div className="poster-week-nav" role="group" aria-label="Pilih minggu">
            <button
              type="button"
              className="poster-week-nav-btn"
              onClick={() => shiftWeek(-1)}
              disabled={busy}
              aria-label="Minggu sebelumnya"
            >
              <ChevronLeft size={16} aria-hidden="true" />
            </button>
            <span className="poster-week-nav-label">{weekRangeLabel}</span>
            <button
              type="button"
              className="poster-week-nav-btn"
              onClick={() => shiftWeek(1)}
              disabled={busy}
              aria-label="Minggu berikutnya"
            >
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
          <span className="poster-row-count">
            {rowCount > 0
              ? `${model?.days.length} hari · ${rowCount} agenda`
              : "Tidak ada agenda"}
          </span>
        </div>

        <div className="poster-preview-wrap">
        <div className="poster-preview-scroll" ref={stageRef} onWheel={handleWheel}>
          {model && rowCount > 0 ? (
            <div
              className="poster-scaler"
              style={{
                width: POSTER_WIDTH * effectiveZoom,
                height: naturalHeight ? naturalHeight * effectiveZoom : undefined,
              }}
            >
              <div
                className="poster-canvas"
                ref={posterRef}
                style={{
                  transform: `scale(${effectiveZoom})`,
                  transformOrigin: "top left",
                }}
              >
              <div className="poster-pattern" aria-hidden="true" />
              <div className="poster-inner">
                <div className="poster-logo">
                  {logoDataUrl ? (
                    <img src={logoDataUrl} alt="" />
                  ) : (
                    <span className="poster-logo-fallback">GEDUNG AGUNG</span>
                  )}
                </div>

                <input
                  className="poster-title poster-editable"
                  value={model.title}
                  onChange={(e) => editTitle(e.target.value)}
                  aria-label="Judul poster"
                  spellCheck={false}
                />

                <div className="poster-month">
                  <input
                    className="poster-month-input poster-editable"
                    value={model.monthLabel}
                    onChange={(e) => editMonth(e.target.value)}
                    aria-label="Label bulan"
                    spellCheck={false}
                  />
                </div>

                <div className="poster-divider" aria-hidden="true" />

                <div className="poster-rows">
                  {model.days.map((day) => (
                    <div className="poster-day" key={day.dateKey}>
                      <div className="poster-day-badge">
                        <span className="poster-day-name">{day.dayName}</span>
                        <span className="poster-day-num">{day.dateNum}</span>
                      </div>

                      <div className="poster-day-entries">
                        {day.rows.map((row) => (
                          <div className="poster-entry" key={row.id}>
                            <input
                              className="poster-entry-time poster-editable"
                              value={row.time}
                              onChange={(e) =>
                                editRowField(day.dateKey, row.id, "time", e.target.value)
                              }
                              aria-label="Waktu"
                              spellCheck={false}
                            />
                            <div className="poster-entry-agenda">
                              {row.agenda.map((line, idx) => (
                                <div className="poster-bullet" key={idx}>
                                  <span className="poster-bullet-dot" aria-hidden="true" />
                                  <textarea
                                    className="poster-bullet-text poster-editable"
                                    value={line}
                                    rows={1}
                                    ref={autoResize}
                                    onChange={(e) => {
                                      autoResize(e.target);
                                      editAgendaLine(day.dateKey, row.id, idx, e.target.value);
                                    }}
                                    aria-label="Deskripsi agenda"
                                    spellCheck={false}
                                  />
                                  <span className="poster-bullet-actions" data-export-hide>
                                    {row.agenda.length > 1 ? (
                                      <button
                                        type="button"
                                        className="poster-line-btn"
                                        onClick={() =>
                                          removeAgendaLine(day.dateKey, row.id, idx)
                                        }
                                        aria-label="Hapus baris"
                                        title="Hapus baris"
                                      >
                                        <Trash2 size={12} aria-hidden="true" />
                                      </button>
                                    ) : null}
                                    {idx === row.agenda.length - 1 ? (
                                      <button
                                        type="button"
                                        className="poster-line-btn"
                                        onClick={() => addAgendaLine(day.dateKey, row.id)}
                                        aria-label="Tambah baris"
                                        title="Tambah baris"
                                      >
                                        <Plus size={12} aria-hidden="true" />
                                      </button>
                                    ) : null}
                                  </span>
                                </div>
                              ))}
                            </div>
                            <input
                              className="poster-entry-people poster-editable"
                              value={row.people}
                              onChange={(e) =>
                                editRowField(day.dateKey, row.id, "people", e.target.value)
                              }
                              aria-label="Jumlah peserta"
                              spellCheck={false}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            </div>
          ) : (
            <div className="poster-empty">
              <p>
                Belum ada kunjungan <strong>disetujui</strong> pada minggu ini.
              </p>
              <small>
                Setujui permohonan dulu, atau geser ke minggu lain yang sudah ada
                jadwal.
              </small>
            </div>
          )}
        </div>

        {rowCount > 0 && (
          <div className="poster-zoom-dock" role="group" aria-label="Kontrol zoom">
            <button
              type="button"
              className="poster-zoom-btn"
              onClick={zoomOut}
              disabled={busy || effectiveZoom <= ZOOM_MIN}
              aria-label="Perkecil"
              title="Perkecil (Ctrl/Cmd + scroll)"
            >
              <Minus size={16} aria-hidden="true" />
            </button>
            <span className="poster-zoom-value">{Math.round(effectiveZoom * 100)}%</span>
            <button
              type="button"
              className="poster-zoom-btn"
              onClick={zoomIn}
              disabled={busy || effectiveZoom >= ZOOM_MAX}
              aria-label="Perbesar"
              title="Perbesar (Ctrl/Cmd + scroll)"
            >
              <Plus size={16} aria-hidden="true" />
            </button>
            <span className="poster-zoom-sep" aria-hidden="true" />
            <button
              type="button"
              className={`poster-zoom-fit${autoFit ? " is-active" : ""}`}
              onClick={zoomFit}
              disabled={busy}
              title="Sesuaikan ke lebar"
            >
              <Maximize2 size={14} aria-hidden="true" />
              Sesuaikan
            </button>
          </div>
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
            onClick={handleDownload}
            disabled={busy || rowCount === 0}
          >
            {busy ? (
              <>
                <Loader2 size={14} aria-hidden="true" className="booking-export-spinner" />
                Membuat gambar...
              </>
            ) : (
              <>
                <Download size={14} aria-hidden="true" />
                Unduh Gambar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

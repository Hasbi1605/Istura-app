import { useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { Archive, Ban, CalendarClock, CalendarDays, Download, Eye, ImageIcon, Loader2, Megaphone, Pencil, Plus, RotateCcw, Search, Trash2, X } from "lucide-react";
import type {
  OpenDayBookingConflict,
  OpenEventAdmin,
  OpenQuotaSummary,
  OpenRegistrationAdmin,
} from "../../domain/types";
import { ValidationError } from "../../api/client";
import {
  activateOpenEvent,
  archiveOpenEvent,
  cancelAdminOpenRegistration,
  createOpenEvent,
  deactivateOpenEvent,
  deleteOpenEvent,
  deleteOpenEventPoster,
  fetchAdminOpenEvents,
  fetchAdminOpenRegistrations,
  fetchOpenEventExport,
  moveOpenRegistration,
  unarchiveOpenEvent,
  updateOpenEvent,
  updateOpenEventDay,
  uploadOpenEventPoster,
} from "../../api/openEvents";
import { ButtonSpinner, InlineSpinner, SavingStatus } from "../ui/LoadingStates";
import { DetailItem } from "../ui/DetailItem";
import { Pagination } from "../ui/Pagination";
import { exportOpenRegistrationsToExcel } from "../../exportOpenRegistrations";
import { formatCount, formatCountShort } from "../../lib/date";

const MONTHS_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function longDate(key?: string | null): string {
  if (!key) return "-";
  const [year, month, day] = key.split("-").map(Number);
  if (!year || !month || !day) return key;
  return `${day} ${MONTHS_ID[month - 1]} ${year}`;
}

function dateKeysInRange(start: string, end: string): string[] {
  if (!start || !end || end < start) return [];
  const dates: string[] = [];
  const cursor = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (cursor <= last && dates.length < 366) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function eventDatesLabel(event: OpenEventAdmin): string {
  const dates = event.days.map((day) => day.date).sort();
  if (dates.length === 0) return "Belum ada tanggal";
  if (dates.length <= 3) return dates.map(longDate).join(" · ");
  return `${longDate(dates[0])} – ${longDate(dates[dates.length - 1])} · ${dates.length} hari pilihan`;
}

function eventLifecycleLabel(event: OpenEventAdmin): string {
  if (event.isArchived) return "Arsip";
  if (event.isPast) return "Lewat";
  if (event.isActive) return "Aktif";
  return "Draft";
}

function eventLifecycleClass(event: OpenEventAdmin): string {
  if (event.isArchived) return "is-archived";
  if (event.isPast) return "is-past";
  if (event.isActive) return "is-on";
  return "";
}

const OPEN_STATUS_LABELS: Record<string, string> = {
  Registered: "Terdaftar",
  Confirmed: "Terdaftar",
  Cancelled: "Batal",
  Waitlisted: "Daftar tunggu",
};

function openStatusLabel(status: string): string {
  return OPEN_STATUS_LABELS[status] ?? status;
}

// Poster upload limits — must mirror the server (CmsImageService + uploadPoster
// validation) so admins get instant, clear feedback before the request.
const POSTER_MAX_BYTES = 5 * 1024 * 1024;
const POSTER_MAX_WIDTH = 2800;
const POSTER_MAX_HEIGHT = 3600;
const POSTER_ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * Client-side guard so landscape/large images fail fast with a clear reason
 * instead of an opaque "failed to upload" from the server. Returns an error
 * message, or null when the file is acceptable.
 */
function validatePosterFile(file: File): Promise<string | null> {
  if (!POSTER_ACCEPTED_TYPES.includes(file.type)) {
    return Promise.resolve("Format gambar harus JPG, PNG, atau WebP.");
  }
  if (file.size > POSTER_MAX_BYTES) {
    return Promise.resolve("Ukuran gambar maksimal 5 MB. Kompres atau perkecil gambar dulu.");
  }
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      if (img.naturalWidth > POSTER_MAX_WIDTH || img.naturalHeight > POSTER_MAX_HEIGHT) {
        resolve(
          `Dimensi gambar maksimal ${POSTER_MAX_WIDTH}×${POSTER_MAX_HEIGHT} piksel (potret atau lanskap sama-sama boleh). Gambarmu ${img.naturalWidth}×${img.naturalHeight}.`,
        );
      } else {
        resolve(null);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve("Gambar tidak dapat dibaca. Coba file lain.");
    };
    img.src = url;
  });
}

function flattenValidationErrors(error: ValidationError): Record<string, string> {
  const flat: Record<string, string> = {};
  Object.entries(error.errors).forEach(([key, messages]) => {
    flat[key.startsWith("dates.") ? "dates" : key] = messages[0];
  });
  return flat;
}

function OpenStatusBadge({ status }: { status: string }) {
  return (
    <span className={`open-status open-status-${status.toLowerCase()}`}>
      {openStatusLabel(status)}
    </span>
  );
}

function OpenRegistrantParticipantCell({ registration }: { registration: OpenRegistrationAdmin }) {
  return (
    <span className="open-registrants-participants">
      <strong>{registration.headcount} orang</strong>
      <small>
        {registration.addonCount > 0
          ? `termasuk ${registration.addonCount} add-on`
          : "tanpa add-on"}
      </small>
    </span>
  );
}

function openAddonDetail(registration: OpenRegistrationAdmin): string {
  if (registration.addonCount === 0) return "0 orang";

  const names = registration.members.filter(Boolean).join(", ");
  return names
    ? `${registration.addonCount} orang: ${names}`
    : `${registration.addonCount} orang`;
}

type Tab = "settings" | "registrants";
type OpenStatusFilter = "" | "Registered" | "Cancelled";
type OpenRegistrationCounts = { total: number; registered: number; cancelled: number };

const EMPTY_OPEN_REGISTRATION_COUNTS: OpenRegistrationCounts = {
  total: 0,
  registered: 0,
  cancelled: 0,
};

const OPEN_REGISTRATION_FILTER_CHIPS: Array<{
  value: OpenStatusFilter;
  label: string;
  countKey: keyof OpenRegistrationCounts;
  className: string;
}> = [
  { value: "", label: "Semua", countKey: "total", className: "booking-chip--all" },
  { value: "Registered", label: "Terdaftar", countKey: "registered", className: "booking-chip--accepted" },
  { value: "Cancelled", label: "Batal", countKey: "cancelled", className: "booking-chip--rejected" },
];

export function IsturaOpenManager({ readOnly = false }: { readOnly?: boolean }) {
  const [events, setEvents] = useState<OpenEventAdmin[]>([]);
  const [quota, setQuota] = useState<Record<number, OpenQuotaSummary[]>>({});
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>("settings");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editingEvent, setEditingEvent] = useState<OpenEventAdmin | null>(null);
  const selectedIdRef = useRef<number | null>(null);

  const selected = useMemo(() => events.find((e) => e.id === selectedId) ?? null, [events, selectedId]);
  const selectedQuota = selectedId ? quota[selectedId] ?? [] : [];
  const selectedLocked = Boolean(selected?.isArchived || selected?.isPast);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  const reload = async (keepSelection = true) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchAdminOpenEvents();
      setEvents(response.data);
      setQuota(response.quota);
      const currentSelectedId = selectedIdRef.current;
      if (!keepSelection || currentSelectedId === null || !response.data.some((e) => e.id === currentSelectedId)) {
        const active = response.data.find((e) => e.isActive && !e.isArchived && !e.isPast)
          ?? response.data.find((e) => !e.isArchived)
          ?? response.data[0]
          ?? null;
        setSelectedId(active?.id ?? null);
      }
    } catch {
      setError("Gagal memuat event Istura Open.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let active = true;
    let cleanupChannel: (() => void) | undefined;
    let fallbackTimer: number | undefined;
    let unsubscribeStatus: (() => void) | undefined;

    const setFallback = (status: string) => {
      if (fallbackTimer !== undefined) window.clearInterval(fallbackTimer);
      fallbackTimer = undefined;
      if (!["disabled", "unavailable", "failed", "disconnected"].includes(status)) return;
      fallbackTimer = window.setInterval(() => {
        if (active && document.visibilityState === "visible") void reload();
      }, 60_000);
    };

    void import("../../realtime/echo").then(({ getEcho, PUBLIC_OPEN_CHANNEL, subscribeRealtimeStatus }) => {
      if (!active) return;
      unsubscribeStatus = subscribeRealtimeStatus(setFallback);
      const echo = getEcho();
      if (!echo) return;
      const channel = echo.channel(PUBLIC_OPEN_CHANNEL);
      channel.subscribed(() => {
        if (active) void reload();
      });
      channel.listen(".open.quota-updated", () => {
        if (active) void reload();
      });
      cleanupChannel = () => {
        channel.stopListening(".open.quota-updated");
        echo.leave(PUBLIC_OPEN_CHANNEL);
      };
    });

    return () => {
      active = false;
      if (fallbackTimer !== undefined) window.clearInterval(fallbackTimer);
      unsubscribeStatus?.();
      cleanupChannel?.();
    };
    // reload intentionally reads the latest selected id without reconnecting
    // the channel whenever the event selector changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading && events.length === 0) {
    return (
      <div className="admin-cms-page open-admin">
        <InlineSpinner label="Memuat Istura Open" />
      </div>
    );
  }

  return (
    <div className="admin-cms-page open-admin">
      <div className="admin-heading">
        <div>
          <h1>Istura Open</h1>
          <p>Pendaftaran perorangan untuk event tertentu.</p>
        </div>
        {!readOnly && <div className="admin-heading-actions">
          <button type="button" className="button button-primary" onClick={() => setShowCreate(true)}>
            <Plus size={15} /> Buat Event
          </button>
        </div>}
      </div>

      {error && <p className="open-wizard-alert" role="alert">{error}</p>}
      {loading && events.length > 0 && <InlineSpinner label="Menyinkronkan Istura Open" />}

      {!selected && !showCreate && (
        <div className="open-admin-empty">
          <p>Belum ada event Istura Open. Buat event untuk mulai.</p>
        </div>
      )}

      {selected && (
        <>
          <section className="booking-toolbar open-admin-toolbar" aria-label="Pengaturan event Istura Open">
            <div className="booking-toolbar-row open-admin-toolbar-primary">
              <label className="open-admin-event-select">
                <span className="visually-hidden">Pilih event</span>
                <select
                  value={selectedId ?? ""}
                  onChange={(e) => setSelectedId(Number(e.target.value))}
                  aria-label="Pilih event"
                >
                  {events.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.name} • {eventLifecycleLabel(event)}
                    </option>
                  ))}
                </select>
              </label>
              {!readOnly && (
                <EventToolbarActions
                  event={selected}
                  onEdit={() => setEditingEvent(selected)}
                  onChanged={() => void reload()}
                  onDeleted={async () => {
                    setSelectedId(null);
                    await reload(false);
                  }}
                />
              )}
            </div>
            <div className="booking-toolbar-row booking-toolbar-row--secondary open-admin-summary">
              <span>
                {eventDatesLabel(selected)}
              </span>
              <span>{selected.perDayQuota}/hari</span>
              <span>maks {selected.maxAddons} add-on</span>
              <span className={`open-pill ${eventLifecycleClass(selected)}`}>
                {eventLifecycleLabel(selected)}
              </span>
              {selected.registrationsCount > 0 && <span>{selected.registrationsCount} pendaftar</span>}
            </div>
          </section>

          {selectedLocked && (
            <p className="open-archive-note">
              {selected.isArchived
                ? "Event arsip bersifat baca-saja. Pulihkan arsip untuk mengubah pengaturan; data pendaftar tetap bisa dilihat dan diekspor."
                : "Event yang sudah lewat bersifat baca-saja. Data pendaftar tetap bisa dilihat dan diekspor."}
            </p>
          )}

          <div className="admin-section-tabs">
            <button type="button" className={tab === "settings" ? "is-active" : ""} onClick={() => setTab("settings")}>
              Pengaturan & Hari
            </button>
            <button type="button" className={tab === "registrants" ? "is-active" : ""} onClick={() => setTab("registrants")}>
              Pendaftar
            </button>
          </div>

          {tab === "settings" && (
            <>
              <DaysPanel event={selected} quota={selectedQuota} onChanged={() => void reload()} readOnly={readOnly || selectedLocked} />
              <div className="open-promo-media">
                <PosterCard event={selected} onChanged={() => void reload()} readOnly={readOnly || selectedLocked} />
                <PromoCard event={selected} onChanged={() => void reload()} readOnly={readOnly || selectedLocked} />
              </div>
            </>
          )}
          {tab === "registrants" && <RegistrantsPanel event={selected} onChanged={() => void reload()} readOnly={readOnly || selectedLocked} />}
        </>
      )}

      {showCreate && (
        <CreateEventModal
          onClose={() => setShowCreate(false)}
          onCreated={async (id) => {
            setShowCreate(false);
            await reload();
            setSelectedId(id);
          }}
        />
      )}
      {editingEvent && (
        <EditEventModal
          event={editingEvent}
          onClose={() => setEditingEvent(null)}
          onSaved={async (id) => {
            setEditingEvent(null);
            await reload();
            setSelectedId(id);
          }}
        />
      )}
    </div>
  );
}

function ActivateButton({ event, onChanged, readOnly = false }: { event: OpenEventAdmin; onChanged: () => void; readOnly?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = async () => {
    setBusy(true);
    setError(null);
    try {
      if (event.isActive) {
        await deactivateOpenEvent(event.id);
      } else {
        await activateOpenEvent(event.id);
      }
      onChanged();
    } catch (err) {
      if (err instanceof ValidationError) {
        setError(err.errors.days?.[0] ?? err.message);
      } else {
        setError("Gagal mengubah status event.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="open-activate">
      {!readOnly && <button
        type="button"
        className={`button ${event.isActive ? "button-ghost" : "button-primary"}`}
        disabled={busy}
        onClick={toggle}
      >
        {busy
          ? <ButtonSpinner label={event.isActive ? "Menonaktifkan..." : "Mengaktifkan..."} />
          : event.isActive ? "Nonaktifkan" : "Aktifkan"}
      </button>}
      {error && <small className="field-error">{error}</small>}
    </span>
  );
}

function EventToolbarActions({
  event,
  onEdit,
  onChanged,
  onDeleted,
}: {
  event: OpenEventAdmin;
  onEdit: () => void;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const editDisabled = event.isArchived || event.isPast;
  const editTitle = editDisabled
    ? "Event arsip atau sudah lewat bersifat baca-saja."
    : "Edit nama, tanggal, kuota, dan teks persetujuan event.";

  return (
    <div className="open-admin-event-actions">
      <span className="open-toolbar-action">
        <button type="button" className="button button-ghost" disabled={editDisabled} title={editTitle} onClick={onEdit}>
          <Pencil size={15} /> Edit event
        </button>
      </span>
      <ActivateButton event={event} onChanged={onChanged} readOnly={event.isArchived || event.isPast} />
      <ArchiveButton event={event} onChanged={onChanged} />
      <DeleteDraftButton event={event} onDeleted={onDeleted} />
    </div>
  );
}

function ArchiveButton({ event, onChanged }: { event: OpenEventAdmin; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleArchive = async () => {
    if (!event.isArchived) {
      const message = event.isActive
        ? `Arsipkan "${event.name}"? Event aktif akan dinonaktifkan dan disimpan sebagai arsip.`
        : `Arsipkan "${event.name}"? Event tidak akan tampil sebagai event operasional aktif.`;
      if (!window.confirm(message)) return;
    }

    setBusy(true);
    setError(null);
    try {
      if (event.isArchived) {
        await unarchiveOpenEvent(event.id);
      } else {
        await archiveOpenEvent(event.id);
      }
      onChanged();
    } catch (err) {
      if (err instanceof ValidationError) {
        setError(err.errors.event?.[0] ?? err.message);
      } else {
        setError(event.isArchived ? "Gagal memulihkan arsip." : "Gagal mengarsipkan event.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="open-toolbar-action">
      <button type="button" className="button button-ghost" disabled={busy} onClick={() => void toggleArchive()}>
        {busy
          ? <ButtonSpinner label={event.isArchived ? "Memulihkan..." : "Mengarsipkan..."} />
          : event.isArchived ? <><RotateCcw size={15} /> Pulihkan</> : <><Archive size={15} /> Arsipkan</>}
      </button>
      {error && <small className="field-error">{error}</small>}
    </span>
  );
}

function DeleteDraftButton({ event, onDeleted }: { event: OpenEventAdmin; onDeleted: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const disabled = busy || event.isActive || event.registrationsCount > 0;
  const title = event.isActive
    ? "Nonaktifkan event sebelum menghapus draft."
    : event.registrationsCount > 0
      ? "Event yang sudah memiliki pendaftar disimpan sebagai arsip."
      : "Hapus draft event secara permanen.";

  const remove = async () => {
    if (disabled) return;
    if (!window.confirm(`Hapus draft "${event.name}" secara permanen? Tindakan ini tidak dapat dibatalkan.`)) return;
    setBusy(true);
    setError(null);
    try {
      await deleteOpenEvent(event.id);
      onDeleted();
    } catch (err) {
      if (err instanceof ValidationError) {
        setError(err.errors.event?.[0] ?? err.message);
      } else {
        setError("Gagal menghapus draft.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="open-toolbar-action">
      <button type="button" className="button button-ghost open-delete-draft" disabled={disabled} title={title} onClick={() => void remove()}>
        {busy ? <ButtonSpinner label="Menghapus..." /> : <><Trash2 size={15} /> Hapus draft</>}
      </button>
      {error && <small className="field-error">{error}</small>}
    </span>
  );
}

function PosterCard({
  event,
  onChanged,
  readOnly = false,
}: {
  event: OpenEventAdmin;
  onChanged: () => void;
  readOnly?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<"upload" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const showFlash = (message: string) => {
    setFlash(message);
    window.setTimeout(() => setFlash(null), 2000);
  };

  const pick = () => inputRef.current?.click();

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const validationError = await validatePosterFile(file);
    if (validationError) {
      setError(validationError);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setPending("upload");
    setError(null);
    try {
      await uploadOpenEventPoster(event.id, file);
      showFlash("Poster diperbarui");
      onChanged();
    } catch (err) {
      if (err instanceof ValidationError) {
        setError(err.errors.poster?.[0] ?? err.message);
      } else {
        setError("Gagal mengunggah poster.");
      }
    } finally {
      setPending(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const remove = async () => {
    if (!window.confirm("Hapus poster event ini?")) return;
    setPending("delete");
    setError(null);
    try {
      await deleteOpenEventPoster(event.id);
      showFlash("Poster dihapus");
      onChanged();
    } catch {
      setError("Gagal menghapus poster.");
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="admin-card open-poster-card">
      <div className="open-poster-head">
        <ImageIcon size={16} /> Poster / Flyer (opsional)
      </div>
      <div className="open-poster-body">
        {event.posterUrl ? (
          <img className="open-poster-preview" src={event.posterUrl} alt={`Poster ${event.name}`} />
        ) : (
          <div className="open-poster-empty">Belum ada poster.</div>
        )}
        {!readOnly && (
          <div className="open-poster-actions">
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={(e) => void onFile(e.target.files?.[0])}
            />
            <button type="button" className="button button-ghost" disabled={pending !== null} onClick={pick}>
              {pending === "upload"
                ? <ButtonSpinner label="Mengunggah..." />
                : event.posterUrl ? "Ganti poster" : "Unggah poster"}
            </button>
            {event.posterUrl && (
              <button type="button" className="button button-ghost open-poster-remove" disabled={pending !== null} onClick={() => void remove()}>
                {pending === "delete" ? <ButtonSpinner label="Menghapus..." /> : <><Trash2 size={14} /> Hapus</>}
              </button>
            )}
            {flash && <span className="open-poster-flash">{flash}</span>}
          </div>
        )}
      </div>
      {error && <small className="field-error">{error}</small>}
    </div>
  );
}

function PromoCard({
  event,
  onChanged,
  readOnly = false,
}: {
  event: OpenEventAdmin;
  onChanged: () => void;
  readOnly?: boolean;
}) {
  const [subtitle, setSubtitle] = useState(event.promoSubtitle ?? "");
  const [banner, setBanner] = useState(event.bannerText ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);

  const dirty = subtitle !== (event.promoSubtitle ?? "") || banner !== (event.bannerText ?? "");

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await updateOpenEvent(event.id, {
        promoSubtitle: subtitle.trim() || null,
        bannerText: banner.trim() || null,
      });
      setFlash(true);
      window.setTimeout(() => setFlash(false), 2000);
      onChanged();
    } catch (err) {
      if (err instanceof ValidationError) {
        setError(err.errors.promoSubtitle?.[0] ?? err.errors.bannerText?.[0] ?? err.message);
      } else {
        setError("Gagal menyimpan teks promo.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-card open-poster-card">
      <div className="open-poster-head">
        <Megaphone size={16} /> Teks Promo (opsional)
      </div>
      <label className="form-field">
        <span>Subjudul popup</span>
        <textarea
          value={subtitle}
          rows={2}
          maxLength={255}
          placeholder="Contoh: Kunjungan perorangan 14–16 Agustus. Gratis, tanpa surat."
          onChange={(e) => setSubtitle(e.target.value)}
          disabled={readOnly}
        />
      </label>
      <label className="form-field">
        <span>Teks banner berjalan</span>
        <textarea
          value={banner}
          rows={2}
          maxLength={500}
          placeholder="Contoh: Pendaftaran Istura Open dibuka! Pilih harimu, siapa cepat dia dapat."
          onChange={(e) => setBanner(e.target.value)}
          disabled={readOnly}
        />
      </label>
      {!readOnly && (
        <div className="open-poster-actions">
          <button type="button" className="button button-primary" disabled={busy || !dirty} onClick={() => void save()}>
            {busy ? <ButtonSpinner label="Menyimpan..." /> : "Simpan teks promo"}
          </button>
          {flash && <span className="open-poster-flash">Tersimpan</span>}
        </div>
      )}
      {error && <small className="field-error">{error}</small>}
    </div>
  );
}

function DaysPanel({
  event,
  quota,
  onChanged,
  readOnly = false,
}: {
  event: OpenEventAdmin;
  quota: OpenQuotaSummary[];
  onChanged: () => void;
  readOnly?: boolean;
}) {
  const usedByDay = useMemo(() => {
    const map: Record<number, number> = {};
    quota.forEach((q) => (map[q.dayId] = q.used));
    return map;
  }, [quota]);

  return (
    <div className="open-day-admin-grid">
      {event.days.map((day) => (
        <DayCard
          key={day.id}
          eventId={event.id}
          day={day}
          fallbackQuota={event.perDayQuota}
          used={usedByDay[day.id] ?? 0}
          onChanged={onChanged}
          readOnly={readOnly}
        />
      ))}
    </div>
  );
}

function DayCard({
  eventId,
  day,
  fallbackQuota,
  used,
  onChanged,
  readOnly = false,
}: {
  eventId: number;
  day: OpenEventAdmin["days"][number];
  fallbackQuota: number;
  used: number;
  onChanged: () => void;
  readOnly?: boolean;
}) {
  const [quotaOverride, setQuotaOverride] = useState(day.quotaOverride?.toString() ?? "");
  const [waUrl, setWaUrl] = useState(day.whatsappGroupUrl ?? "");
  const [pending, setPending] = useState<"save" | "toggle" | "export" | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<OpenDayBookingConflict[] | null>(null);

  useEffect(() => {
    setQuotaOverride(day.quotaOverride?.toString() ?? "");
    setWaUrl(day.whatsappGroupUrl ?? "");
  }, [day.id, day.quotaOverride, day.whatsappGroupUrl]);

  const effectiveQuota = quotaOverride ? Number(quotaOverride) : fallbackQuota;
  const fillPct = effectiveQuota > 0 ? Math.min(100, Math.round((used / effectiveQuota) * 100)) : 0;

  const persist = async (payload: Parameters<typeof updateOpenEventDay>[2]) => {
    setPending("save");
    setSaveStatus("saving");
    setError(null);
    try {
      await updateOpenEventDay(eventId, day.id, payload);
      setSaveStatus("saved");
      window.setTimeout(() => setSaveStatus((current) => current === "saved" ? "idle" : current), 2_000);
      onChanged();
    } catch (err) {
      if (err instanceof ValidationError) {
        setError(err.errors.whatsappGroupUrl?.[0] ?? err.errors.isOpen?.[0] ?? err.message);
      } else {
        setError("Gagal menyimpan perubahan hari.");
      }
      setSaveStatus("error");
    } finally {
      setPending(null);
    }
  };

  // Toggling open can collide with existing rombongan bookings; on the first
  // attempt the backend returns a 422 carrying the conflict list so we can warn
  // before re-sending with acknowledgeConflicts.
  const toggleOpen = async (acknowledge = false) => {
    setPending("toggle");
    setError(null);
    try {
      await updateOpenEventDay(eventId, day.id, {
        isOpen: !day.isOpen,
        ...(acknowledge ? { acknowledgeConflicts: true } : {}),
      });
      setConflicts(null);
      onChanged();
    } catch (err) {
      if (err instanceof ValidationError) {
        const list = (err.body as { conflicts?: OpenDayBookingConflict[] } | null)?.conflicts;
        if (list && list.length > 0) {
          setConflicts(list);
        } else {
          setError(err.errors.whatsappGroupUrl?.[0] ?? err.errors.isOpen?.[0] ?? err.message);
        }
      } else {
        setError("Gagal menyimpan perubahan hari.");
      }
    } finally {
      setPending(null);
    }
  };

  const exportDay = async () => {
    setPending("export");
    setError(null);
    try {
      const { data, event } = await fetchOpenEventExport(eventId);
      await exportOpenRegistrationsToExcel({
        registrations: data,
        eventName: event.name,
        eventSlug: event.slug,
        dayDate: day.date,
      });
    } catch {
      setError("Gagal mengekspor data hari ini.");
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="admin-card open-day-admin-card">
      <div className="open-day-admin-head">
        <CalendarDays size={16} /> {longDate(day.date)}
      </div>
      <label className="form-field">
        <span>Kuota (kosong = {fallbackQuota})</span>
        <input
          inputMode="numeric"
          value={quotaOverride}
          onChange={(e) => setQuotaOverride(e.target.value.replace(/\D/g, ""))}
          onBlur={() => quotaOverride !== (day.quotaOverride?.toString() ?? "") && void persist({ quotaOverride: quotaOverride ? Number(quotaOverride) : null })}
          disabled={readOnly || pending !== null}
        />
      </label>
      <div className="open-day-fill">
        <div className="open-day-fill-bar" style={{ width: `${fillPct}%` }} />
        <span>Terisi {used}/{effectiveQuota}</span>
      </div>
      <label className="form-field">
        <span>Link grup WhatsApp</span>
        <input
          value={waUrl}
          placeholder="https://chat.whatsapp.com/..."
          onChange={(e) => setWaUrl(e.target.value)}
          onBlur={() => waUrl !== (day.whatsappGroupUrl ?? "") && void persist({ whatsappGroupUrl: waUrl || null })}
          disabled={readOnly || pending !== null}
        />
      </label>
      <SavingStatus status={saveStatus} />
      <div className="open-day-admin-actions">
        {!readOnly && <button
          type="button"
          className={`button button-ghost open-day-toggle${day.isOpen ? " is-on" : ""}`}
          disabled={pending !== null}
          aria-pressed={day.isOpen}
          onClick={() => void toggleOpen()}
        >
          {pending === "toggle"
            ? <ButtonSpinner label={day.isOpen ? "Menutup..." : "Membuka..."} />
            : day.isOpen ? "Tutup hari" : "Buka hari"}
        </button>}
        <button type="button" className="booking-export-button open-day-export" disabled={pending !== null} onClick={() => void exportDay()}>
          {pending === "export" ? <ButtonSpinner label="Mengekspor..." /> : <><Download size={14} /> Ekspor hari</>}
        </button>
      </div>
      {conflicts && (
        <div className="open-day-conflict" role="alert">
          <strong>Ada booking rombongan di tanggal ini</strong>
          <p>
            Jika hari ini dibuka untuk Istura Open, tanggal tersebut otomatis tertutup untuk booking rombongan
            baru, tetapi booking berikut tidak ikut dipindahkan. Sebaiknya jadwalkan ulang atau batalkan
            rombongan ini lebih dulu di halaman Booking.
          </p>
          <ul>
            {conflicts.map((c) => (
              <li key={`${c.code}-${c.time ?? ""}`}>
                <strong>{c.code}</strong> · {c.time ?? "-"} · {c.groupSize} orang · {c.statusLabel}
              </li>
            ))}
          </ul>
          <div className="open-day-conflict-actions">
            <button type="button" className="button button-ghost" disabled={pending !== null} onClick={() => setConflicts(null)}>
              Batal
            </button>
            <button type="button" className="button button-danger" disabled={pending !== null} onClick={() => void toggleOpen(true)}>
              {pending === "toggle" ? <ButtonSpinner label="Membuka..." /> : "Tetap buka"}
            </button>
          </div>
        </div>
      )}
      {error && <small className="field-error">{error}</small>}
    </div>
  );
}

function RegistrantsPanel({ event, onChanged, readOnly = false }: { event: OpenEventAdmin; onChanged: () => void; readOnly?: boolean }) {
  const [rows, setRows] = useState<OpenRegistrationAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [dayFilter, setDayFilter] = useState<number | "">("");
  const [statusFilter, setStatusFilter] = useState<OpenStatusFilter>("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<OpenRegistrationCounts>(EMPTY_OPEN_REGISTRATION_COUNTS);
  const [detail, setDetail] = useState<OpenRegistrationAdmin | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const response = await fetchAdminOpenRegistrations(event.id, {
        dayId: dayFilter || undefined,
        status: statusFilter || undefined,
        search: search || undefined,
        page,
      });
      setRows(response.data);
      setLastPage(response.meta.lastPage);
      setTotal(response.meta.total);
      setCounts(response.meta.counts ?? EMPTY_OPEN_REGISTRATION_COUNTS);
    } catch {
      setRows([]);
      setLastPage(1);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.id, dayFilter, statusFilter, page]);

  const exportAll = async () => {
    setExporting(true);
    setExportError(null);
    try {
      const { data, event: eventMeta } = await fetchOpenEventExport(event.id);
      await exportOpenRegistrationsToExcel({
        registrations: data,
        eventName: eventMeta.name,
        eventSlug: eventMeta.slug,
      });
    } catch {
      setExportError("Gagal mengekspor pendaftar.");
    } finally {
      setExporting(false);
    }
  };

  const handleChanged = () => {
    setDetail(null);
    void load();
    onChanged();
  };

  const setStatusChip = (value: OpenStatusFilter) => {
    setPage(1);
    setStatusFilter((current) => (current === value && value !== "" ? "" : value));
  };

  const totalLabel =
    total === counts.total ? (
      <>
        <strong>{formatCount(counts.total)}</strong> pendaftar
      </>
    ) : (
      <>
        <strong>{formatCount(total)}</strong> dari <strong>{formatCount(counts.total)}</strong> pendaftar
      </>
    );

  return (
    <div className="open-registrants">
      <div className="booking-toolbar open-registrants-filters" role="region" aria-label="Filter pendaftar Istura Open">
        <div className="booking-chip-group open-registrants-chip-group" role="tablist" aria-label="Filter status pendaftar">
          {OPEN_REGISTRATION_FILTER_CHIPS.map((chip) => {
            const isActive = statusFilter === chip.value;
            const count = counts[chip.countKey];

            return (
              <button
                key={chip.value || "all"}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`booking-chip ${chip.className}${isActive ? " is-active" : ""}`}
                onClick={() => setStatusChip(chip.value)}
                title={
                  chip.value === ""
                    ? "Tampilkan semua pendaftar"
                    : isActive
                      ? "Klik untuk hapus filter"
                      : `Filter ${chip.label.toLowerCase()}`
                }
              >
                <span>{chip.label}</span>
                <em>{formatCountShort(count)}</em>
              </button>
            );
          })}
        </div>
        <label className="open-registrants-day-filter">
          <span className="visually-hidden">Filter hari</span>
          <select value={dayFilter} onChange={(e) => { setPage(1); setDayFilter(e.target.value ? Number(e.target.value) : ""); }}>
            <option value="">Semua hari</option>
            {event.days.map((day) => (
              <option key={day.id} value={day.id}>{longDate(day.date)}</option>
            ))}
          </select>
        </label>
        <form
          className="open-registrants-search"
          onSubmit={(e) => { e.preventDefault(); setPage(1); void load(); }}
        >
          <div className="open-registrants-searchbox">
            <Search size={16} aria-hidden="true" />
            <input value={search} placeholder="Cari nama / WA / kode" onChange={(e) => setSearch(e.target.value)} />
          </div>
          <button type="submit" className="button button-ghost" disabled={loading}>
            {loading ? <ButtonSpinner label="Mencari..." /> : "Cari"}
          </button>
        </form>
        <button type="button" className="booking-export-button" disabled={exporting} onClick={() => void exportAll()}>
          {exporting ? <ButtonSpinner label="Mengekspor..." /> : <><Download size={15} /> Ekspor</>}
        </button>
        <div className="booking-summary open-registrants-summary" aria-live="polite">
          {totalLabel}
        </div>
      </div>

      {exportError && <small className="field-error">{exportError}</small>}

      {loading ? (
        <InlineSpinner label="Memuat pendaftar" />
      ) : (
        <>
          <div className="booking-grid open-registrants-grid" role="table" aria-label="Daftar pendaftar Istura Open">
            <div className="open-registrants-grid-head" role="row">
              <span role="columnheader">Hari</span>
              <span role="columnheader">Nama</span>
              <span role="columnheader">Asal Kota</span>
              <span role="columnheader">WhatsApp</span>
              <span role="columnheader">Peserta</span>
              <span role="columnheader">Status</span>
              <span role="columnheader">Aksi</span>
            </div>
            {rows.length === 0 ? (
              <div className="open-registrants-empty" role="row">
                <span role="cell">Belum ada pendaftar.</span>
              </div>
            ) : (
              rows.map((reg) => (
                <RegistrantRow
                  key={reg.code}
                  eventId={event.id}
                  days={event.days}
                  registration={reg}
                  onView={() => setDetail(reg)}
                  onChanged={handleChanged}
                  readOnly={readOnly}
                />
              ))
            )}
          </div>
          {lastPage > 1 && (
            <Pagination page={page} totalPages={lastPage} onChange={setPage} />
          )}
        </>
      )}

      {detail && (
        <OpenRegistrationDetailDrawer
          registration={detail}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}

function RegistrantRow({
  eventId,
  days,
  registration,
  onView,
  onChanged,
  readOnly = false,
}: {
  eventId: number;
  days: OpenEventAdmin["days"];
  registration: OpenRegistrationAdmin;
  onView: () => void;
  onChanged: () => void;
  readOnly?: boolean;
}) {
  const [moving, setMoving] = useState(false);
  const [moveDay, setMoveDay] = useState<number | "">("");
  const [allowOverbook, setAllowOverbook] = useState(false);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState<"move" | "cancel" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isActive = registration.status === "Registered" || registration.status === "Confirmed";

  const doMove = async () => {
    if (!moveDay) return;
    setPending("move");
    setError(null);
    try {
      await moveOpenRegistration(eventId, registration.code, {
        dayId: Number(moveDay),
        allowOverbook,
        note: note || undefined,
      });
      setMoving(false);
      onChanged();
    } catch (err) {
      if (err instanceof ValidationError) {
        setError(err.errors.dayId?.[0] ?? err.errors.note?.[0] ?? err.message);
      } else {
        setError("Gagal memindahkan pendaftar.");
      }
    } finally {
      setPending(null);
    }
  };

  const doCancel = async () => {
    if (!window.confirm(`Batalkan pendaftaran ${registration.contactName}?`)) return;
    setPending("cancel");
    setError(null);
    try {
      await cancelAdminOpenRegistration(eventId, registration.code);
      onChanged();
    } catch {
      setError("Gagal membatalkan.");
    } finally {
      setPending(null);
    }
  };

  return (
    <>
      <div className="open-registrants-grid-row" role="row">
        <span className="open-registrants-grid-cell" role="cell">{longDate(registration.dayDate)}</span>
        <span className="open-registrants-grid-cell open-registrants-name" role="cell">
          <strong>{registration.contactName}</strong>
          <small>{registration.code} · {longDate(registration.dayDate)}</small>
        </span>
        <span className="open-registrants-grid-cell" role="cell">{registration.city ?? "-"}</span>
        <span className="open-registrants-grid-cell" role="cell">{registration.whatsapp}</span>
        <span className="open-registrants-grid-cell" role="cell">
          <OpenRegistrantParticipantCell registration={registration} />
        </span>
        <span className="open-registrants-grid-cell" role="cell"><OpenStatusBadge status={registration.status} /></span>
        <span className="open-registrants-grid-cell" role="cell">
          <div className="open-row-actions">
            <button
              type="button"
              className="open-icon-action"
              onClick={onView}
              aria-label={`Lihat detail ${registration.contactName}`}
              title="Lihat detail"
            >
              <Eye size={16} aria-hidden="true" />
            </button>
            {isActive && !readOnly && (
              <>
                <button
                  type="button"
                  className="open-icon-action"
                  disabled={pending !== null}
                  onClick={() => setMoving((m) => !m)}
                  aria-label={`Pindahkan ${registration.contactName}`}
                  aria-pressed={moving}
                  title="Pindah hari"
                >
                  <CalendarClock size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="open-icon-action open-icon-action--danger"
                  disabled={pending !== null}
                  onClick={doCancel}
                  aria-label={`Batalkan ${registration.contactName}`}
                  title="Batalkan"
                >
                  {pending === "cancel"
                    ? <Loader2 size={16} aria-hidden="true" className="button-spinner" />
                    : <Ban size={16} aria-hidden="true" />}
                </button>
              </>
            )}
          </div>
        </span>
      </div>
      {moving && (
        <div className="open-move-row">
          <div className="open-move-form">
            <select value={moveDay} onChange={(e) => setMoveDay(e.target.value ? Number(e.target.value) : "")}>
              <option value="">Pilih hari tujuan</option>
              {days.filter((d) => d.id !== registration.dayId).map((d) => (
                <option key={d.id} value={d.id}>{longDate(d.date)}</option>
              ))}
            </select>
            <label className="open-move-overbook">
              <input type="checkbox" checked={allowOverbook} onChange={(e) => setAllowOverbook(e.target.checked)} />
              Izinkan overbook
            </label>
            <input placeholder="Catatan (wajib jika overbook)" value={note} onChange={(e) => setNote(e.target.value)} />
            <button type="button" className="button button-primary" disabled={pending !== null || !moveDay} onClick={doMove}>
              {pending === "move" ? <ButtonSpinner label="Memindahkan..." /> : "Pindahkan"}
            </button>
            {error && <small className="field-error">{error}</small>}
          </div>
        </div>
      )}
    </>
  );
}

function OpenRegistrationDetailDrawer({
  registration,
  onClose,
}: {
  registration: OpenRegistrationAdmin;
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
    <div className="booking-slideover" role="dialog" aria-modal="true" aria-label="Detail pendaftar Istura Open">
      <button
        type="button"
        className="booking-slideover-backdrop"
        aria-label="Tutup detail"
        onClick={onClose}
      />
      <aside className="booking-slideover-panel">
        <header>
          <span>
            <strong>{registration.contactName}</strong>
            <small>{registration.code}</small>
          </span>
          <button type="button" className="booking-slideover-close" onClick={onClose} aria-label="Tutup">
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <div className="booking-slideover-status">
          <OpenStatusBadge status={registration.status} />
        </div>
        <div className="detail-grid">
          <DetailItem label="Kode" value={registration.code} />
          <DetailItem label="Nama" value={registration.contactName} />
          <DetailItem label="NIK" value={registration.nik ?? registration.nikMasked} />
          <DetailItem label="WhatsApp" value={registration.whatsapp} />
          <DetailItem label="Asal Kota" value={registration.city ?? "-"} />
          <DetailItem label="Hari kunjungan" value={longDate(registration.dayDate)} />
          <DetailItem label="Total peserta" value={`${registration.headcount} orang`} />
          <DetailItem label="Add-on" value={openAddonDetail(registration)} />
          <DetailItem label="Waktu daftar" value={registration.registeredAt ?? "-"} />
          <DetailItem label="Waktu batal" value={registration.cancelledAt ?? "-"} />
        </div>
      </aside>
    </div>
  );
}

function OpenEventDateBuilder({
  selectedDates,
  setSelectedDates,
  disabled,
  todayKey,
  error,
  onDateError,
  helper = "Pilih satu hari, beberapa hari tidak berurutan, atau tambahkan satu rentang sekaligus.",
}: {
  selectedDates: string[];
  setSelectedDates: Dispatch<SetStateAction<string[]>>;
  disabled: boolean;
  todayKey: string;
  error?: string;
  onDateError: (message: string) => void;
  helper?: string;
}) {
  const [dateToAdd, setDateToAdd] = useState("");
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");

  const addDates = (dates: string[]) => {
    setSelectedDates((current) => Array.from(new Set([...current, ...dates])).sort());
    onDateError("");
  };

  const addSingleDate = () => {
    if (!dateToAdd) return;
    addDates([dateToAdd]);
    setDateToAdd("");
  };

  const addRange = () => {
    const dates = dateKeysInRange(rangeStart, rangeEnd);
    if (dates.length === 0) {
      onDateError("Tanggal akhir rentang harus sama atau setelah tanggal mulai.");
      return;
    }
    addDates(dates);
    setRangeStart("");
    setRangeEnd("");
  };

  const removeDate = (date: string) => {
    setSelectedDates((current) => current.filter((item) => item !== date));
    onDateError("");
  };

  return (
    <div className="open-date-builder">
      <div className="open-date-builder-head">
        <span>Tanggal event</span>
        <small>{helper}</small>
      </div>
      <div className="open-date-single-row">
        <label className="form-field">
          <span>Tambah satu tanggal</span>
          <input type="date" min={todayKey} value={dateToAdd} disabled={disabled} onChange={(e) => setDateToAdd(e.target.value)} />
        </label>
        <button type="button" className="button button-ghost" disabled={!dateToAdd || disabled} onClick={addSingleDate}>
          <Plus size={14} /> Tambah tanggal
        </button>
      </div>
      <div className="open-date-range-row">
        <label className="form-field">
          <span>Dari</span>
          <input type="date" min={todayKey} value={rangeStart} disabled={disabled} onChange={(e) => setRangeStart(e.target.value)} />
        </label>
        <label className="form-field">
          <span>Sampai</span>
          <input type="date" min={rangeStart || todayKey} value={rangeEnd} disabled={disabled} onChange={(e) => setRangeEnd(e.target.value)} />
        </label>
        <button type="button" className="button button-ghost" disabled={!rangeStart || !rangeEnd || disabled} onClick={addRange}>
          Tambah rentang
        </button>
      </div>
      <div className="open-selected-dates" aria-live="polite">
        {selectedDates.length === 0 ? (
          <span className="open-selected-dates-empty">Belum ada tanggal dipilih.</span>
        ) : selectedDates.map((date) => (
          <span className="open-date-chip" key={date}>
            {longDate(date)}
            <button
              type="button"
              disabled={disabled}
              aria-label={`Hapus ${longDate(date)}`}
              onClick={() => removeDate(date)}
            >
              <X size={13} />
            </button>
          </span>
        ))}
      </div>
      {error && <small className="field-error">{error}</small>}
    </div>
  );
}

function EditEventModal({
  event,
  onClose,
  onSaved,
}: {
  event: OpenEventAdmin;
  onClose: () => void;
  onSaved: (id: number) => void;
}) {
  const [name, setName] = useState(event.name);
  const [selectedDates, setSelectedDates] = useState<string[]>(() => event.days.map((day) => day.date).sort());
  const [perDayQuota, setPerDayQuota] = useState(String(event.perDayQuota));
  const [maxAddons, setMaxAddons] = useState(String(event.maxAddons));
  const [agreementText, setAgreementText] = useState(event.agreementText ?? "");
  const closeRef = useRef<HTMLButtonElement>(null);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const todayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    const onKeyDown = (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key === "Escape" && !pending) onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, pending]);

  const submit = async () => {
    if (selectedDates.length === 0) {
      setErrors((current) => ({ ...current, dates: "Pilih minimal satu tanggal event." }));
      return;
    }
    setPending(true);
    setErrors({});
    try {
      const saved = await updateOpenEvent(event.id, {
        name: name.trim(),
        dates: selectedDates,
        perDayQuota: Number(perDayQuota) || 0,
        maxAddons: Number(maxAddons) || 0,
        agreementText: agreementText.trim() || null,
      });
      onSaved(saved.id);
    } catch (err) {
      if (err instanceof ValidationError) {
        setErrors(flattenValidationErrors(err));
      } else {
        setErrors({ name: "Gagal menyimpan event." });
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="open-modal-scrim" role="dialog" aria-modal="true" aria-label="Edit event" onMouseDown={(mouseEvent) => {
      if (mouseEvent.target === mouseEvent.currentTarget && !pending) onClose();
    }}>
      <div className="open-modal open-create-event-modal">
        <button
          ref={closeRef}
          type="button"
          className="open-promo-close"
          aria-label="Tutup"
          disabled={pending}
          onClick={onClose}
        >
          <X size={18} />
        </button>
        <h2>Edit Event Istura Open</h2>
        <label className="form-field">
          <span>Nama event</span>
          <input value={name} onChange={(e) => setName(e.target.value)} aria-invalid={Boolean(errors.name)} disabled={pending} />
          {errors.name && <small className="field-error">{errors.name}</small>}
        </label>
        <OpenEventDateBuilder
          selectedDates={selectedDates}
          setSelectedDates={setSelectedDates}
          disabled={pending}
          todayKey={todayKey}
          error={errors.dates}
          onDateError={(message) => setErrors((current) => ({ ...current, dates: message }))}
          helper="Tambahkan hari baru atau hapus hari lama untuk memindahkan jadwal event. Hari yang sudah memiliki pendaftar tidak dapat dihapus."
        />
        {errors.event && <small className="field-error">{errors.event}</small>}
        <div className="form-grid">
          <label className="form-field">
            <span>Kuota / hari</span>
            <input inputMode="numeric" value={perDayQuota} disabled={pending} onChange={(e) => setPerDayQuota(e.target.value.replace(/\D/g, ""))} />
            {errors.perDayQuota && <small className="field-error">{errors.perDayQuota}</small>}
          </label>
          <label className="form-field">
            <span>Maks add-on</span>
            <input inputMode="numeric" value={maxAddons} disabled={pending} onChange={(e) => setMaxAddons(e.target.value.replace(/\D/g, ""))} />
            {errors.maxAddons && <small className="field-error">{errors.maxAddons}</small>}
          </label>
        </div>
        <label className="form-field">
          <span>Teks persetujuan (opsional)</span>
          <textarea value={agreementText} disabled={pending} onChange={(e) => setAgreementText(e.target.value)} rows={3} />
          {errors.agreementText && <small className="field-error">{errors.agreementText}</small>}
        </label>
        <div className="open-step-actions">
          <button type="button" className="button button-ghost" disabled={pending} onClick={onClose}>Batal</button>
          <button type="button" className="button button-primary" disabled={pending || selectedDates.length === 0} onClick={submit}>
            {pending ? <ButtonSpinner label="Menyimpan event..." /> : "Simpan perubahan"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateEventModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: number) => void;
}) {
  const [name, setName] = useState("");
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [perDayQuota, setPerDayQuota] = useState("100");
  const [maxAddons, setMaxAddons] = useState("4");
  const [agreementText, setAgreementText] = useState("");
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [posterPreview, setPosterPreview] = useState<string | null>(null);
  const [posterError, setPosterError] = useState<string | null>(null);
  const posterInputRef = useRef<HTMLInputElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [pending, setPending] = useState<"create" | "poster" | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const todayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());

  useEffect(() => {
    if (!posterFile) {
      setPosterPreview(null);
      return;
    }
    const url = URL.createObjectURL(posterFile);
    setPosterPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [posterFile]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && pending === null) onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, pending]);

  const submit = async () => {
    if (selectedDates.length === 0) {
      setErrors((current) => ({ ...current, dates: "Pilih minimal satu tanggal event." }));
      return;
    }
    setPending("create");
    setErrors({});
    try {
      const event = await createOpenEvent({
        name: name.trim(),
        dates: selectedDates,
        perDayQuota: Number(perDayQuota) || 0,
        maxAddons: Number(maxAddons) || 0,
        agreementText: agreementText || null,
      });
      if (posterFile) {
        setPending("poster");
        try {
          await uploadOpenEventPoster(event.id, posterFile);
        } catch {
          // Event is created; poster can still be added from settings.
        }
      }
      onCreated(event.id);
    } catch (err) {
      if (err instanceof ValidationError) {
        setErrors(flattenValidationErrors(err));
      } else {
        setErrors({ name: "Gagal membuat event." });
      }
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="open-modal-scrim" role="dialog" aria-modal="true" aria-label="Buat event" onMouseDown={(event) => {
      if (event.target === event.currentTarget && pending === null) onClose();
    }}>
      <div className="open-modal open-create-event-modal">
        <button
          ref={closeRef}
          type="button"
          className="open-promo-close"
          aria-label="Tutup"
          disabled={pending !== null}
          onClick={onClose}
        >
          <X size={18} />
        </button>
        <h2>Buat Event Istura Open</h2>
        <label className="form-field">
          <span>Nama event</span>
          <input value={name} onChange={(e) => setName(e.target.value)} aria-invalid={Boolean(errors.name)} disabled={pending !== null} />
          {errors.name && <small className="field-error">{errors.name}</small>}
        </label>
        <OpenEventDateBuilder
          selectedDates={selectedDates}
          setSelectedDates={setSelectedDates}
          disabled={pending !== null}
          todayKey={todayKey}
          error={errors.dates}
          onDateError={(message) => setErrors((current) => ({ ...current, dates: message }))}
        />
        <div className="form-grid">
          <label className="form-field">
            <span>Kuota / hari</span>
            <input inputMode="numeric" value={perDayQuota} disabled={pending !== null} onChange={(e) => setPerDayQuota(e.target.value.replace(/\D/g, ""))} />
            {errors.perDayQuota && <small className="field-error">{errors.perDayQuota}</small>}
          </label>
          <label className="form-field">
            <span>Maks add-on</span>
            <input inputMode="numeric" value={maxAddons} disabled={pending !== null} onChange={(e) => setMaxAddons(e.target.value.replace(/\D/g, ""))} />
            {errors.maxAddons && <small className="field-error">{errors.maxAddons}</small>}
          </label>
        </div>
        <label className="form-field">
          <span>Teks persetujuan (opsional)</span>
          <textarea value={agreementText} disabled={pending !== null} onChange={(e) => setAgreementText(e.target.value)} rows={3} />
          <small>Muncul di langkah "Tinjau" pada wizard pendaftaran, tepat di atas kotak centang persetujuan. Kosongkan untuk memakai teks default.</small>
        </label>
        <div className="form-field">
          <span>Poster / Flyer (opsional)</span>
          <div className="open-poster-body">
            {posterPreview ? (
              <img className="open-poster-preview" src={posterPreview} alt="Pratinjau poster" />
            ) : (
              <div className="open-poster-empty">Belum ada poster. Popup memakai tampilan ringkas.</div>
            )}
            <div className="open-poster-actions">
              <input
                ref={posterInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={async (e) => {
                  const file = e.target.files?.[0] ?? null;
                  if (posterInputRef.current) posterInputRef.current.value = "";
                  if (!file) return;
                  const validationError = await validatePosterFile(file);
                  if (validationError) {
                    setPosterError(validationError);
                    setPosterFile(null);
                    return;
                  }
                  setPosterError(null);
                  setPosterFile(file);
                }}
              />
              <button type="button" className="button button-ghost" disabled={pending !== null} onClick={() => posterInputRef.current?.click()}>
                {posterFile ? "Ganti poster" : "Pilih poster"}
              </button>
              {posterFile && (
                <button type="button" className="button button-ghost open-poster-remove" disabled={pending !== null} onClick={() => { setPosterFile(null); setPosterError(null); }}>
                  <Trash2 size={14} /> Batalkan
                </button>
              )}
            </div>
          </div>
          {posterError && <small className="field-error">{posterError}</small>}
          <small>Potret atau lanskap boleh. JPG/PNG/WebP, maks {POSTER_MAX_WIDTH}×{POSTER_MAX_HEIGHT} piksel, ≤5 MB. Bisa juga ditambahkan nanti dari Pengaturan event.</small>
        </div>
        <div className="open-step-actions">
          <button type="button" className="button button-ghost" disabled={pending !== null} onClick={onClose}>Batal</button>
          <button type="button" className="button button-primary" disabled={pending !== null || selectedDates.length === 0} onClick={submit}>
            {pending
              ? <ButtonSpinner label={pending === "poster" ? "Mengunggah poster..." : "Membuat event..."} />
              : "Buat Event"}
          </button>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Ban, CalendarClock, CalendarDays, Download, Eye, Plus, RefreshCw, Search, X } from "lucide-react";
import type {
  OpenEventAdmin,
  OpenQuotaSummary,
  OpenRegistrationAdmin,
} from "../../domain/types";
import { ValidationError } from "../../api/client";
import {
  activateOpenEvent,
  cancelAdminOpenRegistration,
  createOpenEvent,
  deactivateOpenEvent,
  fetchAdminOpenEvents,
  fetchAdminOpenRegistrations,
  fetchOpenEventExport,
  moveOpenRegistration,
  updateOpenEventDay,
} from "../../api/openEvents";
import { InlineSpinner } from "../ui/LoadingStates";
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

const OPEN_STATUS_LABELS: Record<string, string> = {
  Registered: "Terdaftar",
  Confirmed: "Terdaftar",
  Cancelled: "Batal",
  Waitlisted: "Daftar tunggu",
};

function openStatusLabel(status: string): string {
  return OPEN_STATUS_LABELS[status] ?? status;
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

  const selected = useMemo(() => events.find((e) => e.id === selectedId) ?? null, [events, selectedId]);
  const selectedQuota = selectedId ? quota[selectedId] ?? [] : [];

  const reload = async (keepSelection = true) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchAdminOpenEvents();
      setEvents(response.data);
      setQuota(response.quota);
      if (!keepSelection || selectedId === null || !response.data.some((e) => e.id === selectedId)) {
        const active = response.data.find((e) => e.isActive) ?? response.data[0] ?? null;
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
                      {event.name} {event.isActive ? "• Aktif" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" className="button button-ghost" onClick={() => void reload()}>
                <RefreshCw size={15} /> Muat ulang
              </button>
            </div>
            <div className="booking-toolbar-row booking-toolbar-row--secondary open-admin-summary">
              <span>
                {longDate(selected.startDate)} – {longDate(selected.endDate)}
              </span>
              <span>{selected.perDayQuota}/hari</span>
              <span>maks {selected.maxAddons} add-on</span>
              <span className={selected.isActive ? "open-pill is-on" : "open-pill"}>
                {selected.isActive ? "● Aktif" : "Nonaktif"}
              </span>
              <ActivateButton event={selected} onChanged={() => void reload()} readOnly={readOnly} />
            </div>
          </section>

          <div className="admin-section-tabs">
            <button type="button" className={tab === "settings" ? "is-active" : ""} onClick={() => setTab("settings")}>
              Pengaturan & Hari
            </button>
            <button type="button" className={tab === "registrants" ? "is-active" : ""} onClick={() => setTab("registrants")}>
              Pendaftar
            </button>
          </div>

          {tab === "settings" && (
            <DaysPanel event={selected} quota={selectedQuota} onChanged={() => void reload()} />
          )}
          {tab === "registrants" && <RegistrantsPanel event={selected} onChanged={() => void reload()} readOnly={readOnly} />}
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
        {event.isActive ? "Nonaktifkan" : "Aktifkan"}
      </button>}
      {error && <small className="field-error">{error}</small>}
    </span>
  );
}

function DaysPanel({
  event,
  quota,
  onChanged,
}: {
  event: OpenEventAdmin;
  quota: OpenQuotaSummary[];
  onChanged: () => void;
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
}: {
  eventId: number;
  day: OpenEventAdmin["days"][number];
  fallbackQuota: number;
  used: number;
  onChanged: () => void;
}) {
  const [quotaOverride, setQuotaOverride] = useState(day.quotaOverride?.toString() ?? "");
  const [waUrl, setWaUrl] = useState(day.whatsappGroupUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveQuota = quotaOverride ? Number(quotaOverride) : fallbackQuota;
  const fillPct = effectiveQuota > 0 ? Math.min(100, Math.round((used / effectiveQuota) * 100)) : 0;

  const persist = async (payload: Parameters<typeof updateOpenEventDay>[2]) => {
    setBusy(true);
    setError(null);
    try {
      await updateOpenEventDay(eventId, day.id, payload);
      onChanged();
    } catch (err) {
      if (err instanceof ValidationError) {
        setError(err.errors.whatsappGroupUrl?.[0] ?? err.errors.isOpen?.[0] ?? err.message);
      } else {
        setError("Gagal menyimpan perubahan hari.");
      }
    } finally {
      setBusy(false);
    }
  };

  const exportDay = async () => {
    const { data, event } = await fetchOpenEventExport(eventId);
    await exportOpenRegistrationsToExcel({
      registrations: data,
      eventName: event.name,
      eventSlug: event.slug,
      dayDate: day.date,
    });
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
          onBlur={() => persist({ quotaOverride: quotaOverride ? Number(quotaOverride) : null })}
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
          onBlur={() => waUrl !== (day.whatsappGroupUrl ?? "") && persist({ whatsappGroupUrl: waUrl || null })}
        />
      </label>
      <div className="open-day-admin-actions">
        <button
          type="button"
          className={`button button-ghost open-day-toggle${day.isOpen ? " is-on" : ""}`}
          disabled={busy}
          onClick={() => persist({ isOpen: !day.isOpen })}
        >
          {day.isOpen ? "● Buka" : "Tutup"}
        </button>
        <button type="button" className="booking-export-button open-day-export" onClick={() => void exportDay()}>
          <Download size={14} /> Ekspor hari
        </button>
      </div>
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
    const { data, event: eventMeta } = await fetchOpenEventExport(event.id);
    await exportOpenRegistrationsToExcel({
      registrations: data,
      eventName: eventMeta.name,
      eventSlug: eventMeta.slug,
    });
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
          <button type="submit" className="button button-ghost">Cari</button>
        </form>
        <button type="button" className="booking-export-button" onClick={() => void exportAll()}>
          <Download size={15} /> Ekspor
        </button>
        <div className="booking-summary open-registrants-summary" aria-live="polite">
          {totalLabel}
        </div>
      </div>

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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isActive = registration.status === "Registered" || registration.status === "Confirmed";

  const doMove = async () => {
    if (!moveDay) return;
    setBusy(true);
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
      setBusy(false);
    }
  };

  const doCancel = async () => {
    if (!window.confirm(`Batalkan pendaftaran ${registration.contactName}?`)) return;
    setBusy(true);
    try {
      await cancelAdminOpenRegistration(eventId, registration.code);
      onChanged();
    } catch {
      setError("Gagal membatalkan.");
    } finally {
      setBusy(false);
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
                  disabled={busy}
                  onClick={doCancel}
                  aria-label={`Batalkan ${registration.contactName}`}
                  title="Batalkan"
                >
                  <Ban size={16} aria-hidden="true" />
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
            <button type="button" className="button button-primary" disabled={busy || !moveDay} onClick={doMove}>Pindahkan</button>
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

function CreateEventModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: number) => void;
}) {
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [perDayQuota, setPerDayQuota] = useState("100");
  const [maxAddons, setMaxAddons] = useState("4");
  const [agreementText, setAgreementText] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = async () => {
    setBusy(true);
    setErrors({});
    try {
      const event = await createOpenEvent({
        name: name.trim(),
        startDate,
        endDate,
        perDayQuota: Number(perDayQuota) || 0,
        maxAddons: Number(maxAddons) || 0,
        agreementText: agreementText || null,
      });
      onCreated(event.id);
    } catch (err) {
      if (err instanceof ValidationError) {
        const flat: Record<string, string> = {};
        Object.entries(err.errors).forEach(([key, messages]) => (flat[key] = messages[0]));
        setErrors(flat);
      } else {
        setErrors({ name: "Gagal membuat event." });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="open-modal-scrim" role="dialog" aria-modal="true" aria-label="Buat event">
      <div className="open-modal">
        <h2>Buat Event Istura Open</h2>
        <label className="form-field">
          <span>Nama event</span>
          <input value={name} onChange={(e) => setName(e.target.value)} aria-invalid={Boolean(errors.name)} />
          {errors.name && <small className="field-error">{errors.name}</small>}
        </label>
        <div className="form-grid">
          <label className="form-field">
            <span>Tanggal mulai</span>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            {errors.startDate && <small className="field-error">{errors.startDate}</small>}
          </label>
          <label className="form-field">
            <span>Tanggal akhir</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            {errors.endDate && <small className="field-error">{errors.endDate}</small>}
          </label>
          <label className="form-field">
            <span>Kuota / hari</span>
            <input inputMode="numeric" value={perDayQuota} onChange={(e) => setPerDayQuota(e.target.value.replace(/\D/g, ""))} />
          </label>
          <label className="form-field">
            <span>Maks add-on</span>
            <input inputMode="numeric" value={maxAddons} onChange={(e) => setMaxAddons(e.target.value.replace(/\D/g, ""))} />
          </label>
        </div>
        <label className="form-field">
          <span>Teks persetujuan (opsional)</span>
          <textarea value={agreementText} onChange={(e) => setAgreementText(e.target.value)} rows={3} />
        </label>
        <div className="open-step-actions">
          <button type="button" className="button button-ghost" onClick={onClose}>Batal</button>
          <button type="button" className="button button-primary" disabled={busy} onClick={submit}>
            {busy ? "Menyimpan..." : "Buat Event"}
          </button>
        </div>
      </div>
    </div>
  );
}

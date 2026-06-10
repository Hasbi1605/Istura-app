import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Download, Plus, RefreshCw } from "lucide-react";
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
import { exportOpenRegistrationsToExcel } from "../../exportOpenRegistrations";

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

type Tab = "settings" | "registrants";

export function IsturaOpenManager() {
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
        <div className="admin-heading-actions">
          <button type="button" className="button button-primary" onClick={() => setShowCreate(true)}>
            <Plus size={15} /> Buat Event
          </button>
        </div>
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
              <ActivateButton event={selected} onChanged={() => void reload()} />
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
          {tab === "registrants" && <RegistrantsPanel event={selected} onChanged={() => void reload()} />}
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

function ActivateButton({ event, onChanged }: { event: OpenEventAdmin; onChanged: () => void }) {
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
      <button
        type="button"
        className={`button ${event.isActive ? "button-ghost" : "button-primary"}`}
        disabled={busy}
        onClick={toggle}
      >
        {event.isActive ? "Nonaktifkan" : "Aktifkan"}
      </button>
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

function RegistrantsPanel({ event, onChanged }: { event: OpenEventAdmin; onChanged: () => void }) {
  const [rows, setRows] = useState<OpenRegistrationAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [dayFilter, setDayFilter] = useState<number | "">("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);

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
    } catch {
      setRows([]);
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

  return (
    <div className="open-registrants">
      <div className="booking-toolbar open-registrants-filters">
        <select value={dayFilter} onChange={(e) => { setPage(1); setDayFilter(e.target.value ? Number(e.target.value) : ""); }}>
          <option value="">Semua hari</option>
          {event.days.map((day) => (
            <option key={day.id} value={day.id}>{longDate(day.date)}</option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => { setPage(1); setStatusFilter(e.target.value); }}>
          <option value="">Semua status</option>
          <option value="Registered">Terdaftar</option>
          <option value="Confirmed">Terkonfirmasi</option>
          <option value="Cancelled">Batal</option>
        </select>
        <form
          className="open-registrants-search"
          onSubmit={(e) => { e.preventDefault(); setPage(1); void load(); }}
        >
          <input value={search} placeholder="Cari nama / WA / kode" onChange={(e) => setSearch(e.target.value)} />
          <button type="submit" className="button button-ghost">Cari</button>
        </form>
        <button type="button" className="booking-export-button" onClick={() => void exportAll()}>
          <Download size={15} /> Ekspor
        </button>
      </div>

      {loading ? (
        <InlineSpinner label="Memuat pendaftar" />
      ) : (
        <>
          <p className="open-registrants-count">{total} pendaftar</p>
          <div className="open-table-wrap">
            <table className="admin-table open-table">
              <thead>
                <tr>
                  <th>Hari</th>
                  <th>Nama</th>
                  <th>WhatsApp</th>
                  <th>Kepala</th>
                  <th>Add-on</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={7} className="open-table-empty">Belum ada pendaftar.</td></tr>
                )}
                {rows.map((reg) => (
                  <RegistrantRow
                    key={reg.code}
                    eventId={event.id}
                    days={event.days}
                    registration={reg}
                    onChanged={() => { void load(); onChanged(); }}
                  />
                ))}
              </tbody>
            </table>
          </div>
          {lastPage > 1 && (
            <div className="open-pagination">
              <button type="button" className="button button-ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Sebelumnya
              </button>
              <span>Hal {page} / {lastPage}</span>
              <button type="button" className="button button-ghost" disabled={page >= lastPage} onClick={() => setPage((p) => p + 1)}>
                Berikutnya
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function RegistrantRow({
  eventId,
  days,
  registration,
  onChanged,
}: {
  eventId: number;
  days: OpenEventAdmin["days"];
  registration: OpenRegistrationAdmin;
  onChanged: () => void;
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
      <tr>
        <td>{longDate(registration.dayDate)}</td>
        <td>{registration.contactName}</td>
        <td>{registration.whatsapp}</td>
        <td>{registration.headcount}</td>
        <td>{registration.addonCount > 0 ? `+${registration.addonCount}` : "-"}</td>
        <td><span className={`open-status open-status-${registration.status.toLowerCase()}`}>{registration.status}</span></td>
        <td>
          {isActive && (
            <div className="open-row-actions">
              <button type="button" className="admin-card-link" onClick={() => setMoving((m) => !m)}>Pindah</button>
              <button type="button" className="admin-card-link open-danger-link" disabled={busy} onClick={doCancel}>Batal</button>
            </div>
          )}
        </td>
      </tr>
      {moving && (
        <tr className="open-move-row">
          <td colSpan={7}>
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
          </td>
        </tr>
      )}
    </>
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

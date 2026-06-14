import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Check, ChevronLeft, Plus, Trash2, Users, X } from "lucide-react";
import type { OpenEventPublic, OpenRegistrationResult, Screen } from "../../domain/types";
import { ValidationError } from "../../api/client";
import {
  cancelOpenRegistration,
  lookupOpenRegistration,
  precheckOpenRegistration,
  storeOpenRegistration,
} from "../../api/openEvents";
import { ButtonSpinner } from "../ui/LoadingStates";

const MONTHS_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function formatLongDate(key: string): string {
  const [year, month, day] = key.split("-").map(Number);
  if (!year || !month || !day) return key;
  return `${day} ${MONTHS_ID[month - 1]} ${year}`;
}

function formatEventDates(event: OpenEventPublic): string {
  const dates = event.days.map((day) => day.date).sort();
  if (dates.length <= 3) return dates.map(formatLongDate).join(" · ");
  return `${formatLongDate(dates[0])} – ${formatLongDate(dates[dates.length - 1])} · ${dates.length} hari pilihan`;
}

function OpenFormField({
  label,
  value,
  error,
  helper,
  inputMode,
  maxLength,
  onChange,
}: {
  label: string;
  value: string;
  error?: string;
  helper?: string;
  inputMode?: "text" | "numeric" | "tel";
  maxLength?: number;
  onChange: (value: string) => void;
}) {
  return (
    <label className="form-field">
      <span>{label}</span>
      <input
        value={value}
        inputMode={inputMode}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
      />
      {helper && <small>{helper}</small>}
      {error && <small className="field-error">{error}</small>}
    </label>
  );
}

type StepIndex = 0 | 1 | 2 | 3 | 4;

const STEP_LABELS = ["Pilih Hari", "Data Diri", "Anggota", "Tinjau", "Selesai"];

export function IsturaOpenWizard({
  event,
  onNavigate,
  onQuotaChanged,
}: {
  event: OpenEventPublic | null;
  onNavigate: (screen: Screen) => void;
  onQuotaChanged: () => void;
}) {
  const [step, setStep] = useState<StepIndex>(0);
  const [dayId, setDayId] = useState<number | null>(null);
  const [contactName, setContactName] = useState("");
  const [nik, setNik] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [city, setCity] = useState("");
  const [members, setMembers] = useState<string[]>([]);
  const [agreement, setAgreement] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<OpenRegistrationResult | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Lookup / self-cancel sub-flow.
  const [lookupOpen, setLookupOpen] = useState(false);
  const [lookupNik, setLookupNik] = useState("");
  const [lookupWhatsapp, setLookupWhatsapp] = useState("");
  const [lookupResult, setLookupResult] = useState<OpenRegistrationResult | null | "none">(null);
  const [lookupPending, setLookupPending] = useState<"lookup" | "cancel" | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const lookupCloseRef = useRef<HTMLButtonElement>(null);

  const selectedDay = useMemo(
    () => event?.days.find((day) => day.id === dayId) ?? null,
    [event, dayId],
  );
  const maxAddons = event?.maxAddons ?? 0;
  const activeHeadcount = 1 + members.filter((member) => member.trim()).length;
  const dayRemaining = selectedDay?.remaining ?? 0;

  useEffect(() => {
    if (!dayId || !event) return;
    const currentDay = event.days.find((day) => day.id === dayId);
    if (currentDay?.isOpen && currentDay.remaining >= activeHeadcount) return;
    setDayId(null);
    setStep(0);
    setFormError("Hari yang dipilih baru saja ditutup atau kuotanya tidak lagi mencukupi. Silakan pilih hari lain.");
  }, [activeHeadcount, dayId, event]);

  const closeLookup = useCallback(() => {
    setLookupOpen(false);
    setLookupResult(null);
    setLookupNik("");
    setLookupWhatsapp("");
    setLookupError(null);
  }, []);

  useEffect(() => {
    if (!lookupOpen) return;

    lookupCloseRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key === "Escape" && lookupPending === null) {
        closeLookup();
      }
    };

    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [closeLookup, lookupOpen, lookupPending]);

  if (!event) {
    return (
      <section className="wizard-page open-wizard-page">
        <div className="wizard-panel open-wizard-empty">
          <h1>Istura Open belum dibuka</h1>
          <p>Saat ini tidak ada event pendaftaran perorangan yang aktif. Silakan cek kembali nanti.</p>
          <button type="button" className="button button-primary" onClick={() => onNavigate("home")}>
            Kembali ke Beranda
          </button>
        </div>
      </section>
    );
  }

  const setField = (key: string, setter: (value: string) => void) => (value: string) => {
    setter(value);
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const applyValidationError = (error: unknown) => {
    if (error instanceof ValidationError) {
      const flattened: Record<string, string> = {};
      Object.entries(error.errors).forEach(([key, messages]) => {
        const normalizedKey = key.startsWith("members") ? "members" : key === "assignedDayId" ? "day" : key;
        flattened[normalizedKey] = messages[0];
      });
      setErrors(flattened);
      setFormError(error.errors.assignedDayId?.[0] ?? error.message ?? null);
      return true;
    }
    setFormError("Terjadi kesalahan. Silakan coba lagi.");
    return false;
  };

  const goNextFromIdentity = async () => {
    const nextErrors: Record<string, string> = {};
    if (!/^[\p{L}][\p{L}\s.'-]*$/u.test(contactName.trim())) nextErrors.contactName = "Nama wajib diisi.";
    if (!/^\d{16}$/.test(nik)) nextErrors.nik = "NIK harus 16 digit angka.";
    if (!/^(08|628)\d{8,13}$/.test(whatsapp)) nextErrors.whatsapp = "Nomor WhatsApp tidak valid.";
    if (!city.trim()) nextErrors.city = "Asal kota wajib diisi.";
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      const precheck = await precheckOpenRegistration(nik, whatsapp);
      if (!precheck.identityAvailable) {
        setErrors({ nik: "NIK atau WhatsApp ini sudah terdaftar di event ini." });
        setFormError("NIK atau WhatsApp sudah terdaftar. Gunakan menu 'Cek / batalkan pendaftaran'.");
        return;
      }
      setStep(2);
    } catch (error) {
      applyValidationError(error);
    } finally {
      setSubmitting(false);
    }
  };

  const submitRegistration = async () => {
    if (!agreement) {
      setErrors({ agreement: "Persetujuan wajib dicentang." });
      return;
    }
    if (!dayId) {
      setStep(0);
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      const data = await storeOpenRegistration({
        contactName: contactName.trim(),
        nik,
        whatsapp,
        city: city.trim(),
        assignedDayId: dayId,
        members: members.map((name) => name.trim()).filter(Boolean),
        agreement: true,
      });
      setResult(data);
      setStep(4);
      onQuotaChanged();
    } catch (error) {
      applyValidationError(error);
      // Quota race: bounce back to day selection so the visitor can repick.
      if (error instanceof ValidationError && error.errors.assignedDayId) {
        setStep(0);
        onQuotaChanged();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const runLookup = async () => {
    if (!/^\d{16}$/.test(lookupNik)) {
      setLookupError("NIK harus 16 digit angka.");
      return;
    }
    if (!/^(08|628)\d{8,13}$/.test(lookupWhatsapp)) {
      setLookupError("Nomor WhatsApp tidak valid.");
      return;
    }
    setLookupPending("lookup");
    setLookupError(null);
    try {
      const data = await lookupOpenRegistration(lookupNik, lookupWhatsapp);
      setLookupResult(data ?? "none");
    } catch {
      setLookupError("Gagal memeriksa pendaftaran.");
    } finally {
      setLookupPending(null);
    }
  };

  const runCancel = async () => {
    setLookupPending("cancel");
    setLookupError(null);
    try {
      await cancelOpenRegistration(lookupNik, lookupWhatsapp);
      setLookupResult("none");
      onQuotaChanged();
    } catch {
      setLookupError("Gagal membatalkan pendaftaran.");
    } finally {
      setLookupPending(null);
    }
  };

  const addMember = () => {
    if (members.length >= maxAddons) return;
    if (selectedDay && 1 + members.length >= dayRemaining) return;
    setMembers((current) => [...current, ""]);
  };

  return (
    <section className="wizard-page open-wizard-page">
      <div className="wizard-shell open-wizard-shell">
        <aside className="wizard-guide open-wizard-guide">
          <div
            className={`open-wizard-guide-panel${event.posterUrl ? " has-poster" : ""}`}
            style={event.posterUrl
              ? {
                  backgroundImage: `linear-gradient(180deg, rgba(16, 24, 47, 0.9), rgba(16, 24, 47, 0.76)), url("${event.posterUrl}")`,
                }
              : undefined}
          >
            <button type="button" className="open-wizard-back" onClick={() => onNavigate("home")}>
              <ChevronLeft size={18} /> Beranda
            </button>
            <span className="open-wizard-guide-kicker">Istura Open</span>
            <h2>{event.name}</h2>
            <p>{formatEventDates(event)}</p>
            <div className="open-wizard-guide-facts">
              <span><CalendarDays size={16} /> {event.days.length} hari pilihan</span>
              <span><Users size={16} /> Maks. {event.maxAddons} anggota tambahan</span>
            </div>
            {selectedDay && (
              <div className="open-wizard-guide-selection">
                <small>Hari dipilih</small>
                <strong>{formatLongDate(selectedDay.date)}</strong>
                <span>Sisa {selectedDay.remaining} dari {selectedDay.quota} tempat</span>
              </div>
            )}
          </div>
        </aside>

        <div className="wizard-panel open-wizard-panel">
          <div className="wizard-content open-wizard-content">
            <div className="open-wizard-head">
              <span className="open-wizard-mobile-kicker">Istura Open</span>
              <h1>{event.name}</h1>
              <p>Gratis, tanpa surat permohonan. Pilih tanggal yang tersedia dan lengkapi data pendaftar.</p>
              <ol className="open-stepper" aria-label="Langkah pendaftaran">
                {STEP_LABELS.map((label, index) => (
                  <li key={label} className={index === step ? "is-active" : index < step ? "is-done" : ""}>
                    <span>{index + 1}</span>
                    {label}
                  </li>
                ))}
              </ol>
            </div>
        {formError && step !== 4 && <p className="open-wizard-alert" role="alert">{formError}</p>}

        {step === 0 && (
          <div className="open-step">
            <h2>Pilih hari kunjungan</h2>
            <p className="open-step-hint">Kuota dihitung per hari berdasarkan jumlah kepala.</p>
            <div className="open-day-grid">
              {event.days.map((day) => {
                const disabled = !day.isOpen || day.remaining <= 0;
                const selected = day.id === dayId;
                return (
                  <button
                    key={day.id}
                    type="button"
                    className={`open-day-card${selected ? " is-selected" : ""}${disabled ? " is-disabled" : ""}`}
                    onClick={() => !disabled && setDayId(day.id)}
                    disabled={disabled}
                    aria-pressed={selected}
                  >
                    <span className="open-day-date">
                      <CalendarDays size={18} /> {formatLongDate(day.date)}
                    </span>
                    <span className="open-day-quota">
                      <Users size={15} /> Sisa {day.remaining}/{day.quota}
                    </span>
                    <span className="open-day-status">
                      {!day.isOpen ? "Belum dibuka" : day.remaining <= 0 ? "Penuh" : "Tersedia"}
                    </span>
                  </button>
                );
              })}
            </div>
            {errors.day && <p className="field-error">{errors.day}</p>}
            <div className="wizard-actions">
              <button type="button" className="button button-ghost" onClick={() => setLookupOpen(true)}>
                Sudah daftar? Cek / batalkan pendaftaran
              </button>
              <button type="button" className="button button-primary" disabled={!dayId} onClick={() => setStep(1)}>
                Lanjut
              </button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="open-step">
            <h2>Data diri pendaftar</h2>
            <div className="form-grid">
              <OpenFormField
                label="Nama Lengkap"
                value={contactName}
                error={errors.contactName}
                onChange={setField("contactName", setContactName)}
              />
              <OpenFormField
                label="NIK KTP"
                inputMode="numeric"
                maxLength={16}
                value={nik}
                error={errors.nik}
                helper="16 digit, hanya untuk verifikasi kuota."
                onChange={setField("nik", (value) => setNik(value.replace(/\D/g, "").slice(0, 16)))}
              />
              <OpenFormField
                label="Nomor WhatsApp"
                inputMode="tel"
                value={whatsapp}
                error={errors.whatsapp}
                helper="Contoh 08xxxxxxxxxx."
                onChange={setField("whatsapp", (value) => setWhatsapp(value.replace(/[^\d]/g, "").slice(0, 15)))}
              />
              <OpenFormField
                label="Asal Kota"
                value={city}
                error={errors.city}
                maxLength={100}
                helper="Kota/kabupaten domisili Anda."
                onChange={setField("city", setCity)}
              />
            </div>
            <div className="wizard-actions">
              <button type="button" className="button button-ghost" onClick={() => setStep(0)}>
                Kembali
              </button>
              <button type="button" className="button button-primary" disabled={submitting} onClick={goNextFromIdentity}>
                {submitting ? <ButtonSpinner label="Memeriksa..." /> : "Lanjut"}
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="open-step">
            <h2>Anggota tambahan</h2>
            <p className="open-step-hint">
              Opsional, cukup nama (maksimal {maxAddons}). Setiap anggota ikut menghitung kuota.
            </p>
            {selectedDay && (
              <p className="open-step-hint">
                Sisa kuota hari ini {dayRemaining} orang. Total rombonganmu sekarang {activeHeadcount} orang.
              </p>
            )}
            {errors.members && <p className="field-error">{errors.members}</p>}
            <div className="open-members">
              {members.map((member, index) => (
                <div key={index} className="open-member-row">
                  <OpenFormField
                    label={`Anggota ${index + 1}`}
                    value={member}
                    onChange={(value) =>
                      setMembers((current) => current.map((item, idx) => (idx === index ? value : item)))
                    }
                  />
                  <button
                    type="button"
                    className="open-member-remove"
                    aria-label={`Hapus anggota ${index + 1}`}
                    onClick={() => setMembers((current) => current.filter((_, idx) => idx !== index))}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              {members.length < maxAddons && 1 + members.length < dayRemaining && (
                <button type="button" className="open-add-member" onClick={addMember}>
                  <Plus size={16} /> Tambah anggota
                </button>
              )}
              {selectedDay && 1 + members.length >= dayRemaining && members.length < maxAddons && (
                <p className="open-step-hint">Anggota dibatasi sisa kuota hari ini.</p>
              )}
            </div>
            <div className="wizard-actions">
              <button type="button" className="button button-ghost" onClick={() => setStep(1)}>
                Kembali
              </button>
              <button type="button" className="button button-primary" onClick={() => setStep(3)}>
                Lanjut
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="open-step">
            <h2>Tinjau pendaftaran</h2>
            <dl className="open-review">
              <div><dt>Hari</dt><dd>{selectedDay ? formatLongDate(selectedDay.date) : "-"}</dd></div>
              <div><dt>Nama</dt><dd>{contactName}</dd></div>
              <div><dt>Asal Kota</dt><dd>{city}</dd></div>
              <div><dt>WhatsApp</dt><dd>{whatsapp}</dd></div>
              <div>
                <dt>Jumlah kepala</dt>
                <dd>{1 + members.filter((m) => m.trim()).length} orang</dd>
              </div>
              {members.filter((m) => m.trim()).length > 0 && (
                <div>
                  <dt>Anggota</dt>
                  <dd>{members.filter((m) => m.trim()).join(", ")}</dd>
                </div>
              )}
            </dl>
            {event.agreementText && <p className="open-agreement-text">{event.agreementText}</p>}
            <label className="open-agreement">
              <input
                type="checkbox"
                checked={agreement}
                onChange={(e) => {
                  setAgreement(e.target.checked);
                  setErrors((cur) => ({ ...cur, agreement: "" }));
                }}
              />
              <span>Saya menyetujui ketentuan kunjungan dan data yang saya isi benar.</span>
            </label>
            {errors.agreement && <p className="field-error">{errors.agreement}</p>}
            <div className="wizard-actions">
              <button type="button" className="button button-ghost" onClick={() => setStep(2)}>
                Kembali
              </button>
              <button type="button" className="button button-primary" disabled={submitting} onClick={submitRegistration}>
                {submitting ? <ButtonSpinner label="Mendaftar..." /> : "Daftar Sekarang"}
              </button>
            </div>
          </div>
        )}

        {step === 4 && result && (
          <div className="open-step open-success">
            <div className="open-success-icon"><Check size={28} /></div>
            <h2>Pendaftaran berhasil!</h2>
            <p>
              Kamu terdaftar untuk{" "}
              <strong>{result.dayDate ? formatLongDate(result.dayDate) : "hari terpilih"}</strong>{" "}
              ({result.headcount} orang). Kode: <code>{result.code}</code>
            </p>
            {result.whatsappGroupUrl ? (
              <a className="button button-primary open-join" href={result.whatsappGroupUrl} target="_blank" rel="noopener noreferrer">
                Gabung Grup WhatsApp
              </a>
            ) : (
              <p className="open-wizard-alert">Link grup akan diberikan admin. Simpan kode pendaftaranmu.</p>
            )}
            <button type="button" className="button button-ghost" onClick={() => onNavigate("home")}>
              Kembali ke Beranda
            </button>
          </div>
        )}
          </div>
        </div>
      </div>

      {lookupOpen && (
        <div
          className="open-modal-scrim"
          role="dialog"
          aria-modal="true"
          aria-label="Cek pendaftaran"
          onClick={(e) => {
            if (e.target === e.currentTarget && lookupPending === null) closeLookup();
          }}
        >
          <div className="open-modal">
            <button
              ref={lookupCloseRef}
              type="button"
              className="open-promo-close"
              aria-label="Tutup"
              disabled={lookupPending !== null}
              onClick={closeLookup}
            >
              <X size={18} />
            </button>
            <h2>Cek / batalkan pendaftaran</h2>
            <p className="open-step-hint">Masukkan NIK dan nomor WhatsApp yang dipakai mendaftar.</p>
            <OpenFormField
              label="NIK KTP"
              inputMode="numeric"
              maxLength={16}
              value={lookupNik}
              onChange={(value) => {
                setLookupNik(value.replace(/\D/g, "").slice(0, 16));
                setLookupError(null);
              }}
            />
            <OpenFormField
              label="Nomor WhatsApp"
              inputMode="tel"
              value={lookupWhatsapp}
              error={lookupError ?? undefined}
              helper="Sama dengan yang dipakai saat mendaftar."
              onChange={(value) => {
                setLookupWhatsapp(value.replace(/[^\d]/g, "").slice(0, 15));
                setLookupError(null);
              }}
            />
            {lookupResult === "none" && <p className="open-wizard-alert">Tidak ada pendaftaran aktif untuk data tersebut.</p>}
            {lookupResult && lookupResult !== "none" && (
              <div className="open-lookup-result">
                <p>
                  Terdaftar untuk{" "}
                  <strong>{lookupResult.dayDate ? formatLongDate(lookupResult.dayDate) : "hari terpilih"}</strong>.
                </p>
                {lookupResult.whatsappGroupUrl && (
                  <a className="button button-ghost" href={lookupResult.whatsappGroupUrl} target="_blank" rel="noopener noreferrer">
                    Buka Grup WhatsApp
                  </a>
                )}
                <button type="button" className="button button-danger" disabled={lookupPending !== null} onClick={runCancel}>
                  {lookupPending === "cancel" ? <ButtonSpinner label="Membatalkan..." /> : "Batalkan pendaftaran"}
                </button>
              </div>
            )}
            <div className="wizard-actions">
              <button
                type="button"
                className="button button-ghost"
                onClick={closeLookup}
              >
                Tutup
              </button>
              <button type="button" className="button button-primary" disabled={lookupPending !== null} onClick={runLookup}>
                {lookupPending === "lookup" ? <ButtonSpinner label="Memeriksa..." /> : "Cek"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

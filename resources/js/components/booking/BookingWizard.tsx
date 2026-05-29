import { useRef, useState } from "react";
import type { ChangeEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  UploadCloud,
} from "lucide-react";
import type {
  Booking,
  BookingForm,
  PublicDateStatus,
  Screen,
  VisitDay,
} from "../../domain/types";
import {
  addMonths,
  calendarWeekdays,
  createCalendarDays,
  formatDateKey,
  formatMonthTitle,
  isSameMonth,
  isWithinRange,
  legendStatuses,
  parseDateKey,
  publicSlotStatusLabel,
  publicSlotStatusToClass,
  publicStatusMeta,
  startOfDay,
  startOfMonth,
} from "../../lib/date";
import { wizardSteps } from "../../constants";
import { submitPublicBooking } from "../../api/bookings";
import type { ApiBooking } from "../../api/bookings";
import { ValidationError } from "../../api/client";
import { MikyGuide } from "../MikyGuide";

// Adapter lokal: ApiBooking → Booking. Identik dengan helper di App.tsx tapi
// di-inline di sini agar wizard tidak bergantung pada App.tsx.
function apiBookingToLocal(b: ApiBooking): Booking {
  return {
    code: b.code,
    contactName: b.contactName,
    nik: b.nik ?? "",
    nikMasked: b.nikMasked,
    whatsapp: b.whatsapp,
    institution: b.institution,
    groupSize: b.groupSize,
    date: b.date,
    dateLabel: b.dateLabel,
    time: b.time,
    status: b.status,
    documentName: b.documentName,
    submittedAt: b.submittedAt,
    note: b.note ?? undefined,
    feedbackToken: b.feedbackToken,
    completedAt: b.completedAt ?? undefined,
    proposedDate: b.proposedDate ?? undefined,
    proposedDateLabel: b.proposedDateLabel ?? undefined,
    proposedTime: b.proposedTime ?? undefined,
    proposedAt: b.proposedAt ?? undefined,
  };
}

export function BookingWizard({
  schedules,
  bookings,
  onScheduleLock,
  onBookingCreate,
  onShowExampleLetter,
  onShowSchedule,
  onNavigate,
}: {
  schedules: VisitDay[];
  bookings: Booking[];
  onScheduleLock: (schedules: VisitDay[]) => void;
  onBookingCreate: (booking: Booking) => void;
  onShowExampleLetter: () => void;
  onShowSchedule: () => void;
  onNavigate: (screen: Screen) => void;
}) {
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successCode, setSuccessCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // File asli surat permohonan disimpan di ref, bukan state, supaya tidak
  // memicu re-render dan tetap kompatibel dengan UX existing yang hanya
  // menampilkan nama file.
  const documentFileRef = useRef<File | null>(null);
  const [form, setForm] = useState<BookingForm>({
    contactName: "",
    nik: "",
    whatsapp: "",
    institution: "",
    groupSize: "",
    date: schedules[0]?.date ?? "",
    time: "",
    documentName: "",
    agreement: false,
  });

  const selectedDay = schedules.find((day) => day.date === form.date) ?? schedules[0];
  const selectedSlot = selectedDay?.slots.find((slot) => slot.time === form.time);

  const setField = <Key extends keyof BookingForm>(key: Key, value: BookingForm[Key]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      const next = { ...current };
      delete next[key];
      delete next.submit;
      return next;
    });
  };

  const validateCurrentStep = () => {
    const nextErrors: Record<string, string> = {};

    if (step === 1) {
      if (!form.contactName.trim()) nextErrors.contactName = "Nama contact person wajib diisi.";
      if (!/^\d{16}$/.test(form.nik)) nextErrors.nik = "NIK harus 16 digit angka.";
      if (!/^(08|628)\d{8,13}$/.test(form.whatsapp)) {
        nextErrors.whatsapp = "Nomor WhatsApp harus aktif, contoh 08xxxxxxxxxx.";
      }
    }

    if (step === 2) {
      if (!form.institution.trim()) nextErrors.institution = "Asal instansi wajib diisi.";
      if (!Number(form.groupSize) || Number(form.groupSize) < 1) {
        nextErrors.groupSize = "Jumlah rombongan harus lebih dari 0.";
      }
    }

    if (step === 3) {
      if (!form.date || !form.time) nextErrors.time = "Pilih tanggal dan jam kunjungan.";
      if (selectedSlot && selectedSlot.status !== "Available") {
        nextErrors.time = "Jadwal ini baru saja tidak tersedia. Pilih slot lain.";
      }
    }

    if (step === 4 && !form.documentName) {
      nextErrors.documentName = "Surat permohonan wajib diunggah.";
    }

    if (step === 6 && !form.agreement) {
      nextErrors.agreement = "Pernyataan wajib disetujui sebelum submit.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const goNext = () => {
    if (!validateCurrentStep()) return;
    if (step === 6) {
      submitBooking();
      return;
    }
    setStep((current) => Math.min(current + 1, wizardSteps.length - 1));
  };

  const submitBooking = () => {
    const day = schedules.find((schedule) => schedule.date === form.date);
    const slot = day?.slots.find((item) => item.time === form.time);

    if (!day || !slot || slot.status !== "Available") {
      setErrors({
        submit: "Mohon maaf, jadwal yang dipilih baru saja tidak tersedia. Silakan pilih tanggal atau jam kunjungan lain.",
      });
      setStep(3);
      return;
    }

    const file = documentFileRef.current;
    if (!file) {
      setErrors({ documentName: "Surat permohonan wajib diunggah." });
      setStep(4);
      return;
    }

    setSubmitting(true);
    const fd = new FormData();
    fd.append("contactName", form.contactName.trim());
    fd.append("nik", form.nik.trim());
    fd.append("whatsapp", form.whatsapp.trim());
    fd.append("institution", form.institution.trim());
    fd.append("groupSize", String(Number(form.groupSize)));
    fd.append("date", day.date);
    fd.append("time", slot.time);
    fd.append("agreement", "1");
    fd.append("document", file);

    submitPublicBooking(fd)
      .then((created) => {
        const localBooking = apiBookingToLocal(created);
        onScheduleLock(
          schedules.map((schedule) =>
            schedule.date === day.date
              ? {
                  ...schedule,
                  slots: schedule.slots.map((item) =>
                    item.time === slot.time ? { ...item, status: "Held" } : item,
                  ),
                }
              : schedule,
          ),
        );
        onBookingCreate(localBooking);
        setSuccessCode(localBooking.code);
        setStep(7);
        setErrors({});
      })
      .catch((err) => {
        if (err instanceof ValidationError) {
          const fieldErrors: Record<string, string> = {};
          for (const [key, msgs] of Object.entries(err.errors)) {
            fieldErrors[key] = msgs[0] ?? "Validasi gagal.";
          }
          setErrors(fieldErrors);
        } else {
          setErrors({ submit: "Tidak dapat mengirim permohonan. Coba lagi." });
        }
      })
      .finally(() => setSubmitting(false));
  };

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const valid = /\.(pdf|jpg|jpeg|png)$/i.test(file.name);
    const tenMb = 10 * 1024 * 1024;
    if (!valid) {
      setErrors({ documentName: "Format file harus PDF, JPG, JPEG, atau PNG." });
      return;
    }
    if (file.size > tenMb) {
      setErrors({ documentName: "Ukuran file maksimal 10 MB." });
      return;
    }
    documentFileRef.current = file;
    setField("documentName", file.name);
  };

  const StepIcon = wizardSteps[step].icon;

  return (
    <section className="wizard-page">
      <div className="wizard-shell">
        <aside className="wizard-guide">
          <MikyGuide
            icon={StepIcon}
            title={wizardSteps[step].title}
            message={wizardSteps[step].miky}
            step={step}
            totalSteps={wizardSteps.length}
            variant={step === 0 ? "welcome" : "default"}
            imageSrc={wizardSteps[step].image}
          />
        </aside>

        <div className="wizard-panel">
          <div className="wizard-content">
            <h1>{wizardSteps[step].title}</h1>
            <p>{wizardSteps[step].helper}</p>

            {step === 0 && (
              <div className="prep-grid">
                {["Data contact person", "Nomor WhatsApp aktif", "Tanggal kunjungan", "Surat permohonan"].map(
                  (item) => (
                    <span key={item}>
                      <Check size={16} aria-hidden="true" />
                      {item}
                      {item === "Tanggal kunjungan" && (
                        <button type="button" className="prep-link" onClick={onShowSchedule}>
                          Cek jadwal
                        </button>
                      )}
                      {item === "Surat permohonan" && (
                        <button type="button" className="prep-link" onClick={onShowExampleLetter}>
                          Lihat contoh
                        </button>
                      )}
                    </span>
                  ),
                )}
              </div>
            )}

            {step === 1 && (
              <div className="form-grid">
                <FormField
                  label="Nama Lengkap CP"
                  value={form.contactName}
                  error={errors.contactName}
                  onChange={(value) => setField("contactName", value)}
                />
                <FormField
                  label="NIK KTP"
                  inputMode="numeric"
                  value={form.nik}
                  error={errors.nik}
                  onChange={(value) => setField("nik", value.replace(/\D/g, "").slice(0, 16))}
                />
                <FormField
                  label="Nomor WhatsApp CP"
                  inputMode="tel"
                  value={form.whatsapp}
                  error={errors.whatsapp}
                  helper="Contoh 08xxxxxxxxxx"
                  onChange={(value) => setField("whatsapp", value.replace(/[^\d]/g, ""))}
                />
              </div>
            )}

            {step === 2 && (
              <div className="form-grid">
                <FormField
                  label="Asal Instansi"
                  value={form.institution}
                  error={errors.institution}
                  onChange={(value) => setField("institution", value)}
                />
                <FormField
                  label="Jumlah Rombongan"
                  inputMode="numeric"
                  value={form.groupSize}
                  error={errors.groupSize}
                  helper="Isi jumlah peserta yang akan hadir"
                  onChange={(value) => setField("groupSize", value.replace(/\D/g, ""))}
                />
              </div>
            )}

            {step === 3 && (
              <SchedulePicker
                schedules={schedules}
                selectedDate={form.date}
                selectedTime={form.time}
                error={errors.time || errors.submit}
                onDateChange={(date) => {
                  setField("date", date);
                  setField("time", "");
                }}
                onTimeChange={(time) => setField("time", time)}
              />
            )}

            {step === 4 && (
              <div className="upload-box">
                <UploadCloud size={42} aria-hidden="true" />
                <strong>{form.documentName || "Unggah surat permohonan"}</strong>
                <p>PDF, JPG, JPEG, atau PNG. Maksimal 10 MB.</p>
                <label className="button button-secondary">
                  Pilih File
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFile} />
                </label>
                {errors.documentName && <small className="field-error">{errors.documentName}</small>}
              </div>
            )}

            {step === 5 && <ReviewCard form={form} selectedDay={selectedDay} />}

            {step === 6 && (
              <div className="agreement-box">
                <label>
                  <input
                    type="checkbox"
                    checked={form.agreement}
                    onChange={(event) => setField("agreement", event.target.checked)}
                  />
                  <span>
                    Saya menyatakan data yang diisi benar dan rombongan bersedia mengikuti aturan
                    kunjungan Istana Kepresidenan Yogyakarta.
                  </span>
                </label>
                {errors.agreement && <small className="field-error">{errors.agreement}</small>}
              </div>
            )}

            {step === 7 && (
              <div className="success-box">
                <BadgeCheck size={58} aria-hidden="true" />
                <strong>{successCode}</strong>
                <p>
                  Permohonan berhasil dikirim dengan status Pending. Admin akan menghubungi maksimal
                  1x24 jam melalui WhatsApp.
                </p>
              </div>
            )}
          </div>

          <div className="wizard-actions">
            {step < 7 ? (
              <>
                <button
                  className="button button-ghost"
                  type="button"
                  onClick={() => {
                    if (step === 0) {
                      onNavigate("home");
                    } else {
                      setStep((current) => Math.max(current - 1, 0));
                    }
                  }}
                >
                  <ArrowLeft size={18} aria-hidden="true" />
                  Kembali
                </button>
                <button
                  className="button button-primary"
                  type="button"
                  onClick={goNext}
                >
                  {step === 6 ? "Submit Booking" : "Lanjut"}
                  <ArrowRight size={18} aria-hidden="true" />
                </button>
              </>
            ) : (
              <button
                className="button button-primary wizard-actions-single"
                type="button"
                onClick={() => onNavigate("home")}
              >
                <ArrowLeft size={18} aria-hidden="true" />
                Kembali ke Beranda
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function FormField({
  label,
  value,
  error,
  helper,
  inputMode,
  onChange,
}: {
  label: string;
  value: string;
  error?: string;
  helper?: string;
  inputMode?: "text" | "numeric" | "tel";
  onChange: (value: string) => void;
}) {
  return (
    <label className="form-field">
      <span>{label}</span>
      <input
        value={value}
        inputMode={inputMode}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
      />
      {helper && <small>{helper}</small>}
      {error && <small className="field-error">{error}</small>}
    </label>
  );
}

function SchedulePicker({
  schedules,
  selectedDate,
  selectedTime,
  error,
  onDateChange,
  onTimeChange,
}: {
  schedules: VisitDay[];
  selectedDate: string;
  selectedTime: string;
  error?: string;
  onDateChange: (date: string) => void;
  onTimeChange: (time: string) => void;
}) {
  const [today] = useState(() => startOfDay(new Date()));
  const minMonth = startOfMonth(today);
  const maxScheduleDate = addMonths(today, 2);
  const maxMonth = startOfMonth(maxScheduleDate);

  const initialMonth = selectedDate ? startOfMonth(parseDateKey(selectedDate)) : minMonth;
  const [visibleMonth, setVisibleMonth] = useState(() => initialMonth);

  const scheduleByKey = new Map(schedules.map((day) => [day.date, day]));

  const dayStatus = (date: Date): PublicDateStatus => {
    if (!isSameMonth(date, visibleMonth) || !isWithinRange(date, today, maxScheduleDate)) {
      return "outside";
    }

    const found = scheduleByKey.get(formatDateKey(date));
    if (!found) return "closed";

    const hasAvailable = found.slots.some((slot) => slot.status === "Available");
    const hasPending = found.slots.some(
      (slot) => slot.status === "Held" || slot.status === "Reschedule Hold",
    );
    if (hasAvailable) return "available";
    if (hasPending) return "processing";
    const allClosed = found.slots.every((slot) => slot.status === "Closed");
    if (allClosed) return "closed";
    return "full";
  };

  const calendarDays = createCalendarDays(visibleMonth, today, maxScheduleDate).map((day) => ({
    ...day,
    status: dayStatus(day.date),
  }));

  const selectedDay = scheduleByKey.get(selectedDate);
  const canGoPrev = visibleMonth > minMonth;
  const canGoNext = visibleMonth < maxMonth;

  const handleMonthChange = (amount: number) => {
    const next = startOfMonth(addMonths(visibleMonth, amount));
    if (next < minMonth || next > maxMonth) return;
    setVisibleMonth(next);
  };

  return (
    <div className="schedule-picker">
      <div className="availability-layout availability-layout--inline">
        <section className="calendar-card" aria-label="Kalender ketersediaan jadwal">
          <div className="calendar-toolbar">
            <button
              type="button"
              onClick={() => handleMonthChange(-1)}
              disabled={!canGoPrev}
              aria-label="Bulan sebelumnya"
            >
              <ChevronLeft size={24} aria-hidden="true" />
            </button>
            <strong>{formatMonthTitle(visibleMonth)}</strong>
            <button
              type="button"
              onClick={() => handleMonthChange(1)}
              disabled={!canGoNext}
              aria-label="Bulan berikutnya"
            >
              <ChevronRight size={24} aria-hidden="true" />
            </button>
          </div>

          <div className="calendar-weekdays" aria-hidden="true">
            {calendarWeekdays.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>

          <div className="calendar-grid">
            {calendarDays.map((day) => {
              const isClickable = day.status === "available";
              return (
                <button
                  className={`calendar-day is-${day.status}${selectedDate === day.key ? " is-selected" : ""}`}
                  type="button"
                  key={day.key}
                  disabled={day.status === "outside" || !isClickable}
                  onClick={() => {
                    onDateChange(day.key);
                    onTimeChange("");
                  }}
                  aria-pressed={selectedDate === day.key}
                >
                  {day.date.getDate()}
                </button>
              );
            })}
          </div>
        </section>

        <section className="time-card" aria-label="Pilihan jam kunjungan">
          <h3>Pilih Jam Kunjungan</h3>
          <p>{selectedDay?.label ?? "Pilih tanggal terlebih dahulu"}</p>
          <div className="time-list time-list--hourly">
            {selectedDay ? (
              selectedDay.slots.map((slot) => {
                const klass = publicSlotStatusToClass(slot.status);
                const isClickable = slot.status === "Available";
                const isSelected = selectedTime === slot.time;
                return (
                  <button
                    className={`time-option is-${klass}${isSelected ? " is-selected" : ""}`}
                    type="button"
                    key={slot.time}
                    disabled={!isClickable}
                    aria-pressed={isSelected}
                    onClick={() => onTimeChange(slot.time)}
                  >
                    <Clock3 size={20} aria-hidden="true" />
                    <span>
                      <strong>{slot.time} WIB</strong>
                      <small>{publicSlotStatusLabel[slot.status]}</small>
                    </span>
                  </button>
                );
              })
            ) : (
              <p className="time-empty">Tidak ada slot pada tanggal ini.</p>
            )}
          </div>
        </section>
      </div>

      <div className="availability-legend availability-legend--inline" aria-label="Keterangan status jadwal">
        <strong>Keterangan:</strong>
        {legendStatuses.map((status) => (
          <span key={status}>
            <i className={`legend-dot is-${status}`} />
            {publicStatusMeta[status].label}
          </span>
        ))}
      </div>

      {error && <small className="field-error">{error}</small>}
    </div>
  );
}

function ReviewCard({ form, selectedDay }: { form: BookingForm; selectedDay?: VisitDay }) {
  const rows = [
    ["Nama CP", form.contactName],
    ["NIK", form.nik],
    ["WhatsApp", form.whatsapp],
    ["Instansi", form.institution],
    ["Rombongan", `${form.groupSize} orang`],
    ["Jadwal", `${selectedDay?.label ?? "-"}, ${form.time} WIB`],
    ["Surat", form.documentName],
  ];

  return (
    <div className="review-card">
      {rows.map(([label, value]) => (
        <div key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}

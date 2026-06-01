import { useEffect, useId, useRef, useState } from "react";
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
  BookingSegment,
  FooterContact,
  PublicDateStatus,
  Screen,
  VisitDay,
} from "../../domain/types";
import {
  canFitConsecutiveSlots,
  hasConsecutiveAvailableSlots,
  MAX_BOOKING_GROUP_SIZE,
  previewSegmentsForSelection,
  requiredSlotCount,
  SLOT_CAPACITY,
  splitGroupSizes,
} from "../../domain/booking";
import {
  addDays,
  addMonths,
  calendarWeekdays,
  createCalendarDays,
  formatDateKey,
  formatMonthTitle,
  isSameMonth,
  isWithinRange,
  jakartaToday,
  legendStatuses,
  parseDateKey,
  publicSlotStatusLabel,
  publicSlotStatusToClass,
  publicStatusMeta,
  startOfMonth,
} from "../../lib/date";
import { INITIAL_FOOTER_CONTACTS, wizardSteps } from "../../constants";
import { submitPublicBooking } from "../../api/bookings";
import type { ApiBooking } from "../../api/bookings";
import { ValidationError } from "../../api/client";
import { buildWhatsappTextUrl, normalizeWhatsapp } from "../../lib/whatsapp";
import { MikyGuide } from "../MikyGuide";
import { WhatsAppIcon } from "../icons/SocialIcons";
import { ButtonSpinner, InlineSpinner, SectionSkeleton } from "../ui/LoadingStates";

// Adapter lokal: ApiBooking → Booking. Identik dengan helper di App.tsx tapi
// di-inline di sini agar wizard tidak bergantung pada App.tsx.
function apiBookingToLocal(b: ApiBooking): Booking {
  return {
    code: b.code,
    contactName: b.contactName,
    nik: b.nik ?? b.nikMasked ?? "",
    nikMasked: b.nikMasked,
    whatsapp: b.whatsapp,
    institution: b.institution,
    groupSize: b.groupSize,
    kloterCount: b.kloterCount,
    segments: b.segments,
    date: b.date,
    dateLabel: b.dateLabel,
    time: b.time,
    status: b.status,
    documentName: b.documentName,
    hasDocument: b.hasDocument ?? true,
    submittedAt: b.submittedAt,
    leadTimeDays: b.leadTimeDays ?? undefined,
    isShortNotice: b.isShortNotice ?? false,
    note: b.note ?? undefined,
    feedbackToken: b.feedbackToken ?? "",
    completedAt: b.completedAt ?? undefined,
    proposedDate: b.proposedDate ?? undefined,
    proposedDateLabel: b.proposedDateLabel ?? undefined,
    proposedTime: b.proposedTime ?? undefined,
    proposedSegments: b.proposedSegments ?? undefined,
    proposedAt: b.proposedAt ?? undefined,
  };
}

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const GROUP_SIZE_INPUT_MAX_LENGTH = String(MAX_BOOKING_GROUP_SIZE).length;
const imagePreloadCache = new Map<string, Promise<void>>();

function preloadImage(src: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  const cached = imagePreloadCache.get(src);
  if (cached) return cached;

  const promise = new Promise<void>((resolve) => {
    const img = new Image();
    const done = () => resolve();
    img.onload = () => {
      if (typeof img.decode === "function") {
        void img.decode().then(done).catch(done);
        return;
      }
      done();
    };
    img.onerror = done;
    img.src = src;
  });
  imagePreloadCache.set(src, promise);

  return promise;
}

function getWhatsappContact(contacts: FooterContact[]) {
  return (
    contacts.find((contact) => contact.iconKey === "whatsapp") ??
    INITIAL_FOOTER_CONTACTS.find((contact) => contact.iconKey === "whatsapp")
  );
}

function getWhatsappNumber(contact?: FooterContact) {
  if (!contact) return "";
  const numberFromHref = contact.href.match(/wa\.me\/(\d+)/)?.[1];
  const rawNumber = numberFromHref ?? contact.value;
  return normalizeWhatsapp(rawNumber.replace(/\D/g, ""));
}

function buildLargeGroupDiscussionHref(
  contact: FooterContact | undefined,
  form: BookingForm,
  total: number,
  breakdown: number[],
) {
  const phone = getWhatsappNumber(contact);
  if (!phone) return contact?.href ?? "";
  const breakdownLines = breakdown.map((size, index) => `- Kloter ${index + 1}: ${size} orang`).join("\n");
  const message = [
    "Halo Admin ISTURA, saya ingin berdiskusi terkait pembagian kloter kunjungan.",
    "",
    `Instansi: ${form.institution.trim() || "-"}`,
    `Jumlah rombongan: ${total} orang`,
    "Pembagian otomatis dari sistem:",
    breakdownLines,
    "",
    "Apakah memungkinkan ada penyesuaian pembagian kloter?",
  ].join("\n");
  return buildWhatsappTextUrl(phone, message);
}

function firstAvailableScheduleDate(schedules: VisitDay[], minDateKey: string) {
  return schedules.find((day) => day.date >= minDateKey && day.slots.some((slot) => slot.status === "Available"))?.date ??
    schedules.find((day) => day.date >= minDateKey)?.date ??
    "";
}

export function BookingWizard({
  schedules,
  bookings,
	contacts = INITIAL_FOOTER_CONTACTS,
	onScheduleLock,
	scheduleLoading = false,
	onBookingCreate,
  onShowExampleLetter,
  onShowSchedule,
  onNavigate,
}: {
  schedules: VisitDay[];
  bookings: Booking[];
	contacts?: FooterContact[];
	onScheduleLock: (schedules: VisitDay[]) => void;
	scheduleLoading?: boolean;
	onBookingCreate: (booking: Booking) => void;
  onShowExampleLetter: () => void;
  onShowSchedule: () => void;
  onNavigate: (screen: Screen) => void;
}) {
  const documentInputId = useId();
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successCode, setSuccessCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [stepTransitioning, setStepTransitioning] = useState(false);
  // File asli surat permohonan disimpan di ref, bukan state, supaya tidak
  // memicu re-render dan tetap kompatibel dengan UX existing yang hanya
  // menampilkan nama file.
  const documentFileRef = useRef<File | null>(null);
  const [today] = useState(jakartaToday);
  const minBookingDate = addDays(today, 1);
  const minBookingDateKey = formatDateKey(minBookingDate);
  const initialDate = firstAvailableScheduleDate(schedules, minBookingDateKey);
  const [form, setForm] = useState<BookingForm>({
    contactName: "",
    nik: "",
    whatsapp: "",
    institution: "",
    groupSize: "",
    date: initialDate,
    time: "",
    documentName: "",
    agreement: false,
  });

  useEffect(() => {
    if (!initialDate) return;
    setForm((current) => (current.date && current.date >= minBookingDateKey ? current : { ...current, date: initialDate }));
  }, [initialDate, minBookingDateKey]);

  useEffect(() => {
    void Promise.all(wizardSteps.map((item) => preloadImage(item.image)));
  }, []);

  const selectedDay = schedules.find((day) => day.date === form.date) ?? schedules[0];
  const selectedSlot = selectedDay?.slots.find((slot) => slot.time === form.time);
  const groupSizeNumber = Number(form.groupSize);
  const neededSlots = requiredSlotCount(groupSizeNumber);
  const groupBreakdown = splitGroupSizes(groupSizeNumber);
  const selectedSegments = previewSegmentsForSelection(selectedDay, form.time, groupSizeNumber);
  const whatsappContact = getWhatsappContact(contacts);
  const largeGroupDiscussionHref = buildLargeGroupDiscussionHref(whatsappContact, form, groupSizeNumber, groupBreakdown);

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
      const groupSize = Number(form.groupSize);
      if (!groupSize || groupSize < 1) {
        nextErrors.groupSize = "Jumlah rombongan harus lebih dari 0.";
      } else if (groupSize > MAX_BOOKING_GROUP_SIZE) {
        nextErrors.groupSize = `Jumlah rombongan maksimal ${MAX_BOOKING_GROUP_SIZE} orang per hari kunjungan.`;
      }
    }

    if (step === 3) {
      if (!form.date || !form.time) nextErrors.time = "Pilih tanggal dan jam kunjungan.";
      if (form.date && form.date < minBookingDateKey) {
        nextErrors.time = "Tanggal kunjungan paling cepat besok.";
      }
      if (selectedSlot && selectedSlot.status !== "Available") {
        nextErrors.time = "Jadwal ini baru saja tidak tersedia. Pilih slot lain.";
      }
      if (form.date && form.time && !canFitConsecutiveSlots(selectedDay, form.time, neededSlots)) {
        nextErrors.time = `Rombongan ini membutuhkan ${neededSlots} slot berurutan. Pilih jam mulai lain.`;
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

  const goNext = async () => {
    if (!validateCurrentStep()) return;
    if (step === 6) {
      submitBooking();
      return;
    }
    const nextStep = Math.min(step + 1, wizardSteps.length - 1);
    setStepTransitioning(true);
    await preloadImage(wizardSteps[nextStep].image);
    setStep(nextStep);
    setStepTransitioning(false);
  };

	const submitBooking = () => {
		if (submitting) return;
		const day = schedules.find((schedule) => schedule.date === form.date);
    const slot = day?.slots.find((item) => item.time === form.time);

    if (!day || !slot || slot.status !== "Available" || !canFitConsecutiveSlots(day, slot.time, neededSlots)) {
      setErrors({
        submit: "Mohon maaf, slot berurutan untuk jumlah rombongan ini tidak tersedia. Silakan pilih jam mulai lain.",
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
        const lockedTimes = new Set((localBooking.segments ?? selectedSegments).map((segment) => segment.time));
        onScheduleLock(
          schedules.map((schedule) =>
            schedule.date === day.date
              ? {
                  ...schedule,
                  slots: schedule.slots.map((item) =>
                    lockedTimes.has(item.time) ? { ...item, status: "Held" } : item,
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
            const fieldKey = key === "document" ? "documentName" : key;
            fieldErrors[fieldKey] = msgs[0] ?? "Validasi gagal.";
          }
          setErrors(fieldErrors);
          const targetStep = validationErrorStep(fieldErrors);
          if (targetStep !== null) setStep(targetStep);
        } else {
          setErrors({ submit: "Tidak dapat mengirim permohonan. Coba lagi." });
        }
      })
      .finally(() => setSubmitting(false));
  };

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const rejectFile = (message: string) => {
      documentFileRef.current = null;
      event.currentTarget.value = "";
      setForm((current) => ({ ...current, documentName: "" }));
      setErrors((current) => ({ ...current, documentName: message }));
    };

    const valid = /\.(pdf|jpg|jpeg|png)$/i.test(file.name);
    if (!valid) {
      rejectFile("Format file harus PDF, JPG, JPEG, atau PNG.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      rejectFile("Ukuran file maksimal 5 MB.");
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
              <>
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
                    maxLength={GROUP_SIZE_INPUT_MAX_LENGTH}
                    value={form.groupSize}
                    error={errors.groupSize}
                    onChange={(value) => setField("groupSize", normalizeGroupSizeInput(value))}
                  />
                </div>
                {groupSizeNumber > SLOT_CAPACITY && groupSizeNumber <= MAX_BOOKING_GROUP_SIZE && (
                  <KloterBreakdown
                    total={groupSizeNumber}
                    breakdown={groupBreakdown}
                    discussionHref={largeGroupDiscussionHref}
                  />
                )}
              </>
            )}

			{step === 3 && (
				<SchedulePicker
					schedules={schedules}
						loading={scheduleLoading}
						minDate={minBookingDate}
						requiredSlots={neededSlots}
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
                <p>PDF, JPG, JPEG, atau PNG. Maksimal 5 MB.</p>
                <label className="button button-secondary" htmlFor={documentInputId}>
                  Pilih File
                  <input id={documentInputId} type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFile} />
                </label>
                {errors.documentName && <small className="field-error">{errors.documentName}</small>}
              </div>
            )}

            {step === 5 && <ReviewCard form={form} selectedDay={selectedDay} segments={selectedSegments} />}

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
                {errors.submit && <small className="field-error">{errors.submit}</small>}
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
						disabled={submitting || stepTransitioning}
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
						disabled={submitting || stepTransitioning || (step === 3 && scheduleLoading && schedules.length === 0)}
						onClick={() => void goNext()}
					>
						{stepTransitioning ? (
							<ButtonSpinner label="Menyiapkan langkah..." />
						) : step === 6 && submitting ? (
							<ButtonSpinner label="Mengirim permohonan..." />
						) : (
							<>
								{step === 6 ? "Submit Booking" : "Lanjut"}
								<ArrowRight size={18} aria-hidden="true" />
							</>
						)}
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

function normalizeGroupSizeInput(value: string): string {
  return value.replace(/\D/g, "").slice(0, GROUP_SIZE_INPUT_MAX_LENGTH);
}

function validationErrorStep(errors: Record<string, string>): number | null {
  if (["contactName", "nik", "whatsapp"].some((key) => errors[key])) return 1;
  if (["institution", "groupSize"].some((key) => errors[key])) return 2;
  if (["date", "time"].some((key) => errors[key])) return 3;
  if (errors.documentName) return 4;
  if (errors.agreement) return 6;
  return null;
}

function KloterBreakdown({
  total,
  breakdown,
  discussionHref,
}: {
  total: number;
  breakdown: number[];
  discussionHref: string;
}) {
  return (
    <div className="kloter-breakdown" role="status" aria-live="polite">
      <strong>
        Rombongan {total} orang akan dibagi menjadi {breakdown.length} kloter:
      </strong>
      <p className="kloter-breakdown-copy">
        Pembagian ini membantu kunjungan tetap tertib dan nyaman.
      </p>
      <div className="kloter-breakdown-list">
        {breakdown.map((size, index) => (
          <span key={index}>
            Kloter {index + 1}: {size} orang
          </span>
        ))}
      </div>
      <div className="kloter-breakdown-actions">
        {discussionHref && (
          <a
            className="button button-secondary kloter-whatsapp-link"
            href={discussionHref}
            target="_blank"
            rel="noopener noreferrer"
          >
            <WhatsAppIcon />
            Diskusi dengan Admin
          </a>
        )}
      </div>
    </div>
  );
}

function SchedulePicker({
	schedules,
	loading = false,
	minDate,
	requiredSlots,
	selectedDate,
  selectedTime,
  error,
  onDateChange,
  onTimeChange,
}: {
	schedules: VisitDay[];
	loading?: boolean;
	minDate: Date;
	requiredSlots: number;
	selectedDate: string;
  selectedTime: string;
  error?: string;
  onDateChange: (date: string) => void;
  onTimeChange: (time: string) => void;
}) {
  const [today] = useState(() => addDays(minDate, -1));
  const minMonth = startOfMonth(minDate);
  const maxScheduleDate = addMonths(today, 2);
  const maxMonth = startOfMonth(maxScheduleDate);

  const initialMonth = selectedDate ? startOfMonth(parseDateKey(selectedDate)) : minMonth;
  const [visibleMonth, setVisibleMonth] = useState(() => initialMonth);

  const scheduleByKey = new Map(schedules.map((day) => [day.date, day]));

  const dayStatus = (date: Date): PublicDateStatus => {
    if (!isSameMonth(date, visibleMonth) || !isWithinRange(date, minDate, maxScheduleDate)) {
      return "outside";
    }

    const found = scheduleByKey.get(formatDateKey(date));
    if (!found) return "closed";

    const hasAvailable = hasConsecutiveAvailableSlots(found, requiredSlots);
    const hasPending = found.slots.some(
      (slot) => slot.status === "Held" || slot.status === "Reschedule Hold",
    );
    if (hasAvailable) return "available";
    if (hasPending) return "processing";
    const allClosed = found.slots.every((slot) => slot.status === "Closed");
    if (allClosed) return "closed";
    return "full";
  };

  const calendarDays = createCalendarDays(visibleMonth, minDate, maxScheduleDate).map((day) => ({
    ...day,
    status: dayStatus(day.date),
  }));

  const selectedDay = scheduleByKey.get(selectedDate);
  const selectedSlotOrders = new Map<string, number>();
  if (requiredSlots > 1 && selectedDay && selectedTime) {
    const startIndex = selectedDay.slots.findIndex((slot) => slot.time === selectedTime);
    if (startIndex >= 0) {
      selectedDay.slots.slice(startIndex, startIndex + requiredSlots).forEach((slot, index) => {
        selectedSlotOrders.set(slot.time, index + 1);
      });
    }
  }
  const canGoPrev = visibleMonth > minMonth;
  const canGoNext = visibleMonth < maxMonth;

  const handleMonthChange = (amount: number) => {
    const next = startOfMonth(addMonths(visibleMonth, amount));
    if (next < minMonth || next > maxMonth) return;
    setVisibleMonth(next);
  };

	return (
		<div className="schedule-picker">
			{loading && <InlineSpinner label="Memuat slot kunjungan" />}
			{loading && schedules.length === 0 ? (
				<div className="availability-layout availability-layout--inline availability-layout--loading" aria-busy="true">
					<section className="calendar-card" aria-label="Memuat kalender ketersediaan jadwal">
						<SectionSkeleton rows={8} />
					</section>
					<section className="time-card" aria-label="Memuat pilihan jam kunjungan">
						<SectionSkeleton rows={5} />
					</section>
				</div>
			) : (
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
                const isClickable = canFitConsecutiveSlots(selectedDay, slot.time, requiredSlots);
                const klass = slot.status === "Available" && !isClickable ? "full" : publicSlotStatusToClass(slot.status);
                const selectedOrder = selectedSlotOrders.get(slot.time);
                const isSelected = selectedTime === slot.time;
                const isAutoSelected = requiredSlots > 1 && Boolean(selectedOrder);
                const availableLabel = requiredSlots > 1 ? "Pilih jam mulai" : publicSlotStatusLabel[slot.status];
                const disabledLabel = slot.status === "Available" && !isClickable
                  ? `Butuh ${requiredSlots} slot berurutan`
                  : publicSlotStatusLabel[slot.status];
                return (
                  <button
                    className={`time-option is-${klass}${isSelected ? " is-selected" : ""}${isAutoSelected ? " is-kloter-selected" : ""}${isAutoSelected && !isSelected ? " is-kloter-following" : ""}`}
                    type="button"
                    key={slot.time}
                    disabled={!isClickable}
                    aria-pressed={isSelected}
                    onClick={() => onTimeChange(slot.time)}
                  >
                    <Clock3 size={20} aria-hidden="true" />
                    <span>
                      <strong>{slot.time} WIB</strong>
                      <small>{isAutoSelected ? `Kloter ${selectedOrder}` : isClickable ? availableLabel : disabledLabel}</small>
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
			)}

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

function ReviewCard({
  form,
  selectedDay,
  segments,
}: {
  form: BookingForm;
  selectedDay?: VisitDay;
  segments: BookingSegment[];
}) {
  const hasMultipleSegments = segments.length > 1;
  const kloterSummary = segments.length > 1
    ? `${form.groupSize} orang (${segments.length} kloter)`
    : `${form.groupSize} orang`;
  const scheduleSegments = segments.length > 0
    ? segments
    : [{ order: 1, date: form.date, dateLabel: selectedDay?.label ?? "-", time: form.time, groupSize: Number(form.groupSize) || 0 }];
  const scheduleSummary = `${selectedDay?.label ?? "-"}, ${form.time} WIB`;
  const rows = [
    ["Nama CP", form.contactName],
    ["NIK", form.nik],
    ["WhatsApp", form.whatsapp],
    ["Instansi", form.institution],
  ];

  return (
    <div className="review-card">
      {rows.map(([label, value]) => (
        <div key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
      <div className={hasMultipleSegments ? "review-card-item--wide" : undefined}>
        <span>Rombongan</span>
        <strong>{kloterSummary}</strong>
      </div>
      <div className={`review-card-item--schedule${hasMultipleSegments ? " is-multi" : ""}`}>
        <span>Jadwal</span>
        {hasMultipleSegments ? (
          <div className="review-schedule-list" aria-label="Rincian jadwal per kloter">
            <p className="review-schedule-date">{scheduleSegments[0]?.dateLabel ?? selectedDay?.label ?? "-"}</p>
            {scheduleSegments.map((segment) => (
              <div className="review-schedule-row" key={`${segment.order}-${segment.time}`}>
                <em>Kloter {segment.order}</em>
                <strong>{segment.time} WIB</strong>
                <small>{segment.groupSize} orang</small>
              </div>
            ))}
          </div>
        ) : (
          <strong>{scheduleSummary}</strong>
        )}
      </div>
      <div>
        <span>Surat</span>
        <strong>{form.documentName}</strong>
      </div>
    </div>
  );
}

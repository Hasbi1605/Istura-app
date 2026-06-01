import type { BookingForm } from "../domain/types";

const BOOKING_DRAFT_KEY = "istura-booking-draft-v1";
const BOOKING_DRAFT_TTL_MS = 2 * 60 * 60 * 1000;
const MAX_DRAFT_STEP = 6;
const DOCUMENT_STEP = 4;

type StoredBookingDraft = {
  savedAt: number;
  step: number;
  form: BookingForm;
  documentUploaded?: boolean;
};

export type BookingDraft = {
  savedAt: number;
  step: number;
  form: BookingForm;
  needsDocumentUpload: boolean;
};

const emptyForm: BookingForm = {
  contactName: "",
  nik: "",
  whatsapp: "",
  institution: "",
  groupSize: "",
  date: "",
  time: "",
  documentName: "",
  agreement: false,
};

function getSessionStorage(): Storage | null {
  if (typeof window === "undefined") return null;

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function readBoolean(value: unknown) {
  return typeof value === "boolean" ? value : false;
}

function normalizeStep(value: unknown) {
  const numeric = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return Math.max(0, Math.min(MAX_DRAFT_STEP, Math.floor(numeric)));
}

function normalizeForm(value: unknown): BookingForm | null {
  if (!value || typeof value !== "object") return null;
  const form = value as Partial<BookingForm>;

  return {
    ...emptyForm,
    contactName: readString(form.contactName),
    nik: readString(form.nik),
    whatsapp: readString(form.whatsapp),
    institution: readString(form.institution),
    groupSize: readString(form.groupSize),
    date: readString(form.date),
    time: readString(form.time),
    documentName: "",
    agreement: readBoolean(form.agreement),
  };
}

export function hasBookingDraftContent(form: BookingForm, step: number) {
  return (
    step > 0 ||
    Boolean(
      form.contactName.trim() ||
        form.nik.trim() ||
        form.whatsapp.trim() ||
        form.institution.trim() ||
        form.groupSize.trim() ||
        form.time.trim() ||
        form.documentName.trim() ||
        form.agreement,
    )
  );
}

export function clearBookingDraft() {
  const storage = getSessionStorage();
  if (!storage) return;

  try {
    storage.removeItem(BOOKING_DRAFT_KEY);
  } catch {
    // Browser can deny storage access in private or hardened contexts.
  }
}

export function readBookingDraft(): BookingDraft | null {
  const storage = getSessionStorage();
  if (!storage) return null;

  try {
    const raw = storage.getItem(BOOKING_DRAFT_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<StoredBookingDraft>;
    const savedAt = typeof parsed.savedAt === "number" && Number.isFinite(parsed.savedAt) ? parsed.savedAt : 0;
    if (!savedAt || Date.now() - savedAt > BOOKING_DRAFT_TTL_MS) {
      clearBookingDraft();
      return null;
    }

    const form = normalizeForm(parsed.form);
    if (!form) {
      clearBookingDraft();
      return null;
    }

    const documentUploaded = parsed.documentUploaded === true;
    const requestedStep = normalizeStep(parsed.step);
    const step = documentUploaded && requestedStep > DOCUMENT_STEP ? DOCUMENT_STEP : requestedStep;

    if (!hasBookingDraftContent(form, step) && !documentUploaded) return null;

    return {
      savedAt,
      step,
      form,
      needsDocumentUpload: documentUploaded,
    };
  } catch {
    clearBookingDraft();
    return null;
  }
}

export function hasFreshBookingDraft() {
  return readBookingDraft() !== null;
}

export function writeBookingDraft(step: number, form: BookingForm) {
  const storage = getSessionStorage();
  if (!storage) return;
  if (!hasBookingDraftContent(form, step)) {
    clearBookingDraft();
    return;
  }

  const payload: StoredBookingDraft = {
    savedAt: Date.now(),
    step: normalizeStep(step),
    form: {
      ...form,
      documentName: "",
    },
    documentUploaded: Boolean(form.documentName.trim()),
  };

  try {
    storage.setItem(BOOKING_DRAFT_KEY, JSON.stringify(payload));
  } catch {
    // Best-effort only; validation still protects server submit.
  }
}

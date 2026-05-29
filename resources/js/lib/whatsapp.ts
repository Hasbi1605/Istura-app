// WhatsApp + NIK helpers. Pure except for a module-level cache of the latest
// WA templates (synced by App via setActiveWaTemplates) so the imperative
// message builder doesn't need to be threaded through every callsite.
import type { Booking, BookingStatus, WaTemplate } from "../domain/types";

let activeWaTemplates: WaTemplate[] = [];

export function setActiveWaTemplates(templates: WaTemplate[]): void {
  activeWaTemplates = templates;
}

export function maskNik(nik: string): string {
  if (nik.length < 8) return nik;
  return `${nik.slice(0, 4)}********${nik.slice(-4)}`;
}

export function normalizeWhatsapp(number: string): string {
  if (number.startsWith("08")) return `62${number.slice(1)}`;
  return number.replace(/[^\d]/g, "");
}

export function fillWaTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : match,
  );
}

export function buildWhatsappMessage(
  booking: Booking,
  status: BookingStatus,
  note?: string,
): string {
  const template = activeWaTemplates.find((entry) => entry.id === status);
  if (!template) return `Informasi booking ${booking.code}`;
  const link = `${window.location.origin}/feedback/${booking.code}?token=${booking.feedbackToken}`;
  return fillWaTemplate(template.template, {
    nama: booking.contactName,
    instansi: booking.institution,
    kode: booking.code,
    tanggal: booking.dateLabel,
    jam: booking.time,
    catatan: note ?? "",
    link,
  });
}

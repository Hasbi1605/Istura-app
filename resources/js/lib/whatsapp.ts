// WhatsApp + NIK helpers. Pure except for a module-level cache of the latest
// WA templates (synced by App via setActiveWaTemplates) so the imperative
// message builder doesn't need to be threaded through every callsite.
import type { Booking, BookingStatus, WaTemplate } from "../domain/types";
import { bookingSegments } from "../domain/booking";

let activeWaTemplates: WaTemplate[] = [];

declare global {
  interface Window {
    __ISTURA_CONFIG__?: {
      publicAppUrl?: string;
    };
  }
}

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

export function buildWhatsappTextUrl(phone: string, message: string): string {
  const normalizedPhone = normalizeWhatsapp(phone);

  return `https://api.whatsapp.com/send?phone=${normalizedPhone}&text=${encodeURIComponent(message)}`;
}

export function fillWaTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : match,
  );
}

function fallbackTemplateFor(status: BookingStatus): string | null {
  if (status === "Expired") {
    return [
      "Halo Rencang Istana! \u{1F60A}",
      "salam Humas Gedung Agung",
      "",
      "Terkait permohonan kunjungan Istura (Istana Untuk Rakyat) atas nama *{nama}* dari *{instansi}* dengan kode booking *{kode}*, kami informasikan bahwa jadwal yang diajukan telah terlewat tanpa konfirmasi. \u23F0",
      "",
      "\u{1F4C6} Tanggal awal: *{tanggal_awal}*",
      "\u23F0 Jam: {jam}",
      "",
      "Silakan menunggu tawaran jadwal baru dari kami atau melakukan booking ulang melalui website sesuai slot yang tersedia.",
      "",
      "Mohon maaf atas ketidaknyamanannya,",
      "Humas Gedung Agung",
    ].join("\n");
  }

  if (status !== "Pending") return null;

  return [
    "Halo Rencang Istana! \u{1F60A}",
    "salam Humas Gedung Agung",
    "",
    "Terkait booking kunjungan Istura (Istana Untuk Rakyat) atas nama *{nama}* dari *{instansi}* dengan kode booking *{kode}*, kami informasikan bahwa usulan perubahan jadwal belum dilanjutkan. \u{23F3}",
    "",
    "Status saat ini: *menunggu konfirmasi ulang dari admin*.",
    "",
    "\u{1F4C6} Tanggal kunjungan awal: *{tanggal_awal}*",
    "\u23F0 Jam: {jam}",
    "",
    "Catatan admin:",
    "*{catatan}*",
    "",
    "Kami akan mengirimkan konfirmasi lanjutan setelah jadwal final ditetapkan. Mohon ditunggu, ya.",
    "",
    "Terima kasih atas kesabarannya,",
    "Humas Gedung Agung",
  ].join("\n");
}

function publicAppOrigin(): string {
  const configured =
    import.meta.env.VITE_PUBLIC_APP_URL ??
    window.__ISTURA_CONFIG__?.publicAppUrl ??
    import.meta.env.VITE_APP_URL;
  const trimmed = typeof configured === "string" ? configured.trim() : "";

  return trimmed ? trimmed.replace(/\/+$/, "") : window.location.origin;
}

export function feedbackLinkFor(booking: Booking): string {
  return `${publicAppOrigin()}/feedback/${encodeURIComponent(booking.code)}?token=${encodeURIComponent(booking.feedbackToken)}`;
}

// Tautan ke halaman "Alur & Peraturan Kunjungan" (server-rendered, ber-OG-tag)
// agar WhatsApp menampilkan kartu preview dengan thumbnail. Dipakai placeholder
// {alur} pada template WA; origin mengikuti environment aktif (dev/prod).
export function visitFlowImageUrl(): string {
  return `${publicAppOrigin()}/info/alur-kunjungan`;
}

function formatVisitTimeForWhatsapp(segments: ReturnType<typeof bookingSegments>, fallbackTime: string): string {
  if (segments.length > 1) {
    return segments
      .map((segment) => `• *Kloter ${segment.order}: ${segment.time} WIB (${segment.groupSize} orang)*`)
      .join("\n");
  }

  return `*${segments[0]?.time ?? fallbackTime} WIB*`;
}

function formatGroupSizeForWhatsapp(booking: Booking, segments: ReturnType<typeof bookingSegments>): string {
  return segments.length > 1
    ? `${booking.groupSize} orang (${segments.length} kloter)`
    : `${booking.groupSize} orang`;
}

export function buildWhatsappMessage(
  booking: Booking,
  status: BookingStatus,
  note?: string,
): string {
  const template = activeWaTemplates.find((entry) => entry.id === status);
  const templateText = template?.template ?? fallbackTemplateFor(status);
  if (!templateText) return `Informasi booking ${booking.code}`;
  const link = feedbackLinkFor(booking);
  const segments = status === "Reschedule" && booking.proposedSegments?.length
    ? booking.proposedSegments
    : bookingSegments(booking);
  const jam = formatVisitTimeForWhatsapp(segments, booking.time);
  const tanggalAwal = booking.dateLabel;
  const tanggalUsulan = booking.proposedDateLabel ?? booking.dateLabel;
  const tanggalEfektif = status === "Reschedule" ? tanggalUsulan : tanggalAwal;

  return fillWaTemplate(templateText, {
    nama: booking.contactName,
    instansi: booking.institution,
    kode: booking.code,
    tanggal: tanggalEfektif,
    tanggal_awal: tanggalAwal,
    tanggal_usulan: tanggalUsulan,
    rombongan: formatGroupSizeForWhatsapp(booking, segments),
    jam,
    catatan: note ?? "",
    link,
    alur: visitFlowImageUrl(),
    dokumentasi: booking.documentationLink ?? "",
  });
}

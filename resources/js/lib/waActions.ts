// WhatsApp action helpers that touch the DOM (window.open) — separated from the
// pure builders in lib/whatsapp.ts so components can import without pulling App.
import type { Booking, BookingStatus } from "../domain/types";
import { buildWhatsappMessage, buildWhatsappTextUrl } from "./whatsapp";

export function openWhatsApp(booking: Booking, message: string): void {
  window.open(
    buildWhatsappTextUrl(booking.whatsapp, message),
    "_blank",
    "noopener,noreferrer",
  );
}

export function createWhatsappMessage(
  booking: Booking,
  status: BookingStatus,
  note?: string,
): string {
  return buildWhatsappMessage(booking, status, note);
}

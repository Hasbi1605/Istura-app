// Floating WhatsApp contact widget for public pages. A green FAB that expands
// into a compact, MIKY-branded card with quick-topic shortcuts that prefill an
// official WhatsApp message. Pure presentational + local UI state; reuses the
// CMS-managed footer contacts so the number is never hardcoded.
import { MessageCircle, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { FooterContact } from "../../domain/types";
import { useReducedMotion } from "../../hooks";
import { ASSETS } from "../../lib/assets";
import { buildWhatsappTextUrl } from "../../lib/whatsapp";
import { InstagramIcon, WhatsAppIcon } from "../icons/SocialIcons";

const MIKY_GREETING = "Hai, aku MIKY! Ada yang bisa kubantu soal kunjungan ISTURA? Pilih topik di bawah ya.";

const QUICK_TOPICS: { label: string; message: string }[] = [
  {
    label: "Tanya jadwal kunjungan",
    message:
      "Halo Admin ISTURA, saya ingin menanyakan jadwal kunjungan ke Istana Kepresidenan Yogyakarta.",
  },
  {
    label: "Bantuan proses booking",
    message:
      "Halo Admin ISTURA, saya butuh bantuan terkait proses booking kunjungan ISTURA.",
  },
  {
    label: "Informasi umum",
    message:
      "Halo Admin ISTURA, saya ingin menanyakan informasi umum seputar kunjungan ISTURA.",
  },
];

// Ambil nomor WA bersih: prioritaskan digit dari href (wa.me/62...), fallback ke value.
function resolveWaPhone(contact: FooterContact | undefined): string {
  if (!contact) return "";
  const fromHref = contact.href?.match(/\d+/g)?.join("") ?? "";
  if (fromHref) return fromHref;
  return contact.value.replace(/\s+/g, "");
}

export function FloatingContact({ contacts }: { contacts: FooterContact[] }) {
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const fabRef = useRef<HTMLButtonElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  const waContact = contacts.find((contact) => contact.iconKey === "whatsapp");
  const igContact = contacts.find((contact) => contact.iconKey === "instagram");
  const waPhone = resolveWaPhone(waContact);

  // Escape menutup panel, klik di luar menutup panel.
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
        fabRef.current?.focus();
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  // Pindahkan fokus ke tombol tutup saat panel terbuka agar keyboard-friendly.
  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);

  // Tanpa nomor WA terkonfigurasi, widget tidak relevan.
  if (!waPhone) return null;

  const openWa = (message: string) => {
    window.open(buildWhatsappTextUrl(waPhone, message), "_blank", "noopener,noreferrer");
    setOpen(false);
  };

  return (
    <div
      ref={rootRef}
      className={`floating-contact${open ? " is-open" : ""}`}
      data-reduced={reduced ? "true" : undefined}
    >
      {open && (
        <div
          className="floating-contact-panel"
          id={panelId}
          role="dialog"
          aria-modal="false"
          aria-label="Hubungi ISTURA via WhatsApp"
        >
          <div className="floating-contact-head">
            <span className="floating-contact-avatar" aria-hidden="true">
              <img src={ASSETS.mikyFace} alt="" loading="lazy" decoding="async" />
            </span>
            <div className="floating-contact-intro">
              <strong>MIKY · Tim ISTURA</strong>
              <p>{MIKY_GREETING}</p>
            </div>
            <button
              ref={closeRef}
              type="button"
              className="floating-contact-close"
              onClick={() => {
                setOpen(false);
                fabRef.current?.focus();
              }}
              aria-label="Tutup"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          <div className="floating-contact-topics">
            {QUICK_TOPICS.map((topic) => (
              <button
                key={topic.label}
                type="button"
                className="floating-contact-topic"
                onClick={() => openWa(topic.message)}
              >
                <MessageCircle size={16} aria-hidden="true" />
                <span>{topic.label}</span>
              </button>
            ))}
          </div>

          <div className="floating-contact-actions">
            <button
              type="button"
              className="floating-contact-primary"
              onClick={() =>
                openWa("Halo Admin ISTURA, saya ingin bertanya seputar kunjungan ISTURA.")
              }
            >
              <WhatsAppIcon />
              <span>Chat via WhatsApp</span>
            </button>
            {igContact && (
              <a
                className="floating-contact-secondary"
                href={igContact.href}
                target="_blank"
                rel="noreferrer"
                aria-label={`Instagram: ${igContact.value}`}
              >
                <InstagramIcon />
                <span>Instagram</span>
              </a>
            )}
          </div>
        </div>
      )}

      <button
        ref={fabRef}
        type="button"
        className="floating-contact-fab"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={open ? "Tutup kontak WhatsApp" : "Hubungi ISTURA via WhatsApp"}
      >
        {!reduced && <span className="floating-contact-ping" aria-hidden="true" />}
        <span className="floating-contact-fab-icon" aria-hidden="true">
          {open ? <X size={26} /> : <WhatsAppIcon />}
        </span>
        {!open && (
          <span className="floating-contact-fab-badge" aria-hidden="true">
            <img src={ASSETS.mikyFace} alt="" loading="lazy" decoding="async" />
          </span>
        )}
      </button>
    </div>
  );
}

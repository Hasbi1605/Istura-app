// Floating WhatsApp contact widget for public pages. A green FAB that expands
// into a compact, MIKY-branded card with quick-topic shortcuts that prefill an
// official WhatsApp message. Pure presentational + local UI state; the WA number
// comes from CMS-managed footer contacts, and the greeting + topics come from
// CMS site content so admins can edit them without a deploy.
import { MessageCircle, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { FooterContact, SiteContent } from "../../domain/types";
import { useReducedMotion, useTypewriter } from "../../hooks";
import { ASSETS } from "../../lib/assets";
import { buildWhatsappTextUrl } from "../../lib/whatsapp";
import { InstagramIcon, WhatsAppIcon } from "../icons/SocialIcons";

const PRIMARY_MESSAGE = "Halo Admin ISTURA, saya ingin bertanya seputar kunjungan ISTURA.";

// Ambil nomor WA bersih: prioritaskan digit dari href (wa.me/62...), fallback ke value.
function resolveWaPhone(contact: FooterContact | undefined): string {
  if (!contact) return "";
  const fromHref = contact.href?.match(/\d+/g)?.join("") ?? "";
  if (fromHref) return fromHref;
  return contact.value.replace(/\s+/g, "");
}

export function FloatingContact({
  contacts,
  content,
}: {
  contacts: FooterContact[];
  content: SiteContent["floatingContact"];
}) {
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const fabRef = useRef<HTMLButtonElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  const waContact = contacts.find((contact) => contact.iconKey === "whatsapp");
  const igContact = contacts.find((contact) => contact.iconKey === "instagram");
  const waPhone = resolveWaPhone(waContact);

  const greeting = content.greeting;
  const topics = content.topics;

  // Subtitle "diketik" MIKY saat panel terbuka, konsisten dengan hero/wizard;
  // langsung penuh bila pengguna memilih reduced motion.
  const typedGreeting = useTypewriter(greeting, 22, !reduced, open);

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
              <strong>MIKY · Asisten ISTURA</strong>
              <p aria-live="polite">
                {typedGreeting}
                {!reduced && typedGreeting.length < greeting.length && (
                  <span className="floating-contact-caret" aria-hidden="true" />
                )}
              </p>
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
            {topics.map((topic) => (
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
              onClick={() => openWa(PRIMARY_MESSAGE)}
            >
              <WhatsAppIcon />
              <span>WhatsApp</span>
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

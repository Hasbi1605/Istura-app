import { Clock3, MapPin } from "lucide-react";
import type { FooterContact, Screen, SiteContent } from "../../domain/types";
import { ASSETS } from "../../lib/assets";
import { ContactIcon } from "../icons/SocialIcons";

export function Footer({
  contacts,
  content,
  onNavigate,
}: {
  contacts: FooterContact[];
  content: SiteContent["footer"];
  onNavigate: (screen: Screen) => void;
}) {
  return (
    <footer className="site-footer">
      <div className="footer-grid">
        <div className="footer-col footer-col-brand">
          <span className="footer-eyebrow">Tentang</span>
          <div className="footer-brand-stack">
            <img className="footer-logo" src={content.logoSrc || ASSETS.logoWhite} alt={content.logoAlt || "Gedung Agung"} />
            <p className="footer-hours-line" aria-label={content.scheduleLabel}>
              <Clock3 size={14} aria-hidden="true" />
              <span>
                <strong>{content.scheduleDays}</strong>
                <em>{content.scheduleHours}</em>
              </span>
            </p>
          </div>
        </div>

        <div className="footer-col footer-col-contact">
          <span className="footer-eyebrow">Kontak</span>
          <div className="footer-socials" aria-label="Kontak ISTURA">
            {contacts.map((contact) => (
              <a
                className="footer-social-link"
                href={contact.href}
                key={contact.label}
                target="_blank"
                rel="noreferrer"
                aria-label={`${contact.label}: ${contact.value}`}
              >
                <ContactIcon iconKey={contact.iconKey} />
                <span className="footer-social-copy">
                  <strong>{contact.label}</strong>
                  <span>{contact.value}</span>
                </span>
              </a>
            ))}
          </div>
        </div>

        <div className="footer-col footer-col-location">
          <span className="footer-eyebrow">Lokasi</span>
          <a
            className="footer-map"
            href={content.mapUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="Buka lokasi Gedung Agung di Google Maps"
          >
            <iframe
              title="Lokasi Gedung Agung"
              src={content.mapEmbedUrl}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              sandbox="allow-scripts allow-same-origin allow-popups"
              tabIndex={-1}
            />
            <span className="footer-map-overlay">Lihat di Google Maps</span>
          </a>
          <p className="footer-address">
            <MapPin size={14} aria-hidden="true" />
            <span>{content.address}</span>
          </p>
        </div>
      </div>

      <p className="footer-credit">
        {content.copyright}
        <button type="button" className="footer-admin-link" onClick={() => onNavigate("admin")}>
          Admin
        </button>
      </p>
    </footer>
  );
}

import { Clock3, MapPin } from "lucide-react";
import type { FooterContact, Screen } from "../../domain/types";
import { ASSETS } from "../../lib/assets";
import { ContactIcon } from "../icons/SocialIcons";

export function Footer({
  contacts,
  onNavigate,
}: {
  contacts: FooterContact[];
  onNavigate: (screen: Screen) => void;
}) {
  return (
    <footer className="site-footer">
      <div className="footer-grid">
        <div className="footer-col footer-col-brand">
          <span className="footer-eyebrow">Tentang</span>
          <div className="footer-brand-stack">
            <img className="footer-logo" src={ASSETS.logoWhite} alt="Gedung Agung" />
            <p className="footer-hours-line">
              <Clock3 size={14} aria-hidden="true" />
              <span>
                <strong>Senin - Jumat</strong>
                <em>08.00 - 14.00 WIB</em>
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
            href="https://maps.app.goo.gl/iuAhnPB1SkJLMaX9A"
            target="_blank"
            rel="noreferrer"
            aria-label="Buka lokasi Gedung Agung di Google Maps"
          >
            <iframe
              title="Lokasi Gedung Agung"
              src="https://www.google.com/maps?q=Gedung+Agung+Yogyakarta&output=embed"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              tabIndex={-1}
            />
            <span className="footer-map-overlay">Lihat di Google Maps</span>
          </a>
          <p className="footer-address">
            <MapPin size={14} aria-hidden="true" />
            <span>
              Jl. Jend. Ahmad Yani, Ngupasan, Kec. Gondomanan, Kota Yogyakarta,
              Daerah Istimewa Yogyakarta 55122
            </span>
          </p>
        </div>
      </div>

      <p className="footer-credit">
        &copy; 2026 Istana Kepresidenan Yogyakarta / Gedung Agung. Seluruh hak cipta dilindungi.
        <button type="button" className="footer-admin-link" onClick={() => onNavigate("admin")}>
          Admin
        </button>
      </p>
    </footer>
  );
}

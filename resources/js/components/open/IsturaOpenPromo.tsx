import { useEffect, useRef, useState } from "react";
import { PartyPopper, X } from "lucide-react";
import type { OpenEventPublic, SiteContent } from "../../domain/types";

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
];

function shortDate(key: string): string {
  const [, month, day] = key.split("-").map(Number);
  if (!month || !day) return key;
  return `${day} ${MONTHS_SHORT[month - 1]}`;
}

function hasOpenCapacity(event: OpenEventPublic): boolean {
  return event.days.some((day) => day.isOpen && day.remaining > 0);
}

/**
 * Public popup (every page load while event active) + persistent fixed banner
 * for the active Istura Open event.
 *
 * Banner layout: [🎉 icon] [Title (static)] [|] [Ticker text (marquee scroll)] [Daftar] [×]
 * Ticker text is CMS-editable via siteContent.openBanner.tickerText.
 */
export function IsturaOpenPromo({
  event,
  siteContent,
  onRegister,
}: {
  event: OpenEventPublic;
  siteContent: SiteContent;
  onRegister: () => void;
}) {
  const [showPopup, setShowPopup] = useState(() => hasOpenCapacity(event));
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  const tickerText = event.bannerText
    || siteContent.openBanner?.tickerText
    || "Pendaftaran kunjungan perorangan gratis, tanpa surat. Pilih harimu, siapa cepat dia dapat!";

  const promoSubtitle = event.promoSubtitle
    || `Kunjungan perorangan ${shortDate(event.startDate)} – ${shortDate(event.endDate)}. Gratis, tanpa surat. Pilih harimu, siapa cepat dia dapat.`;

  useEffect(() => {
    if (!showPopup) return;
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismissPopup();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [showPopup]);

  const dismissPopup = () => {
    setShowPopup(false);
  };

  const dismissBanner = () => {
    setBannerDismissed(true);
  };

  const startRegister = () => {
    dismissPopup();
    onRegister();
  };

  const totalRemaining = event.days
    .filter((day) => day.isOpen)
    .reduce((sum, day) => sum + Math.max(0, day.remaining), 0);

  return (
    <>
      {showPopup && (
        <div
          className="open-promo-scrim"
          role="dialog"
          aria-modal="true"
          aria-labelledby="open-promo-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) dismissPopup();
          }}
        >
          <div className={`open-promo-modal${event.posterUrl ? " has-poster" : ""}`}>
            <button ref={closeRef} type="button" className="open-promo-close" aria-label="Tutup" onClick={dismissPopup}>
              <X size={18} />
            </button>
            {event.posterUrl ? (
              <img className="open-promo-poster" src={event.posterUrl} alt={`Poster ${event.name}`} />
            ) : (
              <div className="open-promo-badge"><PartyPopper size={24} /></div>
            )}
            <h2 id="open-promo-title">{event.name}</h2>
            <p className="open-promo-lead">{promoSubtitle}</p>
            {totalRemaining > 0 && (
              <p className="open-promo-quota">Sisa kuota: {totalRemaining} orang</p>
            )}
            <div className="open-promo-actions">
              <button type="button" className="btn-primary" onClick={startRegister}>
                Daftar Sekarang
              </button>
              <button type="button" className="btn-secondary" onClick={dismissPopup}>
                Nanti saja
              </button>
            </div>
          </div>
        </div>
      )}

      {!bannerDismissed && (
        <div className="open-banner" role="region" aria-label="Istura Open">
          <PartyPopper size={16} className="open-banner-icon" />
          <span className="open-banner-title">{event.name}</span>
          <span className="open-banner-divider" aria-hidden="true">|</span>
          <div className="open-banner-ticker" aria-label={tickerText}>
            <div className="open-banner-ticker-track">
              <span>{tickerText}</span>
              <span aria-hidden="true">{tickerText}</span>
            </div>
          </div>
          <div className="open-banner-actions">
            <button type="button" className="open-banner-cta" onClick={onRegister}>
              Daftar
            </button>
            <button type="button" className="open-banner-close" aria-label="Tutup banner" onClick={dismissBanner}>
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

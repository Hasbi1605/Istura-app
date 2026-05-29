import { useEffect, useState } from "react";
import { ArrowRight, Menu, X } from "lucide-react";
import type { Screen } from "../../domain/types";
import { ASSETS } from "../../lib/assets";

export function Navigation({ screen, onNavigate }: { screen: Screen; onNavigate: (screen: Screen) => void }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeAnchor, setActiveAnchor] = useState<string | null>(null);
  type NavItem =
    | { label: string; type: "screen"; screen: Screen }
    | { label: string; type: "anchor"; anchor: string };
  const items: NavItem[] = [
    { label: "Beranda", type: "screen", screen: "home" },
    { label: "Cek Jadwal", type: "anchor", anchor: "panduan" },
    { label: "Contoh Surat", type: "anchor", anchor: "contoh-surat" },
    { label: "FAQ", type: "anchor", anchor: "faq" },
  ];
  const menuId = "mobile-navigation-menu";

  useEffect(() => {
    setIsMenuOpen(false);
  }, [screen]);

  useEffect(() => {
    if (screen !== "home") {
      setActiveAnchor(null);
    }
  }, [screen]);

  const scrollToAnchor = (anchor: string) => {
    requestAnimationFrame(() => {
      const target = document.getElementById(anchor);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  };

  const handleNavigate = (nextScreen: Screen) => {
    setIsMenuOpen(false);
    setActiveAnchor(null);
    onNavigate(nextScreen);
  };

  const handleAnchor = (anchor: string) => {
    setIsMenuOpen(false);
    setActiveAnchor(anchor);
    if (screen !== "home") {
      onNavigate("home");
      window.setTimeout(() => scrollToAnchor(anchor), 320);
    } else {
      scrollToAnchor(anchor);
    }
  };

  const isItemActive = (item: NavItem) => {
    if (item.type === "screen") {
      if (item.screen === "home") {
        return screen === "home" && activeAnchor === null;
      }
      return screen === item.screen;
    }
    return screen === "home" && activeAnchor === item.anchor;
  };

  return (
    <header className="nav-wrap">
      <nav className="nav-shell" aria-label="Navigasi utama">
        <button className="brand-lockup" type="button" onClick={() => handleNavigate("home")}>
          <img src={ASSETS.logoWhite} alt="Logo Gedung Agung" />
          <span>ISTURA</span>
        </button>
        <div className="nav-links">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              className={isItemActive(item) ? "is-active" : ""}
              onClick={() =>
                item.type === "screen" ? handleNavigate(item.screen) : handleAnchor(item.anchor)
              }
            >
              {item.label}
            </button>
          ))}
        </div>
        <button className="nav-cta" type="button" onClick={() => handleNavigate("booking")}>
          Mulai Booking
        </button>
        <button
          className="nav-menu-toggle"
          type="button"
          aria-label={isMenuOpen ? "Tutup menu navigasi" : "Buka menu navigasi"}
          aria-controls={menuId}
          aria-expanded={isMenuOpen}
          onClick={() => setIsMenuOpen((current) => !current)}
        >
          {isMenuOpen ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
        </button>
        <div className={`nav-mobile-menu${isMenuOpen ? " is-open" : ""}`} id={menuId}>
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              className={isItemActive(item) ? "is-active" : ""}
              onClick={() =>
                item.type === "screen" ? handleNavigate(item.screen) : handleAnchor(item.anchor)
              }
            >
              <span>{item.label}</span>
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          ))}
          <button
            type="button"
            className="nav-mobile-cta"
            onClick={() => handleNavigate("booking")}
          >
            <span>Mulai Booking</span>
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
      </nav>
    </header>
  );
}

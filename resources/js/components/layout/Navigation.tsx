import { useEffect, useState } from "react";
import { ArrowRight, Menu, X } from "lucide-react";
import type { LandingNavItem, Screen, SiteContent } from "../../domain/types";
import { ASSETS } from "../../lib/assets";

type NavContent = SiteContent["nav"];

const screenTargets: Screen[] = ["home", "booking", "feedback", "admin"];

export function Navigation({
  screen,
  content,
  onNavigate,
}: {
  screen: Screen;
  content: NavContent;
  onNavigate: (screen: Screen) => void;
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeAnchor, setActiveAnchor] = useState<string | null>(null);
  const items = content.items.length ? content.items : [{ label: "Beranda", target: "home" }];
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

  const handleExternal = (url: string) => {
    setIsMenuOpen(false);
    window.open(url, "_blank", "noopener,noreferrer");
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

  const handleItem = (item: LandingNavItem) => {
    const target = item.target.trim();
    if (screenTargets.includes(target as Screen)) {
      handleNavigate(target as Screen);
      return;
    }
    if (/^https?:\/\//i.test(target)) {
      handleExternal(target);
      return;
    }
    handleAnchor(target.replace(/^#/, ""));
  };

  const isItemActive = (item: LandingNavItem) => {
    const target = item.target.trim();
    if (screenTargets.includes(target as Screen)) {
      return target === "home" ? screen === "home" && activeAnchor === null : screen === target;
    }
    return screen === "home" && activeAnchor === target.replace(/^#/, "");
  };

  return (
    <header className="nav-wrap">
      <nav className="nav-shell" aria-label="Navigasi utama">
        <button className="brand-lockup" type="button" onClick={() => handleNavigate("home")}>
          <img src={content.logoSrc || ASSETS.logoWhite} alt={content.logoAlt || "Logo Gedung Agung"} />
          <span>{content.brandText}</span>
        </button>
        <div className="nav-links">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              className={isItemActive(item) ? "is-active" : ""}
              onClick={() => handleItem(item)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <button className="nav-cta" type="button" onClick={() => handleNavigate("booking")}>
          {content.ctaLabel}
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
              onClick={() => handleItem(item)}
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
            <span>{content.ctaLabel}</span>
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
      </nav>
    </header>
  );
}

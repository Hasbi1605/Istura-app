// Footer social SVG icons + ContactIcon dispatcher. Presentational only.
import { Mail, Phone } from "lucide-react";
import type { ContactIconKey } from "../../domain/types";

export function InstagramIcon() {
  return (
    <svg className="footer-social-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="instagram-footer-gradient" x1="2" x2="22" y1="22" y2="2" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#F58529" />
          <stop offset="0.35" stopColor="#DD2A7B" />
          <stop offset="0.7" stopColor="#8134AF" />
          <stop offset="1" stopColor="#515BD4" />
        </linearGradient>
      </defs>
      <rect width="24" height="24" rx="6" fill="url(#instagram-footer-gradient)" />
      <path
        fill="#fff"
        d="M8.3 5.05h7.4a3.25 3.25 0 0 1 3.25 3.25v7.4a3.25 3.25 0 0 1-3.25 3.25H8.3a3.25 3.25 0 0 1-3.25-3.25V8.3A3.25 3.25 0 0 1 8.3 5.05Zm0 1.55a1.7 1.7 0 0 0-1.7 1.7v7.4c0 .94.76 1.7 1.7 1.7h7.4a1.7 1.7 0 0 0 1.7-1.7V8.3a1.7 1.7 0 0 0-1.7-1.7H8.3Zm3.7 2.1a3.3 3.3 0 1 1 0 6.6 3.3 3.3 0 0 1 0-6.6Zm0 1.55a1.75 1.75 0 1 0 0 3.5 1.75 1.75 0 0 0 0-3.5Zm4.62-1.72a.78.78 0 1 1-1.56 0 .78.78 0 0 1 1.56 0Z"
      />
    </svg>
  );
}

export function YouTubeIcon() {
  return (
    <svg className="footer-social-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="#ff0000"
        d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.38.5A3.02 3.02 0 0 0 .5 6.19C0 8.07 0 12 0 12s0 3.93.5 5.81a3.02 3.02 0 0 0 2.12 2.14c1.88.5 9.38.5 9.38.5s7.5 0 9.38-.5a3.02 3.02 0 0 0 2.12-2.14C24 15.93 24 12 24 12s0-3.93-.5-5.81Z"
      />
      <path fill="#fff" d="M9.55 15.57V8.43L15.82 12l-6.27 3.57Z" />
    </svg>
  );
}

export function WhatsAppIcon() {
  return (
    <svg className="footer-social-icon" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <path
        fill="#25D366"
        d="M16 2.7C8.66 2.7 2.7 8.66 2.7 16c0 2.34.62 4.63 1.79 6.65L2.6 29.4l6.93-1.82A13.24 13.24 0 0 0 16 29.3c7.34 0 13.3-5.96 13.3-13.3S23.34 2.7 16 2.7Z"
      />
      <path
        fill="#fff"
        d="M23.1 19.57c-.35-.18-2.08-1.03-2.4-1.14-.32-.12-.56-.18-.8.18-.23.35-.92 1.14-1.13 1.38-.2.23-.41.26-.76.08-.35-.17-1.49-.55-2.84-1.75a10.61 10.61 0 0 1-1.96-2.45c-.2-.35-.02-.54.15-.72.16-.15.35-.41.53-.61.18-.2.23-.35.35-.58.12-.24.06-.44-.03-.62-.09-.17-.8-1.92-1.1-2.63-.28-.69-.57-.59-.8-.6h-.67c-.24 0-.62.08-.94.43-.32.35-1.24 1.21-1.24 2.95s1.27 3.42 1.45 3.65c.17.24 2.5 3.8 6.04 5.33.84.36 1.5.58 2.02.74.85.27 1.62.23 2.23.14.68-.1 2.08-.85 2.37-1.67.3-.83.3-1.54.21-1.69-.09-.14-.32-.23-.67-.4Z"
      />
    </svg>
  );
}

export function ContactIcon({ iconKey }: { iconKey: ContactIconKey }) {
  switch (iconKey) {
    case "instagram":
      return <InstagramIcon />;
    case "youtube":
      return <YouTubeIcon />;
    case "whatsapp":
      return <WhatsAppIcon />;
    case "email":
      return <Mail className="footer-social-icon" size={22} aria-hidden="true" />;
    case "phone":
      return <Phone className="footer-social-icon" size={22} aria-hidden="true" />;
    default:
      return null;
  }
}

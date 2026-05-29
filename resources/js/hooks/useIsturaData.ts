import { useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type {
  AdminSession,
  AdminTab,
  Booking,
  BookingStatus,
  Feedback,
  FaqItem,
  FooterContact,
  Screen,
  VisitDay,
  WaTemplate,
} from "../domain/types";
import { applyBookingsToSchedule, buildScheduleHorizon } from "../domain/schedule";
import { initialBookings } from "../seeds/bookings";
import { initialFeedbacks } from "../seeds/feedbacks";
import { INITIAL_FAQ_ITEMS, INITIAL_FOOTER_CONTACTS, INITIAL_WA_TEMPLATES } from "../constants";
import { readAdminSession, readCmsCollection, writeCmsCollection } from "../lib/legacyShims";
import { setActiveWaTemplates } from "../lib/whatsapp";
import { me as apiMe } from "../api/auth";
import { fetchAdminBookings } from "../api/bookings";
import { fetchAdminFeedbacks } from "../api/feedback";
import type { ApiBooking } from "../api/bookings";
import type { ApiFeedback } from "../api/feedback";
import {
  fetchPublicContacts,
  fetchPublicFaqs,
  fetchPublicWaTemplates,
  updateAdminContacts,
  updateAdminFaqs,
  updateAdminWaTemplates,
} from "../api/cms";
import { ADMIN_BOOKINGS_CHANNEL, getEcho } from "../realtime/echo";
import { apiBookingToLocal, apiFeedbackToLocal } from "../api/adapters";

export type FeedbackAccess = { code: string; token: string } | null;

// Seed the imperative WA template cache so createWhatsappMessage bekerja
// sebelum useEffect hydration pertama berjalan.
setActiveWaTemplates(INITIAL_WA_TEMPLATES);

export interface IsturaData {
  screen: Screen;
  setScreen: Dispatch<SetStateAction<Screen>>;
  schedules: VisitDay[];
  setSchedules: Dispatch<SetStateAction<VisitDay[]>>;
  bookings: Booking[];
  setBookings: Dispatch<SetStateAction<Booking[]>>;
  feedbacks: Feedback[];
  setFeedbacks: Dispatch<SetStateAction<Feedback[]>>;
  submittedCode: string;
  setSubmittedCode: Dispatch<SetStateAction<string>>;
  feedbackAccess: FeedbackAccess;
  faqs: FaqItem[];
  setFaqs: Dispatch<SetStateAction<FaqItem[]>>;
  contacts: FooterContact[];
  setContacts: Dispatch<SetStateAction<FooterContact[]>>;
  waTemplates: WaTemplate[];
  setWaTemplates: Dispatch<SetStateAction<WaTemplate[]>>;
  adminSession: AdminSession | null;
  setAdminSession: Dispatch<SetStateAction<AdminSession | null>>;
  adminTab: AdminTab;
  setAdminTab: Dispatch<SetStateAction<AdminTab>>;
  bookingFocusCode: string | null;
  setBookingFocusCode: Dispatch<SetStateAction<string | null>>;
}

// Semua state global + efek (persistensi CMS, hydration API publik & admin,
// realtime, dan routing awal dari URL) dikemas di sini supaya App.tsx tetap
// jadi shell tipis. Perilaku tidak berubah dari versi inline sebelumnya.
export function useIsturaData(): IsturaData {
  const [screen, setScreen] = useState<Screen>("home");
  const [schedules, setSchedules] = useState<VisitDay[]>(() =>
    applyBookingsToSchedule(buildScheduleHorizon(new Date()), initialBookings),
  );
  const [bookings, setBookings] = useState<Booking[]>(initialBookings);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>(initialFeedbacks);
  const [submittedCode, setSubmittedCode] = useState("");
  const [feedbackAccess, setFeedbackAccess] = useState<FeedbackAccess>(null);

  // CMS-managed content. Persisted to localStorage so admin edits survive
  // refresh while we wait for a real backend.
  const [faqs, setFaqs] = useState<FaqItem[]>(() => readCmsCollection("istura-faqs", INITIAL_FAQ_ITEMS));
  const [contacts, setContacts] = useState<FooterContact[]>(() =>
    readCmsCollection("istura-contacts", INITIAL_FOOTER_CONTACTS),
  );
  const [waTemplates, setWaTemplates] = useState<WaTemplate[]>(() =>
    readCmsCollection("istura-wa-templates", INITIAL_WA_TEMPLATES),
  );

  // Refs untuk membedakan "data baru dari API" (jangan push balik ke API)
  // vs "user mengubah dari UI" (push ke API). Diset true di useEffect
  // hydration setelah fetch selesai.
  const faqsHydratedRef = useRef(false);
  const contactsHydratedRef = useRef(false);
  const waHydratedRef = useRef(false);

  // Admin auth + UI state. Sesi dijaga oleh Sanctum cookie di server; state
  // ini hanya snapshot di memori untuk render cepat.
  const [adminSession, setAdminSession] = useState<AdminSession | null>(() => readAdminSession());
  const [adminTab, setAdminTab] = useState<AdminTab>("dashboard");
  // Komunikasi antar tab admin: misal Jadwal Kunjungan ingin mengarahkan
  // admin ke booking tertentu di tab Booking.
  const [bookingFocusCode, setBookingFocusCode] = useState<string | null>(null);

  useEffect(() => {
    writeCmsCollection("istura-faqs", faqs);
    if (!faqsHydratedRef.current) return;
    if (!adminSession) return;
    void updateAdminFaqs(
      faqs.map((f) => ({
        id: f.id,
        question: f.question,
        answer: f.answer,
        category: null,
        ...(f.link ? { link: f.link } : {}),
      })),
    ).catch(() => {});
  }, [faqs, adminSession]);

  useEffect(() => {
    writeCmsCollection("istura-contacts", contacts);
    if (!contactsHydratedRef.current) return;
    if (!adminSession) return;
    void updateAdminContacts(
      contacts.map((c) => ({
        id: (c as unknown as { id?: string }).id ?? c.iconKey,
        label: c.label,
        value: c.value,
        href: c.href,
        iconKey: c.iconKey,
      })),
    ).catch(() => {});
  }, [contacts, adminSession]);

  useEffect(() => {
    writeCmsCollection("istura-wa-templates", waTemplates);
    setActiveWaTemplates(waTemplates);
    if (!waHydratedRef.current) return;
    if (!adminSession) return;
    void updateAdminWaTemplates(
      waTemplates.map((t) => ({
        id: t.id as "Accepted" | "Rejected" | "Reschedule" | "Completed",
        label: t.label,
        description: t.description,
        template: t.template,
      })),
    ).catch(() => {});
  }, [waTemplates, adminSession]);

  // ---- API hydration ----------------------------------------------------
  // Bootstrap data dari Laravel API saat komponen mount. State default tetap
  // berisi seed/mock supaya render pertama tidak kosong; data API akan
  // me-replace ketika fetch selesai.
  useEffect(() => {
    let cancelled = false;
    apiMe()
      .then((user) => {
        if (cancelled) return;
        if (user) {
          setAdminSession({
            email: user.email,
            name: user.name,
            role: user.roleLabel,
            loggedAt: new Date().toISOString(),
          });
        }
      })
      .catch(() => {
        /* not authenticated, leave adminSession null */
      });

    fetchPublicFaqs()
      .then((items) => {
        if (cancelled) return;
        if (items.length > 0) {
          setFaqs(
            items.map((it) => ({
              id: it.id,
              question: it.question,
              answer: it.answer,
              ...(it.link ? { link: it.link } : {}),
            })) as FaqItem[],
          );
        }
        // Use rAF to set hydrated flag AFTER the state update has flushed,
        // so the persistence effect can detect "hydrated" reliably.
        requestAnimationFrame(() => {
          faqsHydratedRef.current = true;
        });
      })
      .catch(() => {
        faqsHydratedRef.current = true;
      });

    fetchPublicContacts()
      .then((items) => {
        if (cancelled) return;
        if (items.length > 0) {
          setContacts(
            items.map((it) => ({
              label: it.label,
              value: it.value,
              href: it.href ?? "",
              iconKey: it.iconKey,
            })),
          );
        }
        requestAnimationFrame(() => {
          contactsHydratedRef.current = true;
        });
      })
      .catch(() => {
        contactsHydratedRef.current = true;
      });

    fetchPublicWaTemplates()
      .then((items) => {
        if (cancelled) return;
        if (items.length > 0) {
          setWaTemplates(
            items.map((it) => ({
              id: it.id as BookingStatus,
              label: it.label,
              description: it.description,
              template: it.template,
            })),
          );
        }
        requestAnimationFrame(() => {
          waHydratedRef.current = true;
        });
      })
      .catch(() => {
        waHydratedRef.current = true;
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Admin-only data: bookings + feedbacks. Hydrate ketika sesi admin aktif.
  useEffect(() => {
    if (!adminSession) return;
    let cancelled = false;
    fetchAdminBookings()
      .then((items) => {
        if (cancelled) return;
        setBookings(items.map(apiBookingToLocal));
      })
      .catch(() => {});
    fetchAdminFeedbacks()
      .then((items) => {
        if (cancelled) return;
        setFeedbacks(items.map(apiFeedbackToLocal));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [adminSession]);

  // Realtime: subscribe ke channel admin.bookings ketika admin login.
  useEffect(() => {
    if (!adminSession) return;
    const echo = getEcho();
    if (!echo) return;
    const channel = echo.private(ADMIN_BOOKINGS_CHANNEL);
    const onCreated = (payload: { booking: ApiBooking }) => {
      setBookings((prev) => {
        const next = apiBookingToLocal(payload.booking);
        const idx = prev.findIndex((b) => b.code === next.code);
        if (idx >= 0) {
          const copy = prev.slice();
          copy[idx] = next;
          return copy;
        }
        return [next, ...prev];
      });
    };
    const onChanged = (payload: { booking: ApiBooking }) => {
      setBookings((prev) => {
        const next = apiBookingToLocal(payload.booking);
        const idx = prev.findIndex((b) => b.code === next.code);
        if (idx >= 0) {
          const copy = prev.slice();
          copy[idx] = next;
          return copy;
        }
        return prev;
      });
    };
    const onFeedback = (payload: { feedback: ApiFeedback }) => {
      setFeedbacks((prev) => {
        const next = apiFeedbackToLocal(payload.feedback);
        if (prev.some((f) => f.code === next.code)) return prev;
        return [next, ...prev];
      });
    };
    channel.listen(".booking.created", onCreated);
    channel.listen(".booking.status-changed", onChanged);
    channel.listen(".feedback.submitted", onFeedback);
    return () => {
      try {
        channel.stopListening(".booking.created");
        channel.stopListening(".booking.status-changed");
        channel.stopListening(".feedback.submitted");
        echo.leave(`private-${ADMIN_BOOKINGS_CHANNEL}`);
      } catch {
        /* ignore */
      }
    };
  }, [adminSession]);

  useEffect(() => {
    if (window.location.pathname.startsWith("/admin")) {
      setScreen("admin");
    }
  }, []);

  useEffect(() => {
    const match = window.location.pathname.match(/^\/feedback\/([^/]+)\/?$/);
    if (!match) return;
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token") ?? "";
    setFeedbackAccess({ code: decodeURIComponent(match[1]), token });
    setScreen("feedback");
  }, []);

  return {
    screen,
    setScreen,
    schedules,
    setSchedules,
    bookings,
    setBookings,
    feedbacks,
    setFeedbacks,
    submittedCode,
    setSubmittedCode,
    feedbackAccess,
    faqs,
    setFaqs,
    contacts,
    setContacts,
    waTemplates,
    setWaTemplates,
    adminSession,
    setAdminSession,
    adminTab,
    setAdminTab,
    bookingFocusCode,
    setBookingFocusCode,
  };
}

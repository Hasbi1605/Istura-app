import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent, ReactNode } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Download,
  ExternalLink,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Filter,
  Image as ImageIcon,
  Inbox,
  Info,
  LayoutDashboard,
  ListChecks,
  Loader2,
  Lock,
  LogOut,
  Mail,
  MapPin,
  Menu,
  MessageCircle,
  MessageSquare,
  PenLine,
  Phone,
  Rows3,
  Rows4,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  UploadCloud,
  UserCog,
  Users,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { exportBookingsToZip } from "./exportBookings";
import type { ExportRange, ExportScope } from "./exportBookings";
import { exportFeedbackToXlsx } from "./exportFeedback";
import type { FeedbackExportScope } from "./exportFeedback";
import { exportMonthlyReport } from "./exportMonthlyReport";
import type { MonthlyReportRange } from "./exportMonthlyReport";
import {
  fetchPublicFaqs,
  fetchPublicContacts,
  fetchPublicWaTemplates,
  updateAdminFaqs,
  updateAdminContacts,
  updateAdminWaTemplates,
} from "./api/cms";
import { login as apiLogin, logout as apiLogout, me as apiMe } from "./api/auth";
import {
  fetchAdminBookings,
  acceptBooking as apiAcceptBooking,
  rejectBooking as apiRejectBooking,
  rescheduleBooking as apiRescheduleBooking,
  completeBooking as apiCompleteBooking,
  submitPublicBooking,
} from "./api/bookings";
import { fetchAdminFeedbacks } from "./api/feedback";
import type { ApiBooking } from "./api/bookings";
import type { ApiFeedback } from "./api/feedback";
import { submitPublicFeedback } from "./api/feedback";
import { ApiError, ValidationError } from "./api/client";
import { getEcho, ADMIN_BOOKINGS_CHANNEL, destroyEcho } from "./realtime/echo";
import type {
  ContactIconKey,
  FooterContact,
  Screen,
  AdminTab,
  VisitStatus,
  BookingStatus,
  AdminAction,
  Slot,
  VisitDay,
  AdminSession,
  Booking,
  Feedback,
  BookingForm,
  PublicDateStatus,
  FaqItem,
  WaTemplate,
  BookingStatusFilter,
  BookingSort,
  BookingDateRange,
  BookingViewMode,
  BookingDensity,
} from "./domain/types";
import {
  monthNames,
  fullDayNames,
  calendarWeekdays,
  padDatePart,
  startOfDay,
  startOfMonth,
  getMonthLength,
  addMonths,
  formatDateKey,
  parseDateKey,
  isSameMonth,
  isWithinRange,
  isDefaultHoliday,
  formatMonthTitle,
  formatLongDate,
  formatCount,
  formatCountShort,
  getPublicDateStatus,
  getFirstAvailableDate,
  createCalendarDays,
  publicSlotStatusToClass,
  publicSlotStatusLabel,
  publicStatusMeta,
  legendStatuses,
} from "./lib/date";
import { buildScheduleHorizon, applyBookingsToSchedule, VISIT_TIME_SLOTS } from "./domain/schedule";
import { initialBookings } from "./seeds/bookings";
import { initialFeedbacks } from "./seeds/feedbacks";
import { ContactIcon } from "./components/icons/SocialIcons";
import { StatCard } from "./components/ui/StatCard";
import { DetailItem } from "./components/ui/DetailItem";
import { StatusBadge } from "./components/ui/StatusBadge";
import { Footer } from "./components/layout/Footer";
import { Navigation } from "./components/layout/Navigation";
import { AdminScheduleManager } from "./components/admin/ScheduleManager";
import { AdminScreen } from "./components/admin/BookingScreen";
import { HomeScreen } from "./components/home/HomeScreen";
import { BookingWizard } from "./components/booking/BookingWizard";
import { FeedbackScreen } from "./components/feedback/FeedbackScreen";
import { AdminDashboard } from "./components/admin/AdminDashboard";
import { AdminFeedbackList } from "./components/admin/AdminFeedbackList";
import {
  AdminFaqManager,
  AdminContactsManager,
  AdminWaTemplates,
  AdminLetterPreview,
  AdminHeroPreview,
} from "./components/admin/AdminCmsManagers";
import { AdminUsersList, AdminAuditLog } from "./components/admin/AdminSystemPages";
import { Pagination } from "./components/ui/Pagination";
import {
  BOOKING_STATUS_CHIPS,
  isActionNeeded,
  parseSubmittedAt,
  sortBookings,
  inDateRange,
  parseProposedSlot,
  PAGE_SIZE_BOOKING_SPLIT,
  PAGE_SIZE_BOOKING_TABLE,
  PAGE_SIZE_FEEDBACK,
  VIRTUALIZE_THRESHOLD,
} from "./domain/booking";
import {
  maskNik,
  setActiveWaTemplates,
} from "./lib/whatsapp";
import { openWhatsApp, createWhatsappMessage } from "./lib/waActions";
import { ASSETS } from "./lib/assets";
import {
  useReducedMotion,
  useMediaQuery,
  useTypewriter,
  useVirtualWindow,
} from "./hooks";
import {
  INITIAL_FOOTER_CONTACTS,
  FEEDBACK_HIGHLIGHTS,
  FEEDBACK_IMPROVEMENTS,
  RATING_LABELS,
  storyWords,
  wizardSteps,
  quickInfoCards,
  bookingProcessCards,
  letterChecklist,
  INITIAL_FAQ_ITEMS,
  accordionItems,
  HERO_MESSAGES,
  HERO_MESSAGES_MOBILE,
  INITIAL_WA_TEMPLATES,
  ADMIN_MENU,
} from "./constants";
import type { AdminMenuItem } from "./constants";

gsap.registerPlugin(useGSAP, ScrollTrigger);


// Adapter: ApiBooking dari Laravel → tipe Booking lokal. Mostly identity karena
// API resource sudah meniru shape lama, tapi optional fields perlu di-null
// menjadi undefined supaya komponen yang pakai `?.` tetap aman.
function apiBookingToLocal(b: ApiBooking): Booking {
  return {
    code: b.code,
    contactName: b.contactName,
    nik: b.nik ?? "",
    nikMasked: b.nikMasked,
    whatsapp: b.whatsapp,
    institution: b.institution,
    groupSize: b.groupSize,
    date: b.date,
    dateLabel: b.dateLabel,
    time: b.time,
    status: b.status,
    documentName: b.documentName,
    submittedAt: b.submittedAt,
    note: b.note ?? undefined,
    feedbackToken: b.feedbackToken,
    completedAt: b.completedAt ?? undefined,
    proposedDate: b.proposedDate ?? undefined,
    proposedDateLabel: b.proposedDateLabel ?? undefined,
    proposedTime: b.proposedTime ?? undefined,
    proposedAt: b.proposedAt ?? undefined,
  };
}

function apiFeedbackToLocal(f: ApiFeedback): Feedback {
  return {
    code: f.code,
    rating: f.rating,
    bookingEase: f.bookingEase,
    service: f.service,
    recommend: f.recommend,
    highlights: f.highlights ?? [],
    improvements: f.improvements ?? [],
    comment: f.comment ?? "",
    allowPublish: f.allowPublish,
    submittedAt: f.submittedAt ?? undefined,
  };
}

function App() {
  const pageRef = useRef<HTMLElement>(null);
  const [screen, setScreen] = useState<Screen>("home");
  const [schedules, setSchedules] = useState<VisitDay[]>(() =>
    applyBookingsToSchedule(buildScheduleHorizon(new Date()), initialBookings),
  );
  const [bookings, setBookings] = useState<Booking[]>(initialBookings);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>(initialFeedbacks);
  const [submittedCode, setSubmittedCode] = useState("");
  const [feedbackAccess, setFeedbackAccess] = useState<{ code: string; token: string } | null>(null);

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
  // ini hanya snapshot di memori untuk render cepat. Dideklarasikan sebelum
  // effect persistence CMS karena effect tersebut bergantung pada adminSession.
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

  useGSAP(
    () => {
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduceMotion) {
        return;
      }
      // Animate the navbar entrance only once on initial mount so it doesn't
      // flicker each time we switch screens.
      gsap.from(".nav-shell", { y: -24, opacity: 0, duration: 0.7, ease: "power3.out" });
    },
    { scope: pageRef, dependencies: [] },
  );

  useGSAP(
    () => {
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduceMotion) {
        return;
      }
      if (screen !== "home") {
        // Hero animations only run on home; on other screens leave elements
        // at their baseline CSS so the navbar doesn't flicker.
        return;
      }

      const ctx = gsap.context(() => {
        // Defensive guard: kalau target hero tidak ada di DOM (mis. user
        // navigasi ke route lain sebelum useGSAP sempat bersih), skip seluruh
        // setup supaya GSAP tidak melempar warning "target not found".
        if (!document.querySelector(".hero-visual")) return;
        gsap.from(".hero-copy > *", {
          y: 30,
          opacity: 0,
          duration: 0.85,
          stagger: 0.08,
          ease: "power3.out",
        });
        gsap.from(".hero-visual", {
          y: 42,
          scale: 0.94,
          opacity: 0,
          duration: 1.05,
          ease: "power3.out",
        });
        const mm = gsap.matchMedia();

        mm.add("(min-width: 641px)", () => {
          gsap.from(".miky-hero-stack", {
            y: 34,
            rotate: -3,
            scale: 0.9,
            opacity: 0,
            duration: 1.05,
            delay: 0.12,
            ease: "back.out(1.35)",
            clearProps: "transform,opacity",
          });
          gsap.from(".miky-speech", {
            x: 18,
            y: 18,
            scale: 0.88,
            opacity: 0,
            duration: 0.64,
            delay: 0.9,
            ease: "back.out(1.55)",
          });
          gsap.from(".miky-wave-line", {
            scale: 0.2,
            opacity: 0,
            duration: 0.48,
            stagger: 0.1,
            delay: 0.82,
            transformOrigin: "left bottom",
            ease: "back.out(2)",
          });
          gsap.to(".miky-stage-greeting", {
            y: -10,
            rotate: 0.7,
            duration: 3.8,
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut",
          });
          gsap.to(".miky-speech", {
            y: -4,
            duration: 2.8,
            delay: 1.1,
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut",
          });
          gsap.to(".miky-wave-lines", {
            x: 3,
            rotate: 5,
            duration: 1.45,
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut",
          });
        });

        mm.add("(max-width: 640px)", () => {
          gsap.set(".miky-stage-greeting", {
            autoAlpha: 0,
            y: 76,
            rotate: -1.4,
            scale: 0.94,
          });
          gsap.set(".miky-speech", {
            autoAlpha: 0,
            y: 14,
            scale: 0.92,
          });
          gsap.set(".miky-wave-line", {
            opacity: 0,
            scale: 0.2,
            transformOrigin: "left bottom",
          });

          const mikyScroll = gsap.timeline({
            scrollTrigger: {
              trigger: ".hero-visual",
              start: "top 62%",
              end: "bottom 28%",
              scrub: 0.65,
            },
          });

          mikyScroll
            .to(".miky-stage-greeting", {
              autoAlpha: 1,
              y: 0,
              rotate: 0,
              scale: 1,
              duration: 0.28,
              ease: "power3.out",
            })
            .to(
              ".miky-speech",
              {
                autoAlpha: 1,
                y: 0,
                scale: 1,
                duration: 0.18,
                ease: "power2.out",
              },
              "<0.06",
            )
            .to(
              ".miky-wave-line",
              {
                opacity: (index) => [0.92, 0.72, 0.5][index] ?? 0.7,
                scale: 1,
                stagger: 0.06,
                duration: 0.16,
                ease: "power2.out",
              },
              "<0.04",
            )
            .to(".miky-stage-greeting", {
              autoAlpha: 1,
              y: -8,
              rotate: 0.35,
              duration: 0.32,
              ease: "none",
            })
            .to(".miky-stage-greeting", {
              autoAlpha: 0,
              y: -58,
              rotate: 1.2,
              scale: 0.97,
              duration: 0.22,
              ease: "power2.in",
            });
        });

        gsap.utils.toArray<HTMLElement>(".scale-fade").forEach((element) => {
          gsap.fromTo(
            element,
            { y: 28, scale: 0.98, opacity: 0 },
            {
              y: 0,
              scale: 1,
              opacity: 1,
              duration: 0.64,
              ease: "power3.out",
              clearProps: "transform,opacity",
              scrollTrigger: {
                trigger: element,
                start: "top 88%",
                toggleActions: "play none none none",
                once: true,
                invalidateOnRefresh: true,
              },
            },
          );
        });

        gsap.utils.toArray<HTMLElement>(".process-card-scrub").forEach((element) => {
          gsap.fromTo(
            element,
            { scale: 0.86, opacity: 0.42, filter: "brightness(0.55)" },
            {
              scale: 1,
              opacity: 1,
              filter: "brightness(1)",
              ease: "none",
              scrollTrigger: {
                trigger: element,
                start: "top 82%",
                end: "bottom 22%",
                scrub: true,
                invalidateOnRefresh: true,
              },
            },
          );
        });

        gsap.utils.toArray<HTMLElement>(".reveal-word").forEach((word, index) => {
          gsap.to(word, {
            opacity: 1,
            y: 0,
            ease: "none",
            scrollTrigger: {
              trigger: ".scroll-story",
              start: `top+=${index * 9} 72%`,
              end: `top+=${index * 9 + 140} 42%`,
              scrub: true,
            },
          });
        });

        mm.add("(min-width: 920px)", () => {
          ScrollTrigger.create({
            trigger: ".desire-grid",
            start: "top 10%",
            end: "bottom 82%",
            pin: ".desire-pin",
            pinSpacing: false,
          });
        });

        return () => mm.revert();
      }, pageRef);

      let isRefreshActive = true;
      const refreshScrollTriggers = () => {
        window.requestAnimationFrame(() => {
          if (isRefreshActive) {
            ScrollTrigger.refresh();
          }
        });
      };

      refreshScrollTriggers();

      if (document.readyState === "complete") {
        refreshScrollTriggers();
      } else {
        window.addEventListener("load", refreshScrollTriggers, { once: true });
      }

      void document.fonts?.ready.then(() => {
        if (isRefreshActive) {
          refreshScrollTriggers();
        }
      });

      return () => {
        isRefreshActive = false;
        window.removeEventListener("load", refreshScrollTriggers);
        ctx.revert();
      };
    },
    { scope: pageRef, dependencies: [screen] },
  );

  const goToScreen = (nextScreen: Screen) => {
    setScreen(nextScreen);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <main ref={pageRef} className="app-shell overflow-x-hidden w-full max-w-full">
      {screen === "admin" ? (
        adminSession ? (
          <AdminShell
            session={adminSession}
            tab={adminTab}
            onTabChange={setAdminTab}
            onLogout={() => {
              clearAdminSession();
              setAdminSession(null);
              destroyEcho();
              window.history.replaceState(null, "", "/admin");
              void apiLogout().catch(() => {});
            }}
            onExitToPublic={() => {
              setScreen("home");
              window.history.replaceState(null, "", "/");
            }}
          >
            {adminTab === "dashboard" && (
              <AdminDashboard
                bookings={bookings}
                feedbacks={feedbacks}
                onJumpTab={setAdminTab}
                adminName={adminSession.name}
              />
            )}
            {adminTab === "bookings" && (
              <AdminScreen
                schedules={schedules}
                bookings={bookings}
                onBookingsChange={setBookings}
                onSchedulesChange={setSchedules}
                focusCode={bookingFocusCode}
                onFocusCodeConsumed={() => setBookingFocusCode(null)}
                adminName={adminSession.name}
              />
            )}
            {adminTab === "feedback" && (
              <AdminFeedbackList
                bookings={bookings}
                feedbacks={feedbacks}
                adminName={adminSession.name}
              />
            )}
            {adminTab === "schedule" && (
              <AdminScheduleManager
                schedules={schedules}
                bookings={bookings}
                onSchedulesChange={setSchedules}
                onOpenBooking={(code) => {
                  setBookingFocusCode(code);
                  setAdminTab("bookings");
                }}
              />
            )}
            {adminTab === "cms-faq" && (
              <AdminFaqManager faqs={faqs} onChange={setFaqs} />
            )}
            {adminTab === "cms-contacts" && (
              <AdminContactsManager contacts={contacts} onChange={setContacts} />
            )}
            {adminTab === "cms-letter" && <AdminLetterPreview />}
            {adminTab === "cms-hero" && <AdminHeroPreview />}
            {adminTab === "cms-wa" && (
              <AdminWaTemplates templates={waTemplates} onChange={setWaTemplates} />
            )}
            {adminTab === "users" && <AdminUsersList />}
            {adminTab === "audit" && <AdminAuditLog />}
          </AdminShell>
        ) : (
          <AdminLogin
            onAuthenticated={(session) => {
              writeAdminSession(session);
              setAdminSession(session);
              setAdminTab("dashboard");
              window.history.replaceState(null, "", "/admin");
            }}
            onCancel={() => {
              setScreen("home");
              window.history.replaceState(null, "", "/");
            }}
          />
        )
      ) : (
        <>
          <Navigation screen={screen} onNavigate={goToScreen} />

          {screen === "home" && (
            <HomeScreen
              contacts={contacts}
              faqs={faqs}
              schedules={schedules}
              onNavigate={goToScreen}
            />
          )}
          {screen === "booking" && (
            <BookingWizard
              schedules={schedules}
              bookings={bookings}
              onScheduleLock={setSchedules}
              onBookingCreate={(booking) => {
                setBookings((current) => [booking, ...current]);
                setSubmittedCode(booking.code);
              }}
              onShowExampleLetter={() => {
                goToScreen("home");
                window.setTimeout(() => {
                  const target = document.getElementById("contoh-surat");
                  target?.scrollIntoView({ behavior: "smooth", block: "start" });
                }, 320);
              }}
              onShowSchedule={() => {
                goToScreen("home");
                window.setTimeout(() => {
                  const target = document.getElementById("panduan");
                  target?.scrollIntoView({ behavior: "smooth", block: "start" });
                }, 320);
              }}
              onNavigate={goToScreen}
            />
          )}
          {screen === "feedback" && (
            <FeedbackScreen
              bookings={bookings}
              submittedCode={submittedCode}
              feedbacks={feedbacks}
              access={feedbackAccess}
              onFeedbackCreate={(feedback) => setFeedbacks((current) => [feedback, ...current])}
            />
          )}
        </>
      )}
    </main>
  );
}




// -------------------------------------------------------------------------
//  Admin shell, login, placeholder
// -------------------------------------------------------------------------

const ADMIN_SESSION_KEY = "istura-admin-session";

// Auth sekarang dijaga oleh Sanctum cookie session di server. Helper ini
// tetap dipertahankan agar komponen yang men-cache snapshot AdminSession di
// memori (untuk render UX cepat) tidak perlu diubah; isinya jadi no-op.
function readAdminSession(): AdminSession | null {
  return null;
}

function writeAdminSession(_session: AdminSession) {
  /* no-op: session di server */
}

function clearAdminSession() {
  /* no-op */
}

// CMS data sekarang di server. Helper ini sekadar shim sinkron yang
// mengembalikan fallback (mock seed yang sama dengan seeder Laravel) supaya
// initial render aman; data asli akan di-replace oleh useEffect fetcher di
// komponen App.
function readCmsCollection<T>(_key: string, fallback: T[]): T[] {
  return fallback;
}

function writeCmsCollection<T>(_key: string, _value: T[]) {
  /* no-op: persistence delegated to API hooks */
}

// Mock credentials replaced by Laravel Sanctum auth (api/auth.ts).



// Seed the imperative WA template cache so createWhatsappMessage bekerja
// sebelum useEffect hydration pertama berjalan.
setActiveWaTemplates(INITIAL_WA_TEMPLATES);


function AdminShell({
  session,
  tab,
  onTabChange,
  onLogout,
  onExitToPublic,
  children,
}: {
  session: AdminSession;
  tab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
  onLogout: () => void;
  onExitToPublic: () => void;
  children: ReactNode;
}) {
  const [isMobileNavOpen, setMobileNavOpen] = useState(false);
  const currentItem = ADMIN_MENU.find((item) => item.key === tab) ?? ADMIN_MENU[0];

  // Group menu by section header
  const grouped = ADMIN_MENU.reduce<Record<string, AdminMenuItem[]>>((acc, item) => {
    const key = item.group ?? "Operasional";
    acc[key] = acc[key] ?? [];
    acc[key].push(item);
    return acc;
  }, {});

  return (
    <div className="admin-shell">
      <button
        type="button"
        className={`admin-shell-scrim${isMobileNavOpen ? " is-open" : ""}`}
        aria-hidden={!isMobileNavOpen}
        tabIndex={isMobileNavOpen ? 0 : -1}
        onClick={() => setMobileNavOpen(false)}
      />

      <aside className={`admin-shell-sidebar${isMobileNavOpen ? " is-open" : ""}`}>
        <div className="admin-shell-brand">
          <img src={ASSETS.logoGold} alt="Gedung Agung" />
          <strong>ISTURA Admin</strong>
        </div>
        <nav className="admin-shell-menu" aria-label="Navigasi admin">
          {Object.entries(grouped).map(([group, items]) => (
            <div className="admin-shell-menu-group" key={group}>
              <span className="admin-shell-menu-label">{group}</span>
              {items.map((item) => {
                const Icon = item.icon;
                const isActive = item.key === tab;
                return (
                  <button
                    type="button"
                    key={item.key}
                    className={`admin-shell-menu-item${isActive ? " is-active" : ""}`}
                    onClick={() => {
                      onTabChange(item.key);
                      setMobileNavOpen(false);
                    }}
                  >
                    <Icon size={18} aria-hidden="true" />
                    <span>{item.label}</span>
                    {item.status === "soon" && (
                      <em className="admin-shell-menu-tag">soon</em>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
        <button
          type="button"
          className="admin-shell-exit"
          onClick={onExitToPublic}
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Lihat sisi publik
        </button>
      </aside>

      <div className="admin-shell-main">
        <header className="admin-shell-topbar">
          <button
            type="button"
            className="admin-shell-mobile-toggle"
            onClick={() => setMobileNavOpen((v) => !v)}
            aria-label="Toggle menu admin"
          >
            <Menu size={20} aria-hidden="true" />
          </button>
          <div className="admin-shell-crumb">
            <small>Dashboard</small>
            <strong>{currentItem.label}</strong>
          </div>
          <div className="admin-shell-user">
            <div className="admin-shell-user-avatar" aria-hidden="true">
              {session.name
                .split(" ")
                .map((part) => part[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <div className="admin-shell-user-meta">
              <strong>{session.name}</strong>
              <small>{session.role}</small>
            </div>
            <button
              type="button"
              className="admin-shell-logout"
              onClick={onLogout}
              aria-label="Keluar"
            >
              <LogOut size={16} aria-hidden="true" />
              <span>Keluar</span>
            </button>
          </div>
        </header>

        <div className="admin-shell-content">{children}</div>
      </div>
    </div>
  );
}

function AdminLogin({
  onAuthenticated,
  onCancel,
}: {
  onAuthenticated: (session: AdminSession) => void;
  onCancel: () => void;
}) {
  const [email, setEmail] = useState("admin@istura.id");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    apiLogin(email.trim(), password)
      .then((user) => {
        onAuthenticated({
          email: user.email,
          name: user.name,
          role: user.roleLabel,
          loggedAt: new Date().toISOString(),
        });
      })
      .catch((err) => {
        setLoading(false);
        if (err instanceof ValidationError) {
          const first = Object.values(err.errors).flat()[0];
          setError(first ?? "Email atau password salah. Coba lagi.");
        } else if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError("Tidak dapat menghubungi server. Coba lagi.");
        }
      });
  };

  return (
    <div className="admin-login">
      <button type="button" className="admin-login-back" onClick={onCancel}>
        <ArrowLeft size={16} aria-hidden="true" />
        Kembali ke beranda
      </button>

      <div className="admin-login-card">
        <div className="admin-login-brand">
          <img src={ASSETS.logoGold} alt="Gedung Agung" />
          <strong>ISTURA Admin</strong>
        </div>
        <h1>Masuk ke dashboard</h1>
        <p>
          Akses ini terbatas untuk pengelola Istana Kepresidenan Yogyakarta. Gunakan akun admin
          yang diberikan operator.
        </p>

        <form className="admin-login-form" onSubmit={submit} noValidate>
          <label className="form-field">
            <span>Email</span>
            <span className="admin-login-input">
              <Mail size={16} aria-hidden="true" />
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="admin@istura.id"
                required
              />
            </span>
          </label>
          <label className="form-field">
            <span>Password</span>
            <span className="admin-login-input">
              <Lock size={16} aria-hidden="true" />
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Kata sandi"
                required
              />
              <button
                type="button"
                className="admin-login-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Sembunyikan password" : "Lihat password"}
              >
                {showPassword ? "Sembunyikan" : "Lihat"}
              </button>
            </span>
          </label>

          {error && <strong className="form-message form-message--error">{error}</strong>}

          <button
            type="submit"
            className="button button-primary admin-login-submit"
            disabled={loading}
          >
            {loading ? "Memeriksa..." : "Masuk"}
            {!loading && <ArrowRight size={18} aria-hidden="true" />}
          </button>
        </form>

        <aside className="admin-login-hint" aria-label="Akun demo">
          <strong>Akun demo</strong>
          <p>
            Email <code>admin@istura.id</code> · Password <code>istura2026</code>. Placeholder ini
            akan diganti saat backend autentikasi terhubung.
          </p>
        </aside>
      </div>
    </div>
  );
}

function AdminPlaceholder({ tab }: { tab: AdminTab }) {
  const item = ADMIN_MENU.find((entry) => entry.key === tab);
  return (
    <div className="admin-placeholder">
      <div className="admin-placeholder-card">
        <span className="admin-placeholder-badge">Segera hadir</span>
        <h1>{item?.label ?? "Halaman ini sedang disiapkan"}</h1>
        <p>
          Modul ini akan tersedia setelah modul backend dan CMS terhubung. Untuk sementara, gunakan
          menu Booking untuk mengelola permohonan kunjungan.
        </p>
        <ul>
          <li>Data masih dirakit dari sumber resmi.</li>
          <li>Fitur akan diaktifkan secara bertahap setelah migrasi data selesai.</li>
        </ul>
      </div>
    </div>
  );
}






// -------------------------------------------------------------------------
//  CMS pages
// -------------------------------------------------------------------------



// --------------------------------------------------------------------------
// Booking list helpers (sort, filter, paginate). Kept as pure functions so the
// admin booking page can scale to hundreds/thousands of rows without complex
// state coupling.
// --------------------------------------------------------------------------

// "Virtualization" via window slicing: see hooks/useVirtualWindow.
// (moved to hooks/index.ts)

// Pagination sizes are tuned per viewport so the split-pane layout (list + detail)
// keeps both columns roughly the same height. The dense table view can afford
// more rows because it scrolls internally.
// (moved to domain/booking.ts)

export default App;

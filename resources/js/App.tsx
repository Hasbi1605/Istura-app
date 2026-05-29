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
import { Pagination } from "./components/ui/Pagination";
import {
  BookingExportModal,
  FeedbackExportModal,
  MonthlyReportModal,
} from "./components/admin/ExportModals";
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


function AdminDashboard({
  bookings,
  feedbacks,
  onJumpTab,
  adminName,
}: {
  bookings: Booking[];
  feedbacks: Feedback[];
  onJumpTab: (tab: AdminTab) => void;
  adminName?: string;
}) {
  const [showReportModal, setShowReportModal] = useState(false);
  const today = startOfDay(new Date());
  const todayKey = formatDateKey(today);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowKey = formatDateKey(tomorrow);

  const pendingBookings = bookings.filter((booking) => booking.status === "Pending");
  const acceptedBookings = bookings.filter((booking) => booking.status === "Accepted");
  const rescheduleBookings = bookings.filter((booking) => booking.status === "Reschedule");

  const pendingCount = pendingBookings.length;
  const heroPending = pendingBookings[0];

  // Agenda = kunjungan terkonfirmasi/dalam proses dengan tanggal di depan.
  // Untuk Reschedule, gunakan tanggal usulan baru sebagai acuan.
  type AgendaItem = Booking & {
    sortKey: string;
    displayDate: string;
    displayDateLabel: string;
    displayTime: string;
  };
  const agendaItems: AgendaItem[] = [...acceptedBookings, ...rescheduleBookings]
    .map((booking) => {
      const isReschedule =
        booking.status === "Reschedule" && booking.proposedDate && booking.proposedTime;
      const displayDate = isReschedule ? booking.proposedDate! : booking.date;
      const displayDateLabel = isReschedule
        ? booking.proposedDateLabel ?? booking.dateLabel
        : booking.dateLabel;
      const displayTime = isReschedule ? booking.proposedTime! : booking.time;
      return {
        ...booking,
        displayDate,
        displayDateLabel,
        displayTime,
        sortKey: `${displayDate}T${displayTime}`,
      };
    })
    .filter((item) => parseDateKey(item.displayDate) >= today)
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  const todayVisits = agendaItems.filter((item) => item.displayDate === todayKey);

  // Total kunjungan minggu berjalan (Accepted + Completed + Reschedule) —
  // sudut pandang planning untuk admin: berapa kunjungan akan/telah terjadi
  // minggu ini. Reschedule ikut dihitung memakai tanggal usulan baru kalau
  // tersedia, sehingga distribusi harian mencerminkan rencana terkini.
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);

  const getEffectiveVisitDate = (booking: Booking) =>
    booking.status === "Reschedule" && booking.proposedDate
      ? booking.proposedDate
      : booking.date;

  const isCountableForWeek = (booking: Booking) =>
    booking.status === "Accepted" ||
    booking.status === "Completed" ||
    booking.status === "Reschedule";

  // Semua kunjungan dalam rentang minggu berjalan, sudah dipetakan ke
  // tanggal/jam efektif. Dipakai sekaligus untuk hitungan total, distribusi
  // harian, dan navigasi antar hari di strip "Minggu ini".
  type WeekVisit = Booking & {
    displayDate: string;
    displayDateLabel: string;
    displayTime: string;
    sortKey: string;
  };
  const weekVisits: WeekVisit[] = bookings
    .filter((booking) => {
      if (!isCountableForWeek(booking)) return false;
      const d = parseDateKey(getEffectiveVisitDate(booking));
      return d >= startOfWeek && d <= endOfWeek;
    })
    .map((booking) => {
      const isReschedule =
        booking.status === "Reschedule" && booking.proposedDate && booking.proposedTime;
      const displayDate = isReschedule ? booking.proposedDate! : booking.date;
      const displayDateLabel = isReschedule
        ? booking.proposedDateLabel ?? booking.dateLabel
        : booking.dateLabel;
      const displayTime = isReschedule ? booking.proposedTime! : booking.time;
      return {
        ...booking,
        displayDate,
        displayDateLabel,
        displayTime,
        sortKey: `${displayDate}T${displayTime}`,
      };
    })
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  const visitsThisWeek = weekVisits.length;

  // Distribusi per hari untuk strip "Minggu ini" (Min..Sab). Hari yang sudah
  // lewat ditampilkan redup, hari ini ditandai, hari kosong pakai "—".
  const weekDistribution = Array.from({ length: 7 }, (_, offset) => {
    const dayDate = new Date(startOfWeek);
    dayDate.setDate(startOfWeek.getDate() + offset);
    const key = formatDateKey(dayDate);
    const count = weekVisits.filter((visit) => visit.displayDate === key).length;
    return {
      key,
      date: dayDate,
      count,
      isToday: key === todayKey,
      isPast: dayDate < today,
    };
  });

  // Hari yang sedang dijelajahi admin di strip minggu. Default-nya hari ini,
  // tapi admin bisa klik hari lain untuk melihat agenda harinya tanpa pindah
  // tab. Kalau tanggal tersimpan tidak lagi di minggu berjalan (misal user
  // membuka dashboard di awal minggu baru), fallback ke hari ini.
  const [selectedDayKey, setSelectedDayKey] = useState(todayKey);
  const isSelectedInWeek = weekDistribution.some((day) => day.key === selectedDayKey);
  const activeDayKey = isSelectedInWeek ? selectedDayKey : todayKey;
  const activeDayInfo =
    weekDistribution.find((day) => day.key === activeDayKey) ?? weekDistribution[today.getDay()];
  const activeDayDate = activeDayInfo.date;

  // Heading kompak yang muncul di header detail hari aktif. Untuk hari
  // istimewa (hari ini / besok) cukup label singkat; untuk hari lain pakai
  // "Selasa, 26 Mei" supaya tetap self-contained tanpa ngintip ke strip.
  const activeDayHeading = activeDayInfo.isToday
    ? "Hari ini"
    : activeDayKey === tomorrowKey
      ? "Besok"
      : `${fullDayNames[activeDayDate.getDay()]}, ${activeDayDate.getDate()} ${monthNames[activeDayDate.getMonth()]}`;

  // Subline status temporal supaya admin yang menjelajah ke hari lain tidak
  // bingung apakah hari itu sudah lewat / akan datang. Untuk Hari ini & Besok
  // kita pakai tanggal lengkap (heading sudah kontekstual).
  const activeDaySubline =
    activeDayInfo.isToday || activeDayKey === tomorrowKey
      ? `${fullDayNames[activeDayDate.getDay()]}, ${activeDayDate.getDate()} ${monthNames[activeDayDate.getMonth()]}`
      : activeDayInfo.isPast
        ? "Sudah lewat"
        : "Akan datang";

  const activeDayStatusKey: "today" | "past" | "future" = activeDayInfo.isToday
    ? "today"
    : activeDayInfo.isPast
      ? "past"
      : "future";

  // Label fallback untuk pesan empty-state ("tidak ada kunjungan pada
  // <hari>"). Sengaja terpisah dari heading supaya kalimat tetap natural.
  const activeDayShortLabel = activeDayInfo.isToday
    ? "hari ini"
    : activeDayKey === tomorrowKey
      ? "besok"
      : fullDayNames[activeDayDate.getDay()].toLowerCase();

  const selectedDayVisits = weekVisits.filter((visit) => visit.displayDate === activeDayKey);

  // Rentang minggu untuk header card, mis. "24 – 30 Mei 2026". Tetap ramah
  // saat minggu menjorok ke bulan / tahun berbeda.
  const weekRangeLabel = (() => {
    const s = startOfWeek;
    const e = endOfWeek;
    if (s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth()) {
      return `${s.getDate()} – ${e.getDate()} ${monthNames[s.getMonth()]} ${s.getFullYear()}`;
    }
    if (s.getFullYear() === e.getFullYear()) {
      return `${s.getDate()} ${monthNames[s.getMonth()].slice(0, 3)} – ${e.getDate()} ${monthNames[e.getMonth()].slice(0, 3)} ${s.getFullYear()}`;
    }
    return `${s.getDate()} ${monthNames[s.getMonth()].slice(0, 3)} ${s.getFullYear()} – ${e.getDate()} ${monthNames[e.getMonth()].slice(0, 3)} ${e.getFullYear()}`;
  })();

  const averageRating = feedbacks.length
    ? (feedbacks.reduce((sum, feedback) => sum + feedback.rating, 0) / feedbacks.length).toFixed(1)
    : "0.0";

  // Feedback urut kronologis (terbaru dulu). Rating rendah tetap dapat
  // styling .is-low + badge "Perlu tindak lanjut" sehingga tidak hilang.
  const sortedFeedbacks = [...feedbacks].sort(
    (a, b) =>
      parseSubmittedAt(b.submittedAt ?? "").getTime() -
      parseSubmittedAt(a.submittedAt ?? "").getTime(),
  );
  const recentFeedbacks = sortedFeedbacks.slice(0, 3);
  const lowRatingCount = sortedFeedbacks.filter((feedback) => feedback.rating <= 3).length;

  return (
    <div className="admin-cms-page admin-dashboard">
      <div className="admin-heading">
        <div>
          <h1>Dashboard</h1>
          <p>Ringkasan operasional kunjungan ISTURA hari ini.</p>
        </div>
        <div className="admin-heading-actions">
          <button
            type="button"
            className="booking-export-button"
            onClick={() => setShowReportModal(true)}
            title="Cetak laporan eksekutif (PDF)"
          >
            <FileText size={14} aria-hidden="true" />
            Laporan Bulanan
          </button>
        </div>
      </div>

      <div className="admin-stats">
        <StatCard label="Pending" value={pendingCount} />
        <StatCard label="Hari ini" value={todayVisits.length} />
        <StatCard label="Minggu ini" value={visitsThisWeek} />
        <StatCard label="Rating Rata-rata" value={averageRating} />
      </div>

      {heroPending ? (
        <section className="admin-dashboard-alert" role="status">
          <span className="admin-dashboard-alert-icon" aria-hidden="true">
            <ClipboardCheck size={18} />
          </span>
          <div className="admin-dashboard-alert-body">
            <strong>
              {pendingCount === 1
                ? "1 permohonan menunggu keputusan"
                : `${pendingCount} permohonan menunggu keputusan`}
            </strong>
            <small>
              {heroPending.code} · {heroPending.institution} · {heroPending.dateLabel},{" "}
              {heroPending.time} WIB
              {pendingCount > 1 ? <em> · +{pendingCount - 1} lagi</em> : null}
            </small>
          </div>
          <button
            type="button"
            className="admin-dashboard-alert-cta"
            onClick={() => onJumpTab("bookings")}
          >
            Tinjau pending
            <ArrowRight size={14} aria-hidden="true" />
          </button>
        </section>
      ) : null}

      <div className="admin-dashboard-grid">
        <section className="admin-card admin-dashboard-agenda">
          {/* Strip minggu di paling atas: berfungsi sebagai navigator + ringkasan
              distribusi. Detail agenda di bawah baru ikut konteks hari aktif. */}
          <div className="admin-dashboard-week">
            <div className="admin-dashboard-week-head">
              <div>
                <h3>Minggu ini</h3>
                <small>{weekRangeLabel}</small>
              </div>
              <button
                type="button"
                className="admin-dashboard-week-cta"
                onClick={() => onJumpTab("schedule")}
              >
                Atur jadwal
                <ArrowRight size={14} aria-hidden="true" />
              </button>
            </div>
            <ol className="admin-dashboard-week-strip" aria-label="Pilih hari di minggu ini">
              {weekDistribution.map((day) => {
                const isActive = day.key === activeDayKey;
                const className = [
                  "admin-dashboard-week-cell",
                  day.isToday ? "is-today" : "",
                  day.isPast && !day.isToday ? "is-past" : "",
                  day.count === 0 ? "is-empty" : "",
                  isActive ? "is-active" : "",
                ]
                  .filter(Boolean)
                  .join(" ");
                // Preview tooltip: 2 kunjungan pertama + jumlah sisa, supaya
                // admin bisa intip isi hari lain tanpa harus klik dulu.
                const cellVisits = weekVisits.filter((v) => v.displayDate === day.key);
                const preview = cellVisits
                  .slice(0, 2)
                  .map((v) => `${v.displayTime} ${v.institution}`)
                  .join("\n");
                const more =
                  cellVisits.length > 2 ? `\n+${cellVisits.length - 2} lainnya` : "";
                const title =
                  cellVisits.length === 0
                    ? `${formatLongDate(day.date)} · tidak ada kunjungan`
                    : `${formatLongDate(day.date)}\n${preview}${more}`;
                // Tampilan jumlah: 0 -> kosong (cell di-mute), 1-3 -> dots,
                // 4+ -> "3+". Ini menggantikan angka besar yang sebelumnya
                // mudah ketuker dengan tanggal.
                const dotCount = Math.min(day.count, 3);
                return (
                  <li key={day.key}>
                    <button
                      type="button"
                      className={className}
                      aria-pressed={isActive}
                      aria-label={`${formatLongDate(day.date)}, ${day.count} kunjungan`}
                      title={title}
                      onClick={() => setSelectedDayKey(day.key)}
                    >
                      <span className="admin-dashboard-week-day">
                        {fullDayNames[day.date.getDay()].slice(0, 3)}
                      </span>
                      <span className="admin-dashboard-week-date">
                        {day.date.getDate()}
                      </span>
                      <span
                        className="admin-dashboard-week-load"
                        aria-hidden="true"
                      >
                        {day.count === 0 ? (
                          <span className="admin-dashboard-week-load-empty" />
                        ) : day.count > 3 ? (
                          <span className="admin-dashboard-week-load-more">3+</span>
                        ) : (
                          Array.from({ length: dotCount }).map((_, i) => (
                            <span key={i} className="admin-dashboard-week-dot" />
                          ))
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>

          <header className="admin-card-head admin-dashboard-day-head">
            <div className="admin-dashboard-day-title">
              <div className="admin-dashboard-day-heading">
                <h2>{activeDayHeading}</h2>
                <span
                  className={`admin-dashboard-day-status admin-dashboard-day-status--${activeDayStatusKey}`}
                >
                  {activeDaySubline}
                </span>
              </div>
              {!activeDayInfo.isToday ? (
                <button
                  type="button"
                  className="admin-dashboard-day-reset"
                  onClick={() => setSelectedDayKey(todayKey)}
                >
                  <ArrowLeft size={12} aria-hidden="true" />
                  Hari ini
                </button>
              ) : null}
            </div>
            <button
              type="button"
              className="admin-card-link"
              onClick={() => onJumpTab("bookings")}
            >
              {activeDayInfo.isPast ? "Lihat riwayat" : "Buka booking"}
              <ArrowRight size={14} aria-hidden="true" />
            </button>
          </header>

          <div className="admin-card-body">
            {selectedDayVisits.length === 0 ? (
              <p className="admin-card-empty admin-dashboard-empty">
                <Clock3 size={14} aria-hidden="true" />
                <span>
                  {activeDayInfo.isToday
                    ? "Tidak ada kunjungan terjadwal hari ini."
                    : `Tidak ada kunjungan pada ${activeDayShortLabel}.`}
                </span>
              </p>
            ) : (
              <ul className="admin-agenda-list">
                {selectedDayVisits.map((item) => (
                  <li
                    key={item.code}
                    className={`admin-agenda-item${activeDayInfo.isToday ? " is-today" : ""}`}
                  >
                    <span className="admin-agenda-tag">
                      <Clock3 size={14} aria-hidden="true" />
                      <strong>{item.displayTime} WIB</strong>
                    </span>
                    <div className="admin-agenda-meta">
                      <strong>{item.institution}</strong>
                      <small>
                        {item.code} · {item.groupSize} orang
                      </small>
                    </div>
                    <StatusBadge status={item.status} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="admin-card">
          <header className="admin-card-head">
            <div>
              <h2>Feedback terbaru</h2>
              {lowRatingCount > 0 ? (
                <p>
                  {lowRatingCount} ulasan rating rendah perlu tindak lanjut.
                </p>
              ) : null}
            </div>
            <button
              type="button"
              className="admin-card-link"
              onClick={() => onJumpTab("feedback")}
            >
              Lihat semua
              <ArrowRight size={14} aria-hidden="true" />
            </button>
          </header>

          <div className="admin-card-body">
            {recentFeedbacks.length === 0 ? (
              <p className="admin-card-empty">Belum ada feedback masuk.</p>
            ) : (
              <ul className="admin-feedback-list">
                {recentFeedbacks.map((feedback) => (
                  <li
                    key={feedback.code}
                    className={feedback.rating <= 3 ? "is-low" : undefined}
                  >
                    <div className="admin-feedback-head">
                      <strong>{feedback.code}</strong>
                      <span
                        className="admin-feedback-rating"
                        aria-label={`${feedback.rating} dari 5`}
                      >
                        {Array.from({ length: 5 }).map((_, idx) => (
                          <Star
                            key={idx}
                            size={14}
                            fill={idx < feedback.rating ? "currentColor" : "none"}
                            aria-hidden="true"
                          />
                        ))}
                      </span>
                    </div>
                    {feedback.comment ? (
                      <p>"{feedback.comment}"</p>
                    ) : (
                      <p className="admin-feedback-empty">Tanpa komentar.</p>
                    )}
                    <div className="admin-feedback-foot">
                      <small>{feedback.submittedAt ?? "Tanggal tidak tercatat"}</small>
                      {feedback.rating <= 3 ? (
                        <span className="admin-feedback-flag">
                          Perlu tindak lanjut
                        </span>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      {showReportModal && (
        <MonthlyReportModal
          bookings={bookings}
          feedbacks={feedbacks}
          adminName={adminName}
          onClose={() => setShowReportModal(false)}
        />
      )}
    </div>
  );
}


function AdminFeedbackList({
  bookings,
  feedbacks,
  adminName,
}: {
  bookings: Booking[];
  feedbacks: Feedback[];
  adminName?: string;
}) {
  const [ratingFilter, setRatingFilter] = useState<"all" | "low" | "high">("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest" | "rating-desc" | "rating-asc">(
    "newest",
  );
  const [page, setPage] = useState(1);
  const [showExportModal, setShowExportModal] = useState(false);
  // Mobile breakpoint: split-pane tidak cukup di viewport sempit, jadi
  // pakai slideover. State terbuka digerakkan oleh klik baris saja, agar
  // panel tidak muncul otomatis saat halaman dibuka.
  const isCompactScreen = useMediaQuery("(max-width: 980px)");
  const [showSlideOver, setShowSlideOver] = useState(false);

  const enriched = useMemo(
    () =>
      feedbacks.map((feedback) => {
        const booking = bookings.find((item) => item.code === feedback.code);
        return {
          ...feedback,
          institution: booking?.institution ?? "—",
          dateLabel: booking?.dateLabel ?? "—",
          contactName: booking?.contactName ?? "—",
          // ISO key dipakai untuk sort kronologis. Kalau booking sudah dihapus
          // kita fallback ke string kosong agar entry-nya jatuh ke akhir.
          dateKey: booking?.date ?? "",
        };
      }),
    [feedbacks, bookings],
  );

  // Counts dipakai sebagai badge angka di chip filter, sama seperti pola
  // booking. Hitung dari dataset penuh agar tidak berubah saat user
  // mempersempit filter lain.
  const counts = useMemo(() => {
    let high = 0;
    let low = 0;
    enriched.forEach((feedback) => {
      if (feedback.rating >= 4) high += 1;
      if (feedback.rating <= 3) low += 1;
    });
    return { all: enriched.length, high, low };
  }, [enriched]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matched = enriched.filter((feedback) => {
      if (ratingFilter === "low" && feedback.rating > 3) return false;
      if (ratingFilter === "high" && feedback.rating < 4) return false;
      if (q) {
        const haystack =
          `${feedback.code} ${feedback.institution} ${feedback.contactName}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
    const sorted = [...matched];
    sorted.sort((a, b) => {
      if (sort === "newest") return b.dateKey.localeCompare(a.dateKey);
      if (sort === "oldest") return a.dateKey.localeCompare(b.dateKey);
      if (sort === "rating-desc") {
        if (b.rating !== a.rating) return b.rating - a.rating;
        return b.dateKey.localeCompare(a.dateKey);
      }
      // rating-asc
      if (a.rating !== b.rating) return a.rating - b.rating;
      return b.dateKey.localeCompare(a.dateKey);
    });
    return sorted;
  }, [enriched, ratingFilter, search, sort]);

  // Reset pagination whenever the underlying list changes shape so the user
  // is never stranded on an empty page.
  useEffect(() => {
    setPage(1);
  }, [search, ratingFilter, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE_FEEDBACK));
  const safePage = Math.min(page, totalPages);
  const pagedFeedbacks = filtered.slice(
    (safePage - 1) * PAGE_SIZE_FEEDBACK,
    safePage * PAGE_SIZE_FEEDBACK,
  );

  // Default selection follows the filtered/paged list so the panel never
  // points at a hidden row.
  const [selectedCode, setSelectedCode] = useState<string>("");
  const selected =
    pagedFeedbacks.find((feedback) => feedback.code === selectedCode) ??
    pagedFeedbacks[0] ??
    null;

  // KPI: agregat dipakai untuk evaluasi internal, jadi kita pakai dataset
  // penuh, bukan hasil filter.
  const averageRating = feedbacks.length
    ? (
        feedbacks.reduce((sum, feedback) => sum + feedback.rating, 0) / feedbacks.length
      ).toFixed(1)
    : "0.0";
  const needsAttention = feedbacks.filter((feedback) => feedback.rating <= 3).length;
  const completedCount = bookings.filter((booking) => booking.status === "Completed").length;
  const responseRate = completedCount
    ? Math.round((feedbacks.length / completedCount) * 100)
    : 0;

  const filtersActive = ratingFilter !== "all" || search.trim().length > 0;

  return (
    <div className="admin-cms-page admin-feedback-page">
      <div className="admin-heading">
        <div>
          <h1>Feedback Pengunjung</h1>
          <p>Masukan dari kunjungan yang sudah selesai. Hanya untuk evaluasi internal.</p>
        </div>
        <div className="admin-heading-actions">
          <div className="search-box">
            <Search size={18} aria-hidden="true" />
            <input
              placeholder="Cari kode, instansi, CP"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <button
            type="button"
            className="booking-export-button"
            onClick={() => setShowExportModal(true)}
            title="Export ringkasan & detail feedback ke Excel"
          >
            <FileSpreadsheet size={14} aria-hidden="true" />
            Export
          </button>
        </div>
      </div>

      <div className="admin-stats">
        <StatCard label="Total Feedback" value={feedbacks.length} />
        <StatCard label="Rating Rata-rata" value={averageRating} />
        <StatCard label="Perlu Perhatian" value={needsAttention} />
        <StatCard label="Response Rate" value={`${responseRate}%`} />
      </div>

      <div className="booking-toolbar" role="region" aria-label="Filter feedback">
        <div className="booking-chip-group" role="tablist" aria-label="Filter rating">
          <button
            type="button"
            role="tab"
            aria-selected={ratingFilter === "all"}
            data-empty={counts.all === 0 ? "true" : undefined}
            className={`booking-chip booking-chip--all${ratingFilter === "all" ? " is-active" : ""}`}
            onClick={() => setRatingFilter("all")}
            title="Tampilkan semua rating"
          >
            <span>Semua</span>
            <em>{formatCountShort(counts.all)}</em>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={ratingFilter === "high"}
            data-empty={counts.high === 0 ? "true" : undefined}
            className={`booking-chip booking-chip--positive${ratingFilter === "high" ? " is-active" : ""}`}
            onClick={() => setRatingFilter(ratingFilter === "high" ? "all" : "high")}
            title="Filter rating positif"
          >
            <span>Positif (4-5)</span>
            <em>{formatCountShort(counts.high)}</em>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={ratingFilter === "low"}
            data-empty={counts.low === 0 ? "true" : undefined}
            className={`booking-chip booking-chip--attention${ratingFilter === "low" ? " is-active" : ""}`}
            onClick={() => setRatingFilter(ratingFilter === "low" ? "all" : "low")}
            title="Filter rating perlu perhatian"
          >
            <span>Perlu perhatian (1-3)</span>
            <em>{formatCountShort(counts.low)}</em>
          </button>
        </div>

        <div className="booking-toolbar-spacer" aria-hidden="true" />

        <label className="admin-feedback-sort">
          <span className="visually-hidden">Urutkan feedback</span>
          <select
            value={sort}
            onChange={(event) =>
              setSort(event.target.value as typeof sort)
            }
            aria-label="Urutkan feedback"
          >
            <option value="newest">Terbaru</option>
            <option value="oldest">Terlama</option>
            <option value="rating-desc">Rating tertinggi</option>
            <option value="rating-asc">Rating terendah</option>
          </select>
        </label>

        <div className="booking-summary" aria-live="polite">
          {filtered.length === counts.all ? (
            <>
              <strong>{formatCount(counts.all)}</strong> feedback
            </>
          ) : (
            <>
              <strong>{formatCount(filtered.length)}</strong> dari{" "}
              <strong>{formatCount(counts.all)}</strong>
            </>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="admin-card admin-card--empty">
          <p>
            {filtersActive
              ? "Tidak ada feedback yang cocok dengan filter."
              : "Belum ada feedback masuk."}
          </p>
        </div>
      ) : (
        <div className="admin-workspace admin-feedback-workspace">
          <div className="booking-split-list">
            <div className="booking-table">
              {pagedFeedbacks.map((feedback) => {
                const isSelected = selected?.code === feedback.code;
                return (
                  <button
                    key={feedback.code}
                    type="button"
                    className={`booking-row${isSelected ? " is-selected" : ""}`}
                    onClick={() => {
                      setSelectedCode(feedback.code);
                      if (isCompactScreen) setShowSlideOver(true);
                    }}
                  >
                    <span className="booking-row-main">
                      <strong>{feedback.code}</strong>
                      <small>{feedback.institution}</small>
                      <small className="admin-feedback-row-date">{feedback.dateLabel}</small>
                    </span>
                    <span
                      className="admin-feedback-rating"
                      aria-label={`${feedback.rating} dari 5`}
                    >
                      {Array.from({ length: 5 }).map((_, idx) => (
                        <Star
                          key={idx}
                          size={14}
                          fill={idx < feedback.rating ? "currentColor" : "none"}
                          aria-hidden="true"
                        />
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>

            {totalPages > 1 && (
              <Pagination page={safePage} totalPages={totalPages} onChange={setPage} />
            )}
          </div>

          <div className="booking-split-detail">
            {selected ? (
              <FeedbackDetailPanel feedback={selected} />
            ) : (
              <div className="booking-detail booking-detail--empty">
                <p>Pilih feedback untuk melihat detail.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {showExportModal && (
        <FeedbackExportModal
          bookings={bookings}
          feedbacks={feedbacks}
          adminName={adminName}
          onClose={() => setShowExportModal(false)}
        />
      )}

      {isCompactScreen && showSlideOver && selected && (
        <FeedbackSlideOver
          feedback={selected}
          onClose={() => setShowSlideOver(false)}
        />
      )}
    </div>
  );
}

function FeedbackDetailPanel({
  feedback,
}: {
  feedback: Feedback & { institution: string; dateLabel: string; contactName: string };
}) {
  const scores: Array<{ label: string; value: number; max: number }> = [
    { label: "Kepuasan keseluruhan", value: feedback.rating, max: 5 },
    { label: "Kemudahan booking", value: feedback.bookingEase, max: 5 },
    { label: "Layanan petugas", value: feedback.service, max: 5 },
    { label: "Skor rekomendasi", value: feedback.recommend, max: 5 },
  ];

  return (
    <div className="booking-detail admin-feedback-detail">
      <header className="detail-head">
        <div>
          <strong>{feedback.code}</strong>
          <small>
            {feedback.institution} · {feedback.dateLabel}
          </small>
        </div>
        <span
          className="admin-feedback-rating admin-feedback-rating--lg"
          aria-label={`${feedback.rating} dari 5`}
        >
          {Array.from({ length: 5 }).map((_, idx) => (
            <Star
              key={idx}
              size={18}
              fill={idx < feedback.rating ? "currentColor" : "none"}
              aria-hidden="true"
            />
          ))}
        </span>
      </header>

      <section className="admin-feedback-scores" aria-label="Breakdown skor">
        {scores.map((score) => (
          <div key={score.label} className="admin-feedback-score">
            <div className="admin-feedback-score-label">
              <span>{score.label}</span>
              <strong>
                {score.value}/{score.max}
              </strong>
            </div>
            <div
              className="admin-feedback-score-bar"
              role="presentation"
              aria-hidden="true"
            >
              <div
                className="admin-feedback-score-fill"
                style={{ width: `${(score.value / score.max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </section>

      <section className="admin-feedback-aspects">
        <div>
          <span className="admin-feedback-aspect-label">Aspek terbaik</span>
          {feedback.highlights.length > 0 ? (
            <ul className="admin-feedback-chiplist">
              {feedback.highlights.map((item) => (
                <li key={item} className="admin-feedback-chip admin-feedback-chip--positive">
                  {item}
                </li>
              ))}
            </ul>
          ) : (
            <p className="admin-feedback-aspect-empty">Tidak disebutkan.</p>
          )}
        </div>
        <div>
          <span className="admin-feedback-aspect-label">Perlu diperbaiki</span>
          {feedback.improvements.length > 0 ? (
            <ul className="admin-feedback-chiplist">
              {feedback.improvements.map((item) => (
                <li key={item} className="admin-feedback-chip admin-feedback-chip--warn">
                  {item}
                </li>
              ))}
            </ul>
          ) : (
            <p className="admin-feedback-aspect-empty">Tidak disebutkan.</p>
          )}
        </div>
      </section>

      {feedback.comment && (
        <section className="admin-feedback-comment">
          <span className="admin-feedback-aspect-label">Komentar pengunjung</span>
          <blockquote>"{feedback.comment}"</blockquote>
        </section>
      )}

      <footer className="admin-feedback-detail-foot">
        <small>
          Diisi {feedback.submittedAt ?? feedback.dateLabel} · CP {feedback.contactName}
        </small>
      </footer>
    </div>
  );
}

// Mobile slideover untuk feedback — pola sama persis dengan BookingSlideOver:
// dipakai sebagai panel detail di viewport sempit (≤980px) karena split-pane
// tidak punya cukup ruang horizontal.
function FeedbackSlideOver({
  feedback,
  onClose,
}: {
  feedback: Feedback & { institution: string; dateLabel: string; contactName: string };
  onClose: () => void;
}) {
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      className="booking-slideover"
      role="dialog"
      aria-modal="true"
      aria-label="Detail feedback"
    >
      <button
        type="button"
        className="booking-slideover-backdrop"
        aria-label="Tutup detail"
        onClick={onClose}
      />
      <aside className="booking-slideover-panel">
        <header>
          <span>
            <strong>{feedback.code}</strong>
            <small>
              {feedback.institution} · {feedback.dateLabel}
            </small>
          </span>
          <button
            type="button"
            className="booking-slideover-close"
            onClick={onClose}
            aria-label="Tutup"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <FeedbackDetailPanel feedback={feedback} />
      </aside>
    </div>
  );
}


// -------------------------------------------------------------------------
//  CMS pages
// -------------------------------------------------------------------------

const generateId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

function AdminFaqManager({
  faqs,
  onChange,
}: {
  faqs: FaqItem[];
  onChange: (next: FaqItem[]) => void;
}) {
  const [editing, setEditing] = useState<FaqItem | null>(null);
  const [draft, setDraft] = useState<FaqItem>({
    id: "",
    question: "",
    answer: "",
  });
  const [linkLabel, setLinkLabel] = useState("");
  const [linkHref, setLinkHref] = useState("");

  const startCreate = () => {
    setEditing(null);
    setDraft({ id: generateId("faq"), question: "", answer: "" });
    setLinkLabel("");
    setLinkHref("");
  };

  const startEdit = (item: FaqItem) => {
    setEditing(item);
    setDraft({ ...item });
    setLinkLabel(item.link?.label ?? "");
    setLinkHref(item.link?.href ?? "");
  };

  const cancel = () => {
    setEditing(null);
    setDraft({ id: "", question: "", answer: "" });
    setLinkLabel("");
    setLinkHref("");
  };

  const save = () => {
    if (!draft.question.trim() || !draft.answer.trim()) return;
    const link =
      linkLabel.trim() && linkHref.trim()
        ? { label: linkLabel.trim(), href: linkHref.trim() }
        : undefined;
    const item: FaqItem = {
      id: draft.id || generateId("faq"),
      question: draft.question.trim(),
      answer: draft.answer.trim(),
      link,
    };
    const exists = faqs.some((entry) => entry.id === item.id);
    onChange(exists ? faqs.map((entry) => (entry.id === item.id ? item : entry)) : [...faqs, item]);
    cancel();
  };

  const remove = (id: string) => {
    if (!window.confirm("Hapus pertanyaan ini?")) return;
    onChange(faqs.filter((entry) => entry.id !== id));
    if (draft.id === id) cancel();
  };

  const move = (id: string, direction: -1 | 1) => {
    const idx = faqs.findIndex((entry) => entry.id === id);
    if (idx === -1) return;
    const target = idx + direction;
    if (target < 0 || target >= faqs.length) return;
    const next = [...faqs];
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };

  const isFormOpen = Boolean(draft.id);

  return (
    <div className="admin-cms-page">
      <div className="admin-heading">
        <div>
          <h1>Kelola FAQ</h1>
          <p>Pertanyaan dan jawaban yang muncul di halaman publik.</p>
        </div>
        {!isFormOpen && (
          <button type="button" className="button button-primary" onClick={startCreate}>
            <PenLine size={16} aria-hidden="true" />
            Tambah pertanyaan
          </button>
        )}
      </div>

      {isFormOpen && (
        <section className="admin-card">
          <header className="admin-card-head">
            <div>
              <h2>{editing ? "Edit pertanyaan" : "Tambah pertanyaan baru"}</h2>
              <p>Perubahan langsung muncul di halaman publik.</p>
            </div>
          </header>
          <div className="admin-cms-form">
            <label className="form-field">
              <span>Pertanyaan</span>
              <input
                value={draft.question}
                onChange={(event) => setDraft({ ...draft, question: event.target.value })}
                placeholder="Mis. Apakah booking harus minimal H-5?"
              />
            </label>
            <label className="form-field">
              <span>Jawaban</span>
              <textarea
                rows={4}
                value={draft.answer}
                onChange={(event) => setDraft({ ...draft, answer: event.target.value })}
              />
            </label>
            <div className="admin-cms-link">
              <label className="form-field">
                <span>Label tautan (opsional)</span>
                <input
                  value={linkLabel}
                  onChange={(event) => setLinkLabel(event.target.value)}
                  placeholder="Mis. Lihat contoh surat"
                />
              </label>
              <label className="form-field">
                <span>URL tautan (opsional)</span>
                <input
                  value={linkHref}
                  onChange={(event) => setLinkHref(event.target.value)}
                  placeholder="#contoh-surat atau https://..."
                />
              </label>
            </div>
            <div className="admin-cms-actions">
              <button type="button" className="button button-ghost" onClick={cancel}>
                Batal
              </button>
              <button
                type="button"
                className="button button-primary"
                onClick={save}
                disabled={!draft.question.trim() || !draft.answer.trim()}
              >
                Simpan
              </button>
            </div>
          </div>
        </section>
      )}

      <div className="admin-cms-list">
        {faqs.map((item, index) => (
          <article key={item.id} className="admin-cms-row">
            <div className="admin-cms-row-body">
              <strong>{item.question}</strong>
              <p>{item.answer}</p>
              {item.link && (
                <small>
                  Tautan: {item.link.label} → {item.link.href}
                </small>
              )}
            </div>
            <div className="admin-cms-row-actions">
              <button
                type="button"
                className="admin-icon-btn"
                onClick={() => move(item.id, -1)}
                disabled={index === 0}
                aria-label="Pindahkan ke atas"
              >
                <ChevronLeft size={16} style={{ transform: "rotate(90deg)" }} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="admin-icon-btn"
                onClick={() => move(item.id, 1)}
                disabled={index === faqs.length - 1}
                aria-label="Pindahkan ke bawah"
              >
                <ChevronRight size={16} style={{ transform: "rotate(90deg)" }} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="admin-icon-btn"
                onClick={() => startEdit(item)}
                aria-label="Edit"
              >
                <PenLine size={16} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="admin-icon-btn admin-icon-btn--danger"
                onClick={() => remove(item.id)}
                aria-label="Hapus"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}


function AdminContactsManager({
  contacts,
  onChange,
}: {
  contacts: FooterContact[];
  onChange: (next: FooterContact[]) => void;
}) {
  const [drafts, setDrafts] = useState<FooterContact[]>(contacts);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    setDrafts(contacts);
  }, [contacts]);

  const updateField = (index: number, field: keyof FooterContact, value: string) => {
    setDrafts((current) =>
      current.map((item, idx) =>
        idx === index ? ({ ...item, [field]: value } as FooterContact) : item,
      ),
    );
  };

  const save = () => {
    onChange(drafts);
    setSavedAt(
      new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
    );
  };

  return (
    <div className="admin-cms-page">
      <div className="admin-heading">
        <div>
          <h1>Kontak Footer</h1>
          <p>Tautan kontak resmi yang ditampilkan di footer publik.</p>
        </div>
        <button type="button" className="button button-primary" onClick={save}>
          Simpan perubahan
        </button>
      </div>

      <div className="admin-cms-list">
        {drafts.map((contact, index) => (
          <article key={contact.iconKey} className="admin-cms-row admin-cms-row--form">
            <div className="admin-cms-row-icon">
              <ContactIcon iconKey={contact.iconKey} />
            </div>
            <div className="admin-cms-fields">
              <label className="form-field">
                <span>Nama platform</span>
                <input
                  value={contact.label}
                  onChange={(event) => updateField(index, "label", event.target.value)}
                />
              </label>
              <label className="form-field">
                <span>Handle / nomor</span>
                <input
                  value={contact.value}
                  onChange={(event) => updateField(index, "value", event.target.value)}
                />
              </label>
              <label className="form-field admin-cms-fields-full">
                <span>Tautan</span>
                <input
                  value={contact.href}
                  onChange={(event) => updateField(index, "href", event.target.value)}
                  placeholder="https://..."
                />
              </label>
            </div>
          </article>
        ))}
      </div>
      {savedAt && (
        <small className="admin-cms-saved">Tersimpan terakhir pukul {savedAt}.</small>
      )}
    </div>
  );
}


function AdminWaTemplates({
  templates,
  onChange,
}: {
  templates: WaTemplate[];
  onChange: (next: WaTemplate[]) => void;
}) {
  const [drafts, setDrafts] = useState<WaTemplate[]>(templates);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    setDrafts(templates);
  }, [templates]);

  const isDirty = drafts.some(
    (draft, idx) => draft.template !== templates[idx]?.template,
  );

  const updateField = (index: number, value: string) => {
    setDrafts((current) =>
      current.map((item, idx) => (idx === index ? { ...item, template: value } : item)),
    );
  };

  const reset = (index: number) => {
    const original = INITIAL_WA_TEMPLATES.find((entry) => entry.id === drafts[index].id);
    if (!original) return;
    setDrafts((current) =>
      current.map((item, idx) => (idx === index ? { ...item, template: original.template } : item)),
    );
  };

  const save = () => {
    onChange(drafts);
    setSavedAt(
      new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
    );
  };

  return (
    <div className="admin-cms-page">
      <div className="admin-page-head">
        <div>
          <h1>Template Pesan WhatsApp</h1>
          <p>Pesan otomatis yang dikirim ke pengunjung lewat WhatsApp.</p>
        </div>
        <button
          type="button"
          className="button button-primary"
          onClick={save}
          disabled={!isDirty}
        >
          Simpan perubahan
        </button>
      </div>

      <div className="admin-info-note">
        Variabel yang bisa dipakai:
        <code> {"{nama}"} </code>
        <code> {"{instansi}"} </code>
        <code> {"{kode}"} </code>
        <code> {"{tanggal}"} </code>
        <code> {"{jam}"} </code>
        <code> {"{catatan}"} </code>
        <code> {"{link}"} </code>
        <span> akan otomatis diisi saat pesan dikirim.</span>
      </div>

      <div className="admin-cms-list">
        {drafts.map((draft, index) => (
          <article key={draft.id} className="admin-card admin-wa-card">
            <header className="admin-card-head">
              <div>
                <h2>{draft.label}</h2>
                <p>{draft.description}</p>
              </div>
              <button
                type="button"
                className="admin-card-link"
                onClick={() => reset(index)}
              >
                Pulihkan default
              </button>
            </header>
            <textarea
              className="admin-wa-textarea"
              rows={5}
              value={draft.template}
              onChange={(event) => updateField(index, event.target.value)}
            />
          </article>
        ))}
      </div>

      {savedAt && (
        <small className="admin-cms-saved">Tersimpan terakhir pukul {savedAt}.</small>
      )}
    </div>
  );
}


function AdminLetterPreview() {
  return (
    <div className="admin-cms-page">
      <div className="admin-heading">
        <div>
          <h1>Contoh Surat Permohonan</h1>
          <p>Pratinjau template yang ditampilkan di halaman publik.</p>
        </div>
        <span className="admin-placeholder-badge">Read-only · backend</span>
      </div>

      <section className="admin-card">
        <header className="admin-card-head">
          <div>
            <h2>Template aktif</h2>
            <p>Berkas yang dilampirkan di halaman publik.</p>
          </div>
        </header>
        <div className="admin-letter-preview">
          <img src={ASSETS.letterExample} alt="Pratinjau contoh surat permohonan" />
        </div>
      </section>

      <section className="admin-card">
        <header className="admin-card-head">
          <div>
            <h2>Persyaratan minimal</h2>
            <p>Daftar yang dipakai untuk validasi surat.</p>
          </div>
        </header>
        <ul className="admin-checklist">
          {letterChecklist.map((item) => (
            <li key={item}>
              <Check size={14} aria-hidden="true" /> {item}
            </li>
          ))}
        </ul>
        <p className="admin-info-note">
          Upload template baru dan editor persyaratan akan tersedia setelah backend siap.
        </p>
      </section>
    </div>
  );
}


function AdminHeroPreview() {
  return (
    <div className="admin-cms-page">
      <div className="admin-heading">
        <div>
          <h1>Hero & Cerita</h1>
          <p>Pratinjau copy hero dan cerita pendek di halaman beranda.</p>
        </div>
        <span className="admin-placeholder-badge">Read-only · backend</span>
      </div>

      <section className="admin-card">
        <header className="admin-card-head">
          <div>
            <h2>Hero</h2>
            <p>Headline utama dan ajakan booking.</p>
          </div>
        </header>
        <dl className="admin-kv-list">
          <div>
            <dt>Headline</dt>
            <dd>ISTURA - Istana Untuk Rakyat</dd>
          </div>
          <div>
            <dt>Subheadline</dt>
            <dd>Booking Kunjungan Istana Kepresidenan Yogyakarta</dd>
          </div>
          <div>
            <dt>Tombol primer</dt>
            <dd>Mulai Booking</dd>
          </div>
          <div>
            <dt>Tombol sekunder</dt>
            <dd>Cek Jadwal</dd>
          </div>
        </dl>
      </section>

      <section className="admin-card">
        <header className="admin-card-head">
          <div>
            <h2>Cerita pendek</h2>
            <p>Kalimat scrubbed yang muncul saat scroll.</p>
          </div>
        </header>
        <p className="admin-quote">"{storyWords.join(" ")}"</p>
      </section>

      <p className="admin-info-note">
        Editor copy hero dan cerita akan tersedia setelah CMS terhubung.
      </p>
    </div>
  );
}


const MOCK_ADMIN_USERS = [
  {
    name: "Admin ISTURA",
    email: "admin@istura.id",
    role: "Super Admin",
    status: "Aktif",
    lastLogin: "Hari ini",
  },
  {
    name: "Operator Booking",
    email: "operator@istura.id",
    role: "Operator",
    status: "Aktif",
    lastLogin: "Kemarin, 16:24",
  },
  {
    name: "Editor Konten",
    email: "editor@istura.id",
    role: "Editor",
    status: "Nonaktif",
    lastLogin: "12 Mei 2026",
  },
];

function AdminUsersList() {
  return (
    <div className="admin-cms-page">
      <div className="admin-heading">
        <div>
          <h1>Pengguna Admin</h1>
          <p>Daftar akun yang memiliki akses dashboard ISTURA.</p>
        </div>
        <span className="admin-placeholder-badge">Read-only · backend</span>
      </div>

      <section className="admin-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Nama</th>
              <th>Email</th>
              <th>Peran</th>
              <th>Status</th>
              <th>Login terakhir</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_ADMIN_USERS.map((user) => (
              <tr key={user.email}>
                <td>
                  <strong>{user.name}</strong>
                </td>
                <td>{user.email}</td>
                <td>{user.role}</td>
                <td>
                  <span className={`admin-pill admin-pill--${user.status === "Aktif" ? "ok" : "off"}`}>
                    {user.status}
                  </span>
                </td>
                <td>{user.lastLogin}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="admin-info-note">
          Tambah akun, ubah peran, dan reset password tersedia setelah backend autentikasi
          terhubung.
        </p>
      </section>
    </div>
  );
}


const MOCK_AUDIT_LOG = [
  {
    actor: "Admin ISTURA",
    action: "Menyetujui booking ISTURA-2026-0042",
    at: "26 Mei 2026, 09.12 WIB",
  },
  {
    actor: "Admin ISTURA",
    action: "Mengubah jawaban FAQ 'Apakah booking harus dilakukan minimal H-5?'",
    at: "25 Mei 2026, 17.04 WIB",
  },
  {
    actor: "Operator Booking",
    action: "Menutup slot 12.00 - 14.00 WIB pada 30 Mei 2026",
    at: "25 Mei 2026, 11.20 WIB",
  },
  {
    actor: "Admin ISTURA",
    action: "Menandai ISTURA-2026-0039 sebagai Completed",
    at: "22 Mei 2026, 12.10 WIB",
  },
];

function AdminAuditLog() {
  return (
    <div className="admin-cms-page">
      <div className="admin-heading">
        <div>
          <h1>Riwayat Aktivitas</h1>
          <p>Log perubahan yang dilakukan oleh tim admin.</p>
        </div>
        <span className="admin-placeholder-badge">Read-only · backend</span>
      </div>

      <section className="admin-card">
        <ol className="admin-audit-list">
          {MOCK_AUDIT_LOG.map((entry, idx) => (
            <li key={`${entry.actor}-${idx}`}>
              <span className="admin-audit-dot" aria-hidden="true" />
              <div>
                <strong>{entry.actor}</strong>
                <p>{entry.action}</p>
                <small>{entry.at}</small>
              </div>
            </li>
          ))}
        </ol>
        <p className="admin-info-note">
          Log lengkap dengan filter waktu dan ekspor CSV tersedia setelah backend audit
          terhubung.
        </p>
      </section>
    </div>
  );
}


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

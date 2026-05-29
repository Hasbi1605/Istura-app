import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent, ReactNode } from "react";
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
import { AdminShell, AdminLogin } from "./components/admin/AdminShell";
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
import { useNavEntranceAnimation, useHomeHeroAnimation } from "./animations/useHomeAnimations";

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

  useNavEntranceAnimation(pageRef);
  useHomeHeroAnimation(pageRef, screen);

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



export default App;

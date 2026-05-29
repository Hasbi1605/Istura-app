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

gsap.registerPlugin(useGSAP, ScrollTrigger);

const INITIAL_FOOTER_CONTACTS: FooterContact[] = [
  {
    label: "Instagram",
    value: "istanakepresidenanyogyakarta",
    href: "https://www.instagram.com/istanakepresidenanyogyakarta/",
    iconKey: "instagram",
  },
  {
    label: "YouTube",
    value: "istanakepresidenanyogyakarta",
    href: "https://www.youtube.com/@istanakepresidenanyogyakarta",
    iconKey: "youtube",
  },
  {
    label: "WhatsApp",
    value: "0811 6030 0040",
    href: "https://wa.me/6281160300040",
    iconKey: "whatsapp",
  },
];

const FEEDBACK_HIGHLIGHTS = [
  "Penyambutan",
  "Tur area",
  "Cerita sejarah",
  "Dokumentasi",
  "Penjelasan pemandu",
  "Fasilitas",
];

const FEEDBACK_IMPROVEMENTS = [
  "Waktu kunjungan",
  "Akses informasi",
  "Penjelasan pemandu",
  "Fasilitas",
  "Dokumentasi",
  "Lainnya",
];

const RATING_LABELS = [
  "Pilih rating",
  "Sangat kurang",
  "Kurang",
  "Cukup",
  "Baik",
  "Sangat baik",
];

const storyWords = "Pilih jadwal, isi data, unggah surat, lalu tunggu konfirmasi WhatsApp.".split(" ");

const wizardSteps = [
  {
    title: "Selamat Datang",
    helper: "Siapkan data contact person, nomor WhatsApp aktif, rencana tanggal, dan surat permohonan.",
    miky: "Halo! Aku MIKY. Kita akan mengisi pendaftaran kunjungan secara bertahap.",
    icon: Sparkles,
    image: ASSETS.mikyStep1,
  },
  {
    title: "Data Contact Person",
    helper: "Data ini digunakan admin untuk menghubungi perwakilan rombongan.",
    miky: "Pastikan nomor WhatsApp aktif karena konfirmasi akan dikirim melalui nomor ini.",
    icon: Users,
    image: ASSETS.mikyStep2,
  },
  {
    title: "Data Instansi",
    helper: "Tuliskan nama instansi dan jumlah rombongan yang akan hadir.",
    miky: "Nama instansi membantu admin memverifikasi permohonan kunjunganmu.",
    icon: ClipboardCheck,
    image: ASSETS.mikyStep3,
  },
  {
    title: "Pilih Jadwal",
    helper: "Pilih tanggal dan jam yang masih tersedia. Jadwal pending tetap terkunci.",
    miky: "Jadwal abu-abu sudah terisi atau belum dibuka. Pilih slot berwarna gold.",
    icon: CalendarDays,
    image: ASSETS.mikyStep4,
  },
  {
    title: "Upload Surat",
    helper: "Format yang didukung: PDF, JPG, JPEG, atau PNG dengan ukuran maksimal 10 MB.",
    miky: "Unggah surat permohonan resmi dari instansi agar admin bisa melakukan pengecekan.",
    icon: UploadCloud,
    image: ASSETS.mikyStep5,
  },
  {
    title: "Review Data",
    helper: "Periksa kembali semua data sebelum permohonan dikirim.",
    miky: "Cek ulang nama, jadwal, dan surat. Setelah submit, jadwal akan langsung terkunci.",
    icon: FileCheck2,
    image: ASSETS.mikyStep7,
  },
  {
    title: "Pernyataan",
    helper: "Setujui pernyataan kebenaran data dan kesediaan mengikuti aturan kunjungan.",
    miky: "Kalau datanya sudah benar, centang pernyataan lalu kirim permohonan.",
    icon: ShieldCheck,
    image: ASSETS.mikyStep6,
  },
  {
    title: "Selesai",
    helper: "Permohonan masuk ke dashboard admin dengan status Pending.",
    miky: "Permohonan berhasil dikirim. Admin akan menghubungi maksimal 1x24 jam.",
    icon: BadgeCheck,
    image: ASSETS.mikyStep8,
  },
];

const quickInfoCards: Array<{
  icon: LucideIcon;
  title: string;
  body: string;
  points: string[];
}> = [
  {
    icon: Clock3,
    title: "Jam Kunjungan",
    body: "Kunjungan dibuka pada hari kerja sesuai jadwal layanan ISTURA.",
    points: ["Senin - Jumat", "08.00 - 14.00 WIB"],
  },
  {
    icon: FileCheck2,
    title: "Syarat Kunjungan",
    body: "Siapkan dokumen dan data utama sebelum mengisi form booking.",
    points: ["Surat permohonan resmi", "Data contact person", "Booking minimal H-5"],
  },
  {
    icon: MessageCircle,
    title: "Konfirmasi WhatsApp",
    body: "Admin akan menghubungi contact person setelah data permohonan masuk.",
    points: ["Maksimal 1x24 jam", "Gunakan nomor WhatsApp aktif"],
  },
];

const bookingProcessCards: Array<{
  icon: LucideIcon;
  title: string;
  body: string;
}> = [
  {
    icon: CalendarDays,
    title: "Pilih jadwal",
    body: "Cek kalender dua bulan ke depan, lalu pilih tanggal dan jam yang masih tersedia.",
  },
  {
    icon: PenLine,
    title: "Isi data",
    body: "Masukkan nama contact person, NIK, WhatsApp aktif, asal instansi, dan jumlah rombongan.",
  },
  {
    icon: UploadCloud,
    title: "Unggah surat",
    body: "Lampirkan surat permohonan resmi dari instansi agar admin dapat melakukan verifikasi.",
  },
  {
    icon: MessageCircle,
    title: "Tunggu WhatsApp",
    body: "Admin mengirim keputusan, penolakan, atau opsi reschedule melalui WhatsApp.",
  },
];

const letterChecklist = [
  "Kop surat resmi instansi atau organisasi.",
  "Perihal permohonan kunjungan dan tujuan surat yang jelas.",
  "Tanggal, waktu, jumlah peserta, nama koordinator, NIK, dan nomor HP.",
  "Tanda tangan kepala instansi atau penanggung jawab.",
];

const INITIAL_FAQ_ITEMS: FaqItem[] = [
  {
    id: "faq-h5",
    question: "Apakah booking harus dilakukan minimal H-5?",
    answer:
      "Ya. Permohonan sebaiknya dikirim minimal H-5 dari tanggal kunjungan agar admin memiliki waktu untuk pengecekan jadwal dan surat.",
  },
  {
    id: "faq-individu",
    question: "Apakah pengunjung individu bisa mendaftar?",
    answer:
      "Alur ini diprioritaskan untuk perwakilan instansi, sekolah, komunitas, atau organisasi yang mengajukan kunjungan rombongan.",
  },
  {
    id: "faq-rombongan",
    question: "Berapa jumlah maksimal rombongan?",
    answer:
      "Setiap kloter menampung maksimal 75 orang. Jika rombongan lebih dari 75 orang, tetap kirim booking terlebih dahulu, lalu admin akan menghubungi via WhatsApp untuk membicarakan pembagian kloter.",
  },
  {
    id: "faq-format-surat",
    question: "Format surat permohonan seperti apa?",
    answer:
      "Gunakan surat resmi berkop instansi, mencantumkan tanggal kunjungan, waktu, jumlah peserta, data koordinator, dan tanda tangan penanggung jawab.",
    link: { label: "Lihat contoh surat", href: "#contoh-surat" },
  },
  {
    id: "faq-biaya",
    question: "Apakah ada biaya untuk berkunjung?",
    answer:
      "Tidak ada biaya. Istura merupakan program kunjungan Istana Untuk Rakyat yang dibuka gratis bagi seluruh masyarakat.",
  },
  {
    id: "faq-penuh",
    question: "Bagaimana jika jadwal yang diinginkan penuh?",
    answer:
      "Pilih slot lain yang masih tersedia. Jika admin menawarkan reschedule, konfirmasi akan dikirim melalui WhatsApp contact person.",
  },
];


const accordionItems = [
  {
    title: "Penyambutan",
    body: "Arahan awal dan foto sambutan di pelataran wapres.",
    image: "/assets/penyambutan.jpg",
  },
  {
    title: "Cerita Sejarah Gedung Agung",
    body: "Mengenal sejarah Gedung Agung sambil foto bersama di gedung induk.",
    image: "/assets/cerita-sejarah-gedung-agung.jpg",
  },
  {
    title: "Tur Museum",
    body: "Berkeliling melihat koleksi lukisan dan benda seni Istana Kepresidenan Yogyakarta.",
    image: "/assets/museum.jpg",
  },
  {
    title: "Perpustakaan",
    body: "Membaca koleksi buku Gedung Agung sambil beristirahat sejenak.",
    image: "/assets/perpustakaan.jpg",
  },
];

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

function Navigation({ screen, onNavigate }: { screen: Screen; onNavigate: (screen: Screen) => void }) {
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

function HomeScreen({
  contacts,
  faqs,
  schedules,
  onNavigate,
}: {
  contacts: FooterContact[];
  faqs: FaqItem[];
  schedules: VisitDay[];
  onNavigate: (screen: Screen) => void;
}) {
  const [today] = useState(() => startOfDay(new Date()));
  const maxScheduleDate = addMonths(today, 2);
  const minMonth = startOfMonth(today);
  const maxMonth = startOfMonth(maxScheduleDate);
  const [visibleMonth, setVisibleMonth] = useState(() => minMonth);
  const scheduleByKey = useMemo(
    () => new Map(schedules.map((day) => [day.date, day] as const)),
    [schedules],
  );
  const [selectedDateKey, setSelectedDateKey] = useState(() =>
    formatDateKey(getFirstAvailableDate(today, maxScheduleDate, today, scheduleByKey)),
  );
  const calendarDays = createCalendarDays(visibleMonth, today, maxScheduleDate, scheduleByKey);
  const selectedDate = parseDateKey(selectedDateKey);
  const selectedStatus = getPublicDateStatus(
    selectedDate,
    today,
    maxScheduleDate,
    startOfMonth(selectedDate),
    scheduleByKey,
  );
  const selectedStatusMeta = publicStatusMeta[selectedStatus];
  const selectedDay = scheduleByKey.get(selectedDateKey);
  const canGoPrev = visibleMonth > minMonth;
  const canGoNext = visibleMonth < maxMonth;

  const handleMonthChange = (amount: number) => {
    const nextMonth = startOfMonth(addMonths(visibleMonth, amount));
    if (nextMonth < minMonth || nextMonth > maxMonth) {
      return;
    }

    setVisibleMonth(nextMonth);
    setSelectedDateKey(
      formatDateKey(getFirstAvailableDate(today, maxScheduleDate, nextMonth, scheduleByKey)),
    );
  };

  return (
    <>
      <section className="hero-section attention">
        <div className="ambient ambient-one" />
        <div className="ambient ambient-two" />
        <div className="hero-copy">
          <span className="hero-logo-wrap">
            <img className="hero-logo" src={ASSETS.logoGold} alt="Gedung Agung Yogyakarta" />
            <span className="hero-logo-shine" aria-hidden="true" />
          </span>
          <h1>ISTURA - Istana Untuk Rakyat</h1>
          <p>Booking Kunjungan Istana Kepresidenan Yogyakarta</p>
          <div className="hero-actions" aria-label="Aksi utama">
            <button className="button button-primary" type="button" onClick={() => onNavigate("booking")}>
              Mulai Booking
              <ArrowRight size={18} aria-hidden="true" />
            </button>
            <a className="button button-secondary" href="#panduan">
              Cek Jadwal
            </a>
          </div>
        </div>
        <div className="hero-visual">
          <HeroStage />
        </div>
      </section>

      <section className="chapter interest schedule-showcase" id="panduan">
        <div className="schedule-title">
          <h2>Jadwal Kunjungan ISTURA</h2>
          <p>Cek slot tersedia sebelum booking. Kalender dibuka dua bulan ke depan; ikuti hari yang ditandai sebagai tersedia.</p>
        </div>

        <div className="availability-layout">
          <section className="calendar-card" aria-label="Kalender ketersediaan jadwal">
            <div className="calendar-toolbar">
              <button
                type="button"
                onClick={() => handleMonthChange(-1)}
                disabled={!canGoPrev}
                aria-label="Bulan sebelumnya"
              >
                <ChevronLeft size={28} aria-hidden="true" />
              </button>
              <strong>{formatMonthTitle(visibleMonth)}</strong>
              <button
                type="button"
                onClick={() => handleMonthChange(1)}
                disabled={!canGoNext}
                aria-label="Bulan berikutnya"
              >
                <ChevronRight size={28} aria-hidden="true" />
              </button>
            </div>

            <div className="calendar-weekdays" aria-hidden="true">
              {calendarWeekdays.map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>

            <div className="calendar-grid">
              {calendarDays.map((day) => (
                <button
                  className={`calendar-day is-${day.status}${day.key === selectedDateKey ? " is-selected" : ""}`}
                  type="button"
                  key={day.key}
                  disabled={day.status === "outside"}
                  onClick={() => setSelectedDateKey(day.key)}
                  aria-label={`${formatLongDate(day.date)}, ${publicStatusMeta[day.status].label}`}
                  aria-pressed={day.key === selectedDateKey}
                >
                  {day.date.getDate()}
                </button>
              ))}
            </div>
          </section>

          <section className="time-card" aria-label="Pilihan jam kunjungan">
            <h3>Pilih Jam Kunjungan</h3>
            <p>{formatLongDate(selectedDate)}</p>
            <div className="time-list time-list--hourly">
              {selectedDay && selectedDay.slots.length > 0 ? (
                selectedDay.slots.map((slot) => {
                  const klass = publicSlotStatusToClass(slot.status);
                  return (
                    <div
                      className={`time-option is-${klass}`}
                      key={slot.time}
                      aria-disabled={slot.status !== "Available"}
                    >
                      <Clock3 size={20} aria-hidden="true" />
                      <span>
                        <strong>{slot.time} WIB</strong>
                        <small>{publicSlotStatusLabel[slot.status]}</small>
                      </span>
                    </div>
                  );
                })
              ) : (
                <p className="time-empty">
                  {selectedStatusMeta.label === "Tutup"
                    ? "Hari ini tidak dibuka untuk kunjungan."
                    : "Belum ada slot pada tanggal ini."}
                </p>
              )}
            </div>
          </section>
        </div>

        <div className="availability-legend" aria-label="Keterangan status jadwal">
          <strong>Keterangan:</strong>
          {legendStatuses.map((status) => (
            <span key={status}>
              <i className={`legend-dot is-${status}`} />
              {publicStatusMeta[status].label}
            </span>
          ))}
        </div>
      </section>

      <section className="chapter quick-info-section" aria-labelledby="quick-info-title">
        <div className="section-heading compact quick-info-heading">
          <h2 id="quick-info-title">Sebelum booking, siapkan tiga hal utama.</h2>
          <p>Ringkasan ini membantu pengunjung tahu jadwal, syarat, dan kanal konfirmasi tanpa harus membaca formulir panjang.</p>
        </div>
        <div className="quick-info-grid">
          {quickInfoCards.map((card) => (
            <InfoCard key={card.title} {...card} />
          ))}
        </div>
      </section>

      <section className="chapter video-chapter" aria-label="Virtual Tour Istana Kepresidenan Yogyakarta">
        <div className="video-shell scale-fade">
          <iframe
            src="https://www.youtube.com/embed/YhE3H8mCFV4?start=4&rel=0&modestbranding=1"
            title="Virtual Tour - Istana Kepresidenan Yogyakarta"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      </section>

      <section className="chapter scroll-story desire">
        <div className="desire-grid">
          <div className="desire-pin">
            <h2>Booking dalam 4 langkah.</h2>
            <p className="scrub-copy">
              {storyWords.map((word, index) => (
                <span className="reveal-word" key={`${word}-${index}`}>
                  {word}
                </span>
              ))}
            </p>
          </div>
          <div className="desire-stack">
            {bookingProcessCards.map((card) => (
              <ProcessCard key={card.title} {...card} />
            ))}
          </div>
        </div>
      </section>

      <LetterExampleSection onNavigate={onNavigate} />

      <section className="chapter">
        <HorizontalAccordion />
      </section>

      <FaqSection items={faqs} />

      <section className="action-panel">
        <div>
          <h2>Siap mengajukan kunjungan ISTURA?</h2>
          <p>
            Mulai dari jadwal yang tersedia, unggah surat permohonan, lalu tunggu konfirmasi admin
            maksimal 1x24 jam melalui WhatsApp.
          </p>
        </div>
        <button className="button button-primary" type="button" onClick={() => onNavigate("booking")}>
          Mulai Booking Sekarang
          <ArrowRight size={18} aria-hidden="true" />
        </button>
      </section>

      <Footer contacts={contacts} onNavigate={onNavigate} />
    </>
  );
}

function InfoCard({
  icon: Icon,
  title,
  body,
  points,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  points: string[];
}) {
  return (
    <article className="quick-info-card scale-fade">
      <span className="quick-info-icon">
        <Icon size={30} aria-hidden="true" />
      </span>
      <h3>{title}</h3>
      <p>{body}</p>
      <ul>
        {points.map((point) => (
          <li key={point}>
            <Check size={18} aria-hidden="true" />
            <span>{point}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

function ProcessCard({
  icon: Icon,
  title,
  body,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
}) {
  return (
    <article className="process-card process-card-scrub group">
      <span>
        <Icon size={24} aria-hidden="true" />
      </span>
      <h3>{title}</h3>
      <p>{body}</p>
    </article>
  );
}

function HorizontalAccordion() {
  const [active, setActive] = useState(0);

  return (
    <div className="accordion-block">
      <div className="section-heading compact">
        <h2>Hal apa saja yang akan kamu lakukan di Istana.</h2>
        <p>Empat momen kunjungan diringkas menjadi panel visual yang mudah dipindai.</p>
      </div>
      <div className="horizontal-accordion">
        {accordionItems.map((item, index) => (
          <button
            key={item.title}
            className={`accordion-panel group ${active === index ? "is-open" : ""}`}
            type="button"
            onFocus={() => setActive(index)}
            onMouseEnter={() => setActive(index)}
          >
            <img className="zoom-media" src={item.image} alt="" />
            <span className="accordion-content">
              <strong>{item.title}</strong>
              <small>{item.body}</small>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function LetterExampleSection({ onNavigate }: { onNavigate: (screen: Screen) => void }) {
  return (
    <section className="chapter letter-chapter" id="contoh-surat" aria-labelledby="letter-title">
      <div className="section-heading compact letter-heading">
        <div>
          <h2 id="letter-title">Contoh surat permohonan ISTURA.</h2>
        </div>
        <p>Gunakan contoh ini sebagai acuan format surat resmi sebelum mengunggah dokumen booking.</p>
      </div>

      <div className="letter-layout scale-fade">
        <article className="letter-preview" aria-label="Preview contoh surat permohonan kunjungan">
          <img
            className="letter-example-image"
            src={ASSETS.letterExample}
            alt="Contoh kop surat permohonan kunjungan ISTURA"
          />
        </article>

        <aside className="letter-notes">
          <span className="section-kicker">Format dokumen</span>
          <h3>Yang perlu dicantumkan di surat.</h3>
          <ul>
            {letterChecklist.map((item) => (
              <li key={item}>
                <Check size={18} aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <div className="upload-note">
            <UploadCloud size={22} aria-hidden="true" />
            <span>Upload mendukung PDF, JPG, JPEG, atau PNG. Maksimal 10 MB.</span>
          </div>
          <button className="button button-primary" type="button" onClick={() => onNavigate("booking")}>
            Mulai Booking
            <ArrowRight size={18} aria-hidden="true" />
          </button>
        </aside>
      </div>
    </section>
  );
}

function FaqSection({ items }: { items: FaqItem[] }) {
  return (
    <section className="chapter faq-section" id="faq" aria-labelledby="faq-title">
      <div className="faq-layout">
        <div className="faq-heading">
          <h2 id="faq-title">Pertanyaan yang paling sering muncul.</h2>
          <p>Jawaban ringkas untuk hal yang biasanya ditanyakan sebelum pengunjung mengirim permohonan.</p>
        </div>
        <div className="faq-list">
          {items.map((item) => (
            <details className="faq-item scale-fade" key={item.id} name="faq">
              <summary>
                <span>{item.question}</span>
                <ChevronRight size={22} aria-hidden="true" />
              </summary>
              <p>{item.answer}</p>
              {item.link ? (
                <a className="faq-item-link" href={item.link.href}>
                  {item.link.label}
                </a>
              ) : null}
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function BookingWizard({
  schedules,
  bookings,
  onScheduleLock,
  onBookingCreate,
  onShowExampleLetter,
  onShowSchedule,
  onNavigate,
}: {
  schedules: VisitDay[];
  bookings: Booking[];
  onScheduleLock: (schedules: VisitDay[]) => void;
  onBookingCreate: (booking: Booking) => void;
  onShowExampleLetter: () => void;
  onShowSchedule: () => void;
  onNavigate: (screen: Screen) => void;
}) {
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successCode, setSuccessCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // File asli surat permohonan disimpan di ref, bukan state, supaya tidak
  // memicu re-render dan tetap kompatibel dengan UX existing yang hanya
  // menampilkan nama file.
  const documentFileRef = useRef<File | null>(null);
  const [form, setForm] = useState<BookingForm>({
    contactName: "",
    nik: "",
    whatsapp: "",
    institution: "",
    groupSize: "",
    date: schedules[0]?.date ?? "",
    time: "",
    documentName: "",
    agreement: false,
  });

  const selectedDay = schedules.find((day) => day.date === form.date) ?? schedules[0];
  const selectedSlot = selectedDay?.slots.find((slot) => slot.time === form.time);

  const setField = <Key extends keyof BookingForm>(key: Key, value: BookingForm[Key]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      const next = { ...current };
      delete next[key];
      delete next.submit;
      return next;
    });
  };

  const validateCurrentStep = () => {
    const nextErrors: Record<string, string> = {};

    if (step === 1) {
      if (!form.contactName.trim()) nextErrors.contactName = "Nama contact person wajib diisi.";
      if (!/^\d{16}$/.test(form.nik)) nextErrors.nik = "NIK harus 16 digit angka.";
      if (!/^(08|628)\d{8,13}$/.test(form.whatsapp)) {
        nextErrors.whatsapp = "Nomor WhatsApp harus aktif, contoh 08xxxxxxxxxx.";
      }
    }

    if (step === 2) {
      if (!form.institution.trim()) nextErrors.institution = "Asal instansi wajib diisi.";
      if (!Number(form.groupSize) || Number(form.groupSize) < 1) {
        nextErrors.groupSize = "Jumlah rombongan harus lebih dari 0.";
      }
    }

    if (step === 3) {
      if (!form.date || !form.time) nextErrors.time = "Pilih tanggal dan jam kunjungan.";
      if (selectedSlot && selectedSlot.status !== "Available") {
        nextErrors.time = "Jadwal ini baru saja tidak tersedia. Pilih slot lain.";
      }
    }

    if (step === 4 && !form.documentName) {
      nextErrors.documentName = "Surat permohonan wajib diunggah.";
    }

    if (step === 6 && !form.agreement) {
      nextErrors.agreement = "Pernyataan wajib disetujui sebelum submit.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const goNext = () => {
    if (!validateCurrentStep()) return;
    if (step === 6) {
      submitBooking();
      return;
    }
    setStep((current) => Math.min(current + 1, wizardSteps.length - 1));
  };

  const submitBooking = () => {
    const day = schedules.find((schedule) => schedule.date === form.date);
    const slot = day?.slots.find((item) => item.time === form.time);

    if (!day || !slot || slot.status !== "Available") {
      setErrors({
        submit: "Mohon maaf, jadwal yang dipilih baru saja tidak tersedia. Silakan pilih tanggal atau jam kunjungan lain.",
      });
      setStep(3);
      return;
    }

    const file = documentFileRef.current;
    if (!file) {
      setErrors({ documentName: "Surat permohonan wajib diunggah." });
      setStep(4);
      return;
    }

    setSubmitting(true);
    const fd = new FormData();
    fd.append("contactName", form.contactName.trim());
    fd.append("nik", form.nik.trim());
    fd.append("whatsapp", form.whatsapp.trim());
    fd.append("institution", form.institution.trim());
    fd.append("groupSize", String(Number(form.groupSize)));
    fd.append("date", day.date);
    fd.append("time", slot.time);
    fd.append("agreement", "1");
    fd.append("document", file);

    submitPublicBooking(fd)
      .then((created) => {
        const localBooking = apiBookingToLocal(created);
        onScheduleLock(
          schedules.map((schedule) =>
            schedule.date === day.date
              ? {
                  ...schedule,
                  slots: schedule.slots.map((item) =>
                    item.time === slot.time ? { ...item, status: "Held" } : item,
                  ),
                }
              : schedule,
          ),
        );
        onBookingCreate(localBooking);
        setSuccessCode(localBooking.code);
        setStep(7);
        setErrors({});
      })
      .catch((err) => {
        if (err instanceof ValidationError) {
          const fieldErrors: Record<string, string> = {};
          for (const [key, msgs] of Object.entries(err.errors)) {
            fieldErrors[key] = msgs[0] ?? "Validasi gagal.";
          }
          setErrors(fieldErrors);
        } else {
          setErrors({ submit: "Tidak dapat mengirim permohonan. Coba lagi." });
        }
      })
      .finally(() => setSubmitting(false));
  };

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const valid = /\.(pdf|jpg|jpeg|png)$/i.test(file.name);
    const tenMb = 10 * 1024 * 1024;
    if (!valid) {
      setErrors({ documentName: "Format file harus PDF, JPG, JPEG, atau PNG." });
      return;
    }
    if (file.size > tenMb) {
      setErrors({ documentName: "Ukuran file maksimal 10 MB." });
      return;
    }
    documentFileRef.current = file;
    setField("documentName", file.name);
  };

  const StepIcon = wizardSteps[step].icon;

  return (
    <section className="wizard-page">
      <div className="wizard-shell">
        <aside className="wizard-guide">
          <MikyGuide
            icon={StepIcon}
            title={wizardSteps[step].title}
            message={wizardSteps[step].miky}
            step={step}
            totalSteps={wizardSteps.length}
            variant={step === 0 ? "welcome" : "default"}
            imageSrc={wizardSteps[step].image}
          />
        </aside>

        <div className="wizard-panel">
          <div className="wizard-content">
            <h1>{wizardSteps[step].title}</h1>
            <p>{wizardSteps[step].helper}</p>

            {step === 0 && (
              <div className="prep-grid">
                {["Data contact person", "Nomor WhatsApp aktif", "Tanggal kunjungan", "Surat permohonan"].map(
                  (item) => (
                    <span key={item}>
                      <Check size={16} aria-hidden="true" />
                      {item}
                      {item === "Tanggal kunjungan" && (
                        <button type="button" className="prep-link" onClick={onShowSchedule}>
                          Cek jadwal
                        </button>
                      )}
                      {item === "Surat permohonan" && (
                        <button type="button" className="prep-link" onClick={onShowExampleLetter}>
                          Lihat contoh
                        </button>
                      )}
                    </span>
                  ),
                )}
              </div>
            )}

            {step === 1 && (
              <div className="form-grid">
                <FormField
                  label="Nama Lengkap CP"
                  value={form.contactName}
                  error={errors.contactName}
                  onChange={(value) => setField("contactName", value)}
                />
                <FormField
                  label="NIK KTP"
                  inputMode="numeric"
                  value={form.nik}
                  error={errors.nik}
                  onChange={(value) => setField("nik", value.replace(/\D/g, "").slice(0, 16))}
                />
                <FormField
                  label="Nomor WhatsApp CP"
                  inputMode="tel"
                  value={form.whatsapp}
                  error={errors.whatsapp}
                  helper="Contoh 08xxxxxxxxxx"
                  onChange={(value) => setField("whatsapp", value.replace(/[^\d]/g, ""))}
                />
              </div>
            )}

            {step === 2 && (
              <div className="form-grid">
                <FormField
                  label="Asal Instansi"
                  value={form.institution}
                  error={errors.institution}
                  onChange={(value) => setField("institution", value)}
                />
                <FormField
                  label="Jumlah Rombongan"
                  inputMode="numeric"
                  value={form.groupSize}
                  error={errors.groupSize}
                  helper="Isi jumlah peserta yang akan hadir"
                  onChange={(value) => setField("groupSize", value.replace(/\D/g, ""))}
                />
              </div>
            )}

            {step === 3 && (
              <SchedulePicker
                schedules={schedules}
                selectedDate={form.date}
                selectedTime={form.time}
                error={errors.time || errors.submit}
                onDateChange={(date) => {
                  setField("date", date);
                  setField("time", "");
                }}
                onTimeChange={(time) => setField("time", time)}
              />
            )}

            {step === 4 && (
              <div className="upload-box">
                <UploadCloud size={42} aria-hidden="true" />
                <strong>{form.documentName || "Unggah surat permohonan"}</strong>
                <p>PDF, JPG, JPEG, atau PNG. Maksimal 10 MB.</p>
                <label className="button button-secondary">
                  Pilih File
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFile} />
                </label>
                {errors.documentName && <small className="field-error">{errors.documentName}</small>}
              </div>
            )}

            {step === 5 && <ReviewCard form={form} selectedDay={selectedDay} />}

            {step === 6 && (
              <div className="agreement-box">
                <label>
                  <input
                    type="checkbox"
                    checked={form.agreement}
                    onChange={(event) => setField("agreement", event.target.checked)}
                  />
                  <span>
                    Saya menyatakan data yang diisi benar dan rombongan bersedia mengikuti aturan
                    kunjungan Istana Kepresidenan Yogyakarta.
                  </span>
                </label>
                {errors.agreement && <small className="field-error">{errors.agreement}</small>}
              </div>
            )}

            {step === 7 && (
              <div className="success-box">
                <BadgeCheck size={58} aria-hidden="true" />
                <strong>{successCode}</strong>
                <p>
                  Permohonan berhasil dikirim dengan status Pending. Admin akan menghubungi maksimal
                  1x24 jam melalui WhatsApp.
                </p>
              </div>
            )}
          </div>

          <div className="wizard-actions">
            {step < 7 ? (
              <>
                <button
                  className="button button-ghost"
                  type="button"
                  onClick={() => {
                    if (step === 0) {
                      onNavigate("home");
                    } else {
                      setStep((current) => Math.max(current - 1, 0));
                    }
                  }}
                >
                  <ArrowLeft size={18} aria-hidden="true" />
                  Kembali
                </button>
                <button
                  className="button button-primary"
                  type="button"
                  onClick={goNext}
                >
                  {step === 6 ? "Submit Booking" : "Lanjut"}
                  <ArrowRight size={18} aria-hidden="true" />
                </button>
              </>
            ) : (
              <button
                className="button button-primary wizard-actions-single"
                type="button"
                onClick={() => onNavigate("home")}
              >
                <ArrowLeft size={18} aria-hidden="true" />
                Kembali ke Beranda
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

const HERO_MESSAGES: Array<{ text: string; image: string }> = [
  { text: "Halo! Aku MIKY. Aku bantu pandu booking kunjunganmu.", image: ASSETS.mikyHero },
  { text: "Mau cek slot dulu? Klik Cek Jadwal ya.", image: ASSETS.mikyStep4 },
  { text: "Sudah siap? Yuk klik Mulai Booking.", image: ASSETS.mikyHero3 },
];

const HERO_MESSAGES_MOBILE: Array<{ text: string; image: string }> = [
  { text: "Halo! Aku MIKY, pemandumu.", image: ASSETS.mikyHero },
  { text: "Cek jadwal dulu yuk.", image: ASSETS.mikyStep4 },
  { text: "Siap? Klik Mulai Booking.", image: ASSETS.mikyHero3 },
];

function HeroStage() {
  const reduced = useReducedMotion();
  const isMobile = useMediaQuery("(max-width: 640px)");
  const messages = isMobile ? HERO_MESSAGES_MOBILE : HERO_MESSAGES;
  const [index, setIndex] = useState(0);
  const safeIndex = index % messages.length;

  const cycle = () => setIndex((current) => (current + 1) % messages.length);

  return (
    <div
      className="miky-stage miky-stage-greeting"
      role="button"
      tabIndex={0}
      aria-label="Tap MIKY untuk pesan dan pose berikutnya"
      onClick={cycle}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          cycle();
        }
      }}
    >
      <div className="miky-wave-lines" aria-hidden="true">
        <span className="miky-wave-line" />
        <span className="miky-wave-line" />
        <span className="miky-wave-line" />
      </div>
      <div className="miky-hero-stack">
        {messages.map((item, idx) => (
          <img
            key={item.image}
            className={`miky-hero-img${idx === safeIndex ? " is-active" : ""}`}
            src={item.image}
            alt={idx === safeIndex ? "MIKY, pemandu booking ISTURA" : ""}
            aria-hidden={idx === safeIndex ? undefined : "true"}
            data-reduced={reduced ? "true" : undefined}
          />
        ))}
      </div>
      <HeroMikySpeech index={index} onCycle={cycle} />
    </div>
  );
}

function HeroMikySpeech({
  index,
  onCycle,
}: {
  index: number;
  onCycle: () => void;
}) {
  const reduced = useReducedMotion();
  const isMobile = useMediaQuery("(max-width: 640px)");
  const messages = isMobile ? HERO_MESSAGES_MOBILE : HERO_MESSAGES;
  const safeIndex = index % messages.length;
  const message = messages[safeIndex].text;
  const bubbleRef = useRef<HTMLDivElement | null>(null);

  // Pesan pertama: tunggu sampai bubble benar-benar mulai fade-in (apapun
  // pemicunya — GSAP intro di desktop atau scroll-trigger di mobile) supaya
  // teks dan bubble muncul bersamaan, sesnap pose ke-2 dan seterusnya.
  // Pesan berikutnya: bubble sudah on-screen, langsung ketik.
  const [ready, setReady] = useState(index !== 0 || reduced);
  useEffect(() => {
    if (index !== 0 || reduced) {
      setReady(true);
      return;
    }
    setReady(false);
    let rafId = 0;
    const tick = () => {
      const node = bubbleRef.current;
      if (!node) {
        rafId = window.requestAnimationFrame(tick);
        return;
      }
      const opacity = parseFloat(window.getComputedStyle(node).opacity || "0");
      if (opacity > 0.05) {
        setReady(true);
        return;
      }
      rafId = window.requestAnimationFrame(tick);
    };
    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [index, reduced]);

  const typed = useTypewriter(message, 22, !reduced, ready);
  const isTyping = !reduced && ready && typed.length < message.length;

  useEffect(() => {
    if (reduced) return;
    if (isTyping) return;
    const id = window.setTimeout(() => {
      onCycle();
    }, 4200);
    return () => window.clearTimeout(id);
  }, [reduced, isTyping, onCycle]);

  return (
    <div
      ref={bubbleRef}
      className="miky-speech"
      role="note"
      aria-live="polite"
      onClick={(event) => {
        event.stopPropagation();
        onCycle();
      }}
    >
      {typed}
      {isTyping && <span className="miky-speech-caret" aria-hidden="true" />}
    </div>
  );
}

function MikyGuide({
  icon: Icon,
  title,
  message,
  step,
  totalSteps,
  variant = "default",
  imageSrc,
}: {
  icon: LucideIcon;
  title: string;
  message: string;
  step?: number;
  totalSteps?: number;
  variant?: "welcome" | "default";
  imageSrc?: string;
}) {
  const reduced = useReducedMotion();
  const typed = useTypewriter(message, 22, !reduced);
  const showStepper = typeof step === "number" && typeof totalSteps === "number" && totalSteps > 1;
  const figureSrc = imageSrc ?? (variant === "welcome" ? ASSETS.mikyHero : ASSETS.miky);

  return (
    <div className={`miky-guide miky-guide--${variant}`} data-reduced={reduced ? "true" : undefined}>
      <div className="miky-guide-glow" aria-hidden="true" />
      <div className="miky-guide-pattern" aria-hidden="true" />

      {variant === "welcome" && !reduced && (
        <div className="miky-wave-lines miky-wave-lines--guide" aria-hidden="true">
          <span className="miky-wave-line" />
          <span className="miky-wave-line" />
          <span className="miky-wave-line" />
        </div>
      )}

      {showStepper && (
        <div className="miky-guide-stepper">
          <span className="miky-guide-step-label">
            Langkah {step! + 1} <em>/ {totalSteps}</em>
          </span>
          <div className="miky-guide-dots" role="presentation">
            {Array.from({ length: totalSteps! }).map((_, idx) => (
              <span
                key={idx}
                className={
                  idx < step!
                    ? "miky-guide-dot is-done"
                    : idx === step!
                      ? "miky-guide-dot is-active"
                      : "miky-guide-dot"
                }
              />
            ))}
          </div>
        </div>
      )}

      <div className="miky-guide-figure">
        <img className="miky-guide-img" src={figureSrc} alt="MIKY, pemandu booking ISTURA" />
        <span className="miky-guide-platform" aria-hidden="true" />
      </div>

      <div className="miky-guide-bubble" role="note" aria-live="polite">
        <strong className="miky-guide-bubble-title">
          <Icon size={16} aria-hidden="true" />
          <span>{title}</span>
        </strong>
        <p>
          {typed}
          {!reduced && typed.length < message.length && (
            <span className="miky-guide-caret" aria-hidden="true" />
          )}
        </p>
      </div>
    </div>
  );
}

function FormField({
  label,
  value,
  error,
  helper,
  inputMode,
  onChange,
}: {
  label: string;
  value: string;
  error?: string;
  helper?: string;
  inputMode?: "text" | "numeric" | "tel";
  onChange: (value: string) => void;
}) {
  return (
    <label className="form-field">
      <span>{label}</span>
      <input
        value={value}
        inputMode={inputMode}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
      />
      {helper && <small>{helper}</small>}
      {error && <small className="field-error">{error}</small>}
    </label>
  );
}

function SchedulePicker({
  schedules,
  selectedDate,
  selectedTime,
  error,
  onDateChange,
  onTimeChange,
}: {
  schedules: VisitDay[];
  selectedDate: string;
  selectedTime: string;
  error?: string;
  onDateChange: (date: string) => void;
  onTimeChange: (time: string) => void;
}) {
  const [today] = useState(() => startOfDay(new Date()));
  const minMonth = startOfMonth(today);
  const maxScheduleDate = addMonths(today, 2);
  const maxMonth = startOfMonth(maxScheduleDate);

  const initialMonth = selectedDate ? startOfMonth(parseDateKey(selectedDate)) : minMonth;
  const [visibleMonth, setVisibleMonth] = useState(() => initialMonth);

  const scheduleByKey = new Map(schedules.map((day) => [day.date, day]));

  const dayStatus = (date: Date): PublicDateStatus => {
    if (!isSameMonth(date, visibleMonth) || !isWithinRange(date, today, maxScheduleDate)) {
      return "outside";
    }

    const found = scheduleByKey.get(formatDateKey(date));
    if (!found) return "closed";

    const hasAvailable = found.slots.some((slot) => slot.status === "Available");
    const hasPending = found.slots.some(
      (slot) => slot.status === "Held" || slot.status === "Reschedule Hold",
    );
    if (hasAvailable) return "available";
    if (hasPending) return "processing";
    const allClosed = found.slots.every((slot) => slot.status === "Closed");
    if (allClosed) return "closed";
    return "full";
  };

  const calendarDays = createCalendarDays(visibleMonth, today, maxScheduleDate).map((day) => ({
    ...day,
    status: dayStatus(day.date),
  }));

  const selectedDay = scheduleByKey.get(selectedDate);
  const canGoPrev = visibleMonth > minMonth;
  const canGoNext = visibleMonth < maxMonth;

  const handleMonthChange = (amount: number) => {
    const next = startOfMonth(addMonths(visibleMonth, amount));
    if (next < minMonth || next > maxMonth) return;
    setVisibleMonth(next);
  };

  return (
    <div className="schedule-picker">
      <div className="availability-layout availability-layout--inline">
        <section className="calendar-card" aria-label="Kalender ketersediaan jadwal">
          <div className="calendar-toolbar">
            <button
              type="button"
              onClick={() => handleMonthChange(-1)}
              disabled={!canGoPrev}
              aria-label="Bulan sebelumnya"
            >
              <ChevronLeft size={24} aria-hidden="true" />
            </button>
            <strong>{formatMonthTitle(visibleMonth)}</strong>
            <button
              type="button"
              onClick={() => handleMonthChange(1)}
              disabled={!canGoNext}
              aria-label="Bulan berikutnya"
            >
              <ChevronRight size={24} aria-hidden="true" />
            </button>
          </div>

          <div className="calendar-weekdays" aria-hidden="true">
            {calendarWeekdays.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>

          <div className="calendar-grid">
            {calendarDays.map((day) => {
              const isClickable = day.status === "available";
              return (
                <button
                  className={`calendar-day is-${day.status}${selectedDate === day.key ? " is-selected" : ""}`}
                  type="button"
                  key={day.key}
                  disabled={day.status === "outside" || !isClickable}
                  onClick={() => {
                    onDateChange(day.key);
                    onTimeChange("");
                  }}
                  aria-pressed={selectedDate === day.key}
                >
                  {day.date.getDate()}
                </button>
              );
            })}
          </div>
        </section>

        <section className="time-card" aria-label="Pilihan jam kunjungan">
          <h3>Pilih Jam Kunjungan</h3>
          <p>{selectedDay?.label ?? "Pilih tanggal terlebih dahulu"}</p>
          <div className="time-list time-list--hourly">
            {selectedDay ? (
              selectedDay.slots.map((slot) => {
                const klass = publicSlotStatusToClass(slot.status);
                const isClickable = slot.status === "Available";
                const isSelected = selectedTime === slot.time;
                return (
                  <button
                    className={`time-option is-${klass}${isSelected ? " is-selected" : ""}`}
                    type="button"
                    key={slot.time}
                    disabled={!isClickable}
                    aria-pressed={isSelected}
                    onClick={() => onTimeChange(slot.time)}
                  >
                    <Clock3 size={20} aria-hidden="true" />
                    <span>
                      <strong>{slot.time} WIB</strong>
                      <small>{publicSlotStatusLabel[slot.status]}</small>
                    </span>
                  </button>
                );
              })
            ) : (
              <p className="time-empty">Tidak ada slot pada tanggal ini.</p>
            )}
          </div>
        </section>
      </div>

      <div className="availability-legend availability-legend--inline" aria-label="Keterangan status jadwal">
        <strong>Keterangan:</strong>
        {legendStatuses.map((status) => (
          <span key={status}>
            <i className={`legend-dot is-${status}`} />
            {publicStatusMeta[status].label}
          </span>
        ))}
      </div>

      {error && <small className="field-error">{error}</small>}
    </div>
  );
}

function ReviewCard({ form, selectedDay }: { form: BookingForm; selectedDay?: VisitDay }) {
  const rows = [
    ["Nama CP", form.contactName],
    ["NIK", form.nik],
    ["WhatsApp", form.whatsapp],
    ["Instansi", form.institution],
    ["Rombongan", `${form.groupSize} orang`],
    ["Jadwal", `${selectedDay?.label ?? "-"}, ${form.time} WIB`],
    ["Surat", form.documentName],
  ];

  return (
    <div className="review-card">
      {rows.map(([label, value]) => (
        <div key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}

function FeedbackScreen({
  bookings,
  submittedCode,
  feedbacks,
  access,
  onFeedbackCreate,
}: {
  bookings: Booking[];
  submittedCode: string;
  feedbacks: Feedback[];
  access: { code: string; token: string } | null;
  onFeedbackCreate: (feedback: Feedback) => void;
}) {
  // Resolve booking from URL access (preferred) or fallback (e.g. dev/admin testing)
  const accessBooking = access
    ? bookings.find(
        (booking) => booking.code === access.code && booking.feedbackToken === access.token,
      )
    : undefined;

  const fallbackBooking =
    bookings.find((booking) => booking.code === submittedCode) ??
    bookings.find((booking) => booking.status === "Completed") ??
    bookings[0];

  const booking = accessBooking ?? (access ? undefined : fallbackBooking);
  const code = booking?.code ?? "";
  const storageKey = booking ? `istura-feedback-draft-${booking.code}` : null;

  const [step, setStep] = useState(0);
  const [rating, setRating] = useState(0);
  const [bookingEase, setBookingEase] = useState(0);
  const [service, setService] = useState(0);
  const [recommend, setRecommend] = useState<number | null>(null);
  const [highlights, setHighlights] = useState<string[]>([]);
  const [improvements, setImprovements] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [allowPublish, setAllowPublish] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const existing = feedbacks.some((feedback) => feedback.code === code);
  const reduced = useReducedMotion();

  // Restore draft from localStorage
  useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const draft = JSON.parse(raw) as Partial<Feedback>;
      if (typeof draft.rating === "number") setRating(draft.rating);
      if (typeof draft.bookingEase === "number") setBookingEase(draft.bookingEase);
      if (typeof draft.service === "number") setService(draft.service);
      if (typeof draft.recommend === "number") setRecommend(draft.recommend);
      if (Array.isArray(draft.highlights)) setHighlights(draft.highlights);
      if (Array.isArray(draft.improvements)) setImprovements(draft.improvements);
      if (typeof draft.comment === "string") setComment(draft.comment);
      if (typeof draft.allowPublish === "boolean") setAllowPublish(draft.allowPublish);
    } catch {
      /* ignore corrupt draft */
    }
  }, [storageKey]);

  // Auto-save draft
  useEffect(() => {
    if (!storageKey || submitted) return;
    const draft = {
      rating,
      bookingEase,
      service,
      recommend,
      highlights,
      improvements,
      comment,
      allowPublish,
    };
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(draft));
    } catch {
      /* storage may be unavailable */
    }
  }, [
    storageKey,
    rating,
    bookingEase,
    service,
    recommend,
    highlights,
    improvements,
    comment,
    allowPublish,
    submitted,
  ]);

  const toggleChip = (
    list: string[],
    setter: (next: string[]) => void,
    value: string,
  ) => {
    setter(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  };

  const totalSteps = 3;

  const stepConfig: {
    title: string;
    icon: LucideIcon;
    bubbleTitle: string;
    bubble: string;
    image: string;
  }[] = [
    {
      title: "Penilaian Inti",
      icon: Star,
      bubbleTitle: "Beri bintangmu",
      bubble:
        rating === 0
          ? "Halo! Bagaimana pengalaman kunjunganmu? Beri bintang di tiga aspek ini ya."
          : rating <= 2
            ? "Maaf belum sesuai harapan. Lengkapi dulu, nanti kita ceritakan di langkah terakhir."
            : rating === 3
              ? "Cukup baik. Lanjut ke aspek yang lain ya."
              : "Senang mendengarnya! Lanjut sebentar.",
      image: ASSETS.mikyFeedback,
    },
    {
      title: "Detail Pengalaman",
      icon: Sparkles,
      bubbleTitle: "Cerita lebih dalam",
      bubble:
        recommend === null
          ? "Sekarang, seberapa besar kamu mau merekomendasikan ISTURA?"
          : highlights.length === 0
            ? "Mantap. Bagian mana yang paling berkesan?"
            : "Boleh juga sebut yang masih perlu diperbaiki, opsional saja.",
      image: ASSETS.mikyFeedback2,
    },
    {
      title: "Cerita & Kirim",
      icon: Send,
      bubbleTitle: "Tinggal sedikit lagi",
      bubble:
        comment.trim().length === 0
          ? "Ceritakan momen yang paling berkesan, atau langsung kirim saja."
          : "Terima kasih ceritanya. Tekan kirim kalau sudah siap.",
      image: ASSETS.mikyFeedback3,
    },
  ];

  const stepReady = [
    rating > 0 && bookingEase > 0 && service > 0,
    recommend !== null,
    true,
  ];

  const goNext = () => {
    if (!stepReady[step]) {
      if (step === 0) {
        setError("Mohon berikan rating untuk ketiga aspek di atas.");
      } else if (step === 1) {
        setError("Mohon pilih skor rekomendasi.");
      }
      return;
    }
    setError("");
    setStep((current) => Math.min(current + 1, totalSteps - 1));
  };

  const goBack = () => {
    setError("");
    setStep((current) => Math.max(current - 1, 0));
  };

  const submitFeedback = () => {
    if (!booking) return;
    if (!stepReady[0]) {
      setError("Mohon berikan rating untuk ketiga aspek di langkah 1.");
      setStep(0);
      return;
    }
    if (!stepReady[1]) {
      setError("Mohon pilih skor rekomendasi di langkah 2.");
      setStep(1);
      return;
    }
    if (existing) {
      setError("Feedback untuk kode ini sudah tercatat sebelumnya.");
      return;
    }

    const payload = {
      token: access?.token ?? booking.feedbackToken,
      rating,
      bookingEase,
      service,
      recommend: recommend ?? 0,
      highlights,
      improvements,
      comment: comment.trim(),
      allowPublish,
    };
    submitPublicFeedback(code, payload).catch(() => {});

    onFeedbackCreate({
      code,
      rating,
      bookingEase,
      service,
      recommend: recommend ?? 0,
      highlights,
      improvements,
      comment: comment.trim(),
      allowPublish,
      submittedAt: new Date().toLocaleString("id-ID", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }) + " WIB",
    });
    setError("");
    setSubmitted(true);
    if (storageKey) {
      try {
        window.localStorage.removeItem(storageKey);
      } catch {
        /* ignore */
      }
    }
  };

  // ----- Gating: link tidak valid / belum selesai -----
  if (access) {
    if (!accessBooking) {
      return (
        <FeedbackGate
          icon={ShieldCheck}
          title="Link feedback tidak valid"
          message="Periksa kembali tautan dari WhatsApp resmi ISTURA. Pastikan kode booking dan token tidak terpotong."
        />
      );
    }
    if (accessBooking.status !== "Completed") {
      return (
        <FeedbackGate
          icon={Clock3}
          title="Link aktif setelah kunjungan selesai"
          message="Form feedback akan terbuka setelah petugas menandai kunjunganmu selesai. Terima kasih sudah menanti."
        />
      );
    }
  } else if (!booking) {
    return (
      <FeedbackGate
        icon={ShieldCheck}
        title="Akses feedback dibatasi"
        message="Tautan feedback dikirim melalui WhatsApp setelah kunjungan selesai. Silakan tunggu pesan resmi dari ISTURA."
      />
    );
  }

  if (submitted) {
    return (
      <section className="wizard-page feedback-page">
        <div className="feedback-success-shell">
          <div className="feedback-success-card">
            <div className="feedback-success-figure">
              <img
                src={ASSETS.mikyFeedback}
                alt="MIKY mengucapkan terima kasih"
                className={reduced ? "" : "feedback-success-bounce"}
              />
              <span className="feedback-success-burst" aria-hidden="true" />
            </div>
            <div className="feedback-success-copy">
              <span className="feedback-success-eyebrow">
                <BadgeCheck size={16} aria-hidden="true" />
                Terima kasih
              </span>
              <h1>Feedback berhasil dikirim</h1>
              <p>
                Cerita Bapak/Ibu membantu kami memperbaiki layanan ISTURA. Kunjungan dengan kode {" "}
                <strong>{code}</strong> sudah terhubung dengan masukan ini.
              </p>
              <a className="button button-primary" href="/">
                Kembali ke Beranda
                <ArrowRight size={18} aria-hidden="true" />
              </a>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const current = stepConfig[step];

  return (
    <section className="wizard-page feedback-page">
      <div className="wizard-shell">
        <aside className="wizard-guide">
          <MikyGuide
            icon={current.icon}
            title={current.bubbleTitle}
            message={current.bubble}
            step={step}
            totalSteps={totalSteps}
            imageSrc={current.image}
          />
        </aside>

        <div className="wizard-panel">
          <div className="wizard-content">
            <h1>{current.title}</h1>
            <p>Bagikan pengalaman kunjunganmu di Istana Kepresidenan Yogyakarta.</p>

            <aside
              className="feedback-context"
              aria-label="Konteks kunjungan"
              hidden={step !== 0}
            >
              <span>
                <em>Kode kunjungan</em>
                <strong>{booking!.code}</strong>
              </span>
              <span>
                <em>Tanggal</em>
                <strong>{booking!.dateLabel}</strong>
              </span>
              <span>
                <em>Instansi</em>
                <strong>{booking!.institution}</strong>
              </span>
            </aside>

            {step === 0 && (
              <div className="feedback-step">
                <RatingField
                  label="Kepuasan keseluruhan"
                  value={rating}
                  onChange={setRating}
                />
                <RatingField
                  label="Kemudahan proses booking online"
                  value={bookingEase}
                  onChange={setBookingEase}
                />
                <RatingField
                  label="Pelayanan petugas saat kunjungan"
                  value={service}
                  onChange={setService}
                />
              </div>
            )}

            {step === 1 && (
              <div className="feedback-step">
                <fieldset className="recommend-field">
                  <legend>Akan merekomendasikan ke teman atau keluarga?</legend>
                  <div
                    className="recommend-scale"
                    role="radiogroup"
                    aria-label="Skor rekomendasi"
                  >
                    {Array.from({ length: 5 }).map((_, idx) => {
                      const score = idx + 1;
                      return (
                        <button
                          type="button"
                          key={score}
                          role="radio"
                          aria-checked={recommend === score}
                          className={recommend === score ? "is-active" : ""}
                          onClick={() => setRecommend(score)}
                        >
                          {score}
                        </button>
                      );
                    })}
                  </div>
                  <div className="recommend-scale-legend" aria-hidden="true">
                    <span>Tidak</span>
                    <span>Sangat mungkin</span>
                  </div>
                </fieldset>

                <ChipField
                  label="Aspek terbaik"
                  options={FEEDBACK_HIGHLIGHTS}
                  values={highlights}
                  onToggle={(value) => toggleChip(highlights, setHighlights, value)}
                />
                <ChipField
                  label="Aspek yang perlu diperbaiki (opsional)"
                  options={FEEDBACK_IMPROVEMENTS}
                  values={improvements}
                  onToggle={(value) => toggleChip(improvements, setImprovements, value)}
                />
              </div>
            )}

            {step === 2 && (
              <div className="feedback-step">
                <label className="form-field">
                  <span>Saran atau cerita pengalaman</span>
                  <textarea
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                    placeholder="Ceritakan momen yang berkesan atau saran spesifik..."
                    rows={5}
                  />
                </label>

                <label className="feedback-permission">
                  <input
                    type="checkbox"
                    checked={allowPublish}
                    onChange={(event) => setAllowPublish(event.target.checked)}
                  />
                  <span>
                    Saya mengizinkan kesan saya ditampilkan sebagai testimoni publik (tanpa data
                    pribadi).
                  </span>
                </label>
              </div>
            )}

            {error && <strong className="form-message form-message--error">{error}</strong>}
          </div>

          <div className="wizard-actions">
            <button
              className="button button-ghost"
              type="button"
              disabled={step === 0}
              onClick={goBack}
            >
              <ArrowLeft size={18} aria-hidden="true" />
              Kembali
            </button>
            {step < totalSteps - 1 ? (
              <button className="button button-primary" type="button" onClick={goNext}>
                Lanjut
                <ArrowRight size={18} aria-hidden="true" />
              </button>
            ) : (
              <button
                className="button button-primary"
                type="button"
                onClick={submitFeedback}
              >
                Kirim Feedback
                <Send size={18} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function FeedbackGate({
  icon: Icon,
  title,
  message,
}: {
  icon: LucideIcon;
  title: string;
  message: string;
}) {
  return (
    <section className="wizard-page feedback-page">
      <div className="feedback-gate-shell">
        <div className="feedback-gate-card">
          <span className="feedback-gate-icon" aria-hidden="true">
            <Icon size={28} />
          </span>
          <h1>{title}</h1>
          <p>{message}</p>
          <a className="button button-secondary" href="/">
            Kembali ke Beranda
            <ArrowRight size={18} aria-hidden="true" />
          </a>
        </div>
      </div>
    </section>
  );
}

function ChipField({
  label,
  helper,
  options,
  values,
  onToggle,
}: {
  label: string;
  helper?: string;
  options: string[];
  values: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <fieldset className="chip-field">
      <legend>{label}</legend>
      {helper && <small>{helper}</small>}
      <div className="chip-list" role="group" aria-label={label}>
        {options.map((option) => {
          const active = values.includes(option);
          return (
            <button
              type="button"
              key={option}
              className={active ? "chip is-active" : "chip"}
              aria-pressed={active}
              onClick={() => onToggle(option)}
            >
              {active && <Check size={14} aria-hidden="true" />}
              <span>{option}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function RatingField({
  label,
  value,
  onChange,
  helper,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  helper?: string;
}) {
  const [hover, setHover] = useState(0);
  const display = hover || value;
  return (
    <fieldset className="rating-field">
      <legend>{label}</legend>
      {helper && <small>{helper}</small>}
      <div
        className="rating-stars"
        onMouseLeave={() => setHover(0)}
        role="radiogroup"
        aria-label={label}
      >
        {[1, 2, 3, 4, 5].map((score) => {
          const filled = score <= display;
          return (
            <button
              type="button"
              key={score}
              role="radio"
              aria-checked={value === score}
              className={`rating-star${filled ? " is-active" : ""}${
                value === score ? " is-selected" : ""
              }`}
              onMouseEnter={() => setHover(score)}
              onFocus={() => setHover(score)}
              onBlur={() => setHover(0)}
              onClick={() => onChange(score)}
              aria-label={`${score} dari 5: ${RATING_LABELS[score]}`}
            >
              <Star size={22} fill={filled ? "currentColor" : "none"} aria-hidden="true" />
            </button>
          );
        })}
      </div>
      <span className="rating-caption" aria-live="polite">
        {display ? RATING_LABELS[display] : "Belum dipilih"}
      </span>
    </fieldset>
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

type AdminMenuItem = {
  key: AdminTab;
  label: string;
  icon: LucideIcon;
  group?: string;
  status?: "ready" | "soon";
};

const INITIAL_WA_TEMPLATES: WaTemplate[] = [
  {
    id: "Accepted",
    label: "Booking disetujui",
    description: "Dikirim saat admin menyetujui permohonan kunjungan.",
    template:
      "Yth. {nama}, permohonan kunjungan {instansi} dengan kode {kode} disetujui untuk {tanggal} pukul {jam} WIB. Mohon hadir 15 menit lebih awal dengan menunjukkan kode ini di pintu masuk. Terima kasih.",
  },
  {
    id: "Rejected",
    label: "Booking ditolak",
    description: "Dikirim saat permohonan tidak disetujui.",
    template:
      "Yth. {nama}, mohon maaf permohonan kunjungan {instansi} dengan kode {kode} belum dapat disetujui. Alasan: {catatan}",
  },
  {
    id: "Reschedule",
    label: "Tawaran reschedule",
    description: "Dikirim saat admin menawarkan jadwal alternatif.",
    template:
      "Yth. {nama}, permohonan {kode} perlu penyesuaian jadwal. Usulan jadwal: {catatan}. Mohon konfirmasi melalui WhatsApp ini.",
  },
  {
    id: "Completed",
    label: "Tandai selesai & permintaan feedback",
    description: "Dikirim setelah kunjungan selesai. {link} adalah tautan feedback unik.",
    template:
      "Yth. {nama}, terima kasih telah berkunjung ke Istana Kepresidenan Yogyakarta pada {tanggal}. Setelah melakukan ISTURA, Bapak/Ibu kami mohon untuk mengisi feedback pada link berikut: {link} agar kami dapat memperbaiki pelayanan kami setiap saat. Terima kasih.",
  },
];

// Seed the imperative WA template cache so createWhatsappMessage bekerja
// sebelum useEffect hydration pertama berjalan.
setActiveWaTemplates(INITIAL_WA_TEMPLATES);

const ADMIN_MENU: AdminMenuItem[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, status: "ready" },
  { key: "bookings", label: "Booking", icon: ClipboardCheck, status: "ready" },
  { key: "schedule", label: "Jadwal Kunjungan", icon: CalendarDays, status: "ready" },
  { key: "feedback", label: "Feedback", icon: Inbox, status: "ready" },
  { key: "cms-faq", label: "FAQ", icon: MessageSquare, group: "Konten Web", status: "ready" },
  { key: "cms-letter", label: "Contoh Surat", icon: FileCheck2, group: "Konten Web", status: "ready" },
  { key: "cms-contacts", label: "Kontak Footer", icon: Phone, group: "Konten Web", status: "ready" },
  { key: "cms-hero", label: "Hero & Cerita", icon: ImageIcon, group: "Konten Web", status: "ready" },
  { key: "cms-wa", label: "Template Pesan WA", icon: MessageCircle, group: "Konten Web", status: "ready" },
  { key: "users", label: "Pengguna Admin", icon: UserCog, group: "Sistem", status: "ready" },
  { key: "audit", label: "Riwayat Aktivitas", icon: ListChecks, group: "Sistem", status: "ready" },
];

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


function AdminScheduleManager({
  schedules,
  bookings,
  onSchedulesChange,
  onOpenBooking,
}: {
  schedules: VisitDay[];
  bookings: Booking[];
  onSchedulesChange: (next: VisitDay[]) => void;
  onOpenBooking: (bookingCode: string) => void;
}) {
  const today = useState(() => startOfDay(new Date()))[0];
  const minMonth = startOfMonth(today);
  const maxScheduleDate = addMonths(today, 2);
  const maxMonth = startOfMonth(maxScheduleDate);
  const [visibleMonth, setVisibleMonth] = useState(() => minMonth);

  // Map booking by `${date}|${time}` agar lookup detail booking di slot
  // Booked/Held murah dan eksak.
  const bookingByKey = useMemo(() => {
    const map = new Map<string, Booking>();
    for (const booking of bookings) {
      map.set(`${booking.date}|${booking.time}`, booking);
    }
    return map;
  }, [bookings]);

  // Booking aktif per tanggal (Pending/Accepted/Reschedule) untuk indikator
  // dampak saat admin menutup hari.
  const activeBookingsByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const booking of bookings) {
      if (
        booking.status === "Pending" ||
        booking.status === "Accepted" ||
        booking.status === "Reschedule"
      ) {
        map.set(booking.date, (map.get(booking.date) ?? 0) + 1);
      }
    }
    return map;
  }, [bookings]);

  const scheduleByDate = new Map(schedules.map((day) => [day.date, day] as const));
  // Pilih default ke hari aktif terdekat dari hari ini (slot Available),
  // bukan sekadar tanggal pertama agar admin tidak mendarat di hari Closed.
  const firstActive =
    schedules.find(
      (day) =>
        parseDateKey(day.date) >= today &&
        day.slots.some((slot) => slot.status === "Available"),
    )?.date ??
    schedules.find((day) => parseDateKey(day.date) >= today)?.date ??
    schedules[0]?.date ??
    "";
  const [selectedDate, setSelectedDate] = useState(firstActive);
  const [customDraft, setCustomDraft] = useState("");
  const [customError, setCustomError] = useState<string | null>(null);
  // Slot detail popover (untuk slot Booked/Held).
  const [slotInfoTime, setSlotInfoTime] = useState<string | null>(null);
  // Range modal (#1) state.
  const [showRangeModal, setShowRangeModal] = useState(false);
  // Confirm dialog generic (#3).
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    body: string;
    confirmLabel: string;
    confirmVariant?: "default" | "danger";
    onConfirm: () => void;
  } | null>(null);
  // Undo toast (#5). Setiap aksi besar menyimpan snapshot jadwal sebelumnya.
  const [undoState, setUndoState] = useState<{
    label: string;
    snapshot: VisitDay[];
  } | null>(null);
  // Sumber kebenaran "sekarang" untuk menandai jam yang sudah lewat di hari
  // ini. Diperbarui per menit.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  // Auto dismiss toast undo setelah 5 detik.
  useEffect(() => {
    if (!undoState) return;
    const id = window.setTimeout(() => setUndoState(null), 5000);
    return () => window.clearTimeout(id);
  }, [undoState]);
  // Highlight slot baru selama beberapa detik (#10).
  const [newlyAddedSlot, setNewlyAddedSlot] = useState<{
    date: string;
    time: string;
  } | null>(null);
  useEffect(() => {
    if (!newlyAddedSlot) return;
    const id = window.setTimeout(() => setNewlyAddedSlot(null), 1800);
    return () => window.clearTimeout(id);
  }, [newlyAddedSlot]);

  const canGoPrev = visibleMonth > minMonth;
  const canGoNext = visibleMonth < maxMonth;

  const calendarDays = createCalendarDays(visibleMonth, today, maxScheduleDate);
  const selectedDay = scheduleByDate.get(selectedDate);

  // Helper: parse "HH.MM" jadi menit total dalam hari.
  const parseTimeToMinutes = (hhmm: string) => {
    const [h, m] = hhmm.split(".").map(Number);
    return h * 60 + (m || 0);
  };

  // Slot lewat = slot di hari ini yang jamnya sudah lewat dari "now".
  const isSlotPast = (dateKey: string, time: string) => {
    const dateObj = parseDateKey(dateKey);
    if (
      dateObj.getFullYear() !== now.getFullYear() ||
      dateObj.getMonth() !== now.getMonth() ||
      dateObj.getDate() !== now.getDate()
    ) {
      return false;
    }
    return parseTimeToMinutes(time) <= now.getHours() * 60 + now.getMinutes();
  };

  // Setiap mutasi melalui helper ini agar Undo punya snapshot konsisten.
  const applyChange = (label: string, next: VisitDay[]) => {
    setUndoState({ label, snapshot: schedules });
    onSchedulesChange(next);
  };

  const restoreUndo = () => {
    if (!undoState) return;
    onSchedulesChange(undoState.snapshot);
    setUndoState(null);
  };

  const toggleSlot = (dayDate: string, time: string) => {
    if (isSlotPast(dayDate, time)) return;
    applyChange(
      `Slot ${time} diperbarui`,
      schedules.map((day) =>
        day.date === dayDate
          ? {
              ...day,
              slots: day.slots.map((slot) =>
                slot.time === time
                  ? {
                      ...slot,
                      status:
                        slot.status === "Closed"
                          ? "Available"
                          : slot.status === "Available"
                            ? "Closed"
                            : slot.status,
                    }
                  : slot,
              ),
            }
          : day,
      ),
    );
  };

  // Bulk action di satu hari, dengan optional konfirmasi.
  const performSetDayAll = (dayDate: string, action: "open" | "close") => {
    applyChange(
      action === "open" ? "Slot dibuka" : "Slot ditutup",
      schedules.map((day) =>
        day.date === dayDate
          ? {
              ...day,
              slots: day.slots.map((slot) =>
                slot.status === "Booked" || slot.status === "Held"
                  ? slot
                  : isSlotPast(dayDate, slot.time)
                    ? slot
                    : {
                        ...slot,
                        status: action === "open" ? "Available" : "Closed",
                      },
              ),
            }
          : day,
      ),
    );
  };

  const setDayAll = (dayDate: string, action: "open" | "close") => {
    const day = scheduleByDate.get(dayDate);
    if (!day) return;
    if (action === "close") {
      const willClose = day.slots.filter(
        (slot) =>
          slot.status === "Available" && !isSlotPast(dayDate, slot.time),
      ).length;
      const activeBooking = activeBookingsByDate.get(dayDate) ?? 0;
      // Konfirmasi hanya kalau ada banyak slot yang akan tertutup atau ada
      // booking aktif di hari itu (#3, #4).
      if (willClose >= 3 || activeBooking > 0) {
        setConfirmDialog({
          title: "Tutup semua slot?",
          body:
            `Pada ${day.label}, ${willClose} slot tersedia akan ditutup. ` +
            (activeBooking > 0
              ? `Ada ${activeBooking} booking aktif di tanggal ini yang tidak terpengaruh.`
              : "Slot yang sudah ada booking tidak terpengaruh."),
          confirmLabel: "Tutup semua",
          confirmVariant: "danger",
          onConfirm: () => performSetDayAll(dayDate, "close"),
        });
        return;
      }
    }
    performSetDayAll(dayDate, action);
  };

  // Normalisasi input "08", "8", "8:00", "8.00", "08:0" menjadi format
  // "HH.MM" 24 jam. Mengembalikan null jika input tidak valid.
  const normalizeTimeInput = (raw: string): string | null => {
    const value = raw.trim();
    if (!value) return null;
    const match = value.match(/^(\d{1,2})(?:[.:](\d{1,2}))?$/);
    if (!match) return null;
    const hour = Number(match[1]);
    const minute = match[2] ? Number(match[2]) : 0;
    if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
    if (hour < 0 || hour > 23) return null;
    if (minute < 0 || minute > 59) return null;
    return `${String(hour).padStart(2, "0")}.${String(minute).padStart(2, "0")}`;
  };

  const sortSlots = (slots: Slot[]) =>
    [...slots].sort((a, b) => a.time.localeCompare(b.time));

  const addCustomSlot = (dayDate: string, raw: string) => {
    const normalized = normalizeTimeInput(raw);
    if (!normalized) {
      setCustomError("Format jam tidak valid. Gunakan HH.MM, contoh 15.30.");
      return;
    }
    const day = scheduleByDate.get(dayDate);
    if (!day) return;
    if (day.slots.some((slot) => slot.time === normalized)) {
      setCustomError(`Jam ${normalized} sudah ada di daftar.`);
      return;
    }
    if (isSlotPast(dayDate, normalized)) {
      setCustomError("Jam tersebut sudah lewat untuk hari ini.");
      return;
    }
    setCustomError(null);
    setCustomDraft("");
    applyChange(
      `Jam khusus ${normalized} ditambahkan`,
      schedules.map((d) =>
        d.date === dayDate
          ? {
              ...d,
              slots: sortSlots([
                ...d.slots,
                { time: normalized, status: "Available", custom: true },
              ]),
            }
          : d,
      ),
    );
    // Beri tanda highlight singkat ke slot baru.
    setNewlyAddedSlot({ date: dayDate, time: normalized });
  };

  const removeCustomSlot = (dayDate: string, time: string) => {
    applyChange(
      `Jam khusus ${time} dihapus`,
      schedules.map((d) =>
        d.date === dayDate
          ? {
              ...d,
              slots: d.slots.filter(
                (slot) => !(slot.time === time && slot.custom),
              ),
            }
          : d,
      ),
    );
  };

  // Apply pengaturan rentang (#1): rentang tanggal + hari minggu yang
  // dipilih, lalu buka/tutup. Slot Booked/Held tetap aman.
  const applyRange = (params: {
    from: string;
    to: string;
    weekdays: number[]; // 0=Min...6=Sab
    action: "open" | "close";
  }) => {
    const fromDate = parseDateKey(params.from);
    const toDate = parseDateKey(params.to);
    const action = params.action;
    const weekdaySet = new Set(params.weekdays);
    const next = schedules.map((day) => {
      const d = parseDateKey(day.date);
      if (d < fromDate || d > toDate) return day;
      if (!weekdaySet.has(d.getDay())) return day;
      return {
        ...day,
        slots: day.slots.map((slot): Slot =>
          slot.status === "Booked" || slot.status === "Held"
            ? slot
            : isSlotPast(day.date, slot.time)
              ? slot
              : {
                  ...slot,
                  status: action === "open" ? "Available" : "Closed",
                },
        ),
      };
    });
    applyChange(
      action === "open"
        ? "Rentang tanggal dibuka"
        : "Rentang tanggal ditutup",
      next,
    );
  };

  const totalAvailable = schedules.reduce(
    (sum, day) => sum + day.slots.filter((slot) => slot.status === "Available").length,
    0,
  );
  const totalBooked = schedules.reduce(
    (sum, day) => sum + day.slots.filter((slot) => slot.status === "Booked").length,
    0,
  );
  // Hari aktif = hari (>= hari ini) yang punya minimal satu slot Available.
  const totalActiveDays = schedules.reduce(
    (sum, day) =>
      parseDateKey(day.date) >= today &&
      day.slots.some((slot) => slot.status === "Available")
        ? sum + 1
        : sum,
    0,
  );

  // KPI hari ini untuk kartu "Hari ini".
  const todayKey = formatDateKey(today);
  const todaySchedule = scheduleByDate.get(todayKey);
  const todayAvailable = todaySchedule?.slots.filter((s) => s.status === "Available").length ?? 0;

  const dayKpi = selectedDay
    ? {
        available: selectedDay.slots.filter((slot) => slot.status === "Available").length,
        booked: selectedDay.slots.filter((slot) => slot.status === "Booked").length,
        held: selectedDay.slots.filter((slot) => slot.status === "Held").length,
        closed: selectedDay.slots.filter((slot) => slot.status === "Closed").length,
      }
    : null;

  return (
    <div className="admin-cms-page">
      <div className="admin-heading">
        <div>
          <h1>Jadwal Kunjungan</h1>
          <p>Atur slot kunjungan untuk 2 bulan ke depan.</p>
        </div>
      </div>

      <div className="admin-stats">
        <StatCard label="Slot tersedia" value={totalAvailable} />
        <StatCard label="Hari ini" value={todaySchedule ? todayAvailable : "—"} />
        <StatCard label="Sudah terisi" value={totalBooked} />
        <StatCard label="Hari aktif" value={totalActiveDays} />
      </div>

      <section className="admin-schedule-shell">
        <div className="admin-schedule-calendar">
          <header className="admin-schedule-cal-head">
            <div className="admin-schedule-cal-head-nav">
              <button
                type="button"
                onClick={() => canGoPrev && setVisibleMonth(addMonths(visibleMonth, -1))}
                disabled={!canGoPrev}
                aria-label="Bulan sebelumnya"
              >
                <ChevronLeft size={16} aria-hidden="true" />
              </button>
              <strong>{formatMonthTitle(visibleMonth)}</strong>
              <button
                type="button"
                onClick={() => canGoNext && setVisibleMonth(addMonths(visibleMonth, 1))}
                disabled={!canGoNext}
                aria-label="Bulan berikutnya"
              >
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </div>
            <button
              type="button"
              className="admin-pill-button"
              onClick={() => setShowRangeModal(true)}
            >
              Pengaturan rentang
            </button>
          </header>
          <div className="admin-schedule-cal-weekdays" aria-hidden="true">
            {calendarWeekdays.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
          <div className="admin-schedule-cal-grid">
            {calendarDays.map((cell) => {
              const inMonth = isSameMonth(cell.date, visibleMonth);
              const day = scheduleByDate.get(cell.key);
              const isPast = cell.date < today;
              const isToday =
                cell.date.getFullYear() === today.getFullYear() &&
                cell.date.getMonth() === today.getMonth() &&
                cell.date.getDate() === today.getDate();
              const totalSlots = day?.slots.length ?? 0;
              const openSlots = day?.slots.filter((slot) => slot.status === "Available").length ?? 0;
              const closedSlots = day?.slots.filter((slot) => slot.status === "Closed").length ?? 0;
              // Hari Jum/Sab/Min default tertutup; tandai berbeda dari hari
              // kerja yang sengaja ditutup admin agar admin tahu itu libur
              // default yang bisa dibuka kapan saja.
              const isDefaultOff = isDefaultHoliday(cell.date);
              const fullyClosed = totalSlots > 0 && closedSlots === totalSlots;

              const summaryClass = !inMonth
                ? "is-outside"
                : isPast
                  ? "is-past"
                  : !day
                    ? "is-past"
                    : fullyClosed
                      ? isDefaultOff
                        ? "is-holiday"
                        : "is-closed"
                      : openSlots === 0
                        ? "is-full"
                        : "is-open";

              const clickable = inMonth && !isPast && Boolean(day);

              return (
                <button
                  type="button"
                  key={cell.key}
                  className={`admin-schedule-cal-cell ${summaryClass}${
                    selectedDate === cell.key ? " is-selected" : ""
                  }${isToday ? " is-today" : ""}`}
                  disabled={!clickable}
                  onClick={() => clickable && setSelectedDate(cell.key)}
                  aria-pressed={selectedDate === cell.key}
                  aria-label={
                    inMonth
                      ? `${formatLongDate(cell.date)}${
                          isPast
                            ? ", sudah lewat"
                            : isDefaultOff && fullyClosed
                              ? ", libur default, klik untuk membuka"
                              : `, ${openSlots} slot tersedia`
                        }`
                      : ""
                  }
                >
                  <span className="admin-schedule-cal-num">{cell.date.getDate()}</span>
                </button>
              );
            })}
          </div>
          <div className="admin-schedule-cal-legend" aria-hidden="true">
            <span><i className="swatch is-open" /> Buka</span>
            <span><i className="swatch is-full" /> Penuh</span>
            <span><i className="swatch is-closed" /> Tutup</span>
            <span><i className="swatch is-holiday" /> Libur default</span>
          </div>
        </div>

        <div className="admin-schedule-day-panel">
          {selectedDay && dayKpi ? (
            (() => {
              const totalSlots = selectedDay.slots.length;
              const fullyClosed = totalSlots > 0 && dayKpi.closed === totalSlots;
              const fullyOpen =
                totalSlots > 0 && dayKpi.available + dayKpi.booked + dayKpi.held === totalSlots;
              return (
                <>
                  <header className="admin-schedule-day-head">
                    <div className="admin-schedule-day-head-title">
                      <strong>{selectedDay.label}</strong>
                      <div className="admin-schedule-day-counters">
                        {(() => {
                          const items: Array<{ key: string; n: number; label: string }> = [
                            { key: "a", n: dayKpi.available, label: "tersedia" },
                            { key: "b", n: dayKpi.booked, label: "sudah terisi" },
                            { key: "c", n: dayKpi.held, label: "diproses" },
                            { key: "d", n: dayKpi.closed, label: "ditutup" },
                          ].filter((entry) => entry.n > 0);
                          if (items.length === 0) {
                            return <span className="is-empty">Belum ada slot di hari ini.</span>;
                          }
                          return items.map((entry, index) => (
                            <span key={entry.key}>
                              <strong>{entry.n}</strong> {entry.label}
                              {index < items.length - 1 && (
                                <em aria-hidden="true">·</em>
                              )}
                            </span>
                          ));
                        })()}
                      </div>
                    </div>
                    <div
                      className="admin-schedule-day-bulk admin-schedule-segment"
                      role="group"
                      aria-label="Bulk action hari ini"
                    >
                      <button
                        type="button"
                        className={`admin-segment-button${fullyClosed ? " is-active" : ""}`}
                        onClick={() => setDayAll(selectedDay.date, "close")}
                        disabled={fullyClosed}
                        aria-pressed={fullyClosed}
                      >
                        Tutup semua
                      </button>
                      <button
                        type="button"
                        className={`admin-segment-button${fullyOpen ? " is-active" : ""}`}
                        onClick={() => setDayAll(selectedDay.date, "open")}
                        disabled={fullyOpen}
                        aria-pressed={fullyOpen}
                      >
                        Buka semua
                      </button>
                    </div>
                  </header>

                  <div className="admin-schedule-slots">
                    {selectedDay.slots.map((slot) => {
                      const locked = slot.status === "Booked" || slot.status === "Held";
                      const past = isSlotPast(selectedDay.date, slot.time);
                      const disabled = locked || past;
                      const isOpen = slot.status === "Available" && !past;
                      const statusClass = past
                        ? "is-past"
                        : slot.status === "Available"
                          ? "is-available"
                          : slot.status === "Closed"
                            ? "is-closed"
                            : slot.status === "Booked"
                              ? "is-full"
                              : "is-processing";
                      const statusLabel = past
                        ? "Lewat"
                        : slot.status === "Available"
                          ? "Tersedia"
                          : slot.status === "Closed"
                            ? "Ditutup"
                            : slot.status === "Booked"
                              ? "Sudah terisi"
                              : "Sedang diproses";
                      const StatusIcon = past
                        ? Clock3
                        : slot.status === "Available"
                          ? Check
                          : slot.status === "Closed"
                            ? X
                            : slot.status === "Booked"
                              ? Lock
                              : Clock3;
                      const booking = locked
                        ? bookingByKey.get(`${selectedDay.date}|${slot.time}`)
                        : undefined;
                      const isHighlight =
                        newlyAddedSlot?.date === selectedDay.date &&
                        newlyAddedSlot?.time === slot.time;
                      return (
                        <div
                          key={slot.time}
                          className={`admin-schedule-slot ${statusClass}${
                            disabled ? " is-locked" : ""
                          }${slot.custom ? " is-custom" : ""}${
                            isHighlight ? " is-highlight" : ""
                          }`}
                        >
                          <button
                            type="button"
                            className="admin-schedule-slot-main"
                            onClick={() => {
                              if (locked) {
                                setSlotInfoTime(slot.time);
                                return;
                              }
                              if (past) return;
                              toggleSlot(selectedDay.date, slot.time);
                            }}
                            disabled={past && !locked}
                            aria-label={`${slot.time} ${statusLabel}${
                              locked
                                ? ", klik untuk lihat detail booking"
                                : past
                                  ? ""
                                  : isOpen
                                    ? ", klik untuk menutup"
                                    : ", klik untuk membuka"
                            }`}
                          >
                            <Clock3 size={18} aria-hidden="true" />
                            <span className="admin-schedule-slot-text">
                              <strong>{slot.time}</strong>
                              <small>
                                <StatusIcon size={11} aria-hidden="true" /> {statusLabel}
                              </small>
                            </span>
                            {!disabled && (
                              <em className="admin-schedule-slot-action">
                                {isOpen ? "Tutup slot" : "Buka slot"}
                              </em>
                            )}
                            {locked && (
                              <em className="admin-schedule-slot-action">Lihat detail</em>
                            )}
                          </button>
                          {slot.custom && (
                            <span className="admin-schedule-slot-tag" aria-hidden="true">
                              Khusus
                            </span>
                          )}
                          {slot.custom && !locked && !past && (
                            <button
                              type="button"
                              className="admin-schedule-slot-remove"
                              onClick={() => removeCustomSlot(selectedDay.date, slot.time)}
                              aria-label={`Hapus jam khusus ${slot.time}`}
                              title="Hapus jam khusus"
                            >
                              <X size={14} aria-hidden="true" />
                            </button>
                          )}
                          {slotInfoTime === slot.time && booking && (
                            <SlotBookingPopover
                              booking={booking}
                              onClose={() => setSlotInfoTime(null)}
                              onOpen={() => {
                                onOpenBooking(booking.code);
                                setSlotInfoTime(null);
                              }}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <form
                    className="admin-schedule-add"
                    onSubmit={(event) => {
                      event.preventDefault();
                      addCustomSlot(selectedDay.date, customDraft);
                    }}
                  >
                    <label className="admin-schedule-add-field">
                      <span>Tambah jam khusus</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="Contoh: 15.30"
                        value={customDraft}
                        onChange={(event) => {
                          setCustomDraft(event.target.value);
                          if (customError) setCustomError(null);
                        }}
                        list="admin-schedule-time-suggestions"
                        aria-invalid={Boolean(customError)}
                      />
                      <datalist id="admin-schedule-time-suggestions">
                        <option value="15.00" />
                        <option value="15.30" />
                        <option value="16.00" />
                        <option value="16.30" />
                        <option value="19.00" />
                        <option value="19.30" />
                      </datalist>
                    </label>
                    <button
                      type="submit"
                      className="admin-pill-button admin-pill-button--primary"
                    >
                      Tambah
                    </button>
                    {customError && (
                      <small className="admin-schedule-add-error">{customError}</small>
                    )}
                    <small className="admin-schedule-add-hint">
                      Jam default {VISIT_TIME_SLOTS[0]}-{VISIT_TIME_SLOTS[VISIT_TIME_SLOTS.length - 1]}.
                      Tambahkan jam khusus jika ada keperluan di luar jam tersebut.
                    </small>
                  </form>
                </>
              );
            })()
          ) : (
            <div className="admin-schedule-empty">
              <CalendarDays size={28} aria-hidden="true" />
              <strong>Pilih tanggal</strong>
              <p>Pilih tanggal pada kalender untuk melihat dan mengatur slot.</p>
            </div>
          )}
        </div>
      </section>

      {showRangeModal && (
        <ScheduleRangeModal
          minDate={today}
          maxDate={maxScheduleDate}
          activeBookingsByDate={activeBookingsByDate}
          schedules={schedules}
          onClose={() => setShowRangeModal(false)}
          onConfirm={(params) => {
            applyRange(params);
            setShowRangeModal(false);
          }}
        />
      )}

      {confirmDialog && (
        <ScheduleConfirmDialog
          title={confirmDialog.title}
          body={confirmDialog.body}
          confirmLabel={confirmDialog.confirmLabel}
          variant={confirmDialog.confirmVariant}
          onCancel={() => setConfirmDialog(null)}
          onConfirm={() => {
            confirmDialog.onConfirm();
            setConfirmDialog(null);
          }}
        />
      )}

      {undoState && (
        <div className="admin-schedule-toast" role="status" aria-live="polite">
          <span>{undoState.label}</span>
          <button
            type="button"
            className="admin-schedule-toast-undo"
            onClick={restoreUndo}
          >
            Batalkan
          </button>
        </div>
      )}
    </div>
  );
}

function SlotBookingPopover({
  booking,
  onClose,
  onOpen,
}: {
  booking: Booking;
  onClose: () => void;
  onOpen: () => void;
}) {
  // Tutup popover saat klik di luar atau Esc.
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose();
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("mousedown", handleClick);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("mousedown", handleClick);
      window.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);
  return (
    <div ref={ref} className="admin-schedule-slot-popover" role="dialog">
      <header>
        <strong>{booking.code}</strong>
        <span className={`admin-schedule-slot-popover-status is-${booking.status.toLowerCase()}`}>
          {booking.status}
        </span>
      </header>
      <dl>
        <div>
          <dt>CP</dt>
          <dd>{booking.contactName}</dd>
        </div>
        <div>
          <dt>Rombongan</dt>
          <dd>
            {booking.institution} · {booking.groupSize} orang
          </dd>
        </div>
        <div>
          <dt>WhatsApp</dt>
          <dd>{booking.whatsapp}</dd>
        </div>
        <div>
          <dt>Jam</dt>
          <dd>{booking.time} WIB</dd>
        </div>
      </dl>
      <div className="admin-schedule-slot-popover-actions">
        <button type="button" className="admin-pill-button" onClick={onClose}>
          Tutup
        </button>
        <button
          type="button"
          className="admin-pill-button admin-pill-button--primary"
          onClick={onOpen}
        >
          Buka di Booking
        </button>
      </div>
    </div>
  );
}

function ScheduleConfirmDialog({
  title,
  body,
  confirmLabel,
  variant,
  onCancel,
  onConfirm,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  variant?: "default" | "danger";
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
      if (event.key === "Enter") onConfirm();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onCancel, onConfirm]);
  return (
    <div className="admin-modal-backdrop" onClick={onCancel} role="presentation">
      <div
        className="admin-modal admin-modal--confirm"
        role="alertdialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <h2>{title}</h2>
        <p>{body}</p>
        <div className="admin-modal-actions">
          <button type="button" className="admin-pill-button" onClick={onCancel}>
            Batal
          </button>
          <button
            type="button"
            className={`admin-pill-button ${
              variant === "danger" ? "admin-pill-button--danger" : "admin-pill-button--primary"
            }`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function ScheduleRangeModal({
  minDate,
  maxDate,
  activeBookingsByDate,
  schedules,
  onClose,
  onConfirm,
}: {
  minDate: Date;
  maxDate: Date;
  activeBookingsByDate: Map<string, number>;
  schedules: VisitDay[];
  onClose: () => void;
  onConfirm: (params: {
    from: string;
    to: string;
    weekdays: number[];
    action: "open" | "close";
  }) => void;
}) {
  const [from, setFrom] = useState(formatDateKey(minDate));
  const [to, setTo] = useState(formatDateKey(maxDate));
  // Default kosong agar admin sengaja memilih hari yang ingin diubah.
  // Tidak menebak intent (lihat juga quick-pick di bawah).
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [action, setAction] = useState<"open" | "close">("close");

  const dayLabels = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
  const dayOrder = [1, 2, 3, 4, 5, 6, 0];

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Preview: hitung jumlah hari yang akan diubah dan jumlah booking aktif
  // di rentang itu untuk peringatan.
  const preview = (() => {
    if (!from || !to) return null;
    const fromDate = parseDateKey(from);
    const toDate = parseDateKey(to);
    if (fromDate > toDate) return null;
    const set = new Set(weekdays);
    let days = 0;
    let bookingsInRange = 0;
    for (const day of schedules) {
      const d = parseDateKey(day.date);
      if (d < fromDate || d > toDate) continue;
      if (!set.has(d.getDay())) continue;
      days += 1;
      bookingsInRange += activeBookingsByDate.get(day.date) ?? 0;
    }
    return { days, bookingsInRange };
  })();

  const toggleWeekday = (value: number) => {
    setWeekdays((current) =>
      current.includes(value)
        ? current.filter((day) => day !== value)
        : [...current, value],
    );
  };

  const fromDateInput = formatDateKey(minDate);
  const toDateInput = formatDateKey(maxDate);
  const canSubmit =
    Boolean(from) &&
    Boolean(to) &&
    parseDateKey(from) <= parseDateKey(to) &&
    weekdays.length > 0;

  return (
    <div className="admin-modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="admin-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="schedule-range-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="admin-modal-head">
          <h2 id="schedule-range-title">Pengaturan rentang</h2>
          <button
            type="button"
            className="admin-modal-close"
            onClick={onClose}
            aria-label="Tutup"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </header>

        <div className="admin-modal-grid">
          <label className="admin-modal-field">
            <span>Dari tanggal</span>
            <input
              type="date"
              value={from}
              min={fromDateInput}
              max={toDateInput}
              onChange={(event) => setFrom(event.target.value)}
            />
          </label>
          <label className="admin-modal-field">
            <span>Sampai tanggal</span>
            <input
              type="date"
              value={to}
              min={fromDateInput}
              max={toDateInput}
              onChange={(event) => setTo(event.target.value)}
            />
          </label>
        </div>

        <fieldset className="admin-modal-fieldset">
          <legend>Hari yang dipilih</legend>
          <div className="admin-modal-quickpick">
            <button
              type="button"
              onClick={() => setWeekdays([1, 2, 3, 4])}
              aria-pressed={
                weekdays.length === 4 && [1, 2, 3, 4].every((d) => weekdays.includes(d))
              }
            >
              Hari kerja
            </button>
            <button
              type="button"
              onClick={() => setWeekdays([5, 6, 0])}
              aria-pressed={
                weekdays.length === 3 && [5, 6, 0].every((d) => weekdays.includes(d))
              }
            >
              Akhir pekan
            </button>
            <button
              type="button"
              onClick={() => setWeekdays([0, 1, 2, 3, 4, 5, 6])}
              aria-pressed={weekdays.length === 7}
            >
              Semua
            </button>
          </div>
          <div className="admin-modal-weekdays">
            {dayOrder.map((value) => (
              <label key={value}>
                <input
                  type="checkbox"
                  checked={weekdays.includes(value)}
                  onChange={() => toggleWeekday(value)}
                />
                <span>{dayLabels[value]}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="admin-modal-fieldset">
          <legend>Aksi</legend>
          <div
            className="admin-schedule-segment admin-modal-segment"
            role="radiogroup"
            aria-label="Aksi"
          >
            <button
              type="button"
              role="radio"
              aria-checked={action === "close"}
              className={`admin-segment-button${action === "close" ? " is-active" : ""}`}
              onClick={() => setAction("close")}
            >
              Tutup hari
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={action === "open"}
              className={`admin-segment-button${action === "open" ? " is-active" : ""}`}
              onClick={() => setAction("open")}
            >
              Buka hari
            </button>
          </div>
        </fieldset>

        <div className="admin-modal-preview">
          {weekdays.length === 0 ? null : preview ? (
            <p>
              Akan {action === "close" ? "menutup" : "membuka"} <strong>{preview.days}</strong>{" "}
              hari.
              {preview.bookingsInRange > 0 && action === "close" && (
                <>
                  {" "}
                  <strong>{preview.bookingsInRange}</strong> booking aktif tetap aman.
                </>
              )}
            </p>
          ) : (
            <p className="admin-modal-preview-error">Rentang tanggal belum valid.</p>
          )}
        </div>

        <div className="admin-modal-actions">
          <button type="button" className="admin-pill-button" onClick={onClose}>
            Batal
          </button>
          <button
            type="button"
            className={`admin-pill-button ${
              action === "close"
                ? "admin-pill-button--danger"
                : "admin-pill-button--primary"
            }`}
            disabled={!canSubmit}
            onClick={() =>
              canSubmit && onConfirm({ from, to, weekdays, action })
            }
          >
            {action === "close" ? "Tutup hari" : "Buka hari"}
          </button>
        </div>
      </div>
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

function AdminScreen({
  schedules,
  bookings,
  onBookingsChange,
  onSchedulesChange,
  focusCode,
  onFocusCodeConsumed,
  adminName,
}: {
  schedules: VisitDay[];
  bookings: Booking[];
  onBookingsChange: (bookings: Booking[]) => void;
  onSchedulesChange: (schedules: VisitDay[]) => void;
  focusCode?: string | null;
  onFocusCodeConsumed?: () => void;
  adminName?: string;
}) {
  const [selectedCode, setSelectedCode] = useState(
    focusCode ?? bookings[0]?.code ?? "",
  );
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<BookingStatusFilter>(null);
  const [sort, setSort] = useState<BookingSort>("smart");
  const [dateRange, setDateRange] = useState<BookingDateRange>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<BookingViewMode>("split");
  const [density, setDensity] = useState<BookingDensity>("comfortable");
  const [showSlideOver, setShowSlideOver] = useState(false);
  const [showFilterPopover, setShowFilterPopover] = useState(false);
  const [modal, setModal] = useState<{ action: AdminAction; booking: Booking } | null>(null);
  const [previewBooking, setPreviewBooking] = useState<Booking | null>(null);
  // Mobile breakpoint: split-pane tidak punya cukup ruang untuk dua kolom,
  // jadi kita reuse pola SlideOver (yang sudah dipakai di mode "table" desktop)
  // sebagai panel detail. List tetap full-width.
  const isCompactScreen = useMediaQuery("(max-width: 980px)");
  const [showExportModal, setShowExportModal] = useState(false);

  // In production this would resolve to the user-uploaded file. The demo
  // reuses the shared kop-surat asset for every booking so admins can still
  // exercise the preview/download UI end-to-end.
  const documentUrlFor = (_booking: Booking) => ASSETS.letterExample;

  const handleDownloadDocument = (booking: Booking) => {
    const url = documentUrlFor(booking);
    const link = document.createElement("a");
    link.href = url;
    link.download = booking.documentName;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Saat ada permintaan fokus dari modul lain (misal dari Jadwal Kunjungan),
  // pilih booking itu dan reset filter agar booking pasti terlihat.
  useEffect(() => {
    if (!focusCode) return;
    setSelectedCode(focusCode);
    setStatusFilter(null);
    setSearch("");
    setDateRange("all");
    setPage(1);
    if (viewMode === "table" || isCompactScreen) setShowSlideOver(true);
    onFocusCodeConsumed?.();
  }, [focusCode, viewMode, isCompactScreen, onFocusCodeConsumed]);

  // Per-status counts always reference the full dataset so the chips stay
  // stable while the admin narrows the list.
  const counts = useMemo(() => {
    const total = bookings.length;
    const byStatus: Record<BookingStatus, number> = {
      Pending: 0,
      Accepted: 0,
      Reschedule: 0,
      Completed: 0,
      Rejected: 0,
    };
    bookings.forEach((booking) => {
      byStatus[booking.status] += 1;
    });
    return { total, byStatus };
  }, [bookings]);

  const visibleBookings = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matched = bookings.filter((booking) => {
      if (q) {
        const haystack =
          `${booking.code} ${booking.contactName} ${booking.institution}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (statusFilter !== null && booking.status !== statusFilter) return false;
      if (!inDateRange(booking, dateRange, customFrom, customTo)) return false;
      return true;
    });
    return sortBookings(matched, sort);
  }, [bookings, search, statusFilter, dateRange, customFrom, customTo, sort]);

  // Reset pagination whenever the underlying list shrinks/grows from a filter
  // change so the user is never stranded on an empty page.
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, dateRange, customFrom, customTo, sort, viewMode]);

  const pageSize = viewMode === "table" ? PAGE_SIZE_BOOKING_TABLE : PAGE_SIZE_BOOKING_SPLIT;
  const totalPages = Math.max(1, Math.ceil(visibleBookings.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const useVirtual = visibleBookings.length > VIRTUALIZE_THRESHOLD;
  const pagedBookings = useVirtual
    ? visibleBookings
    : visibleBookings.slice((safePage - 1) * pageSize, safePage * pageSize);

  const selectedBooking =
    visibleBookings.find((booking) => booking.code === selectedCode) ??
    pagedBookings[0] ??
    null;

  // Booking-page KPIs focus on operational workload, not visitor sentiment.
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setHours(0, 0, 0, 0);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  const completedThisWeek = bookings.filter(
    (booking) => booking.status === "Completed" && parseDateKey(booking.date) >= startOfWeek,
  ).length;
  const totalThisWeek = bookings.filter(
    (booking) => parseDateKey(booking.date) >= startOfWeek,
  ).length;

  const updateBooking = (
    booking: Booking,
    patch: Partial<Booking>,
  ) => {
    onBookingsChange(
      bookings.map((item) =>
        item.code === booking.code ? { ...item, ...patch } : item,
      ),
    );
  };

  const updateBookingStatus = (booking: Booking, status: BookingStatus, note?: string) => {
    updateBooking(booking, {
      status,
      note,
      completedAt:
        status === "Completed"
          ? new Date().toLocaleString("id-ID", {
              day: "2-digit",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            }) + " WIB"
          : booking.completedAt,
    });
    // Persist to API. Optimistic local update sudah dilakukan di atas; jika
    // API gagal, realtime broadcast atau refetch berikutnya akan rekonsiliasi.
    const apiCall =
      status === "Accepted"
        ? apiAcceptBooking(booking.code, note)
        : status === "Rejected"
          ? apiRejectBooking(booking.code, note)
          : status === "Completed"
            ? apiCompleteBooking(booking.code)
            : null;
    if (apiCall) void apiCall.catch(() => {});
  };

  const handleMarkCompleted = (booking: Booking) => {
    updateBookingStatus(booking, "Completed");
    openWhatsApp(booking, createWhatsappMessage(booking, "Completed"));
  };

  const updateSlotStatus = (booking: Booking, status: VisitStatus) => {
    onSchedulesChange(
      schedules.map((day) =>
        day.date === booking.date
          ? {
              ...day,
              slots: day.slots.map((slot) => (slot.time === booking.time ? { ...slot, status } : slot)),
            }
          : day,
      ),
    );
  };

  // Reschedule lifecycle helpers ---------------------------------------------

  const setSlotStatusAt = (date: string, time: string, status: VisitStatus) => {
    onSchedulesChange(
      schedules.map((day) =>
        day.date === date
          ? {
              ...day,
              slots: day.slots.map((slot) =>
                slot.time === time ? { ...slot, status } : slot,
              ),
            }
          : day,
      ),
    );
  };

  const formatNow = () =>
    new Date().toLocaleString("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }) + " WIB";

  // Admin proposes a new slot. Original slot is held (Reschedule Hold) so it
  // is not handed to another visitor while we wait for the user reply on
  // WhatsApp. Proposed slot is *not* held yet because the user has not agreed.
  const handleProposeReschedule = (
    booking: Booking,
    proposedDate: string,
    proposedDateLabel: string,
    proposedTime: string,
    note: string,
  ) => {
    updateBooking(booking, {
      status: "Reschedule",
      note,
      proposedDate,
      proposedDateLabel,
      proposedTime,
      proposedAt: formatNow(),
    });
    void apiRescheduleBooking(booking.code, { proposedDate, proposedTime, note }).catch(() => {});
    setSlotStatusAt(booking.date, booking.time, "Reschedule Hold");
    const proposalText = `${proposedDateLabel}, ${proposedTime} WIB`;
    openWhatsApp(
      booking,
      createWhatsappMessage(booking, "Reschedule", note ? `${proposalText} - ${note}` : proposalText),
    );
  };

  // User accepted via WhatsApp. Move booking to its proposed slot, free the
  // old hold, and lock the new slot as Booked. WhatsApp re-opens with the
  // standard "Accepted" template so the user receives a final confirmation.
  const handleConfirmReschedule = (booking: Booking) => {
    if (!booking.proposedDate || !booking.proposedTime) return;
    setSlotStatusAt(booking.date, booking.time, "Available");
    setSlotStatusAt(booking.proposedDate, booking.proposedTime, "Booked");
    const promoted: Booking = {
      ...booking,
      status: "Accepted",
      date: booking.proposedDate,
      dateLabel: booking.proposedDateLabel ?? booking.proposedDate,
      time: booking.proposedTime,
      proposedDate: undefined,
      proposedDateLabel: undefined,
      proposedTime: undefined,
      proposedAt: undefined,
    };
    onBookingsChange(
      bookings.map((item) => (item.code === booking.code ? promoted : item)),
    );
    void apiAcceptBooking(booking.code).catch(() => {});
    openWhatsApp(promoted, createWhatsappMessage(promoted, "Accepted"));
  };

  // User declined the proposed slot. Mark booking as rejected and free the
  // original slot so it can be picked up by someone else.
  const handleCancelReschedule = (booking: Booking) => {
    updateBooking(booking, {
      status: "Rejected",
      note: booking.note ?? "User menolak usulan reschedule",
      proposedDate: undefined,
      proposedDateLabel: undefined,
      proposedTime: undefined,
      proposedAt: undefined,
    });
    setSlotStatusAt(booking.date, booking.time, "Available");
    openWhatsApp(
      booking,
      createWhatsappMessage(booking, "Rejected", "Reschedule tidak dapat diakomodasi."),
    );
  };

  const handleAction = (action: AdminAction, booking: Booking, note: string, proposed?: string) => {
    if (action === "accept") {
      updateBookingStatus(booking, "Accepted", note);
      updateSlotStatus(booking, "Booked");
      openWhatsApp(booking, createWhatsappMessage(booking, "Accepted"));
    }
    if (action === "reject") {
      updateBookingStatus(booking, "Rejected", note);
      updateSlotStatus(booking, "Available");
      openWhatsApp(booking, createWhatsappMessage(booking, "Rejected", note));
    }
    if (action === "reschedule" && proposed) {
      // proposed is "Senin, 1 Juni 2026, 09.00 WIB" - parse back to date/time
      const parsed = parseProposedSlot(proposed, schedules);
      if (parsed) {
        handleProposeReschedule(booking, parsed.date, parsed.dateLabel, parsed.time, note);
      }
    }
    setModal(null);
  };

  const handleRowClick = (code: string) => {
    setSelectedCode(code);
    // Di mobile slideover juga dipakai pada split mode karena kolom detail
    // tidak tampil — selektor CSS .booking-split-detail di-hide @ ≤980px.
    if (viewMode === "table" || isCompactScreen) setShowSlideOver(true);
  };

  const resetFilters = () => {
    setSearch("");
    setStatusFilter(null);
    setDateRange("all");
    setCustomFrom("");
    setCustomTo("");
    setSort("smart");
  };

  const filtersActive =
    !!search.trim() ||
    statusFilter !== null ||
    dateRange !== "all" ||
    sort !== "smart";

  // Active filters that pertain only to the popover (sort + date range), used
  // to drive the indicator dot on the filter button.
  const popoverFiltersActive = dateRange !== "all" || sort !== "smart";

  const rowHeight = density === "compact" ? 44 : 64;

  return (
    <div className="admin-cms-page admin-bookings-page">
      <div className="admin-heading">
        <div>
          <h1>Booking Permohonan</h1>
          <p>Tinjau permohonan masuk, kirim konfirmasi WhatsApp, dan tandai kunjungan selesai.</p>
        </div>
        <div className="admin-heading-actions">
          <div className="search-box">
            <Search size={18} aria-hidden="true" />
            <input
              placeholder="Cari kode, CP, instansi"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <button
            type="button"
            className="booking-export-button"
            onClick={() => setShowExportModal(true)}
            title="Export laporan booking ke Excel"
          >
            <FileSpreadsheet size={14} aria-hidden="true" />
            Export
          </button>
        </div>
      </div>

      <div className="admin-stats">
        <StatCard label="Pending" value={counts.byStatus.Pending} />
        <StatCard label="Accepted" value={counts.byStatus.Accepted} />
        <StatCard label="Completed minggu ini" value={completedThisWeek} />
        <StatCard label="Total minggu ini" value={totalThisWeek} />
      </div>

      <div className="booking-toolbar" role="region" aria-label="Filter dan tampilan booking">
        <div className="booking-chip-group" role="tablist" aria-label="Filter status">
          <button
            type="button"
            role="tab"
            aria-selected={statusFilter === null}
            className={`booking-chip booking-chip--all${statusFilter === null ? " is-active" : ""}`}
            onClick={() => setStatusFilter(null)}
            title="Tampilkan semua status"
          >
            <span>Semua</span>
            <em>{formatCountShort(counts.total)}</em>
          </button>
          {BOOKING_STATUS_CHIPS.map((chip) => {
            const count = counts.byStatus[chip.value];
            const isActive = statusFilter === chip.value;
            return (
              <button
                key={chip.value}
                type="button"
                role="tab"
                aria-selected={isActive}
                data-empty={count === 0 ? "true" : undefined}
                className={`booking-chip${isActive ? " is-active" : ""} booking-chip--${chip.value.toLowerCase()}`}
                onClick={() => setStatusFilter(isActive ? null : chip.value)}
                title={isActive ? "Klik untuk hapus filter" : `Filter ${chip.label}`}
              >
                <span>{chip.label}</span>
                <em>{formatCountShort(count)}</em>
              </button>
            );
          })}
        </div>

        <div className="booking-toolbar-spacer" aria-hidden="true" />

        <BookingFilterPopover
          open={showFilterPopover}
          onToggle={() => setShowFilterPopover((prev) => !prev)}
          onClose={() => setShowFilterPopover(false)}
          hasActive={popoverFiltersActive}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          customFrom={customFrom}
          customTo={customTo}
          onCustomFromChange={setCustomFrom}
          onCustomToChange={setCustomTo}
          sort={sort}
          onSortChange={setSort}
          canReset={filtersActive}
          onReset={resetFilters}
        />

        <div className="booking-toggle" role="group" aria-label="Mode tampilan">
          <button
            type="button"
            aria-pressed={viewMode === "split"}
            onClick={() => setViewMode("split")}
            title="Master-detail"
          >
            Split
          </button>
          <button
            type="button"
            aria-pressed={viewMode === "table"}
            onClick={() => setViewMode("table")}
            title="Tabel full-width"
          >
            Tabel
          </button>
        </div>

        <div className="booking-toggle" role="group" aria-label="Density">
          <button
            type="button"
            aria-pressed={density === "comfortable"}
            onClick={() => setDensity("comfortable")}
            title="Comfortable"
          >
            <Rows3 size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-pressed={density === "compact"}
            onClick={() => setDensity("compact")}
            title="Compact"
          >
            <Rows4 size={14} aria-hidden="true" />
          </button>
        </div>

        <div className="booking-summary" aria-live="polite">
          {visibleBookings.length === counts.total ? (
            <>
              <strong>{formatCount(counts.total)}</strong> booking
            </>
          ) : (
            <>
              <strong>{formatCount(visibleBookings.length)}</strong> dari{" "}
              <strong>{formatCount(counts.total)}</strong>
            </>
          )}
          {useVirtual ? " · virtualized" : ""}
        </div>
      </div>

      {viewMode === "split" ? (
        <div className={`admin-workspace booking-density-${density}`}>
          <div className="booking-split-list">
            <div className="booking-table">
              {pagedBookings.length === 0 ? (
                <p className="admin-card-empty">
                  {filtersActive
                    ? "Tidak ada booking yang cocok dengan filter."
                    : "Belum ada booking masuk."}
                </p>
              ) : useVirtual ? (
                <BookingVirtualList
                  bookings={pagedBookings}
                  rowHeight={rowHeight}
                  selectedCode={selectedBooking?.code ?? null}
                  density={density}
                  onSelect={handleRowClick}
                />
              ) : (
                pagedBookings.map((booking) => (
                  <BookingListRow
                    key={booking.code}
                    booking={booking}
                    isSelected={selectedBooking?.code === booking.code}
                    density={density}
                    onSelect={handleRowClick}
                  />
                ))
              )}
            </div>

            {!useVirtual && totalPages > 1 && (
              <Pagination
                page={safePage}
                totalPages={totalPages}
                onChange={setPage}
              />
            )}
          </div>

          <div className="booking-split-detail">
            {selectedBooking ? (
              <BookingDetailPanel
                booking={selectedBooking}
                onAccept={() => setModal({ action: "accept", booking: selectedBooking })}
                onReject={() => setModal({ action: "reject", booking: selectedBooking })}
                onReschedule={() => setModal({ action: "reschedule", booking: selectedBooking })}
                onMarkCompleted={() => handleMarkCompleted(selectedBooking)}
                onConfirmReschedule={() => handleConfirmReschedule(selectedBooking)}
                onCancelReschedule={() => handleCancelReschedule(selectedBooking)}
                onResendReschedule={() => setModal({ action: "reschedule", booking: selectedBooking })}
                onPreviewDocument={(booking) => setPreviewBooking(booking)}
                onDownloadDocument={handleDownloadDocument}
              />
            ) : (
              <div className="booking-detail booking-detail--empty">
                <p>Pilih booking untuk melihat detail.</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <BookingTable
          bookings={pagedBookings}
          density={density}
          rowHeight={rowHeight}
          useVirtual={useVirtual}
          selectedCode={selectedBooking?.code ?? null}
          onSelect={handleRowClick}
          emptyLabel={
            filtersActive
              ? "Tidak ada booking yang cocok dengan filter."
              : "Belum ada booking masuk."
          }
        />
      )}

      {viewMode === "table" && !useVirtual && totalPages > 1 && (
        <Pagination
          page={safePage}
          totalPages={totalPages}
          onChange={setPage}
        />
      )}

      {((viewMode === "table" || isCompactScreen) && showSlideOver && selectedBooking) && (
        <BookingSlideOver
          booking={selectedBooking}
          onClose={() => setShowSlideOver(false)}
          onAccept={() => setModal({ action: "accept", booking: selectedBooking })}
          onReject={() => setModal({ action: "reject", booking: selectedBooking })}
          onReschedule={() => setModal({ action: "reschedule", booking: selectedBooking })}
          onMarkCompleted={() => handleMarkCompleted(selectedBooking)}
          onConfirmReschedule={() => handleConfirmReschedule(selectedBooking)}
          onCancelReschedule={() => handleCancelReschedule(selectedBooking)}
          onResendReschedule={() => setModal({ action: "reschedule", booking: selectedBooking })}
          onPreviewDocument={(booking) => setPreviewBooking(booking)}
          onDownloadDocument={handleDownloadDocument}
        />
      )}

      {modal && (
        <AdminActionModal
          modal={modal}
          schedules={schedules}
          onClose={() => setModal(null)}
          onConfirm={handleAction}
        />
      )}

      {previewBooking && (
        <DocumentPreviewModal
          documentName={previewBooking.documentName}
          documentUrl={documentUrlFor(previewBooking)}
          onClose={() => setPreviewBooking(null)}
          onDownload={() => handleDownloadDocument(previewBooking)}
        />
      )}

      {showExportModal && (
        <BookingExportModal
          bookings={bookings}
          adminName={adminName}
          documentUrlFor={documentUrlFor}
          onClose={() => setShowExportModal(false)}
        />
      )}
    </div>
  );
}

function BookingListRow({
  booking,
  isSelected,
  density,
  onSelect,
  style,
}: {
  booking: Booking;
  isSelected: boolean;
  density: BookingDensity;
  onSelect: (code: string) => void;
  style?: React.CSSProperties;
}) {
  return (
    <button
      type="button"
      className={`booking-row${isSelected ? " is-selected" : ""} booking-row--${density}`}
      onClick={() => onSelect(booking.code)}
      style={style}
    >
      <span className="booking-row-main">
        <strong>{booking.code}</strong>
        <small>{booking.institution}</small>
      </span>
      <StatusBadge status={booking.status} />
    </button>
  );
}

function BookingVirtualList({
  bookings,
  rowHeight,
  selectedCode,
  density,
  onSelect,
}: {
  bookings: Booking[];
  rowHeight: number;
  selectedCode: string | null;
  density: BookingDensity;
  onSelect: (code: string) => void;
}) {
  const { containerRef, visible, totalHeight, offsetY } = useVirtualWindow(bookings, rowHeight);
  return (
    <div className="booking-virtual" ref={containerRef}>
      <div className="booking-virtual-spacer" style={{ height: totalHeight }}>
        <div className="booking-virtual-window" style={{ transform: `translateY(${offsetY}px)` }}>
          {visible.map(({ item, index }) => (
            <BookingListRow
              key={item.code}
              booking={item}
              isSelected={selectedCode === item.code}
              density={density}
              onSelect={onSelect}
              style={{ height: rowHeight, ['--row-index' as never]: index }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function BookingTable({
  bookings,
  density,
  rowHeight,
  useVirtual,
  selectedCode,
  onSelect,
  emptyLabel,
}: {
  bookings: Booking[];
  density: BookingDensity;
  rowHeight: number;
  useVirtual: boolean;
  selectedCode: string | null;
  onSelect: (code: string) => void;
  emptyLabel: string;
}) {
  if (bookings.length === 0) {
    return <p className="admin-card-empty">{emptyLabel}</p>;
  }

  return (
    <div className={`booking-grid booking-grid--${density}`}>
      <div className="booking-grid-head" role="row">
        <span>Kode</span>
        <span>Instansi</span>
        <span>Contact person</span>
        <span>Jadwal</span>
        <span>Rombongan</span>
        <span>Submitted</span>
        <span>Status</span>
      </div>
      {useVirtual ? (
        <BookingTableVirtual
          bookings={bookings}
          rowHeight={rowHeight}
          selectedCode={selectedCode}
          onSelect={onSelect}
        />
      ) : (
        bookings.map((booking) => (
          <BookingTableRow
            key={booking.code}
            booking={booking}
            isSelected={selectedCode === booking.code}
            onSelect={onSelect}
          />
        ))
      )}
    </div>
  );
}

function BookingTableVirtual({
  bookings,
  rowHeight,
  selectedCode,
  onSelect,
}: {
  bookings: Booking[];
  rowHeight: number;
  selectedCode: string | null;
  onSelect: (code: string) => void;
}) {
  const { containerRef, visible, totalHeight, offsetY } = useVirtualWindow(bookings, rowHeight);
  return (
    <div className="booking-grid-virtual" ref={containerRef}>
      <div className="booking-grid-spacer" style={{ height: totalHeight }}>
        <div className="booking-grid-window" style={{ transform: `translateY(${offsetY}px)` }}>
          {visible.map(({ item }) => (
            <BookingTableRow
              key={item.code}
              booking={item}
              isSelected={selectedCode === item.code}
              onSelect={onSelect}
              fixedHeight={rowHeight}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function BookingTableRow({
  booking,
  isSelected,
  onSelect,
  fixedHeight,
}: {
  booking: Booking;
  isSelected: boolean;
  onSelect: (code: string) => void;
  fixedHeight?: number;
}) {
  return (
    <button
      type="button"
      role="row"
      className={`booking-grid-row${isSelected ? " is-selected" : ""}`}
      onClick={() => onSelect(booking.code)}
      style={fixedHeight ? { height: fixedHeight } : undefined}
    >
      <span className="booking-grid-cell booking-grid-code">{booking.code}</span>
      <span className="booking-grid-cell">{booking.institution}</span>
      <span className="booking-grid-cell">{booking.contactName}</span>
      <span className="booking-grid-cell">
        {booking.dateLabel}
        <small>{booking.time} WIB</small>
      </span>
      <span className="booking-grid-cell">{booking.groupSize} orang</span>
      <span className="booking-grid-cell booking-grid-meta">{booking.submittedAt}</span>
      <span className="booking-grid-cell">
        <StatusBadge status={booking.status} />
      </span>
    </button>
  );
}

function BookingDetailPanel({
  booking,
  onAccept,
  onReject,
  onReschedule,
  onMarkCompleted,
  onConfirmReschedule,
  onCancelReschedule,
  onResendReschedule,
  onPreviewDocument,
  onDownloadDocument,
}: {
  booking: Booking;
  onAccept: () => void;
  onReject: () => void;
  onReschedule: () => void;
  onMarkCompleted: () => void;
  onConfirmReschedule?: () => void;
  onCancelReschedule?: () => void;
  onResendReschedule?: () => void;
  onPreviewDocument: (booking: Booking) => void;
  onDownloadDocument: (booking: Booking) => void;
}) {
  return (
    <div className="booking-detail">
      <div className="detail-head">
        <span>
          <strong>{booking.code}</strong>
          <small>Diajukan {booking.submittedAt}</small>
        </span>
        <StatusBadge status={booking.status} />
      </div>
      {booking.status === "Reschedule" && booking.proposedDate && (
        <RescheduleProposalBanner booking={booking} />
      )}
      <div className="detail-grid">
        <DetailItem label="Contact person" value={booking.contactName} />
        <DetailItem label="NIK" value={booking.nik} />
        <DetailItem label="WhatsApp" value={booking.whatsapp} />
        <DetailItem label="Instansi" value={booking.institution} />
        <DetailItem label="Rombongan" value={`${booking.groupSize} orang`} />
        <DetailItem
          label="Jadwal"
          value={`${booking.dateLabel}, ${booking.time} WIB`}
        />
        <DocumentDetailItem
          label="Surat"
          documentName={booking.documentName}
          onPreview={() => onPreviewDocument(booking)}
          onDownload={() => onDownloadDocument(booking)}
        />
      </div>
      <BookingActions
        booking={booking}
        onAccept={onAccept}
        onReject={onReject}
        onReschedule={onReschedule}
        onMarkCompleted={onMarkCompleted}
        onConfirmReschedule={onConfirmReschedule}
        onCancelReschedule={onCancelReschedule}
        onResendReschedule={onResendReschedule}
      />
    </div>
  );
}

function RescheduleProposalBanner({ booking }: { booking: Booking }) {
  // Surface the original vs proposed slot so the admin sees exactly what was
  // offered to the visitor without re-reading the WhatsApp thread.
  return (
    <div className="reschedule-banner" role="status">
      <div className="reschedule-banner-head">
        <Clock3 size={14} aria-hidden="true" />
        Menunggu konfirmasi user
      </div>
      <div className="reschedule-banner-grid">
        <div className="reschedule-banner-slot">
          <span>Jadwal awal</span>
          <strong>{booking.dateLabel}</strong>
          <small>{booking.time} WIB</small>
        </div>
        <div className="reschedule-banner-arrow" aria-hidden="true">
          <ArrowRight size={14} />
        </div>
        <div className="reschedule-banner-slot">
          <span>Usulan baru</span>
          <strong>{booking.proposedDateLabel ?? booking.proposedDate}</strong>
          <small>{booking.proposedTime} WIB</small>
        </div>
      </div>
      {booking.proposedAt && (
        <div className="reschedule-banner-meta">Diusulkan {booking.proposedAt}</div>
      )}
      {booking.note && <div className="reschedule-banner-note">Catatan admin: {booking.note}</div>}
    </div>
  );
}

function BookingActions({
  booking,
  onAccept,
  onReject,
  onReschedule,
  onMarkCompleted,
  onConfirmReschedule,
  onCancelReschedule,
  onResendReschedule,
}: {
  booking: Booking;
  onAccept: () => void;
  onReject: () => void;
  onReschedule: () => void;
  onMarkCompleted: () => void;
  onConfirmReschedule?: () => void;
  onCancelReschedule?: () => void;
  onResendReschedule?: () => void;
}) {
  return (
    <div className="admin-actions">
      {booking.status === "Pending" && (
        <>
          <button className="button button-accept" type="button" onClick={onAccept}>
            Accept
          </button>
          <button className="button button-danger" type="button" onClick={onReject}>
            Reject
          </button>
          <button className="button button-outline" type="button" onClick={onReschedule}>
            Reschedule
          </button>
        </>
      )}
      {booking.status === "Accepted" && (
        <>
          <button
            className="button button-primary"
            type="button"
            onClick={onMarkCompleted}
            title="Tandai kunjungan selesai dan kirim link feedback via WhatsApp"
          >
            <BadgeCheck size={16} aria-hidden="true" />
            Tandai Selesai
          </button>
          <button className="button button-outline" type="button" onClick={onReschedule}>
            Reschedule
          </button>
        </>
      )}
      {booking.status === "Reschedule" && (
        <>
          <button
            className="button button-accept"
            type="button"
            onClick={onConfirmReschedule}
            title="User setuju jadwal baru, kunci slot dan kirim WhatsApp konfirmasi"
          >
            User setuju, konfirmasi
          </button>
          <button
            className="button button-outline"
            type="button"
            onClick={onResendReschedule}
            title="Tawarkan jadwal alternatif lain"
          >
            Tawarkan jadwal lain
          </button>
          <button
            className="button button-danger"
            type="button"
            onClick={onCancelReschedule}
            title="User menolak, batalkan permohonan"
          >
            User menolak, batalkan
          </button>
        </>
      )}
      {(booking.status === "Rejected" || booking.status === "Completed") && (
        <span className="admin-actions-locked">Status: {booking.status}</span>
      )}
    </div>
  );
}

function BookingFilterPopover({
  open,
  onToggle,
  onClose,
  hasActive,
  dateRange,
  onDateRangeChange,
  customFrom,
  customTo,
  onCustomFromChange,
  onCustomToChange,
  sort,
  onSortChange,
  canReset,
  onReset,
}: {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  hasActive: boolean;
  dateRange: BookingDateRange;
  onDateRangeChange: (next: BookingDateRange) => void;
  customFrom: string;
  customTo: string;
  onCustomFromChange: (next: string) => void;
  onCustomToChange: (next: string) => void;
  sort: BookingSort;
  onSortChange: (next: BookingSort) => void;
  canReset: boolean;
  onReset: () => void;
}) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // Outside-click + Escape close. Both are mandatory so the popover behaves
  // like the rest of the menu/modal patterns in the app.
  useEffect(() => {
    if (!open) return undefined;
    const handlePointer = (event: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(event.target as Node)) onClose();
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open, onClose]);

  return (
    <div className="booking-filter" ref={wrapperRef}>
      <button
        type="button"
        className={`booking-filter-trigger${hasActive ? " has-active" : ""}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={onToggle}
      >
        <Filter size={14} aria-hidden="true" />
        Filter & Urutan
        {hasActive && <span className="booking-filter-dot" aria-hidden="true" />}
      </button>
      {open && (
        <div className="booking-filter-popover" role="dialog" aria-label="Filter dan urutan">
          <div className="booking-filter-section">
            <span className="booking-filter-label">Tanggal kunjungan</span>
            <div className="booking-filter-options">
              {(
                [
                  { value: "all", label: "Semua" },
                  { value: "today", label: "Hari ini" },
                  { value: "week", label: "Minggu ini" },
                  { value: "month", label: "Bulan ini" },
                  { value: "custom", label: "Custom" },
                ] as { value: BookingDateRange; label: string }[]
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={dateRange === opt.value}
                  className={`booking-filter-option${dateRange === opt.value ? " is-active" : ""}`}
                  onClick={() => onDateRangeChange(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {dateRange === "custom" && (
              <div className="booking-filter-range">
                <input
                  type="date"
                  value={customFrom}
                  max={customTo || undefined}
                  onChange={(event) => onCustomFromChange(event.target.value)}
                  aria-label="Dari tanggal"
                />
                <span aria-hidden="true">-</span>
                <input
                  type="date"
                  value={customTo}
                  min={customFrom || undefined}
                  onChange={(event) => onCustomToChange(event.target.value)}
                  aria-label="Sampai tanggal"
                />
              </div>
            )}
          </div>

          <div className="booking-filter-section">
            <span className="booking-filter-label">Urutan</span>
            <div className="booking-filter-options booking-filter-options--column">
              {(
                [
                  { value: "smart", label: "Smart sort (rekomendasi)" },
                  { value: "submitted-desc", label: "Submit terbaru" },
                  { value: "submitted-asc", label: "Submit terlama" },
                  { value: "date-asc", label: "Jadwal terdekat" },
                  { value: "date-desc", label: "Jadwal terjauh" },
                ] as { value: BookingSort; label: string }[]
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={sort === opt.value}
                  className={`booking-filter-option${sort === opt.value ? " is-active" : ""}`}
                  onClick={() => onSortChange(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="booking-filter-footer">
            <button
              type="button"
              className="booking-filter-reset"
              onClick={onReset}
              disabled={!canReset}
            >
              Reset semua
            </button>
            <button
              type="button"
              className="booking-filter-apply"
              onClick={onClose}
            >
              Selesai
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function BookingSlideOver({
  booking,
  onClose,
  onAccept,
  onReject,
  onReschedule,
  onMarkCompleted,
  onConfirmReschedule,
  onCancelReschedule,
  onResendReschedule,
  onPreviewDocument,
  onDownloadDocument,
}: {
  booking: Booking;
  onClose: () => void;
  onAccept: () => void;
  onReject: () => void;
  onReschedule: () => void;
  onMarkCompleted: () => void;
  onConfirmReschedule?: () => void;
  onCancelReschedule?: () => void;
  onResendReschedule?: () => void;
  onPreviewDocument: (booking: Booking) => void;
  onDownloadDocument: (booking: Booking) => void;
}) {
  // Close on Escape so power users can navigate the table without leaving the
  // keyboard.
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div className="booking-slideover" role="dialog" aria-modal="true" aria-label="Detail booking">
      <button
        type="button"
        className="booking-slideover-backdrop"
        aria-label="Tutup detail"
        onClick={onClose}
      />
      <aside className="booking-slideover-panel">
        <header>
          <span>
            <strong>{booking.code}</strong>
            <small>Diajukan {booking.submittedAt}</small>
          </span>
          <button type="button" className="booking-slideover-close" onClick={onClose} aria-label="Tutup">
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <div className="booking-slideover-status">
          <StatusBadge status={booking.status} />
        </div>
        {booking.status === "Reschedule" && booking.proposedDate && (
          <RescheduleProposalBanner booking={booking} />
        )}
        <div className="detail-grid">
          <DetailItem label="Contact person" value={booking.contactName} />
          <DetailItem label="NIK" value={booking.nik} />
          <DetailItem label="WhatsApp" value={booking.whatsapp} />
          <DetailItem label="Instansi" value={booking.institution} />
          <DetailItem label="Rombongan" value={`${booking.groupSize} orang`} />
          <DetailItem label="Jadwal" value={`${booking.dateLabel}, ${booking.time} WIB`} />
          <DocumentDetailItem
            label="Surat"
            documentName={booking.documentName}
            onPreview={() => onPreviewDocument(booking)}
            onDownload={() => onDownloadDocument(booking)}
          />
        </div>
        <BookingActions
          booking={booking}
          onAccept={onAccept}
          onReject={onReject}
          onReschedule={onReschedule}
          onMarkCompleted={onMarkCompleted}
          onConfirmReschedule={onConfirmReschedule}
          onCancelReschedule={onCancelReschedule}
          onResendReschedule={onResendReschedule}
        />
      </aside>
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (next: number) => void;
}) {
  // Compact pager with first/prev/next/last + sibling-aware numeric range.
  const pages: number[] = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, page + 2);
  for (let i = start; i <= end; i += 1) pages.push(i);

  return (
    <nav className="booking-pagination" aria-label="Pagination booking">
      <button
        type="button"
        onClick={() => onChange(1)}
        disabled={page === 1}
        aria-label="Halaman pertama"
      >
        <ChevronLeft size={14} aria-hidden="true" />
        <ChevronLeft size={14} aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={page === 1}
        aria-label="Halaman sebelumnya"
      >
        <ChevronLeft size={14} aria-hidden="true" />
      </button>
      {start > 1 && <span className="booking-pagination-gap">…</span>}
      {pages.map((p) => (
        <button
          key={p}
          type="button"
          aria-current={p === page ? "page" : undefined}
          className={p === page ? "is-current" : undefined}
          onClick={() => onChange(p)}
        >
          {p}
        </button>
      ))}
      {end < totalPages && <span className="booking-pagination-gap">…</span>}
      <button
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={page === totalPages}
        aria-label="Halaman selanjutnya"
      >
        <ChevronRight size={14} aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => onChange(totalPages)}
        disabled={page === totalPages}
        aria-label="Halaman terakhir"
      >
        <ChevronRight size={14} aria-hidden="true" />
        <ChevronRight size={14} aria-hidden="true" />
      </button>
    </nav>
  );
}


function AdminActionModal({
  modal,
  schedules,
  onClose,
  onConfirm,
}: {
  modal: { action: AdminAction; booking: Booking };
  schedules: VisitDay[];
  onClose: () => void;
  onConfirm: (action: AdminAction, booking: Booking, note: string, proposed?: string) => void;
}) {
  const [note, setNote] = useState("");
  const availableSlots = schedules.flatMap((day) =>
    day.slots
      .filter((slot) => slot.status === "Available")
      .map((slot) => `${day.label}, ${slot.time} WIB`),
  );
  const [proposed, setProposed] = useState(availableSlots[0] ?? "");
  const titleMap = {
    accept: "Setujui Booking",
    reject: "Tolak Booking",
    reschedule: "Tawarkan Reschedule",
  };
  const needsNote = modal.action !== "accept";

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal-card" role="dialog" aria-modal="true" aria-label={titleMap[modal.action]}>
        <button className="modal-close" type="button" onClick={onClose} aria-label="Tutup modal">
          <X size={18} aria-hidden="true" />
        </button>
        <h2>{titleMap[modal.action]}</h2>
        <p>{modal.booking.code} - {modal.booking.institution}</p>
        {modal.action === "reschedule" && (
          <label className="form-field">
            <span>Jadwal alternatif</span>
            <select value={proposed} onChange={(event) => setProposed(event.target.value)}>
              {availableSlots.map((slot) => (
                <option key={slot} value={slot}>
                  {slot}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="form-field">
          <span>{needsNote ? "Alasan" : "Catatan admin opsional"}</span>
          <textarea value={note} onChange={(event) => setNote(event.target.value)} />
        </label>
        <div className="modal-actions">
          <button className="button button-ghost" type="button" onClick={onClose}>
            Batal
          </button>
          <button
            className="button button-primary"
            type="button"
            disabled={needsNote && !note.trim()}
            onClick={() => onConfirm(modal.action, modal.booking, note, proposed)}
          >
            Konfirmasi & Buka WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
}

function DocumentDetailItem({
  label,
  documentName,
  onPreview,
  onDownload,
}: {
  label: string;
  documentName: string;
  onPreview: () => void;
  onDownload: () => void;
}) {
  // Icon picker keyed off the file extension. PDFs get the document icon,
  // anything else (jpg/png) gets the image icon. Keeps the row visually
  // honest about the kind of attachment being previewed.
  const ext = documentName.split(".").pop()?.toLowerCase() ?? "";
  const Icon = ext === "pdf" ? FileText : ImageIcon;

  return (
    <div className="detail-item detail-item--document">
      <span>{label}</span>
      <div className="document-detail-row">
        <button
          type="button"
          className="document-detail-link"
          onClick={onPreview}
          aria-label={`Pratinjau ${documentName}`}
        >
          <Icon size={16} aria-hidden="true" />
          <strong>{documentName}</strong>
        </button>
        <button
          type="button"
          className="document-detail-download"
          onClick={onDownload}
          aria-label={`Unduh ${documentName}`}
          title="Unduh surat"
        >
          <Download size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function DocumentPreviewModal({
  documentName,
  documentUrl,
  onClose,
  onDownload,
}: {
  documentName: string;
  documentUrl: string;
  onClose: () => void;
  onDownload: () => void;
}) {
  // Esc to dismiss, mirroring the slideover keyboard behaviour so admins can
  // breeze through pending bookings without leaving the keyboard.
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Render mode is decided from the actual asset URL extension, not the
  // displayed file name: in the demo every booking previews the shared
  // contoh-kop-surat.png even when documentName ends in .pdf.
  const urlExt = documentUrl.split(".").pop()?.toLowerCase() ?? "";
  const isPdf = urlExt === "pdf";
  const isImage = urlExt === "jpg" || urlExt === "jpeg" || urlExt === "png";

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-card document-preview-card"
        role="dialog"
        aria-modal="true"
        aria-label={`Pratinjau ${documentName}`}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          className="modal-close"
          type="button"
          onClick={onClose}
          aria-label="Tutup pratinjau"
        >
          <X size={18} aria-hidden="true" />
        </button>
        <header className="document-preview-head">
          <FileText size={18} aria-hidden="true" />
          <div>
            <h2>Pratinjau surat permohonan</h2>
            <p>{documentName}</p>
          </div>
        </header>
        <div className="document-preview-body">
          {isPdf && (
            <iframe
              title={`Pratinjau ${documentName}`}
              src={documentUrl}
              className="document-preview-frame"
            />
          )}
          {isImage && (
            <img
              src={documentUrl}
              alt={`Pratinjau ${documentName}`}
              className="document-preview-image"
            />
          )}
          {!isPdf && !isImage && (
            <div className="document-preview-fallback">
              <FileText size={32} aria-hidden="true" />
              <p>Format file tidak bisa ditampilkan langsung.</p>
              <p>Silakan unduh untuk membukanya di komputer.</p>
            </div>
          )}
        </div>
        <div className="document-preview-actions">
          <a
            className="button button-ghost"
            href={documentUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink size={16} aria-hidden="true" />
            Buka di tab baru
          </a>
          <button
            className="button button-primary"
            type="button"
            onClick={onDownload}
          >
            <Download size={16} aria-hidden="true" />
            Unduh
          </button>
        </div>
      </div>
    </div>
  );
}

function Footer({
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

export default App;

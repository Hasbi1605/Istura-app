import { useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type {
	AdminSession,
	AdminTab,
	Booking,
	BookingStatus,
	CmsSyncState,
	CmsSyncStatus,
	DataLoadingState,
	Feedback,
	FaqItem,
  FooterContact,
  Screen,
  SiteContent,
  VisitDay,
  WaTemplate,
} from "../domain/types";
import { DEFAULT_SITE_CONTENT, INITIAL_FAQ_ITEMS, INITIAL_FOOTER_CONTACTS, INITIAL_WA_TEMPLATES, letterChecklist, storyWords } from "../constants";
import { hasFreshBookingDraft } from "../lib/bookingDraft";
import { clearAdminSession, readAdminSession, readCmsCollection, writeCmsCollection } from "../lib/legacyShims";
import { ASSETS } from "../lib/assets";
import { setActiveWaTemplates } from "../lib/whatsapp";
import { me as apiMe, twoFactorChallenge, twoFactorStatus } from "../api/auth";
import { fetchAdminBooking, fetchAdminBookings } from "../api/bookings";
import { fetchAdminFeedbacks } from "../api/feedback";
import { fetchAdminSchedule, fetchPublicSchedule } from "../api/schedule";
import type { ApiBooking } from "../api/bookings";
import type { ApiFeedback } from "../api/feedback";
import {
  fetchPublicBootstrap,
  updateAdminContacts,
  updateAdminFaqs,
  updateAdminWaTemplates,
  type ApiHero,
  type ApiLetter,
} from "../api/cms";
import { apiBookingToLocal, apiFeedbackToLocal, apiVisitDayToLocal } from "../api/adapters";
import { ApiError, onAdminAuthFailure, resetCsrf } from "../api/client";
import type { RealtimeConnectionStatus } from "../realtime/echo";

export type FeedbackAccess = { code: string; token: string } | null;

const DEFAULT_HERO: ApiHero = {
  headline: "ISTURA - Istana Untuk Rakyat",
  subheadline: "Booking Kunjungan Istana Kepresidenan Yogyakarta",
  primaryCta: "Mulai Booking",
  secondaryCta: "Cek Jadwal",
  story: storyWords.join(" "),
};

const DEFAULT_LETTER: ApiLetter = {
  image: ASSETS.letterExample,
  checklist: letterChecklist,
};

// Seed the imperative WA template cache so createWhatsappMessage bekerja
// sebelum useEffect hydration pertama berjalan.
setActiveWaTemplates(INITIAL_WA_TEMPLATES);

const ALLOW_DEMO_FALLBACK = import.meta.env.DEV || import.meta.env.VITE_ALLOW_DEMO_FALLBACK === "true";
const PUBLIC_SCHEDULE_FALLBACK_INITIAL_JITTER_MS = 10_000;
const PUBLIC_SCHEDULE_FALLBACK_BASE_INTERVAL_MS = 45_000;
const PUBLIC_SCHEDULE_FALLBACK_MAX_INTERVAL_MS = 180_000;
const PUBLIC_SCHEDULE_FALLBACK_JITTER_MS = 15_000;
const PUBLIC_SCHEDULE_FALLBACK_FOCUS_MIN_MS = 30_000;
const PUBLIC_SCHEDULE_FALLBACK_STATUSES = new Set<RealtimeConnectionStatus>([
  "disabled",
  "unavailable",
  "failed",
  "disconnected",
]);

function shouldUsePublicScheduleFallback(status: RealtimeConnectionStatus): boolean {
  return import.meta.env.VITE_REVERB_ENABLED !== "true" || PUBLIC_SCHEDULE_FALLBACK_STATUSES.has(status);
}

function mergeWaTemplatesWithDefaults(templates: WaTemplate[]): WaTemplate[] {
  if (templates.length === 0) return [];

  const byId = new Map(templates.map((template) => [template.id, template]));
  const knownIds = new Set(INITIAL_WA_TEMPLATES.map((template) => template.id));

  return [
    ...INITIAL_WA_TEMPLATES.map((template) => byId.get(template.id) ?? template),
    ...templates.filter((template) => !knownIds.has(template.id)),
  ];
}

async function canFetchAdminData() {
  try {
    const { enabled } = await twoFactorStatus();
    if (!enabled) return false;

    const { requires_2fa } = await twoFactorChallenge();
    return !requires_2fa;
  } catch {
    return false;
  }
}

function isTwoFactorBlock(error: unknown) {
  if (!(error instanceof ApiError) || error.status !== 403) return false;
  if (!error.body || typeof error.body !== "object") return false;

  const body = error.body as { two_factor_required?: unknown; two_factor_setup_required?: unknown };
  return Boolean(body.two_factor_required || body.two_factor_setup_required);
}

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
  hero: ApiHero;
  setHero: Dispatch<SetStateAction<ApiHero>>;
  letter: ApiLetter;
  setLetter: Dispatch<SetStateAction<ApiLetter>>;
  siteContent: SiteContent;
  setSiteContent: Dispatch<SetStateAction<SiteContent>>;
  adminSession: AdminSession | null;
  setAdminSession: Dispatch<SetStateAction<AdminSession | null>>;
  adminTab: AdminTab;
  setAdminTab: Dispatch<SetStateAction<AdminTab>>;
	bookingFocusCode: string | null;
	setBookingFocusCode: Dispatch<SetStateAction<string | null>>;
	loading: DataLoadingState;
	cmsSync: CmsSyncState;
}

const initialLoading: DataLoadingState = {
  public: true,
  admin: false,
  schedule: true,
  bookings: false,
  feedbacks: false,
};

const initialCmsSync: CmsSyncState = {
  faqs: "idle",
  contacts: "idle",
  waTemplates: "idle",
};

const markCmsSync = (
  setCmsSync: Dispatch<SetStateAction<CmsSyncState>>,
  key: keyof CmsSyncState,
  status: CmsSyncStatus,
) => {
  setCmsSync((current) => ({ ...current, [key]: status }));
};

const mergeScheduleDays = (current: VisitDay[], incoming: VisitDay[]) => {
  const byDate = new Map(current.map((day) => [day.date, day]));
  incoming.forEach((day) => byDate.set(day.date, day));

  return Array.from(byDate.values()).sort((left, right) => left.date.localeCompare(right.date));
};

// Semua state global + efek (persistensi CMS, hydration API publik & admin,
// realtime, dan routing awal dari URL) dikemas di sini supaya App.tsx tetap
// jadi shell tipis. Perilaku tidak berubah dari versi inline sebelumnya.
export function useIsturaData(): IsturaData {
  const [screen, setScreen] = useState<Screen>(() => {
    if (typeof window !== "undefined") {
      if (window.location.pathname.startsWith("/admin")) return "admin";
      if (window.location.pathname.match(/^\/feedback\/([^/]+)\/?$/)) return "feedback";
    }

    return hasFreshBookingDraft() ? "booking" : "home";
  });
  const [schedules, setSchedules] = useState<VisitDay[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
	const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
	const [submittedCode, setSubmittedCode] = useState("");
	const [feedbackAccess, setFeedbackAccess] = useState<FeedbackAccess>(null);
	const [loading, setLoading] = useState<DataLoadingState>(initialLoading);
	const [cmsSync, setCmsSync] = useState<CmsSyncState>(initialCmsSync);

  // CMS-managed content. Persisted to localStorage so admin edits survive
  // refresh while we wait for a real backend.
  const [faqs, setFaqs] = useState<FaqItem[]>(() =>
    readCmsCollection("istura-faqs", ALLOW_DEMO_FALLBACK ? INITIAL_FAQ_ITEMS : []),
  );
  const [contacts, setContacts] = useState<FooterContact[]>(() =>
    readCmsCollection("istura-contacts", ALLOW_DEMO_FALLBACK ? INITIAL_FOOTER_CONTACTS : []),
  );
  const [waTemplates, setWaTemplates] = useState<WaTemplate[]>(() =>
    mergeWaTemplatesWithDefaults(
      readCmsCollection("istura-wa-templates", ALLOW_DEMO_FALLBACK ? INITIAL_WA_TEMPLATES : []),
    ),
  );

  // Hero & letter CMS content (read-only on public side, edited via admin).
  const [hero, setHero] = useState<ApiHero>(DEFAULT_HERO);
  const [letter, setLetter] = useState<ApiLetter>(DEFAULT_LETTER);
  const [siteContent, setSiteContent] = useState<SiteContent>(DEFAULT_SITE_CONTENT);

  // Refs untuk membedakan "data baru dari API" (jangan push balik ke API)
  // vs "user mengubah dari UI" (push ke API). Diset true di useEffect
  // hydration setelah fetch selesai.
  const faqsHydratedRef = useRef(false);
  const contactsHydratedRef = useRef(false);
  const waHydratedRef = useRef(false);
  const faqsBaselineRef = useRef<string | null>(null);
  const contactsBaselineRef = useRef<string | null>(null);
  const waBaselineRef = useRef<string | null>(null);

  // Admin auth + UI state. Sesi dijaga oleh Sanctum cookie di server; state
  // ini hanya snapshot di memori untuk render cepat.
  const [adminSession, setAdminSession] = useState<AdminSession | null>(() => readAdminSession());
  const [adminTab, setAdminTab] = useState<AdminTab>("dashboard");
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeConnectionStatus>(
    import.meta.env.VITE_REVERB_ENABLED === "true" ? "idle" : "disabled",
  );
  // Komunikasi antar tab admin: misal Jadwal Kunjungan ingin mengarahkan
  // admin ke booking tertentu di tab Booking.
  const [bookingFocusCode, setBookingFocusCode] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;

    void import("../realtime/echo").then(({ subscribeRealtimeStatus }) => {
      if (!active) return;
      unsubscribe = subscribeRealtimeStatus(setRealtimeStatus);
    });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  useEffect(() => onAdminAuthFailure(() => {
    clearAdminSession();
    resetCsrf();
    void import("../realtime/echo").then(({ destroyEcho }) => destroyEcho());
    setAdminSession(null);
    setAdminTab("dashboard");
    setBookingFocusCode(null);
    setBookings([]);
    setFeedbacks([]);
    setLoading((current) => ({
      ...current,
      admin: false,
      bookings: false,
      feedbacks: false,
    }));
  }), []);

  useEffect(() => {
		writeCmsCollection("istura-faqs", faqs);
		if (!faqsHydratedRef.current) return;
		if (!adminSession) return;
		const serialized = JSON.stringify(faqs);
		if (faqsBaselineRef.current === serialized) return;
		markCmsSync(setCmsSync, "faqs", "saving");
		void updateAdminFaqs(
			faqs.map((f) => ({
        id: f.id,
        question: f.question,
        answer: f.answer,
        category: null,
        ...(f.link ? { link: f.link } : {}),
      })),
		)
			.then(() => {
          faqsBaselineRef.current = serialized;
          markCmsSync(setCmsSync, "faqs", "saved");
        })
			.catch(() => markCmsSync(setCmsSync, "faqs", "error"));
	}, [faqs, adminSession]);

  useEffect(() => {
		writeCmsCollection("istura-contacts", contacts);
		if (!contactsHydratedRef.current) return;
		if (!adminSession) return;
		const serialized = JSON.stringify(contacts);
		if (contactsBaselineRef.current === serialized) return;
		markCmsSync(setCmsSync, "contacts", "saving");
		void updateAdminContacts(
      contacts.map((c) => ({
        id: (c as unknown as { id?: string }).id ?? c.iconKey,
        label: c.label,
        value: c.value,
        href: c.href,
        iconKey: c.iconKey,
      })),
		)
			.then(() => {
          contactsBaselineRef.current = serialized;
          markCmsSync(setCmsSync, "contacts", "saved");
        })
			.catch(() => markCmsSync(setCmsSync, "contacts", "error"));
	}, [contacts, adminSession]);

  useEffect(() => {
    writeCmsCollection("istura-wa-templates", waTemplates);
		setActiveWaTemplates(waTemplates);
		if (!waHydratedRef.current) return;
		if (!adminSession) return;
		const serialized = JSON.stringify(waTemplates);
		if (waBaselineRef.current === serialized) return;
		markCmsSync(setCmsSync, "waTemplates", "saving");
		void updateAdminWaTemplates(
      waTemplates.map((t) => ({
        id: t.id,
        label: t.label,
        description: t.description,
        template: t.template,
      })),
		)
			.then(() => {
          waBaselineRef.current = serialized;
          markCmsSync(setCmsSync, "waTemplates", "saved");
        })
			.catch(() => markCmsSync(setCmsSync, "waTemplates", "error"));
	}, [waTemplates, adminSession]);

  // ---- API hydration ----------------------------------------------------
  // Bootstrap data dari Laravel API saat komponen mount. Data demo hanya
  // dipakai saat dev/env mengizinkan; produksi harus mengikuti API.
	useEffect(() => {
		let cancelled = false;
		setLoading((current) => ({ ...current, public: true, schedule: true }));
		if (window.location.pathname.startsWith("/admin") || adminSession) {
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
		}

		fetchPublicBootstrap()
      .then((data) => {
        if (cancelled) return;

        setSchedules(data.schedule.map(apiVisitDayToLocal));

        if (data.faqs.length > 0) {
          const nextFaqs = data.faqs.map((it) => ({
              id: it.id,
              question: it.question,
              answer: it.answer,
              ...(it.link ? { link: it.link } : {}),
            })) as FaqItem[];
          faqsBaselineRef.current = JSON.stringify(nextFaqs);
          setFaqs(nextFaqs);
        } else if (!ALLOW_DEMO_FALLBACK) {
          faqsBaselineRef.current = JSON.stringify([]);
          setFaqs([]);
        } else {
          faqsBaselineRef.current = JSON.stringify(faqs);
        }

        if (data.contacts.length > 0) {
          const nextContacts = data.contacts.map((it) => ({
              label: it.label,
              value: it.value,
              href: it.href ?? "",
              iconKey: it.iconKey,
            }));
          contactsBaselineRef.current = JSON.stringify(nextContacts);
          setContacts(nextContacts);
        } else if (!ALLOW_DEMO_FALLBACK) {
          contactsBaselineRef.current = JSON.stringify([]);
          setContacts([]);
        } else {
          contactsBaselineRef.current = JSON.stringify(contacts);
        }

        if (data.waTemplates.length > 0) {
          const nextWaTemplates = mergeWaTemplatesWithDefaults(data.waTemplates.map((it) => ({
              id: it.id as BookingStatus,
              label: it.label,
              description: it.description,
              template: it.template,
            })));
          waBaselineRef.current = JSON.stringify(nextWaTemplates);
          setWaTemplates(nextWaTemplates);
        } else if (!ALLOW_DEMO_FALLBACK) {
          waBaselineRef.current = JSON.stringify([]);
          setWaTemplates([]);
        } else {
          waBaselineRef.current = JSON.stringify(waTemplates);
        }

        if (data.hero) setHero(data.hero);
        if (data.letter) setLetter(data.letter);
        if (data.siteContent) setSiteContent(data.siteContent);

        requestAnimationFrame(() => {
          faqsHydratedRef.current = true;
          contactsHydratedRef.current = true;
          waHydratedRef.current = true;
        });
      })
			.catch(() => {
				if (!cancelled && !ALLOW_DEMO_FALLBACK) {
					setSchedules([]);
					setFaqs([]);
					setContacts([]);
					setWaTemplates([]);
				}
				faqsBaselineRef.current = JSON.stringify(ALLOW_DEMO_FALLBACK ? faqs : []);
				contactsBaselineRef.current = JSON.stringify(ALLOW_DEMO_FALLBACK ? contacts : []);
				if (!ALLOW_DEMO_FALLBACK) setWaTemplates([]);
				waBaselineRef.current = JSON.stringify(ALLOW_DEMO_FALLBACK ? waTemplates : []);
				faqsHydratedRef.current = true;
				contactsHydratedRef.current = true;
				waHydratedRef.current = true;
			})
			.finally(() => {
				if (!cancelled) setLoading((current) => ({ ...current, public: false, schedule: false }));
			});

    return () => {
      cancelled = true;
    };
  }, []);

  // Admin-only data: bookings + feedbacks. Hydrate ketika sesi admin aktif.
	useEffect(() => {
		if (!adminSession) {
			setLoading((current) => ({
				...current,
				admin: false,
				bookings: false,
				feedbacks: false,
			}));
			return;
		}
		let cancelled = false;
		let pendingAdminRequests = 3;
		setLoading((current) => ({
			...current,
			admin: true,
			bookings: true,
			feedbacks: true,
			schedule: true,
		}));
		const finishAdminRequest = () => {
			pendingAdminRequests -= 1;
			if (!cancelled && pendingAdminRequests <= 0) {
				setLoading((current) => ({ ...current, admin: false }));
			}
		};
		void canFetchAdminData().then((allowed) => {
			if (cancelled) return;
			if (!allowed) {
				setLoading((current) => ({
					...current,
					admin: false,
					bookings: false,
					feedbacks: false,
					schedule: false,
				}));
				return;
			}
			fetchAdminBookings()
				.then((items) => {
					if (cancelled) return;
					setBookings(items.map(apiBookingToLocal));
				})
			.catch((err) => {
				if (!cancelled && !ALLOW_DEMO_FALLBACK && !isTwoFactorBlock(err)) setBookings([]);
			})
			.finally(() => {
				if (!cancelled) setLoading((current) => ({ ...current, bookings: false }));
				finishAdminRequest();
			});
			fetchAdminFeedbacks()
				.then((items) => {
					if (cancelled) return;
					setFeedbacks(items.map(apiFeedbackToLocal));
				})
			.catch((err) => {
				if (!cancelled && !ALLOW_DEMO_FALLBACK && !isTwoFactorBlock(err)) setFeedbacks([]);
			})
			.finally(() => {
				if (!cancelled) setLoading((current) => ({ ...current, feedbacks: false }));
				finishAdminRequest();
			});
			fetchAdminSchedule()
				.then((days) => {
					if (!cancelled) setSchedules(days.map(apiVisitDayToLocal));
				})
			.catch((err) => {
				if (!cancelled && !ALLOW_DEMO_FALLBACK && !isTwoFactorBlock(err)) setSchedules([]);
			})
			.finally(() => {
				if (!cancelled) setLoading((current) => ({ ...current, schedule: false }));
				finishAdminRequest();
			});
		});
    return () => {
      cancelled = true;
    };
  }, [adminSession]);

  // Realtime: jadwal publik ikut berubah saat admin membuka/menutup slot.
  useEffect(() => {
    if (loading.public || import.meta.env.VITE_REVERB_ENABLED !== "true") return;

    let active = true;
    let cleanup: (() => void) | undefined;
    const refreshSchedule = (payload?: { from?: string; to?: string }) => {
      setLoading((current) => ({ ...current, schedule: true }));
      const fetcher = adminSession ? fetchAdminSchedule : fetchPublicSchedule;
      fetcher(payload?.from, payload?.to)
        .then((days) => {
          if (!active) return;
          const nextDays = days.map(apiVisitDayToLocal);
          setSchedules((current) => (payload?.from ? mergeScheduleDays(current, nextDays) : nextDays));
        })
        .catch(() => {})
        .finally(() => {
          if (active) setLoading((current) => ({ ...current, schedule: false }));
        });
    };
    const subscriptionDelay = adminSession ? 250 : 1800;
    const timerId = window.setTimeout(() => {
      void import("../realtime/echo").then(({ getEcho, PUBLIC_SCHEDULE_CHANNEL }) => {
        if (!active) return;
        const echo = getEcho();
        if (!echo) return;
        const channel = echo.channel(PUBLIC_SCHEDULE_CHANNEL);
        channel.listen(".schedule.updated", refreshSchedule);
        cleanup = () => {
          try {
            channel.stopListening(".schedule.updated");
            echo.leave(PUBLIC_SCHEDULE_CHANNEL);
          } catch {
            /* ignore */
          }
        };
      });
    }, subscriptionDelay);

    return () => {
      active = false;
      window.clearTimeout(timerId);
      cleanup?.();
    };
  }, [adminSession, loading.public]);

  // Fallback agar public tetap auto-sync saat WebSocket/Reverb belum tersambung
  // atau service realtime production sedang restart.
  useEffect(() => {
    if (adminSession || loading.public || !shouldUsePublicScheduleFallback(realtimeStatus)) return;

    let active = true;
    let inFlight = false;
    let failureCount = 0;
    let lastRefreshAt = 0;
    let timeoutId: number | undefined;

    const nextDelay = () => {
      const backoffDelay = Math.min(
        PUBLIC_SCHEDULE_FALLBACK_MAX_INTERVAL_MS,
        PUBLIC_SCHEDULE_FALLBACK_BASE_INTERVAL_MS * 2 ** Math.min(failureCount, 2),
      );
      return backoffDelay + Math.floor(Math.random() * PUBLIC_SCHEDULE_FALLBACK_JITTER_MS);
    };

    const queueNextRefresh = (delay: number) => {
      if (!active) return;
      timeoutId = window.setTimeout(() => refreshPublicSchedule("timer"), delay);
    };

    const refreshPublicSchedule = (reason: "timer" | "focus" | "visibility") => {
      if (inFlight || document.visibilityState === "hidden") {
        if (reason === "timer") queueNextRefresh(nextDelay());
        return;
      }

      if (reason !== "timer" && Date.now() - lastRefreshAt < PUBLIC_SCHEDULE_FALLBACK_FOCUS_MIN_MS) return;

      inFlight = true;
      lastRefreshAt = Date.now();
      fetchPublicSchedule()
        .then((days) => {
          if (!active) return;
          failureCount = 0;
          setSchedules(days.map(apiVisitDayToLocal));
        })
        .catch(() => {
          failureCount = Math.min(failureCount + 1, 3);
        })
        .finally(() => {
          inFlight = false;
          if (active && reason === "timer") queueNextRefresh(nextDelay());
        });
    };

    queueNextRefresh(Math.floor(Math.random() * PUBLIC_SCHEDULE_FALLBACK_INITIAL_JITTER_MS));
    const handleVisibility = () => {
      if (document.visibilityState === "visible") refreshPublicSchedule("visibility");
    };
    const handleFocus = () => refreshPublicSchedule("focus");

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleFocus);

    return () => {
      active = false;
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleFocus);
    };
  }, [adminSession, loading.public, realtimeStatus]);

  // Realtime: subscribe ke channel admin.bookings ketika admin login.
  useEffect(() => {
    if (!adminSession) return;
    let active = true;
    let cleanup: (() => void) | undefined;
    const refreshSchedule = (from?: string, to?: string) => {
      fetchAdminSchedule(from, to)
        .then((days) => {
          if (!active) return;
          const nextDays = days.map(apiVisitDayToLocal);
          setSchedules((current) => (from ? mergeScheduleDays(current, nextDays) : nextDays));
        })
        .catch(() => {});
    };
    const refreshBookingSchedule = (booking: Booking) => {
      const dates = (booking.segments?.map((segment) => segment.date) ?? [booking.date]).sort();
      if (dates.length === 0) {
        refreshSchedule();
        return;
      }

      refreshSchedule(dates[0], dates[dates.length - 1]);
    };
    const upsertBooking = (booking: Booking) => {
      setBookings((prev) => {
        const idx = prev.findIndex((b) => b.code === booking.code);
        if (idx >= 0) {
          const copy = prev.slice();
          copy[idx] = booking;
          return copy;
        }
        return [booking, ...prev];
      });
    };
    const hydrateAdminBooking = (payload: { booking: ApiBooking }) => {
      const fallback = apiBookingToLocal(payload.booking);
      upsertBooking(fallback);
      fetchAdminBooking(fallback.code)
        .then((booking) => {
          if (active) upsertBooking(apiBookingToLocal(booking));
        })
        .catch(() => {});
    };
    const onCreated = (payload: { booking: ApiBooking }) => {
      const fallback = apiBookingToLocal(payload.booking);
      hydrateAdminBooking(payload);
      refreshBookingSchedule(fallback);
    };
    const onChanged = (payload: { booking: ApiBooking }) => {
      const fallback = apiBookingToLocal(payload.booking);
      hydrateAdminBooking(payload);
      refreshBookingSchedule(fallback);
    };
    const onFeedback = (payload: { feedback: ApiFeedback }) => {
      setFeedbacks((prev) => {
        const next = apiFeedbackToLocal(payload.feedback);
        if (prev.some((f) => f.code === next.code)) return prev;
        return [next, ...prev];
      });
    };
    void import("../realtime/echo").then(({ getEcho, ADMIN_BOOKINGS_CHANNEL }) => {
      if (!active) return;
      const echo = getEcho();
      if (!echo) return;
      const channel = echo.private(ADMIN_BOOKINGS_CHANNEL);
      channel.listen(".booking.created", onCreated);
      channel.listen(".booking.status-changed", onChanged);
      channel.listen(".feedback.submitted", onFeedback);
      cleanup = () => {
        try {
          channel.stopListening(".booking.created");
          channel.stopListening(".booking.status-changed");
          channel.stopListening(".feedback.submitted");
          echo.leave(`private-${ADMIN_BOOKINGS_CHANNEL}`);
        } catch {
          /* ignore */
        }
      };
    });
    return () => {
      active = false;
      cleanup?.();
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
    hero,
    setHero,
    letter,
    setLetter,
    siteContent,
    setSiteContent,
    adminSession,
    setAdminSession,
    adminTab,
    setAdminTab,
		bookingFocusCode,
		setBookingFocusCode,
		loading,
		cmsSync,
	};
}

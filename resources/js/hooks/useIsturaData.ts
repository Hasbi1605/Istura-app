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
import { clearAdminSession, readAdminSession, readCmsCollection, writeCmsCollection } from "../lib/legacyShims";
import { ASSETS } from "../lib/assets";
import { setActiveWaTemplates } from "../lib/whatsapp";
import { me as apiMe } from "../api/auth";
import { fetchAdminBooking, fetchAdminBookings } from "../api/bookings";
import { fetchAdminFeedbacks } from "../api/feedback";
import { fetchAdminSchedule, fetchPublicSchedule } from "../api/schedule";
import type { ApiBooking } from "../api/bookings";
import type { ApiFeedback } from "../api/feedback";
import {
  fetchPublicContacts,
  fetchPublicFaqs,
  fetchPublicHero,
  fetchPublicLetter,
  fetchPublicSiteContent,
  fetchPublicWaTemplates,
  updateAdminContacts,
  updateAdminFaqs,
  updateAdminWaTemplates,
  type ApiHero,
  type ApiLetter,
} from "../api/cms";
import { ADMIN_BOOKINGS_CHANNEL, PUBLIC_SCHEDULE_CHANNEL, destroyEcho, getEcho } from "../realtime/echo";
import { apiBookingToLocal, apiFeedbackToLocal, apiVisitDayToLocal } from "../api/adapters";
import { onAdminAuthFailure, resetCsrf } from "../api/client";

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
  const [screen, setScreen] = useState<Screen>("home");
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
    readCmsCollection("istura-wa-templates", ALLOW_DEMO_FALLBACK ? INITIAL_WA_TEMPLATES : []),
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
  // Komunikasi antar tab admin: misal Jadwal Kunjungan ingin mengarahkan
  // admin ke booking tertentu di tab Booking.
  const [bookingFocusCode, setBookingFocusCode] = useState<string | null>(null);

  useEffect(() => onAdminAuthFailure(() => {
    clearAdminSession();
    resetCsrf();
    destroyEcho();
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
        id: t.id as "Accepted" | "Rejected" | "Reschedule" | "Completed",
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
		let pendingPublicRequests = 7;
		setLoading((current) => ({ ...current, public: true, schedule: true }));
		const finishPublicRequest = () => {
			pendingPublicRequests -= 1;
			if (!cancelled && pendingPublicRequests <= 0) {
				setLoading((current) => ({ ...current, public: false }));
			}
		};
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

		fetchPublicSchedule()
			.then((days) => {
				if (!cancelled) setSchedules(days.map(apiVisitDayToLocal));
			})
			.catch(() => {
				if (!cancelled && !ALLOW_DEMO_FALLBACK) setSchedules([]);
			})
			.finally(() => {
				if (!cancelled) setLoading((current) => ({ ...current, schedule: false }));
				finishPublicRequest();
			});

		fetchPublicFaqs()
      .then((items) => {
        if (cancelled) return;
        if (items.length > 0) {
          const nextFaqs = items.map((it) => ({
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
        // Use rAF to set hydrated flag AFTER the state update has flushed,
        // so the persistence effect can detect "hydrated" reliably.
        requestAnimationFrame(() => {
          faqsHydratedRef.current = true;
        });
      })
			.catch(() => {
				if (!ALLOW_DEMO_FALLBACK) setFaqs([]);
				faqsBaselineRef.current = JSON.stringify(ALLOW_DEMO_FALLBACK ? faqs : []);
				faqsHydratedRef.current = true;
			})
			.finally(finishPublicRequest);

		fetchPublicContacts()
      .then((items) => {
        if (cancelled) return;
        if (items.length > 0) {
          const nextContacts = items.map((it) => ({
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
        requestAnimationFrame(() => {
          contactsHydratedRef.current = true;
        });
      })
			.catch(() => {
				if (!ALLOW_DEMO_FALLBACK) setContacts([]);
				contactsBaselineRef.current = JSON.stringify(ALLOW_DEMO_FALLBACK ? contacts : []);
				contactsHydratedRef.current = true;
			})
			.finally(finishPublicRequest);

		fetchPublicWaTemplates()
      .then((items) => {
        if (cancelled) return;
        if (items.length > 0) {
          const nextWaTemplates = items.map((it) => ({
              id: it.id as BookingStatus,
              label: it.label,
              description: it.description,
              template: it.template,
            }));
          waBaselineRef.current = JSON.stringify(nextWaTemplates);
          setWaTemplates(nextWaTemplates);
        } else if (!ALLOW_DEMO_FALLBACK) {
          waBaselineRef.current = JSON.stringify([]);
          setWaTemplates([]);
        } else {
          waBaselineRef.current = JSON.stringify(waTemplates);
        }
        requestAnimationFrame(() => {
          waHydratedRef.current = true;
        });
      })
			.catch(() => {
				if (!ALLOW_DEMO_FALLBACK) setWaTemplates([]);
				waBaselineRef.current = JSON.stringify(ALLOW_DEMO_FALLBACK ? waTemplates : []);
				waHydratedRef.current = true;
			})
			.finally(finishPublicRequest);

		fetchPublicHero()
			.then((data) => {
				if (!cancelled && data) setHero(data);
			})
			.catch(() => {})
			.finally(finishPublicRequest);

		fetchPublicLetter()
			.then((data) => {
				if (!cancelled && data) setLetter(data);
			})
			.catch(() => {})
			.finally(finishPublicRequest);

		fetchPublicSiteContent()
			.then((data) => {
				if (!cancelled && data) setSiteContent(data);
			})
			.catch(() => {})
			.finally(finishPublicRequest);

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
		fetchAdminBookings()
      .then((items) => {
        if (cancelled) return;
        setBookings(items.map(apiBookingToLocal));
      })
			.catch(() => {
				if (!cancelled && !ALLOW_DEMO_FALLBACK) setBookings([]);
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
			.catch(() => {
				if (!cancelled && !ALLOW_DEMO_FALLBACK) setFeedbacks([]);
			})
			.finally(() => {
				if (!cancelled) setLoading((current) => ({ ...current, feedbacks: false }));
				finishAdminRequest();
			});
		fetchAdminSchedule()
      .then((days) => {
        if (!cancelled) setSchedules(days.map(apiVisitDayToLocal));
      })
			.catch(() => {
				if (!cancelled && !ALLOW_DEMO_FALLBACK) setSchedules([]);
			})
			.finally(() => {
				if (!cancelled) setLoading((current) => ({ ...current, schedule: false }));
				finishAdminRequest();
			});
    return () => {
      cancelled = true;
    };
  }, [adminSession]);

  // Realtime: jadwal publik ikut berubah saat admin membuka/menutup slot.
  useEffect(() => {
    const echo = getEcho();
    if (!echo) return;
    let active = true;
    const channel = echo.channel(PUBLIC_SCHEDULE_CHANNEL);
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
    channel.listen(".schedule.updated", refreshSchedule);
    return () => {
      active = false;
      try {
        channel.stopListening(".schedule.updated");
        echo.leave(PUBLIC_SCHEDULE_CHANNEL);
      } catch {
        /* ignore */
      }
    };
  }, [adminSession]);

  // Realtime: subscribe ke channel admin.bookings ketika admin login.
  useEffect(() => {
    if (!adminSession) return;
    const echo = getEcho();
    if (!echo) return;
    let active = true;
    const channel = echo.private(ADMIN_BOOKINGS_CHANNEL);
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
    channel.listen(".booking.created", onCreated);
    channel.listen(".booking.status-changed", onChanged);
    channel.listen(".feedback.submitted", onFeedback);
    return () => {
      active = false;
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

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileCheck2,
  Image as ImageIcon,
  MapPin,
  MessageCircle,
  PenLine,
  UploadCloud,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { FaqItem, FooterContact, LandingIconKey, Screen, SiteContent, Slot, VisitDay } from "../../domain/types";
import type { ApiHero, ApiLetter } from "../../api/cms";
import {
  addDays,
  addMonths,
  calendarWeekdays,
  createCalendarDays,
  formatDateKey,
  formatLongDate,
  formatMonthTitle,
  getPublicDateStatus,
  jakartaToday,
  isSameMonth,
  isWithinRange,
  legendStatuses,
  parseDateKey,
  publicSlotStatusLabel,
  publicSlotStatusToClass,
  publicStatusMeta,
  startOfMonth,
} from "../../lib/date";
import { ASSETS } from "../../lib/assets";
import {
  HERO_MESSAGES,
  HERO_MESSAGES_MOBILE,
} from "../../constants";
import { useMediaQuery, useReducedMotion, useTypewriter } from "../../hooks";
import { Footer } from "../layout/Footer";
import { InlineSpinner, SectionSkeleton } from "../ui/LoadingStates";

const hasAvailableSlot = (day: VisitDay) => day.slots.some((slot) => slot.status === "Available");
const warmedImages = new Set<string>();

function closureReasonLabel(day?: VisitDay): string | null {
  return day?.closureReason?.label ?? day?.holiday?.label ?? null;
}

function closureReasonBadge(day?: VisitDay): string | null {
  const type = day?.closureReason?.type ?? day?.holiday?.type;
  if (type === "national_holiday" || type === "collective_leave" || type === "operational_closed") {
    return "Libur";
  }

  return null;
}

function slotClosureLabel(slot: Slot, day?: VisitDay): string | null {
  const type = slot.closureReason?.type ?? day?.closureReason?.type ?? day?.holiday?.type;
  if (type === "national_holiday") return "Libur Nasional";
  if (type === "collective_leave") return "Cuti Bersama";
  if (type === "operational_closed") return "Ditutup admin";
  return slot.closureReason?.label ?? closureReasonLabel(day);
}

function warmImage(src?: string) {
  if (!src || warmedImages.has(src) || typeof window === "undefined") return;
  warmedImages.add(src);
  const img = new Image();
  img.decoding = "async";
  img.src = src;
}

const landingIconMap: Record<LandingIconKey, LucideIcon> = {
  clock: Clock3,
  "file-check": FileCheck2,
  "message-circle": MessageCircle,
  calendar: CalendarDays,
  pen: PenLine,
  upload: UploadCloud,
  "map-pin": MapPin,
  image: ImageIcon,
};

const videoEmbedUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be")) {
      const id = parsed.pathname.replace(/^\//, "");
      return `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1`;
    }
    if (parsed.hostname.includes("youtube.com") && !parsed.pathname.startsWith("/embed/")) {
      const id = parsed.searchParams.get("v");
      const start = parsed.searchParams.get("t") ?? parsed.searchParams.get("start");
      const startQuery = start ? `&start=${start.replace(/s$/, "")}` : "";
      if (id) return `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1${startQuery}`;
    }
  } catch {
    return url;
  }
  return url;
};

const isInsideScheduleWindow = (dateKey: string, minDate: Date, maxDate: Date) => {
  const date = parseDateKey(dateKey);

  return isWithinRange(date, minDate, maxDate);
};

const firstAvailableDateKey = (
  schedules: VisitDay[],
  minDate: Date,
  maxDate: Date,
  visibleMonth?: Date,
) =>
  schedules.find((day) => {
    const date = parseDateKey(day.date);

    return (
      hasAvailableSlot(day) &&
      isWithinRange(date, minDate, maxDate) &&
      (!visibleMonth || isSameMonth(date, visibleMonth))
    );
  })?.date;

const firstScheduleDateKey = (
  schedules: VisitDay[],
  minDate: Date,
  maxDate: Date,
  visibleMonth: Date,
) =>
  schedules.find((day) => {
    const date = parseDateKey(day.date);

    return isWithinRange(date, minDate, maxDate) && isSameMonth(date, visibleMonth);
  })?.date;

const fallbackDateKeyForMonth = (month: Date, minDate: Date, maxDate: Date) => {
  const monthStart = startOfMonth(month);
  const date = new Date(Math.max(minDate.getTime(), monthStart.getTime()));

  return formatDateKey(new Date(Math.min(date.getTime(), maxDate.getTime())));
};

export function HomeScreen({
  contacts,
  faqs,
  schedules,
  hero,
	letter,
	siteContent,
	loading = false,
	onNavigate,
}: {
  contacts: FooterContact[];
  faqs: FaqItem[];
  schedules: VisitDay[];
  hero: ApiHero;
	letter: ApiLetter;
	siteContent: SiteContent;
	loading?: boolean;
	onNavigate: (screen: Screen) => void;
}) {
  const [today] = useState(jakartaToday);
  const minPublicDate = useMemo(() => addDays(today, 2), [today]);
  const maxScheduleDate = addMonths(today, 2);
  const minMonth = startOfMonth(minPublicDate);
  const maxMonth = startOfMonth(maxScheduleDate);
  const [visibleMonth, setVisibleMonth] = useState(() => minMonth);
  const scheduleByKey = useMemo(
    () => new Map(schedules.map((day) => [day.date, day] as const)),
    [schedules],
  );
  const scheduleSignature = useMemo(
    () => schedules.map((day) => `${day.date}:${day.slots.map((slot) => slot.status).join(".")}`).join("|"),
    [schedules],
  );
  const lastScheduleSyncRef = useRef("");
  const [selectedDateKey, setSelectedDateKey] = useState(() => formatDateKey(minPublicDate));
  const calendarDays = createCalendarDays(visibleMonth, minPublicDate, maxScheduleDate, scheduleByKey);
  const selectedDate = parseDateKey(selectedDateKey);
  const selectedStatus = getPublicDateStatus(
    selectedDate,
    minPublicDate,
    maxScheduleDate,
    startOfMonth(selectedDate),
    scheduleByKey,
  );
  const selectedStatusMeta = publicStatusMeta[selectedStatus];
  const selectedDay = scheduleByKey.get(selectedDateKey);
  const selectedClosureLabel = closureReasonLabel(selectedDay);
  const canGoPrev = visibleMonth > minMonth;
  const canGoNext = visibleMonth < maxMonth;

  useEffect(() => {
    if (schedules.length === 0 || lastScheduleSyncRef.current === scheduleSignature) return;
    lastScheduleSyncRef.current = scheduleSignature;

    const selectedIsAvailable = Boolean(selectedDay && hasAvailableSlot(selectedDay));
    if (selectedIsAvailable && isInsideScheduleWindow(selectedDateKey, minPublicDate, maxScheduleDate)) {
      return;
    }

    const nextDateKey =
      firstAvailableDateKey(schedules, minPublicDate, maxScheduleDate) ??
      firstScheduleDateKey(schedules, minPublicDate, maxScheduleDate, visibleMonth) ??
      formatDateKey(minPublicDate);

    setSelectedDateKey(nextDateKey);
    setVisibleMonth(startOfMonth(parseDateKey(nextDateKey)));
  }, [maxScheduleDate, minPublicDate, scheduleSignature, schedules, selectedDateKey, selectedDay, visibleMonth]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      const urls = new Set<string>([
        ...HERO_MESSAGES.map((item) => item.image),
        ...HERO_MESSAGES_MOBILE.map((item) => item.image),
        letter.image || ASSETS.letterExample,
        siteContent.cta.backgroundImage,
        ...siteContent.activities.items.map((item) => item.image),
      ]);
      urls.forEach(warmImage);
    }, 1200);

    return () => window.clearTimeout(id);
  }, [letter.image, siteContent.activities.items, siteContent.cta.backgroundImage]);

  const handleMonthChange = (amount: number) => {
    const nextMonth = startOfMonth(addMonths(visibleMonth, amount));
    if (nextMonth < minMonth || nextMonth > maxMonth) {
      return;
    }

    setVisibleMonth(nextMonth);
    setSelectedDateKey(
      firstAvailableDateKey(schedules, minPublicDate, maxScheduleDate, nextMonth) ??
        firstScheduleDateKey(schedules, minPublicDate, maxScheduleDate, nextMonth) ??
        fallbackDateKeyForMonth(nextMonth, minPublicDate, maxScheduleDate),
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
          <h1>{hero.headline}</h1>
          <p>{hero.subheadline}</p>
          <div className="hero-actions" aria-label="Aksi utama">
            <button className="button button-primary" type="button" onClick={() => onNavigate("booking")}>
              {hero.primaryCta}
              <ArrowRight size={18} aria-hidden="true" />
            </button>
            <a className="button button-secondary" href="#panduan">
              {hero.secondaryCta}
            </a>
          </div>
        </div>
        <div className="hero-visual">
          <HeroStage />
        </div>
      </section>

		<section className="chapter interest schedule-showcase" id="panduan">
			<div className="schedule-title">
				<h2>{siteContent.schedule.title}</h2>
				<p>{siteContent.schedule.description}</p>
				{loading && <InlineSpinner label="Memuat jadwal terbaru" />}
			</div>

			{loading && schedules.length === 0 ? (
				<div className="availability-layout availability-layout--loading" aria-busy="true">
					<section className="calendar-card" aria-label="Memuat kalender ketersediaan jadwal">
						<SectionSkeleton rows={8} />
					</section>
					<section className="time-card" aria-label="Memuat pilihan jam kunjungan">
						<SectionSkeleton rows={5} />
					</section>
				</div>
			) : (
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
              {calendarDays.map((day) => {
                const dayData = scheduleByKey.get(day.key);
                const dayClosureLabel = closureReasonLabel(dayData);
                const dayClosureBadge = closureReasonBadge(dayData);
                const statusLabel = day.status === "available"
                  ? publicStatusMeta.available.label
                  : dayClosureLabel ?? publicStatusMeta[day.status].label;
                const ariaLabel = dayData
                  ? `${dayData.label}, ${statusLabel}`
                  : `${formatLongDate(day.date)}, ${publicStatusMeta[day.status].label}`;

                return (
                  <button
                    className={`calendar-day is-${day.status}${day.key === selectedDateKey ? " is-selected" : ""}`}
                    type="button"
                    key={day.key}
                    disabled={day.status === "outside"}
                    onClick={() => setSelectedDateKey(day.key)}
                    aria-label={ariaLabel}
                    aria-pressed={day.key === selectedDateKey}
                    title={dayClosureLabel ?? undefined}
                  >
                    <span className="calendar-day-number">{day.date.getDate()}</span>
                    {dayClosureBadge && <small className="calendar-day-note">{dayClosureBadge}</small>}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="time-card" aria-label="Pilihan jam kunjungan">
            <h3>Pilih Jam Kunjungan</h3>
            <p>{formatLongDate(selectedDate)}</p>
            {selectedClosureLabel && <p className="time-card-note">{selectedClosureLabel}</p>}
            <div className="time-list time-list--hourly">
              {selectedDay && selectedDay.slots.length > 0 ? (
                selectedDay.slots.map((slot) => {
                  const klass = publicSlotStatusToClass(slot.status);
                  const closedLabel = slotClosureLabel(slot, selectedDay);
                  const statusLabel = slot.status === "Closed" && closedLabel
                    ? closedLabel
                    : publicSlotStatusLabel[slot.status];
                  return (
                    <div
                      className={`time-option is-${klass}`}
                      key={slot.time}
                      aria-disabled={slot.status !== "Available"}
                    >
                      <Clock3 size={20} aria-hidden="true" />
                      <span>
                        <strong>{slot.time} WIB</strong>
                        <small>{statusLabel}</small>
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
			)}

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
          <h2 id="quick-info-title">{siteContent.quickInfo.title}</h2>
          <p>{siteContent.quickInfo.description}</p>
        </div>
        <div className="quick-info-grid">
          {siteContent.quickInfo.cards.map((card) => (
            <InfoCard key={card.title} {...card} />
          ))}
        </div>
      </section>

      <section className="chapter video-chapter" aria-label={siteContent.video.title}>
        <div className="video-shell scale-fade">
          <iframe
            src={videoEmbedUrl(siteContent.video.url)}
            title={siteContent.video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
          />
        </div>
      </section>

      <section className="chapter scroll-story desire">
        <div className="desire-grid">
          <div className="desire-pin">
            <h2>{siteContent.bookingSteps.title}</h2>
            <p className="scrub-copy">
              {siteContent.bookingSteps.story.split(" ").map((word, index) => (
                <span className="reveal-word" key={`${word}-${index}`}>
                  {word}
                </span>
              ))}
            </p>
          </div>
          <div className="desire-stack">
            {siteContent.bookingSteps.cards.map((card) => (
              <ProcessCard key={card.title} {...card} />
            ))}
          </div>
        </div>
      </section>

      <LetterExampleSection content={siteContent.letterSection} letter={letter} onNavigate={onNavigate} />

      <RulesSection content={siteContent.rulesSection} letter={letter} onNavigate={onNavigate} />

      <section className="chapter">
        <HorizontalAccordion content={siteContent.activities} />
      </section>

      <FaqSection content={siteContent.faq} items={faqs} />

      <section
        className="action-panel"
        style={{
          backgroundImage: `linear-gradient(135deg, rgba(16, 24, 47, 0.95), rgba(16, 24, 47, 0.7)), url("${siteContent.cta.backgroundImage}")`,
        }}
      >
        <div>
          <h2>{siteContent.cta.title}</h2>
          <p>{siteContent.cta.body}</p>
        </div>
        <button className="button button-primary" type="button" onClick={() => onNavigate("booking")}>
          {siteContent.cta.buttonLabel}
          <ArrowRight size={18} aria-hidden="true" />
        </button>
      </section>

      <Footer contacts={contacts} content={siteContent.footer} onNavigate={onNavigate} />
    </>
  );
}

function InfoCard({
  iconKey,
  title,
  body,
  points,
}: {
  iconKey: LandingIconKey;
  title: string;
  body: string;
  points: string[];
}) {
  const Icon = landingIconMap[iconKey] ?? Clock3;

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
  iconKey,
  title,
  body,
}: {
  iconKey: LandingIconKey;
  title: string;
  body: string;
}) {
  const Icon = landingIconMap[iconKey] ?? Clock3;

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

function HorizontalAccordion({ content }: { content: SiteContent["activities"] }) {
  const [active, setActive] = useState(0);

  return (
    <div className="accordion-block">
      <div className="section-heading compact">
        <h2>{content.title}</h2>
        <p>{content.description}</p>
      </div>
      <div className="horizontal-accordion">
        {content.items.map((item, index) => (
          <button
            key={item.title}
            className={`accordion-panel group ${active === index ? "is-open" : ""}`}
            type="button"
            onFocus={() => setActive(index)}
            onMouseEnter={() => setActive(index)}
          >
            <img
              className="zoom-media"
              src={item.image}
              alt=""
              loading={index === 0 ? "eager" : "lazy"}
              decoding="async"
              fetchPriority="low"
            />
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

function LetterExampleSection({
  content,
  letter,
  onNavigate,
}: {
  content: SiteContent["letterSection"];
  letter: ApiLetter;
  onNavigate: (screen: Screen) => void;
}) {
  return (
    <section className="chapter letter-chapter" id="contoh-surat" aria-labelledby="letter-title">
      <div className="section-heading compact letter-heading">
        <div>
          <h2 id="letter-title">{content.title}</h2>
        </div>
        <p>{content.description}</p>
      </div>

      <div className="letter-layout scale-fade">
        <article className="letter-preview" aria-label="Preview contoh surat permohonan kunjungan">
          <img
            className="letter-example-image"
            src={letter.image || ASSETS.letterExample}
            alt="Contoh kop surat permohonan kunjungan ISTURA"
            loading="lazy"
            decoding="async"
          />
        </article>

        <aside className="letter-notes">
          <span className="section-kicker">{content.formatKicker}</span>
          <h3>{content.formatTitle}</h3>
          <ul>
            {letter.checklist.map((item) => (
              <li key={item}>
                <Check size={18} aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <div className="upload-note">
            <UploadCloud size={22} aria-hidden="true" />
            <span>{content.uploadNote}</span>
          </div>
          <button className="button button-primary" type="button" onClick={() => onNavigate("booking")}>
            {content.buttonLabel}
            <ArrowRight size={18} aria-hidden="true" />
          </button>
        </aside>
      </div>
    </section>
  );
}

function RulesSection({
  content,
  onNavigate,
  letter,
}: {
  content: SiteContent["rulesSection"];
  onNavigate: (screen: Screen) => void;
  letter: ApiLetter;
}) {
  return (
    <section className="chapter rules-chapter" id="peraturan" aria-labelledby="rules-title">
      <div className="section-heading compact rules-heading">
        <div>
          <h2 id="rules-title">{content.title}</h2>
        </div>
        <p>{content.description}</p>
      </div>

      <div className="rules-layout scale-fade">
        <article className="rules-preview" aria-label="Gambar peraturan kunjungan resmi">
          <img
            className="rules-example-image"
            src={letter.rulesImage || "/assets/peraturan-kunjungan.webp"}
            alt="Peraturan Kunjungan Istana Kepresidenan Yogyakarta"
            loading="lazy"
            decoding="async"
          />
        </article>

        <aside className="rules-notes letter-notes">
          <span className="section-kicker">{content.rulesKicker || "Aturan Utama"}</span>
          <h3>{content.rulesTitle || "Kepatuhan Protokol"}</h3>
          <ul>
            {(letter.rulesList || content.rulesList || []).map((item) => (
              <li key={item}>
                <Check size={18} aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <div className="upload-note">
            <FileCheck2 size={22} aria-hidden="true" />
            <span>Koordinator bertanggung jawab penuh atas seluruh anggota rombongan.</span>
          </div>
          <button className="button button-primary" type="button" onClick={() => onNavigate("booking")}>
            {content.buttonLabel}
            <ArrowRight size={18} aria-hidden="true" />
          </button>
        </aside>
      </div>
    </section>
  );
}

function FaqSection({ content, items }: { content: SiteContent["faq"]; items: FaqItem[] }) {
  return (
    <section className="chapter faq-section" id="faq" aria-labelledby="faq-title">
      <div className="faq-layout">
        <div className="faq-heading">
          <h2 id="faq-title">{content.title}</h2>
          <p>{content.description}</p>
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
        {messages.map((item, idx) => {
          const isActive = idx === safeIndex;

          return (
            <img
              key={item.image}
              className={`miky-hero-img${isActive ? " is-active" : ""}`}
              src={item.image}
              alt={isActive ? "MIKY, pemandu booking ISTURA" : ""}
              aria-hidden={isActive ? undefined : "true"}
              data-reduced={reduced ? "true" : undefined}
              decoding="async"
              fetchPriority={isActive ? "high" : "low"}
            />
          );
        })}
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

  // Pesan pertama: tunggu sampai GSAP benar-benar memulai fade-in bubble
  // (sinyal `data-speech-revealed`) supaya teks dan bubble muncul bersamaan.
  // Memeriksa computed opacity tidak reliable: layer animasi di-lazy-load,
  // jadi sebelum GSAP sempat jalan bubble masih pada opacity natural (1) dan
  // typewriter terlanjur selesai sebelum bubble terlihat. Sinyal eksplisit ini
  // selalu terpicu setelah delay, kapan pun layer GSAP selesai dimuat.
  // Pesan berikutnya: bubble sudah on-screen, langsung ketik.
  const [ready, setReady] = useState(index !== 0 || reduced);
  useEffect(() => {
    if (index !== 0 || reduced) {
      setReady(true);
      return;
    }
    setReady(false);
    let rafId = 0;
    // Fallback: kalau layer GSAP gagal dimuat, jangan biarkan teks tidak pernah
    // muncul — tetap mulai ketik setelah jeda aman.
    const fallbackId = window.setTimeout(() => {
      window.cancelAnimationFrame(rafId);
      setReady(true);
    }, 2000);
    const tick = () => {
      const node = bubbleRef.current;
      if (node?.getAttribute("data-speech-revealed") === "1") {
        window.clearTimeout(fallbackId);
        setReady(true);
        return;
      }
      rafId = window.requestAnimationFrame(tick);
    };
    rafId = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(fallbackId);
    };
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

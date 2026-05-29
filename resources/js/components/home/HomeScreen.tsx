import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  UploadCloud,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { FaqItem, FooterContact, Screen, VisitDay } from "../../domain/types";
import {
  addMonths,
  calendarWeekdays,
  createCalendarDays,
  formatDateKey,
  formatLongDate,
  formatMonthTitle,
  getFirstAvailableDate,
  getPublicDateStatus,
  legendStatuses,
  parseDateKey,
  publicSlotStatusLabel,
  publicSlotStatusToClass,
  publicStatusMeta,
  startOfDay,
  startOfMonth,
} from "../../lib/date";
import { ASSETS } from "../../lib/assets";
import {
  accordionItems,
  bookingProcessCards,
  HERO_MESSAGES,
  HERO_MESSAGES_MOBILE,
  letterChecklist,
  quickInfoCards,
  storyWords,
} from "../../constants";
import { useMediaQuery, useReducedMotion, useTypewriter } from "../../hooks";
import { Footer } from "../layout/Footer";

export function HomeScreen({
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

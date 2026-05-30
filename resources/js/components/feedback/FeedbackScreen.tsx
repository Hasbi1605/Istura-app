import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Check,
  Clock3,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Booking, Feedback } from "../../domain/types";
import { ASSETS } from "../../lib/assets";
import { FEEDBACK_HIGHLIGHTS, FEEDBACK_IMPROVEMENTS, RATING_LABELS } from "../../constants";
import { fetchPublicFeedback, submitPublicFeedback } from "../../api/feedback";
import { ValidationError } from "../../api/client";
import { useReducedMotion } from "../../hooks";
import { MikyGuide } from "../MikyGuide";
import { ButtonSpinner, InlineSpinner } from "../ui/LoadingStates";

type FeedbackBookingContext = Pick<
  Booking,
  "code" | "institution" | "dateLabel" | "status" | "feedbackToken"
>;

const apiFeedbackToLocal = (feedback: {
  code: string;
  rating: number;
  bookingEase: number;
  service: number;
  recommend: number;
  highlights?: string[];
  improvements?: string[];
  comment: string | null;
  allowPublish: boolean;
  submittedAt: string | null;
}): Feedback => ({
  code: feedback.code,
  rating: feedback.rating,
  bookingEase: feedback.bookingEase,
  service: feedback.service,
  recommend: feedback.recommend,
  highlights: feedback.highlights ?? [],
  improvements: feedback.improvements ?? [],
  comment: feedback.comment ?? "",
  allowPublish: feedback.allowPublish,
  submittedAt: feedback.submittedAt ?? undefined,
});

const firstValidationMessage = (error: unknown, fallback: string) => {
  if (error instanceof ValidationError) {
    return Object.values(error.errors).flat()[0] ?? error.message ?? fallback;
  }

  return fallback;
};

export function FeedbackScreen({
  bookings,
  submittedCode,
	feedbacks,
	access,
	loading = false,
	onFeedbackCreate,
  onNavigationLockChange,
}: {
  bookings: Booking[];
  submittedCode: string;
	feedbacks: Feedback[];
	access: { code: string; token: string } | null;
	loading?: boolean;
	onFeedbackCreate: (feedback: Feedback) => void;
  onNavigationLockChange?: (locked: boolean) => void;
}) {
  // Resolve booking from URL access (preferred) or fallback (e.g. dev/admin testing)
  const localAccessBooking = access
    ? bookings.find(
        (booking) => booking.code === access.code && booking.feedbackToken === access.token,
      )
    : undefined;

  const fallbackBooking =
    bookings.find((booking) => booking.code === submittedCode) ??
    bookings.find((booking) => booking.status === "Completed") ??
    bookings[0];

  const [remoteBooking, setRemoteBooking] = useState<FeedbackBookingContext | null>(null);
  const [remoteFeedback, setRemoteFeedback] = useState<Feedback | null>(null);
  const [accessLoading, setAccessLoading] = useState(false);
  const [accessError, setAccessError] = useState("");
  const accessBooking = localAccessBooking ?? remoteBooking ?? undefined;
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
  const [submitting, setSubmitting] = useState(false);

  const existing = [remoteFeedback, ...feedbacks].some((feedback) => feedback?.code === code);
  const reduced = useReducedMotion();
  const navigationLocked = Boolean(booking && booking.status === "Completed" && !existing && !submitted);

  useEffect(() => {
    onNavigationLockChange?.(navigationLocked);

    return () => onNavigationLockChange?.(false);
  }, [navigationLocked, onNavigationLockChange]);

  useEffect(() => {
    if (!access) {
      setRemoteBooking(null);
      setRemoteFeedback(null);
      setAccessError("");
      setAccessLoading(false);
      return;
    }

    let cancelled = false;
    setRemoteBooking(null);
    setRemoteFeedback(null);
    setAccessError("");
    setAccessLoading(true);

    fetchPublicFeedback(access.code, access.token)
      .then((response) => {
        if (cancelled) return;
        setRemoteBooking({
          code: response.booking.code,
          institution: response.booking.institution,
          dateLabel: response.booking.dateLabel,
          status: response.booking.status,
          feedbackToken: access.token,
        });
        setRemoteFeedback(response.data ? apiFeedbackToLocal(response.data) : null);
      })
      .catch((err) => {
        if (cancelled) return;
        setAccessError(
          firstValidationMessage(
            err,
            "Periksa kembali tautan dari WhatsApp resmi ISTURA. Pastikan kode booking dan token tidak terpotong.",
          ),
        );
      })
      .finally(() => {
        if (!cancelled) setAccessLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [access]);

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

  const submitFeedback = async () => {
    if (!booking) return;
    if (submitting) return;
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

    setSubmitting(true);
    try {
      const created = await submitPublicFeedback(code, payload);
      const localFeedback = apiFeedbackToLocal(created);
      setRemoteFeedback(localFeedback);
      onFeedbackCreate(localFeedback);
      setError("");
      setSubmitted(true);
      if (storageKey) {
        try {
          window.localStorage.removeItem(storageKey);
        } catch {
          /* ignore */
        }
      }
    } catch (err) {
      setError(firstValidationMessage(err, "Tidak dapat mengirim feedback. Coba lagi."));
    } finally {
      setSubmitting(false);
    }
  };

  // ----- Gating: link tidak valid / belum selesai -----
  if (access) {
    if (accessLoading && !accessBooking) {
      return (
			<FeedbackGate
				icon={Clock3}
				title="Memuat feedback"
				message="Kami sedang memeriksa tautan feedback kunjunganmu. Mohon tunggu sebentar."
				busy
			/>
      );
    }
    if (accessError && !accessBooking) {
      return (
        <FeedbackGate
          icon={ShieldCheck}
          title="Link feedback tidak valid"
          message={accessError}
        />
      );
    }
    if (!accessBooking) {
      return (
        <FeedbackGate
          icon={ShieldCheck}
          title="Link feedback tidak valid"
          message="Periksa kembali tautan dari WhatsApp resmi ISTURA. Pastikan kode booking dan token tidak terpotong."
        />
      );
    }
    if (existing && !submitted) {
      return (
        <FeedbackGate
          icon={BadgeCheck}
          title="Feedback sudah tercatat"
          message="Terima kasih, masukan untuk kode kunjungan ini sudah kami terima."
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
				icon={loading ? Clock3 : ShieldCheck}
				title={loading ? "Memuat akses feedback" : "Akses feedback dibatasi"}
				message={
					loading
						? "Kami sedang memeriksa data kunjungan yang tersedia. Mohon tunggu sebentar."
						: "Tautan feedback dikirim melalui WhatsApp setelah kunjungan selesai. Silakan tunggu pesan resmi dari ISTURA."
				}
				busy={loading}
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
				disabled={step === 0 || submitting}
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
                disabled={submitting}
                onClick={submitFeedback}
              >
				{submitting ? (
					<ButtonSpinner label="Mengirim feedback..." />
				) : (
					<>
						Kirim Feedback
						<Send size={18} aria-hidden="true" />
					</>
				)}
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
	busy = false,
}: {
	icon: LucideIcon;
	title: string;
	message: string;
	busy?: boolean;
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
			{busy && <InlineSpinner label="Mohon tunggu" />}
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

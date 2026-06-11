import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Building2,
  Check,
  Clock3,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type {
  Booking,
  Feedback,
  FeedbackDiscoverySource,
  FeedbackWizardContent,
} from "../../domain/types";
import { ASSETS } from "../../lib/assets";
import { DEFAULT_FEEDBACK_WIZARD_CONTENT } from "../../constants";
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
  guideQuality: number | null;
  facilityComfort: number | null;
  recommend: number;
  visitedBefore: boolean | null;
  discoverySource: FeedbackDiscoverySource | null;
  discoverySourceOther: string | null;
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
  guideQuality: feedback.guideQuality,
  facilityComfort: feedback.facilityComfort,
  recommend: feedback.recommend,
  visitedBefore: feedback.visitedBefore,
  discoverySource: feedback.discoverySource,
  discoverySourceOther: feedback.discoverySourceOther ?? "",
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

const emptyDraft = {
  step: 0,
  rating: 0,
  bookingEase: 0,
  service: 0,
  guideQuality: 0,
  facilityComfort: 0,
  recommend: null as number | null,
  visitedBefore: null as boolean | null,
  discoverySource: "" as FeedbackDiscoverySource | "",
  discoverySourceOther: "",
  highlights: [] as string[],
  improvements: [] as string[],
  comment: "",
  allowPublish: false,
};

export function FeedbackScreen({
  bookings,
  submittedCode,
	feedbacks,
  content = DEFAULT_FEEDBACK_WIZARD_CONTENT,
	access,
	loading = false,
	onFeedbackCreate,
  onNavigationLockChange,
}: {
  bookings: Booking[];
  submittedCode: string;
	feedbacks: Feedback[];
  content?: FeedbackWizardContent;
	access: { code: string; token: string } | null;
	loading?: boolean;
  onFeedbackCreate: (feedback: Feedback) => void;
  onNavigationLockChange?: (locked: boolean) => void;
}) {
  const accessCode = access?.code ?? "";
  const accessToken = access?.token ?? "";

  // Resolve booking only from explicit URL access.
  const localAccessBooking = access
    ? bookings.find(
        (booking) => booking.code === access.code && booking.feedbackToken === access.token,
      )
    : undefined;

  const [remoteBooking, setRemoteBooking] = useState<FeedbackBookingContext | null>(null);
  const [remoteFeedback, setRemoteFeedback] = useState<Feedback | null>(null);
  const [accessLoading, setAccessLoading] = useState(false);
  const [accessError, setAccessError] = useState("");
  const accessBooking = localAccessBooking ?? remoteBooking ?? undefined;
  const booking = accessBooking;
  const code = booking?.code ?? "";
  const storageKey = booking ? `istura-feedback-draft-${booking.code}` : null;

  const [step, setStep] = useState(0);
  const [rating, setRating] = useState(0);
  const [bookingEase, setBookingEase] = useState(0);
  const [service, setService] = useState(0);
  const [guideQuality, setGuideQuality] = useState(0);
  const [facilityComfort, setFacilityComfort] = useState(0);
  const [recommend, setRecommend] = useState<number | null>(null);
  const [visitedBefore, setVisitedBefore] = useState<boolean | null>(null);
  const [discoverySource, setDiscoverySource] = useState<FeedbackDiscoverySource | "">("");
  const [discoverySourceOther, setDiscoverySourceOther] = useState("");
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
    if (!accessCode || !accessToken) {
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

    fetchPublicFeedback(accessCode, accessToken)
      .then((response) => {
        if (cancelled) return;
        setRemoteBooking({
          code: response.booking.code,
          institution: response.booking.institution,
          dateLabel: response.booking.dateLabel,
          status: response.booking.status,
          feedbackToken: accessToken,
        });
        setRemoteFeedback(response.data ? apiFeedbackToLocal(response.data) : null);
      })
      .catch((err) => {
        if (cancelled) return;
        setAccessError(
          firstValidationMessage(
            err,
            content.gates.invalidMessage,
          ),
        );
      })
      .finally(() => {
        if (!cancelled) setAccessLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [accessCode, accessToken, content.gates.invalidMessage]);

  // Restore draft from localStorage
  useEffect(() => {
    setStep(emptyDraft.step);
    setRating(emptyDraft.rating);
    setBookingEase(emptyDraft.bookingEase);
    setService(emptyDraft.service);
    setGuideQuality(emptyDraft.guideQuality);
    setFacilityComfort(emptyDraft.facilityComfort);
    setRecommend(emptyDraft.recommend);
    setVisitedBefore(emptyDraft.visitedBefore);
    setDiscoverySource(emptyDraft.discoverySource);
    setDiscoverySourceOther(emptyDraft.discoverySourceOther);
    setHighlights(emptyDraft.highlights);
    setImprovements(emptyDraft.improvements);
    setComment(emptyDraft.comment);
    setAllowPublish(emptyDraft.allowPublish);
    setError("");
    setSubmitted(false);

    if (!storageKey) return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const draft = JSON.parse(raw) as Partial<Feedback>;
      if (typeof (draft as Partial<typeof emptyDraft>).step === "number") setStep((draft as Partial<typeof emptyDraft>).step ?? 0);
      if (typeof draft.rating === "number") setRating(draft.rating);
      if (typeof draft.bookingEase === "number") setBookingEase(draft.bookingEase);
      if (typeof draft.service === "number") setService(draft.service);
      if (typeof draft.guideQuality === "number") setGuideQuality(draft.guideQuality);
      if (typeof draft.facilityComfort === "number") setFacilityComfort(draft.facilityComfort);
      if (typeof draft.recommend === "number") setRecommend(draft.recommend);
      if (typeof draft.visitedBefore === "boolean") setVisitedBefore(draft.visitedBefore);
      if (typeof draft.discoverySource === "string") setDiscoverySource(draft.discoverySource);
      if (typeof draft.discoverySourceOther === "string") setDiscoverySourceOther(draft.discoverySourceOther);
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
      step,
      rating,
      bookingEase,
      service,
      guideQuality,
      facilityComfort,
      recommend,
      visitedBefore,
      discoverySource,
      discoverySourceOther,
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
    step,
    rating,
    bookingEase,
    service,
    guideQuality,
    facilityComfort,
    recommend,
    visitedBefore,
    discoverySource,
    discoverySourceOther,
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

  const totalSteps = 4;
  const ratingStep = content.steps.rating;
  const visitStep = content.steps.visit;
  const detailsStep = content.steps.details;
  const commentStep = content.steps.comment;

  const stepConfig: {
    title: string;
    icon: LucideIcon;
    bubbleTitle: string;
    bubble: string;
    image: string;
  }[] = [
    {
      title: ratingStep.title,
      icon: Star,
      bubbleTitle: ratingStep.bubbleTitle,
      bubble:
        rating === 0
          ? ratingStep.bubbleEmpty
          : rating <= 2
            ? ratingStep.bubbleLow
            : rating === 3
              ? ratingStep.bubbleNeutral
              : ratingStep.bubbleHigh,
      image: ASSETS.mikyFeedback,
    },
    {
      title: visitStep.title,
      icon: Building2,
      bubbleTitle: visitStep.bubbleTitle,
      bubble:
        guideQuality === 0 ||
        facilityComfort === 0 ||
        visitedBefore === null ||
        discoverySource === "" ||
        (discoverySource === "other" && discoverySourceOther.trim() === "")
          ? visitStep.bubbleEmpty
          : visitStep.bubbleDone,
      image: ASSETS.mikyFeedback2,
    },
    {
      title: detailsStep.title,
      icon: Sparkles,
      bubbleTitle: detailsStep.bubbleTitle,
      bubble:
        recommend === null
          ? detailsStep.bubbleEmpty
          : highlights.length === 0
            ? detailsStep.bubbleHighlightsEmpty
            : detailsStep.bubbleDone,
      image: ASSETS.mikyFeedback3,
    },
    {
      title: commentStep.title,
      icon: Send,
      bubbleTitle: commentStep.bubbleTitle,
      bubble:
        comment.trim().length === 0
          ? commentStep.bubbleEmpty
          : commentStep.bubbleDone,
      image: ASSETS.mikyFeedback3,
    },
  ];

  const stepReady = [
    rating > 0 && bookingEase > 0 && service > 0,
    guideQuality > 0 &&
      facilityComfort > 0 &&
      visitedBefore !== null &&
      discoverySource !== "" &&
      (discoverySource !== "other" || discoverySourceOther.trim().length > 0),
    recommend !== null,
    true,
  ];

  const goNext = () => {
    if (!stepReady[step]) {
      if (step === 0) {
        setError("Mohon berikan rating untuk ketiga aspek di atas.");
      } else if (step === 1) {
        setError("Mohon lengkapi penilaian dan informasi kunjungan.");
      } else if (step === 2) {
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
    if (!booking || !access) return;
    if (submitting) return;
    if (!stepReady[0]) {
      setError("Mohon berikan rating untuk ketiga aspek di langkah 1.");
      setStep(0);
      return;
    }
    if (!stepReady[1]) {
      setError("Mohon lengkapi penilaian dan informasi kunjungan di langkah 2.");
      setStep(1);
      return;
    }
    if (!stepReady[2]) {
      setError("Mohon pilih skor rekomendasi di langkah 3.");
      setStep(2);
      return;
    }
    if (existing) {
      setError("Feedback untuk kode ini sudah tercatat sebelumnya.");
      return;
    }

    const payload = {
      token: access.token,
      rating,
      bookingEase,
      service,
      guideQuality,
      facilityComfort,
      recommend: recommend ?? 0,
      visitedBefore: visitedBefore ?? false,
      discoverySource: discoverySource as FeedbackDiscoverySource,
      discoverySourceOther:
        discoverySource === "other" ? discoverySourceOther.trim() : undefined,
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
				title={content.gates.loadingTitle}
				message={content.gates.loadingMessage}
        busyLabel={content.gates.busyLabel}
        homeLabel={content.actions.homeLabel}
				busy
			/>
      );
    }
    if (accessError && !accessBooking) {
      return (
        <FeedbackGate
          icon={ShieldCheck}
          title={content.gates.invalidTitle}
          message={accessError}
          homeLabel={content.actions.homeLabel}
        />
      );
    }
    if (!accessBooking) {
      return (
        <FeedbackGate
          icon={ShieldCheck}
          title={content.gates.invalidTitle}
          message={content.gates.invalidMessage}
          homeLabel={content.actions.homeLabel}
        />
      );
    }
    if (existing && !submitted) {
      return (
        <FeedbackGate
          icon={BadgeCheck}
          title={content.gates.alreadySubmittedTitle}
          message={content.gates.alreadySubmittedMessage}
          homeLabel={content.actions.homeLabel}
        />
      );
    }
    if (accessBooking.status !== "Completed") {
      return (
        <FeedbackGate
          icon={Clock3}
          title={content.gates.unavailableTitle}
          message={content.gates.unavailableMessage}
          homeLabel={content.actions.homeLabel}
        />
      );
    }
	} else {
		return (
			<FeedbackGate
				icon={loading ? Clock3 : ShieldCheck}
				title={loading ? content.gates.restrictedLoadingTitle : content.gates.restrictedTitle}
				message={
					loading
						? content.gates.restrictedLoadingMessage
						: content.gates.restrictedMessage
				}
        busyLabel={content.gates.busyLabel}
        homeLabel={content.actions.homeLabel}
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
                loading="lazy"
                decoding="async"
              />
              <span className="feedback-success-burst" aria-hidden="true" />
            </div>
            <div className="feedback-success-copy">
              <span className="feedback-success-eyebrow">
                <BadgeCheck size={16} aria-hidden="true" />
                {content.success.eyebrow}
              </span>
              <h1>{content.success.title}</h1>
              <p>
                {content.success.message.includes("{kode}") ? (
                  <>
                    {content.success.message.split("{kode}")[0]}
                    <strong>{code}</strong>
                    {content.success.message.split("{kode}").slice(1).join(code)}
                  </>
                ) : (
                  content.success.message
                )}
              </p>
              <a className="button button-primary" href="/">
                {content.actions.homeLabel}
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
            <p>{content.intro}</p>

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
                  label={content.fields.ratingLabel}
                  value={rating}
                  labels={content.fields.ratingLabels}
                  onChange={setRating}
                />
                <RatingField
                  label={content.fields.bookingEaseLabel}
                  value={bookingEase}
                  labels={content.fields.ratingLabels}
                  onChange={setBookingEase}
                />
                <RatingField
                  label={content.fields.serviceLabel}
                  value={service}
                  labels={content.fields.ratingLabels}
                  onChange={setService}
                />
              </div>
            )}

            {step === 1 && (
              <div className="feedback-step">
                <RatingField
                  label={content.fields.guideQualityLabel}
                  value={guideQuality}
                  labels={content.fields.ratingLabels}
                  onChange={setGuideQuality}
                />
                <RatingField
                  label={content.fields.facilityComfortLabel}
                  value={facilityComfort}
                  labels={content.fields.ratingLabels}
                  onChange={setFacilityComfort}
                />

                <fieldset className="recommend-field">
                  <legend>{content.fields.visitedBeforeLegend}</legend>
                  <div
                    className="recommend-scale feedback-binary-choice"
                    role="radiogroup"
                    aria-label={content.fields.visitedBeforeLegend}
                  >
                    <button
                      type="button"
                      role="radio"
                      aria-checked={visitedBefore === false}
                      className={visitedBefore === false ? "is-active" : ""}
                      onClick={() => setVisitedBefore(false)}
                    >
                      {content.fields.visitedBeforeFirstLabel}
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={visitedBefore === true}
                      className={visitedBefore === true ? "is-active" : ""}
                      onClick={() => setVisitedBefore(true)}
                    >
                      {content.fields.visitedBeforeReturnLabel}
                    </button>
                  </div>
                </fieldset>

                <label className="form-field">
                  <span>{content.fields.discoverySourceLabel}</span>
                  <select
                    value={discoverySource}
                    onChange={(event) => {
                      const value = event.target.value as FeedbackDiscoverySource | "";
                      setDiscoverySource(value);
                      if (value !== "other") setDiscoverySourceOther("");
                    }}
                  >
                    <option value="">{content.fields.discoverySourcePlaceholder}</option>
                    {content.options.discoverySources.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                {discoverySource === "other" && (
                  <label className="form-field">
                    <span>{content.fields.discoverySourceOtherLabel}</span>
                    <input
                      value={discoverySourceOther}
                      onChange={(event) => setDiscoverySourceOther(event.target.value)}
                      placeholder={content.fields.discoverySourceOtherPlaceholder}
                      maxLength={120}
                    />
                  </label>
                )}
              </div>
            )}

            {step === 2 && (
              <div className="feedback-step">
                <fieldset className="recommend-field">
                  <legend>{content.fields.recommendLegend}</legend>
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
                    <span>{content.fields.recommendLowLabel}</span>
                    <span>{content.fields.recommendHighLabel}</span>
                  </div>
                </fieldset>

                <ChipField
                  label={content.fields.highlightsLabel}
                  options={content.options.highlights}
                  values={highlights}
                  onToggle={(value) => toggleChip(highlights, setHighlights, value)}
                />
                <ChipField
                  label={content.fields.improvementsLabel}
                  options={content.options.improvements}
                  values={improvements}
                  onToggle={(value) => toggleChip(improvements, setImprovements, value)}
                />
              </div>
            )}

            {step === 3 && (
              <div className="feedback-step">
                <label className="form-field">
                  <span>{content.fields.commentLabel}</span>
                  <textarea
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                    placeholder={content.fields.commentPlaceholder}
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
                    {content.fields.publishConsent}
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
              {content.actions.backLabel}
            </button>
            {step < totalSteps - 1 ? (
              <button className="button button-primary" type="button" onClick={goNext}>
                {content.actions.nextLabel}
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
						{content.actions.submitLabel}
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
  busyLabel = "Mohon tunggu",
  homeLabel = "Kembali ke Beranda",
	busy = false,
}: {
	icon: LucideIcon;
	title: string;
	message: string;
  busyLabel?: string;
  homeLabel?: string;
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
			{busy && <InlineSpinner label={busyLabel} />}
			<a className="button button-secondary" href="/">
            {homeLabel}
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
  labels,
  onChange,
  helper,
}: {
  label: string;
  value: number;
  labels: string[];
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
              aria-label={`${score} dari 5: ${labels[score] ?? score}`}
            >
              <Star size={22} fill={filled ? "currentColor" : "none"} aria-hidden="true" />
            </button>
          );
        })}
      </div>
      <span className="rating-caption" aria-live="polite">
        {display ? labels[display] ?? display : labels[0] ?? "Belum dipilih"}
      </span>
    </fieldset>
  );
}

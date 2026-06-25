import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Building2,
  Clock3,
  Send,
  ShieldCheck,
  Sparkles,
  User,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type {
  FeedbackDiscoverySource,
  FeedbackGender,
  FeedbackWizardContent,
} from "../../domain/types";
import { ASSETS } from "../../lib/assets";
import { DEFAULT_FEEDBACK_WIZARD_CONTENT } from "../../constants";
import {
  fetchOpenFeedbackContext,
  submitOpenFeedback,
  type OpenFeedbackAccessStatus,
  type OpenFeedbackContext,
} from "../../api/openFeedback";
import { ValidationError } from "../../api/client";
import { useReducedMotion } from "../../hooks";
import { MikyGuide } from "../MikyGuide";
import { ButtonSpinner, InlineSpinner } from "../ui/LoadingStates";
import { ChipField, FeedbackGate, RatingField } from "./FeedbackScreen";

const firstValidationMessage = (error: unknown, fallback: string) => {
  if (error instanceof ValidationError) {
    return Object.values(error.errors).flat()[0] ?? error.message ?? fallback;
  }

  return fallback;
};

/**
 * Istura Open feedback wizard. Same questionnaire as the rombongan feedback,
 * but reached via a shared per-day link (token in the URL) and gated by a time
 * window instead of a per-booking token. Adds NIK + phone (HP) so submissions
 * can be deduped one per NIK and per phone per day.
 */
export function OpenFeedbackScreen({
  token,
  content = DEFAULT_FEEDBACK_WIZARD_CONTENT,
  onNavigationLockChange,
}: {
  token: string;
  content?: FeedbackWizardContent;
  onNavigationLockChange?: (locked: boolean) => void;
}) {
  const reduced = useReducedMotion();
  const [context, setContext] = useState<OpenFeedbackContext | null>(null);
  const [accessLoading, setAccessLoading] = useState(true);
  const [accessError, setAccessError] = useState("");

  const [step, setStep] = useState(0);
  const [nik, setNik] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [visitorName, setVisitorName] = useState("");
  const [gender, setGender] = useState<FeedbackGender | "">("");
  const [age, setAge] = useState("");
  const [origin, setOrigin] = useState("");
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

  const accessStatus: OpenFeedbackAccessStatus | null = context?.accessStatus ?? null;
  const navigationLocked = Boolean(context && accessStatus === "available" && !submitted);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
  }, [step, reduced]);

  useEffect(() => {
    onNavigationLockChange?.(navigationLocked);
    return () => onNavigationLockChange?.(false);
  }, [navigationLocked, onNavigationLockChange]);

  useEffect(() => {
    let cancelled = false;
    setAccessLoading(true);
    setAccessError("");
    fetchOpenFeedbackContext(token)
      .then((data) => {
        if (!cancelled) setContext(data);
      })
      .catch((err) => {
        if (!cancelled) setAccessError(firstValidationMessage(err, content.gates.invalidMessage));
      })
      .finally(() => {
        if (!cancelled) setAccessLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, content.gates.invalidMessage]);

  const toggleChip = (list: string[], setter: (next: string[]) => void, value: string) => {
    setter(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  };

  const totalSteps = 4;
  const identityStep = content.steps.rating;
  const visitStep = content.steps.visit;
  const detailsStep = content.steps.details;
  const commentStep = content.steps.comment;

  const ageNumber = Number.parseInt(age, 10);
  const ageValid = Number.isFinite(ageNumber) && ageNumber >= 1 && ageNumber <= 120;
  const nikValid = /^\d{16}$/.test(nik);
  const whatsappValid = /^(08|628)\d{8,13}$/.test(whatsapp);
  const identityComplete =
    nikValid &&
    whatsappValid &&
    visitorName.trim().length > 0 &&
    gender !== "" &&
    ageValid &&
    origin.trim().length > 0;

  const stepConfig: { icon: LucideIcon; bubbleTitle: string; bubble: string; image: string }[] = [
    {
      icon: User,
      bubbleTitle: identityStep.bubbleTitle,
      bubble:
        identityComplete &&
        visitedBefore !== null &&
        discoverySource !== "" &&
        (discoverySource !== "other" || discoverySourceOther.trim() !== "")
          ? identityStep.bubbleHigh
          : identityStep.bubbleEmpty,
      image: ASSETS.mikyFeedback,
    },
    {
      icon: Building2,
      bubbleTitle: visitStep.bubbleTitle,
      bubble:
        bookingEase === 0 || service === 0 || guideQuality === 0 || facilityComfort === 0
          ? visitStep.bubbleEmpty
          : visitStep.bubbleDone,
      image: ASSETS.mikyFeedback2,
    },
    {
      icon: Sparkles,
      bubbleTitle: detailsStep.bubbleTitle,
      bubble:
        recommend === null
          ? detailsStep.bubbleEmpty
          : highlights.length === 0
            ? detailsStep.bubbleHighlightsEmpty
            : detailsStep.bubbleDone,
      image: ASSETS.mikyHero,
    },
    {
      icon: Send,
      bubbleTitle: commentStep.bubbleTitle,
      bubble: comment.trim().length === 0 ? commentStep.bubbleEmpty : commentStep.bubbleDone,
      image: ASSETS.mikyFeedback3,
    },
  ];

  const stepReady = [
    identityComplete &&
      visitedBefore !== null &&
      discoverySource !== "" &&
      (discoverySource !== "other" || discoverySourceOther.trim().length > 0),
    bookingEase > 0 && service > 0 && guideQuality > 0 && facilityComfort > 0,
    recommend !== null && improvements.length > 0,
    true,
  ];

  const goNext = () => {
    if (!stepReady[step]) {
      if (step === 0) setError("Mohon lengkapi NIK, nomor HP, data diri, dan informasi kunjungan.");
      else if (step === 1) setError("Mohon berikan penilaian untuk keempat aspek layanan.");
      else if (step === 2) setError("Mohon lengkapi skor rekomendasi dan aspek yang perlu diperbaiki.");
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
    if (submitting) return;
    if (!stepReady[0]) {
      setError("Mohon lengkapi NIK, nomor HP, dan data diri di langkah 1.");
      setStep(0);
      return;
    }
    if (!stepReady[1]) {
      setError("Mohon berikan penilaian untuk keempat aspek layanan di langkah 2.");
      setStep(1);
      return;
    }
    if (!stepReady[2]) {
      setError("Mohon lengkapi skor rekomendasi dan aspek perbaikan di langkah 3.");
      setStep(2);
      return;
    }

    setSubmitting(true);
    try {
      await submitOpenFeedback(token, {
        nik,
        whatsapp,
        visitorName: visitorName.trim(),
        gender: gender as FeedbackGender,
        age: ageNumber,
        origin: origin.trim(),
        bookingEase,
        service,
        guideQuality,
        facilityComfort,
        recommend: recommend ?? 0,
        visitedBefore: visitedBefore ?? false,
        discoverySource: discoverySource as FeedbackDiscoverySource,
        discoverySourceOther: discoverySource === "other" ? discoverySourceOther.trim() : undefined,
        highlights,
        improvements,
        comment: comment.trim(),
        allowPublish,
      });
      setError("");
      setSubmitted(true);
    } catch (err) {
      setError(firstValidationMessage(err, "Tidak dapat mengirim feedback. Coba lagi."));
    } finally {
      setSubmitting(false);
    }
  };

  // ----- Gating -----
  if (accessLoading && !context) {
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
  if (accessError && !context) {
    return (
      <FeedbackGate
        icon={ShieldCheck}
        title={content.gates.invalidTitle}
        message={accessError}
        homeLabel={content.actions.homeLabel}
      />
    );
  }
  if (!context) {
    return (
      <FeedbackGate
        icon={ShieldCheck}
        title={content.gates.invalidTitle}
        message={content.gates.invalidMessage}
        homeLabel={content.actions.homeLabel}
      />
    );
  }
  if (accessStatus === "not_open_yet") {
    return (
      <FeedbackGate
        icon={Clock3}
        title="Feedback Belum Dibuka"
        message={`Feedback untuk ${context.eventName ?? "kegiatan ini"}${
          context.dayDateLabel ? ` (${context.dayDateLabel})` : ""
        } baru dapat diisi setelah kegiatan berlangsung.`}
        homeLabel={content.actions.homeLabel}
      />
    );
  }
  if (accessStatus === "closed") {
    return (
      <FeedbackGate
        icon={Clock3}
        title="Periode Berakhir"
        message="Periode pengisian feedback untuk hari ini telah berakhir. Terima kasih atas partisipasinya."
        homeLabel={content.actions.homeLabel}
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
              <p>Terima kasih sudah mengisi feedback Istura Open. Masukanmu sangat berarti.</p>
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
            {step === 0 && (
              <>
                <h1>{content.steps.rating.title}</h1>
                <p>{content.intro}</p>
                <aside className="feedback-context" aria-label="Konteks kegiatan">
                  <span>
                    <em>Kegiatan</em>
                    <strong>{context.eventName ?? "Istura Open"}</strong>
                  </span>
                  {context.dayDateLabel && (
                    <span>
                      <em>Hari kunjungan</em>
                      <strong>{context.dayDateLabel}</strong>
                    </span>
                  )}
                </aside>
              </>
            )}

            {step === 0 && (
              <div className="feedback-step">
                <div className="feedback-identity-grid">
                  <label className="form-field">
                    <span>NIK (16 digit)</span>
                    <input
                      inputMode="numeric"
                      maxLength={16}
                      value={nik}
                      onChange={(event) => setNik(event.target.value.replace(/\D/g, ""))}
                      placeholder="Nomor Induk Kependudukan"
                      aria-invalid={nik.length > 0 && !nikValid}
                    />
                  </label>
                  <label className="form-field">
                    <span>Nomor HP (WhatsApp)</span>
                    <input
                      inputMode="tel"
                      value={whatsapp}
                      onChange={(event) => setWhatsapp(event.target.value.replace(/[^\d]/g, ""))}
                      placeholder="08xxxxxxxxxx"
                      aria-invalid={whatsapp.length > 0 && !whatsappValid}
                    />
                  </label>
                  <label className="form-field">
                    <span>{content.fields.visitorNameLabel}</span>
                    <input
                      value={visitorName}
                      onChange={(event) => setVisitorName(event.target.value)}
                      placeholder={content.fields.visitorNamePlaceholder}
                      maxLength={120}
                    />
                  </label>
                  <label className="form-field">
                    <span>{content.fields.genderLabel}</span>
                    <select value={gender} onChange={(event) => setGender(event.target.value as FeedbackGender | "")}>
                      <option value="">{content.fields.genderPlaceholder}</option>
                      <option value="male">{content.fields.genderMaleLabel}</option>
                      <option value="female">{content.fields.genderFemaleLabel}</option>
                    </select>
                  </label>
                  <label className="form-field">
                    <span>{content.fields.ageLabel}</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={age}
                      onChange={(event) => setAge(event.target.value)}
                      placeholder={content.fields.agePlaceholder}
                      min={1}
                      max={120}
                    />
                  </label>
                  <label className="form-field">
                    <span>{content.fields.originLabel}</span>
                    <input
                      value={origin}
                      onChange={(event) => setOrigin(event.target.value)}
                      placeholder={content.fields.originPlaceholder}
                      maxLength={160}
                    />
                  </label>
                </div>

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

            {step === 1 && (
              <div className="feedback-step">
                <RatingField label={content.fields.bookingEaseLabel} value={bookingEase} labels={content.fields.ratingLabels} onChange={setBookingEase} />
                <RatingField label={content.fields.serviceLabel} value={service} labels={content.fields.ratingLabels} onChange={setService} />
                <RatingField label={content.fields.guideQualityLabel} value={guideQuality} labels={content.fields.ratingLabels} onChange={setGuideQuality} />
                <RatingField label={content.fields.facilityComfortLabel} value={facilityComfort} labels={content.fields.ratingLabels} onChange={setFacilityComfort} />
              </div>
            )}

            {step === 2 && (
              <div className="feedback-step">
                <fieldset className="recommend-field">
                  <legend>{content.fields.recommendLegend}</legend>
                  <div className="recommend-scale" role="radiogroup" aria-label="Skor rekomendasi">
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
                  <input type="checkbox" checked={allowPublish} onChange={(event) => setAllowPublish(event.target.checked)} />
                  <span>{content.fields.publishConsent}</span>
                </label>
              </div>
            )}

            {error && <strong className="form-message form-message--error">{error}</strong>}
          </div>

          <div className="wizard-actions">
            <button className="button button-ghost" type="button" disabled={step === 0 || submitting} onClick={goBack}>
              <ArrowLeft size={18} aria-hidden="true" />
              {content.actions.backLabel}
            </button>
            {step < totalSteps - 1 ? (
              <button className="button button-primary" type="button" onClick={goNext}>
                {content.actions.nextLabel}
                <ArrowRight size={18} aria-hidden="true" />
              </button>
            ) : (
              <button className="button button-primary" type="button" disabled={submitting} onClick={submitFeedback}>
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

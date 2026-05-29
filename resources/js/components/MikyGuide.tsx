import type { LucideIcon } from "lucide-react";
import { ASSETS } from "../lib/assets";
import { useReducedMotion, useTypewriter } from "../hooks";

export function MikyGuide({
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

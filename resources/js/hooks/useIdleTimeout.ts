import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Hook to detect user inactivity and trigger logout.
 *
 * - Monitors mouse, keyboard, touch, scroll, and focus events.
 * - Shows a warning N seconds before logout.
 * - Resets timer on any user interaction.
 * - Calls onLogout when idle timeout expires.
 */
export function useIdleTimeout({
  timeoutMinutes = 55,
  warningSeconds = 120,
  onLogout,
  enabled = true,
}: {
  /** Minutes of inactivity before session expires */
  timeoutMinutes?: number;
  /** Seconds before timeout to show warning */
  warningSeconds?: number;
  /** Called when timeout expires */
  onLogout: () => void;
  /** Enable/disable the idle monitor */
  enabled?: boolean;
}) {
  const [showWarning, setShowWarning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  const timeoutMs = timeoutMinutes * 60 * 1000;
  const warningMs = warningSeconds * 1000;

  const lastActivityRef = useRef(Date.now());
  const warningTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const countdownRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const clearTimers = useCallback(() => {
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, []);

  const resetTimers = useCallback(() => {
    if (!enabled) return;

    clearTimers();
    setShowWarning(false);
    lastActivityRef.current = Date.now();

    // Set warning timer
    warningTimerRef.current = setTimeout(() => {
      setShowWarning(true);
      setRemainingSeconds(Math.ceil(warningMs / 1000));

      // Start countdown
      const start = Date.now();
      countdownRef.current = setInterval(() => {
        const elapsed = Date.now() - start;
        const left = Math.max(0, Math.ceil((warningMs - elapsed) / 1000));
        setRemainingSeconds(left);
        if (left <= 0 && countdownRef.current) {
          clearInterval(countdownRef.current);
        }
      }, 1000);
    }, timeoutMs - warningMs);

    // Set logout timer
    logoutTimerRef.current = setTimeout(() => {
      clearTimers();
      setShowWarning(false);
      onLogout();
    }, timeoutMs);
  }, [enabled, timeoutMs, warningMs, clearTimers, onLogout]);

  const extendSession = useCallback(() => {
    resetTimers();
  }, [resetTimers]);

  useEffect(() => {
    if (!enabled) {
      clearTimers();
      setShowWarning(false);
      return;
    }

    const events: (keyof WindowEventMap)[] = [
      "mousedown",
      "mousemove",
      "keydown",
      "scroll",
      "touchstart",
      "click",
    ];

    // Throttle activity detection to avoid excessive timer resets
    let throttled = false;
    const handleActivity = () => {
      if (throttled) return;
      throttled = true;
      setTimeout(() => {
        throttled = false;
      }, 5000); // Only reset every 5 seconds max

      // Don't reset if warning is showing (user must explicitly extend)
      if (!showWarning) {
        resetTimers();
      }
    };

    events.forEach((event) => window.addEventListener(event, handleActivity, { passive: true }));
    resetTimers();

    return () => {
      events.forEach((event) => window.removeEventListener(event, handleActivity));
      clearTimers();
    };
  }, [enabled, showWarning, resetTimers, clearTimers]);

  return {
    showWarning,
    remainingSeconds,
    extendSession,
  };
}

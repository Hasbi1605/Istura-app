import { useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import {
  addMonths,
  calendarWeekdays,
  createCalendarDays,
  dateKeysInInclusiveRange,
  formatDateKey,
  formatLongDate,
  formatMonthTitle,
  isSameMonth,
  jakartaToday,
  parseDateKey,
  startOfMonth,
} from "../../lib/date";

const MAX_SELECTED = 366;

type PickMode = "day" | "range";

type OpenEventDateCalendarProps = {
  selectedDates: string[];
  setSelectedDates: Dispatch<SetStateAction<string[]>>;
  disabled: boolean;
  error?: string;
  onDateError?: (message: string) => void;
  helper?: string;
};

function mergeSelectedDates(current: string[], incoming: string[]): string[] | null {
  const merged = Array.from(new Set([...current, ...incoming])).sort();
  if (merged.length > MAX_SELECTED) {
    return null;
  }

  return merged;
}

export function OpenEventDateCalendar({
  selectedDates,
  setSelectedDates,
  disabled,
  error,
  onDateError,
  helper = "Klik hari di kalender untuk memilih atau membatalkan. Tanggal terpilih langsung ditambahkan.",
}: OpenEventDateCalendarProps) {
  const today = useMemo(() => jakartaToday(), []);
  const todayKey = formatDateKey(today);
  const maxDate = useMemo(() => addMonths(today, 12), [today]);
  const minMonth = useMemo(() => startOfMonth(today), [today]);
  const maxMonth = useMemo(() => startOfMonth(maxDate), [maxDate]);
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(today));
  const [pickMode, setPickMode] = useState<PickMode>("day");
  const [rangeAnchor, setRangeAnchor] = useState<string | null>(null);

  const selectedSet = useMemo(() => new Set(selectedDates), [selectedDates]);
  const calendarDays = createCalendarDays(visibleMonth, today, maxDate);

  const canGoPrev = startOfMonth(visibleMonth) > minMonth;
  const canGoNext = startOfMonth(visibleMonth) < maxMonth;

  const clearDateError = () => onDateError?.("");

  const reportLimitError = () => {
    onDateError?.(`Maksimal ${MAX_SELECTED} tanggal per event.`);
  };

  const toggleDate = (key: string) => {
    if (key < todayKey || disabled) {
      return;
    }

    clearDateError();
    setSelectedDates((current) => {
      if (current.includes(key)) {
        return current.filter((date) => date !== key);
      }

      const next = [...current, key].sort();
      if (next.length > MAX_SELECTED) {
        reportLimitError();
        return current;
      }

      return next;
    });
  };

  const handleCellClick = (key: string, inMonth: boolean, isPast: boolean) => {
    if (!inMonth || isPast || disabled || key < todayKey) {
      return;
    }

    if (pickMode === "day") {
      toggleDate(key);
      return;
    }

    if (!rangeAnchor) {
      setRangeAnchor(key);
      clearDateError();
      return;
    }

    const [start, end] = rangeAnchor <= key ? [rangeAnchor, key] : [key, rangeAnchor];
    const range = dateKeysInInclusiveRange(start, end).filter((date) => date >= todayKey);
    setSelectedDates((current) => {
      const merged = mergeSelectedDates(current, range);
      if (!merged) {
        reportLimitError();
        return current;
      }

      return merged;
    });
    setRangeAnchor(null);
    clearDateError();
  };

  const removeDate = (key: string) => {
    if (disabled) {
      return;
    }

    setSelectedDates((current) => current.filter((date) => date !== key));
    if (rangeAnchor === key) {
      setRangeAnchor(null);
    }
    clearDateError();
  };

  const switchMode = (mode: PickMode) => {
    if (disabled || pickMode === mode) {
      return;
    }

    setPickMode(mode);
    setRangeAnchor(null);
    clearDateError();
  };

  const modeHint =
    pickMode === "day"
      ? "Mode per hari: klik tanggal untuk menambah atau menghapus pilihan."
      : rangeAnchor
        ? `Rentang dimulai ${formatLongDate(parseDateKey(rangeAnchor))}. Klik hari akhir untuk menambahkan seluruh rentang.`
        : "Mode rentang: klik hari awal, lalu hari akhir.";

  return (
    <div className="open-date-builder open-date-calendar">
      <div className="open-date-builder-head">
        <span>Tanggal event</span>
        <small>{helper}</small>
      </div>

      <div className="open-date-mode-row">
        <div className="admin-segmented-control" role="group" aria-label="Mode pemilihan tanggal">
          <button
            type="button"
            className={pickMode === "day" ? "is-active" : ""}
            disabled={disabled}
            onClick={() => switchMode("day")}
          >
            Per hari
          </button>
          <button
            type="button"
            className={pickMode === "range" ? "is-active" : ""}
            disabled={disabled}
            onClick={() => switchMode("range")}
          >
            Rentang
          </button>
        </div>
        <small className="open-date-mode-hint">{modeHint}</small>
      </div>

      <div className="open-date-calendar-grid admin-schedule-calendar">
        <header className="admin-schedule-cal-head">
          <div className="admin-schedule-cal-head-nav">
            <button
              type="button"
              onClick={() => canGoPrev && setVisibleMonth(addMonths(visibleMonth, -1))}
              disabled={!canGoPrev || disabled}
              aria-label="Bulan sebelumnya"
            >
              <ChevronLeft size={16} aria-hidden="true" />
            </button>
            <strong>{formatMonthTitle(visibleMonth)}</strong>
            <button
              type="button"
              onClick={() => canGoNext && setVisibleMonth(addMonths(visibleMonth, 1))}
              disabled={!canGoNext || disabled}
              aria-label="Bulan berikutnya"
            >
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className="admin-schedule-cal-weekdays" aria-hidden="true">
          {calendarWeekdays.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>

        <div className="admin-schedule-cal-grid">
          {calendarDays.map((cell) => {
            const inMonth = isSameMonth(cell.date, visibleMonth);
            const isPast = cell.key < todayKey;
            const isToday = cell.key === todayKey;
            const isSelected = selectedSet.has(cell.key);
            const isAnchor = rangeAnchor === cell.key;
            const clickable = inMonth && !isPast && !disabled;

            const summaryClass = !inMonth
              ? "is-outside"
              : isPast
                ? "is-past"
                : isSelected
                  ? "is-selected is-open"
                  : isAnchor
                    ? "is-range-anchor is-open"
                    : "is-open";

            return (
              <button
                type="button"
                key={cell.key}
                className={`admin-schedule-cal-cell open-event-cal-cell ${summaryClass}${isToday ? " is-today" : ""}`}
                disabled={!clickable}
                onClick={() => handleCellClick(cell.key, inMonth, isPast)}
                aria-pressed={isSelected || isAnchor}
                aria-label={
                  inMonth
                    ? `${formatLongDate(cell.date)}${
                        isPast
                          ? ", sudah lewat"
                          : isSelected
                            ? ", terpilih, klik untuk membatalkan"
                            : pickMode === "range" && !rangeAnchor
                              ? ", klik sebagai awal rentang"
                              : pickMode === "range" && rangeAnchor
                                ? ", klik sebagai akhir rentang"
                                : ", klik untuk memilih"
                      }`
                    : undefined
                }
              >
                <span className="admin-schedule-cal-num">{cell.date.getDate()}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="open-selected-dates" aria-live="polite">
        {selectedDates.length === 0 ? (
          <span className="open-selected-dates-empty">Belum ada tanggal dipilih.</span>
        ) : (
          selectedDates.map((date) => (
            <span className="open-date-chip" key={date}>
              {formatLongDate(parseDateKey(date))}
              <button
                type="button"
                disabled={disabled}
                aria-label={`Hapus ${formatLongDate(parseDateKey(date))}`}
                onClick={() => removeDate(date)}
              >
                <X size={13} />
              </button>
            </span>
          ))
        )}
      </div>

      {error && <small className="field-error">{error}</small>}
    </div>
  );
}

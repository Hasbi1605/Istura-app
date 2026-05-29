// Shared helpers for the booking + feedback Excel exports.
//
// Pulled into its own module so the two report types stay consistent on date
// parsing, range resolution, and filename conventions without one importing
// the other.

export type ExportRange = "week" | "month" | "year" | "custom";

export const monthNamesId = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

export const parseDateKey = (key: string): Date => {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
};

// Mirror the in-page parser so sorting in Excel matches what admin sees in
// the list. Returns epoch 0 for unparseable input so legacy rows still sort
// deterministically (oldest-last).
export const parseSubmittedAt = (value: string): Date => {
  if (!value) return new Date(0);
  const cleaned = value.replace(/\s*WIB\s*$/i, "").trim();
  const match = cleaned.match(
    /^(\d{1,2})\s+([A-Za-zÀ-ÿ]+)\s+(\d{4})(?:,\s*(\d{1,2})\.(\d{2}))?$/,
  );
  if (!match) return new Date(0);
  const [, dayRaw, monthName, yearRaw, hourRaw, minuteRaw] = match;
  const monthIndex = monthNamesId.findIndex(
    (name) => name.toLowerCase() === monthName.toLowerCase(),
  );
  if (monthIndex < 0) return new Date(0);
  return new Date(
    Number(yearRaw),
    monthIndex,
    Number(dayRaw),
    Number(hourRaw ?? 0),
    Number(minuteRaw ?? 0),
  );
};

export const formatDateKey = (date: Date): string => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

export const formatLongLabel = (date: Date): string =>
  `${date.getDate()} ${monthNamesId[date.getMonth()]} ${date.getFullYear()}`;

export const formatNowLabel = (): string => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${formatLongLabel(now)}, ${pad(now.getHours())}.${pad(now.getMinutes())} WIB`;
};

export const RANGE_FILENAME: Record<ExportRange, string> = {
  week: "MingguIni",
  month: "BulanIni",
  year: "TahunIni",
  custom: "Custom",
};

// Compute the [from, to] inclusive range for a preset bucket. Week = Senin..
// Minggu of the current week (locale ID convention starts on Senin), Month =
// 1st..last day of current month, Year = Jan 1..Dec 31 current year.
export const resolveRange = (
  range: ExportRange,
  customFrom?: string,
  customTo?: string,
): { from: Date; to: Date; label: string } => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (range === "week") {
    const dayOfWeek = today.getDay();
    const offsetToMonday = (dayOfWeek + 6) % 7; // Senin=0, ..., Minggu=6
    const start = new Date(today);
    start.setDate(today.getDate() - offsetToMonday);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return {
      from: start,
      to: end,
      label: `Minggu ${formatLongLabel(start)} – ${formatLongLabel(end)}`,
    };
  }
  if (range === "month") {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return {
      from: start,
      to: end,
      label: `${monthNamesId[start.getMonth()]} ${start.getFullYear()}`,
    };
  }
  if (range === "year") {
    const start = new Date(today.getFullYear(), 0, 1);
    const end = new Date(today.getFullYear(), 11, 31);
    return { from: start, to: end, label: `Tahun ${start.getFullYear()}` };
  }
  // custom
  const from = customFrom ? parseDateKey(customFrom) : new Date(0);
  const to = customTo ? parseDateKey(customTo) : new Date(8640000000000000);
  return {
    from,
    to,
    label:
      customFrom && customTo
        ? `${formatLongLabel(from)} – ${formatLongLabel(to)}`
        : "Rentang kustom",
  };
};

// Returns true if the given timestamp falls within [from, to] (inclusive,
// truncated to day boundaries).
export const isWithinRangeByDate = (
  candidate: Date,
  from: Date,
  to: Date,
): boolean => {
  if (candidate.getTime() === 0) return false;
  const d = new Date(candidate);
  d.setHours(0, 0, 0, 0);
  return d.getTime() >= from.getTime() && d.getTime() <= to.getTime();
};

// Common Excel theme tokens so booking + feedback sheets feel sibling.
export const THEME = {
  headerFill: "FFC49212",   // ISTURA gold
  headerFont: "FFFFFFFF",
  zebraFill: "FFFAF6EC",
  navy: "FF10182F",
  muted: "FF5F6477",
  link: "FF1A56DB",
  borderGold: "FFD7B25C",
} as const;

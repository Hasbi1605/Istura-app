// Monthly executive report generator.
//
// Produces an A4 portrait PDF summarizing booking + feedback over a chosen
// period. Designed for *reading*, not for further data manipulation:
// pimpinan/protokoler open it, skim KPIs, optionally print or forward.
//
// pdfmake is dynamically imported so the initial bundle stays lean. The
// shared period helpers come from exportShared.ts to keep date logic
// consistent with the booking + feedback Excel exports.

import {
  THEME,
  formatDateKey,
  formatLongLabel,
  formatNowLabel,
  isWithinRangeByDate,
  monthNamesId,
  parseDateKey,
  parseSubmittedAt,
  resolveRange,
} from "./exportShared";
import type { ExportRange } from "./exportShared";

export type { ExportRange } from "./exportShared";

// Extra "triwulan" range, only relevant for the executive report (Booking +
// Feedback exports keep the leaner week/month/year/custom set).
export type MonthlyReportRange = ExportRange | "quarter";

// Structural inputs duplicated here so the module stays decoupled from
// App.tsx's full Booking/Feedback shapes.
export type ReportBooking = {
  code: string;
  contactName: string;
  institution: string;
  groupSize: number;
  date: string;
  dateLabel: string;
  time: string;
  status: "Pending" | "Accepted" | "Rejected" | "Reschedule" | "Completed";
  submittedAt: string | null;
  completedAt?: string;
  note?: string;
};

export type ReportFeedback = {
  code: string;
  rating: number;
  bookingEase: number;
  service: number;
  recommend: number;
  highlights: string[];
  improvements: string[];
  comment: string;
  allowPublish: boolean;
  submittedAt?: string;
};

export type MonthlyReportOptions = {
  bookings: ReportBooking[];
  feedbacks: ReportFeedback[];
  range: MonthlyReportRange;
  customFrom?: string;
  customTo?: string;
  generatedBy?: string;
  // Logo URL fetched at runtime and embedded as a data URL. Optional — the
  // cover falls back to a text-only header if fetching fails.
  logoUrl?: string;
};

export type MonthlyReportResult = {
  filename: string;
  bookingCount: number;
  feedbackCount: number;
};

// ---------- helpers ----------

const RANGE_FILENAME: Record<MonthlyReportRange, string> = {
  week: "MingguIni",
  month: "BulanIni",
  quarter: "TriwulanIni",
  year: "TahunIni",
  custom: "Custom",
};

const RANGE_TITLE_LABEL: Record<MonthlyReportRange, string> = {
  week: "Mingguan",
  month: "Bulanan",
  quarter: "Triwulanan",
  year: "Tahunan",
  custom: "Periode Pilihan",
};

// Triwulan = 3 bulan kalender berjalan (Jan-Mar, Apr-Jun, Jul-Sep, Okt-Des).
const resolveQuarter = (): { from: Date; to: Date; label: string } => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const month = today.getMonth();
  const startMonth = Math.floor(month / 3) * 3;
  const start = new Date(today.getFullYear(), startMonth, 1);
  const end = new Date(today.getFullYear(), startMonth + 3, 0);
  const quarterIdx = Math.floor(month / 3) + 1;
  return {
    from: start,
    to: end,
    label: `Triwulan ${quarterIdx} ${today.getFullYear()} (${monthNamesId[startMonth]}-${monthNamesId[startMonth + 2]})`,
  };
};

const resolvePeriod = (
  range: MonthlyReportRange,
  customFrom?: string,
  customTo?: string,
) => {
  if (range === "quarter") return resolveQuarter();
  return resolveRange(range as ExportRange, customFrom, customTo);
};

// Date used for filtering booking/feedback into the period. Mirrors the
// rationale from the Excel exports (use submittedAt; fallback when absent).
const bookingFilterDate = (b: ReportBooking): Date => parseSubmittedAt(b.submittedAt ?? "");

const feedbackFilterDate = (f: ReportFeedback): Date => {
  if (f.submittedAt) {
    const parsed = parseSubmittedAt(f.submittedAt);
    if (parsed.getTime() > 0) return parsed;
  }
  return new Date(0);
};

// Average + round to one decimal. 0 for empty input (not NaN).
const avg1 = (values: number[]): number => {
  if (values.length === 0) return 0;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
};

const tally = (lists: string[][]): Map<string, number> => {
  const map = new Map<string, number>();
  for (const list of lists) {
    for (const tag of list) {
      const t = tag.trim();
      if (!t) continue;
      map.set(t, (map.get(t) ?? 0) + 1);
    }
  }
  return map;
};

// Truncate komentar untuk lampiran tindak lanjut. PDF tetap rapi, dan kalau
// admin perlu komentar penuh tinggal buka export Excel feedback.
const truncate = (text: string, max: number): string => {
  if (!text) return "";
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trimEnd() + "…";
};

// Convert URL-fetched image to data URL. pdfmake can ingest data URLs
// directly when image is registered in the document images map.
const fetchImageAsDataUrl = async (url: string): Promise<string | null> => {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

// ---------- styles & color tokens ----------

// pdfmake expects #RRGGBB; THEME constants are ARGB. Convert once.
const argbToHex = (argb: string) => `#${argb.slice(2)}`;

const COLOR = {
  navy: argbToHex(THEME.navy),
  gold: "#C49212",
  goldLight: "#FAF6EC",
  goldBorder: argbToHex(THEME.borderGold),
  muted: argbToHex(THEME.muted),
  positive: "#1E8E50",
  attention: "#A13D36",
  whisper: "#E5E7EB",
  black: "#10182F",
};

// ---------- main entry ----------

export const exportMonthlyReport = async (
  options: MonthlyReportOptions,
): Promise<MonthlyReportResult> => {
  const { bookings, feedbacks, range, customFrom, customTo, generatedBy, logoUrl } = options;

  // 1. Resolve period --------------------------------------------------
  const period = resolvePeriod(range, customFrom, customTo);

  // 2. Filter bookings & feedbacks ------------------------------------
  const periodBookings = bookings.filter((b) =>
    isWithinRangeByDate(bookingFilterDate(b), period.from, period.to),
  );
  const periodFeedbacks = feedbacks.filter((f) =>
    isWithinRangeByDate(feedbackFilterDate(f), period.from, period.to),
  );

  // 3. Compute KPIs ---------------------------------------------------
  const total = periodBookings.length;
  const completed = periodBookings.filter((b) => b.status === "Completed");
  const accepted = periodBookings.filter((b) => b.status === "Accepted");
  const rejected = periodBookings.filter((b) => b.status === "Rejected");
  const reschedule = periodBookings.filter((b) => b.status === "Reschedule");
  const pending = periodBookings.filter((b) => b.status === "Pending");
  const totalVisitors = completed.reduce((sum, b) => sum + (b.groupSize ?? 0), 0);

  const pct = (count: number) => (total === 0 ? 0 : Math.round((count / total) * 1000) / 10);

  // Feedback dimensions.
  const overallAvg = avg1(periodFeedbacks.map((f) => f.rating));
  const easeAvg = avg1(periodFeedbacks.map((f) => f.bookingEase));
  const serviceAvg = avg1(periodFeedbacks.map((f) => f.service));
  const recommendAvg = avg1(periodFeedbacks.map((f) => f.recommend));

  // 1-5 star distribution.
  const distribution = [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    count: periodFeedbacks.filter((f) => f.rating === stars).length,
  }));
  const maxDistCount = Math.max(1, ...distribution.map((d) => d.count));

  // Top tags.
  const topHighlights = Array.from(
    tally(periodFeedbacks.map((f) => f.highlights)).entries(),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const topImprovements = Array.from(
    tally(periodFeedbacks.map((f) => f.improvements)).entries(),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Selected positive quotes: rating 5 + allowPublish + non-empty comment.
  const positiveQuotes = periodFeedbacks
    .filter((f) => f.rating === 5 && f.allowPublish && f.comment.trim().length > 0)
    .sort((a, b) => feedbackFilterDate(b).getTime() - feedbackFilterDate(a).getTime())
    .slice(0, 3);

  // Tindak lanjut: rating <= 2.
  const followUps = periodFeedbacks
    .filter((f) => f.rating <= 2)
    .sort((a, b) => a.rating - b.rating);

  // 4. Load logo (best effort) -----------------------------------------
  const logoDataUrl = logoUrl ? await fetchImageAsDataUrl(logoUrl) : null;

  // 5. Build pdfmake docDefinition ------------------------------------
  const docDefinition = buildDocDefinition({
    period,
    range,
    generatedBy,
    logoDataUrl,
    kpis: { total, completed: completed.length, totalVisitors, overallAvg },
    statusBreakdown: [
      { label: "Pending", count: pending.length, color: COLOR.muted },
      { label: "Accepted", count: accepted.length, color: "#3B82F6" },
      { label: "Reschedule", count: reschedule.length, color: COLOR.gold },
      { label: "Completed", count: completed.length, color: COLOR.positive },
      { label: "Rejected", count: rejected.length, color: COLOR.attention },
    ],
    pct,
    feedbackCount: periodFeedbacks.length,
    dimensions: { overallAvg, easeAvg, serviceAvg, recommendAvg },
    distribution,
    maxDistCount,
    topHighlights,
    topImprovements,
    positiveQuotes,
    followUps,
  });

  // 6. Generate PDF ----------------------------------------------------
  const pdfMakeModule = await import("pdfmake/build/pdfmake.js");
  const vfsModule = await import("pdfmake/build/vfs_fonts.js");
  // pdfmake's UMD bundle exposes createPdf either as default export or
  // directly on the module object depending on bundler shim.
  const pdfMakeAny = pdfMakeModule as unknown as Record<string, unknown>;
  const pdfMake = (pdfMakeAny.default ?? pdfMakeAny) as {
    createPdf: (def: unknown) => { download: (name: string) => void };
    vfs?: Record<string, string>;
  };
  const vfsAny = vfsModule as unknown as Record<string, unknown>;
  const vfsCandidate =
    (vfsAny.pdfMake as { vfs?: Record<string, string> } | undefined)?.vfs ??
    ((vfsAny.default as { pdfMake?: { vfs?: Record<string, string> } } | undefined)?.pdfMake?.vfs);
  if (vfsCandidate) pdfMake.vfs = vfsCandidate;

  const filename = `ISTURA-Laporan-${RANGE_TITLE_LABEL[range]}-${formatDateKey(new Date()).replace(/-/g, "")}.pdf`;

  pdfMake.createPdf(docDefinition).download(filename);

  return {
    filename,
    bookingCount: periodBookings.length,
    feedbackCount: periodFeedbacks.length,
  };
};

// ---------- docDefinition builder ----------

type DocBuildArgs = {
  period: { from: Date; to: Date; label: string };
  range: MonthlyReportRange;
  generatedBy?: string;
  logoDataUrl: string | null;
  kpis: { total: number; completed: number; totalVisitors: number; overallAvg: number };
  statusBreakdown: Array<{ label: string; count: number; color: string }>;
  pct: (count: number) => number;
  feedbackCount: number;
  dimensions: { overallAvg: number; easeAvg: number; serviceAvg: number; recommendAvg: number };
  distribution: Array<{ stars: number; count: number }>;
  maxDistCount: number;
  topHighlights: Array<[string, number]>;
  topImprovements: Array<[string, number]>;
  positiveQuotes: ReportFeedback[];
  followUps: ReportFeedback[];
};

const buildDocDefinition = (args: DocBuildArgs): unknown => {
  const periodLabelHuman = `${formatLongLabel(args.period.from)} – ${formatLongLabel(args.period.to)}`;

  // pdfmake is loosely typed; we describe content as plain objects.
  return {
    pageSize: "A4",
    pageMargins: [40, 60, 40, 60],
    info: {
      title: `Laporan ${RANGE_TITLE_LABEL[args.range]} ISTURA`,
      author: args.generatedBy ?? "ISTURA Admin",
    },
    defaultStyle: {
      font: "Roboto",
      fontSize: 10,
      color: COLOR.black,
      lineHeight: 1.35,
    },
    styles: {
      h1: { fontSize: 22, bold: true, color: COLOR.navy, margin: [0, 0, 0, 6] },
      h2: { fontSize: 14, bold: true, color: COLOR.navy, margin: [0, 16, 0, 8] },
      h3: { fontSize: 11, bold: true, color: COLOR.navy, margin: [0, 8, 0, 4] },
      muted: { color: COLOR.muted, fontSize: 9 },
      kpiLabel: { fontSize: 9, color: COLOR.muted, bold: true, characterSpacing: 0.5 },
      kpiValue: { fontSize: 22, bold: true, color: COLOR.navy },
      kpiUnit: { fontSize: 9, color: COLOR.muted, italics: true },
      tableHeader: { fillColor: COLOR.gold, color: "#FFFFFF", bold: true, fontSize: 9 },
      tableCell: { fontSize: 9, color: COLOR.black },
      footerNote: { fontSize: 8, color: COLOR.muted, italics: true },
      quote: { italics: true, color: COLOR.navy, fontSize: 10 },
    },
    footer: (currentPage: number, pageCount: number) => ({
      text: `ISTURA · Laporan ${RANGE_TITLE_LABEL[args.range]} · Halaman ${currentPage} dari ${pageCount}`,
      alignment: "center",
      style: "footerNote",
      margin: [40, 20, 40, 0],
    }),
    content: [
      // ---------- Halaman 1: Cover & Ringkasan Eksekutif ----------
      buildCoverHeader(args, periodLabelHuman),
      { text: "Ringkasan Eksekutif", style: "h2" },
      buildKpiRow(args),
      { text: "Sorotan periode", style: "h3", margin: [0, 12, 0, 4] },
      buildExecutiveNarrative(args),
      { text: "Distribusi status permohonan", style: "h3", margin: [0, 14, 0, 6] },
      buildStatusTable(args),

      // ---------- Halaman 2: Suara Pengunjung ----------
      { text: "", pageBreak: "before" },
      { text: "Suara Pengunjung", style: "h1" },
      { text: `${args.feedbackCount} feedback diterima · ${periodLabelHuman}`, style: "muted", margin: [0, 0, 0, 12] },

      { text: "Rata-rata penilaian", style: "h3" },
      buildDimensionsTable(args),

      { text: "Distribusi rating overall", style: "h3", margin: [0, 14, 0, 6] },
      buildDistributionRows(args),

      { text: "Sorotan & Saran perbaikan", style: "h3", margin: [0, 14, 0, 6] },
      buildTagsTwoColumn(args),

      args.positiveQuotes.length > 0
        ? [
            { text: "Komentar positif terpilih", style: "h3", margin: [0, 14, 0, 6] },
            ...args.positiveQuotes.map((q) => buildQuoteBlock(q)),
          ]
        : undefined,

      // ---------- Halaman 3: Tindak Lanjut ----------
      { text: "", pageBreak: "before" },
      { text: "Tindak Lanjut", style: "h1" },
      { text: "Feedback dengan rating ≤ 2 yang membutuhkan perhatian.", style: "muted", margin: [0, 0, 0, 12] },
      buildFollowUpTable(args),
    ].filter(Boolean),
  };
};

// ---------- section builders ----------

const buildCoverHeader = (args: DocBuildArgs, periodLabelHuman: string): unknown => {
  const titleColumn: unknown = {
    stack: [
      { text: `LAPORAN ${RANGE_TITLE_LABEL[args.range].toUpperCase()}`, style: "kpiLabel", color: COLOR.gold, margin: [0, 0, 0, 4] },
      { text: "ISTURA", style: "h1", margin: [0, 0, 0, 2] },
      { text: "Istana Kepresidenan Yogyakarta", color: COLOR.muted, margin: [0, 0, 0, 12] },
      { text: args.period.label, fontSize: 12, bold: true, color: COLOR.navy },
      { text: periodLabelHuman, style: "muted" },
      {
        text: `Dibuat: ${formatNowLabel()}${args.generatedBy ? ` · oleh ${args.generatedBy}` : ""}`,
        style: "muted",
        margin: [0, 4, 0, 0],
      },
    ],
  };

  if (args.logoDataUrl) {
    return {
      columns: [
        titleColumn,
        { image: args.logoDataUrl, width: 80, alignment: "right" },
      ],
      columnGap: 16,
      margin: [0, 0, 0, 20],
    };
  }
  return { ...(titleColumn as object), margin: [0, 0, 0, 20] };
};

const buildKpiRow = (args: DocBuildArgs): unknown => {
  const card = (label: string, value: string, unit?: string) => ({
    stack: [
      { text: label.toUpperCase(), style: "kpiLabel" },
      { text: value, style: "kpiValue", margin: [0, 4, 0, 0] },
      unit ? { text: unit, style: "kpiUnit" } : undefined,
    ].filter(Boolean),
    fillColor: COLOR.goldLight,
    margin: [0, 0, 0, 0],
  });

  // pdfmake doesn't have card primitives; fake them with a borderless table
  // whose cells get a fillColor and padding via layout.
  return {
    table: {
      widths: ["*", "*", "*", "*"],
      body: [
        [
          card("Total Booking", String(args.kpis.total), "permohonan"),
          card("Kunjungan Terlaksana", String(args.kpis.completed), `${args.pct(args.kpis.completed)}% dari total`),
          card("Total Pengunjung", args.kpis.totalVisitors.toLocaleString("id-ID"), "orang"),
          card("Rating Rata-rata", args.kpis.overallAvg.toFixed(1), "/ 5.0"),
        ],
      ],
    },
    layout: {
      hLineWidth: () => 0,
      vLineWidth: () => 0,
      paddingLeft: () => 12,
      paddingRight: () => 12,
      paddingTop: () => 12,
      paddingBottom: () => 12,
    },
  };
};

const buildExecutiveNarrative = (args: DocBuildArgs): unknown => {
  const completedPct = args.pct(args.kpis.completed);
  const sentences: string[] = [];

  if (args.kpis.total === 0) {
    sentences.push("Tidak ada permohonan kunjungan masuk pada periode ini.");
  } else {
    sentences.push(
      `Periode ini menerima ${args.kpis.total} permohonan kunjungan. ` +
        `${args.kpis.completed} kunjungan terlaksana (${completedPct}%) dengan total ${args.kpis.totalVisitors.toLocaleString("id-ID")} pengunjung.`,
    );
  }

  if (args.feedbackCount > 0) {
    sentences.push(
      `Sebanyak ${args.feedbackCount} pengunjung mengisi feedback dengan rata-rata rating ${args.dimensions.overallAvg.toFixed(1)} dari 5.`,
    );
    if (args.topHighlights.length > 0) {
      sentences.push(
        `Aspek paling diapresiasi: ${args.topHighlights.slice(0, 3).map(([t]) => t).join(", ")}.`,
      );
    }
    if (args.topImprovements.length > 0) {
      sentences.push(
        `Area yang masih perlu peningkatan: ${args.topImprovements.slice(0, 3).map(([t]) => t).join(", ")}.`,
      );
    }
  }

  if (args.followUps.length > 0) {
    sentences.push(
      `Terdapat ${args.followUps.length} feedback dengan rating rendah (≤ 2) yang dirinci pada lampiran tindak lanjut.`,
    );
  }

  return {
    text: sentences.join(" "),
    margin: [0, 0, 0, 6],
    alignment: "justify",
  };
};

const buildStatusTable = (args: DocBuildArgs): unknown => {
  const body: unknown[][] = [
    [
      { text: "Status", style: "tableHeader" },
      { text: "Jumlah", style: "tableHeader", alignment: "right" },
      { text: "Persentase", style: "tableHeader", alignment: "right" },
      { text: "Visual", style: "tableHeader" },
    ],
  ];
  args.statusBreakdown.forEach((entry, idx) => {
    const percent = args.pct(entry.count);
    body.push([
      {
        text: entry.label,
        style: "tableCell",
        fillColor: idx % 2 === 1 ? COLOR.goldLight : undefined,
      },
      {
        text: String(entry.count),
        style: "tableCell",
        alignment: "right",
        fillColor: idx % 2 === 1 ? COLOR.goldLight : undefined,
      },
      {
        text: `${percent.toFixed(1)}%`,
        style: "tableCell",
        alignment: "right",
        fillColor: idx % 2 === 1 ? COLOR.goldLight : undefined,
      },
      // Mini bar drawn with canvas primitive: full track + filled portion.
      {
        canvas: [
          { type: "rect", x: 0, y: 4, w: 140, h: 6, color: COLOR.whisper, lineColor: COLOR.whisper },
          {
            type: "rect",
            x: 0,
            y: 4,
            w: Math.max(0, (percent / 100) * 140),
            h: 6,
            color: entry.color,
            lineColor: entry.color,
          },
        ],
        fillColor: idx % 2 === 1 ? COLOR.goldLight : undefined,
      },
    ]);
  });

  return {
    table: { widths: ["*", "auto", "auto", 150], body },
    layout: {
      hLineColor: () => COLOR.whisper,
      vLineWidth: () => 0,
      hLineWidth: (i: number) => (i === 0 || i === 1 ? 0 : 0.5),
      paddingLeft: () => 8,
      paddingRight: () => 8,
      paddingTop: () => 5,
      paddingBottom: () => 5,
    },
  };
};

const buildDimensionsTable = (args: DocBuildArgs): unknown => {
  const dims = [
    { label: "Overall", value: args.dimensions.overallAvg },
    { label: "Kemudahan booking", value: args.dimensions.easeAvg },
    { label: "Layanan", value: args.dimensions.serviceAvg },
    { label: "Recommend (NPS-style)", value: args.dimensions.recommendAvg },
  ];
  const body: unknown[][] = [
    [
      { text: "Dimensi", style: "tableHeader" },
      { text: "Skor (1-5)", style: "tableHeader", alignment: "right" },
      { text: "Visual", style: "tableHeader" },
    ],
  ];
  dims.forEach((d, idx) => {
    body.push([
      { text: d.label, style: "tableCell", fillColor: idx % 2 === 1 ? COLOR.goldLight : undefined },
      {
        text: d.value.toFixed(1),
        style: "tableCell",
        alignment: "right",
        bold: true,
        fillColor: idx % 2 === 1 ? COLOR.goldLight : undefined,
      },
      {
        canvas: [
          { type: "rect", x: 0, y: 4, w: 140, h: 6, color: COLOR.whisper, lineColor: COLOR.whisper },
          {
            type: "rect",
            x: 0,
            y: 4,
            w: Math.max(0, (d.value / 5) * 140),
            h: 6,
            color: d.value >= 4 ? COLOR.positive : d.value >= 3 ? COLOR.gold : COLOR.attention,
            lineColor: d.value >= 4 ? COLOR.positive : d.value >= 3 ? COLOR.gold : COLOR.attention,
          },
        ],
        fillColor: idx % 2 === 1 ? COLOR.goldLight : undefined,
      },
    ]);
  });
  return {
    table: { widths: ["*", "auto", 150], body },
    layout: {
      hLineColor: () => COLOR.whisper,
      vLineWidth: () => 0,
      hLineWidth: (i: number) => (i === 0 || i === 1 ? 0 : 0.5),
      paddingLeft: () => 8,
      paddingRight: () => 8,
      paddingTop: () => 5,
      paddingBottom: () => 5,
    },
  };
};

const buildDistributionRows = (args: DocBuildArgs): unknown => {
  const rows = args.distribution.map(({ stars, count }) => {
    const w = Math.max(0, (count / args.maxDistCount) * 200);
    return {
      columns: [
        { text: `${stars}★`, width: 26, color: COLOR.navy, bold: true, fontSize: 11 },
        {
          width: 220,
          canvas: [
            { type: "rect", x: 0, y: 4, w: 200, h: 8, color: COLOR.whisper, lineColor: COLOR.whisper },
            {
              type: "rect",
              x: 0,
              y: 4,
              w,
              h: 8,
              color: stars >= 4 ? COLOR.positive : stars >= 3 ? COLOR.gold : COLOR.attention,
              lineColor: stars >= 4 ? COLOR.positive : stars >= 3 ? COLOR.gold : COLOR.attention,
            },
          ],
        },
        { text: String(count), width: 30, color: COLOR.muted, alignment: "right" },
      ],
      margin: [0, 2, 0, 2],
    };
  });
  return { stack: rows };
};

const buildTagsTwoColumn = (args: DocBuildArgs): unknown => {
  const list = (entries: Array<[string, number]>, emptyMsg: string) => {
    if (entries.length === 0) return { text: emptyMsg, style: "muted" };
    return {
      ul: entries.map(([tag, count]) => ({
        text: [
          { text: `${tag} `, color: COLOR.navy },
          { text: `(${count})`, color: COLOR.muted, fontSize: 9 },
        ],
      })),
    };
  };
  return {
    columns: [
      {
        width: "*",
        stack: [
          { text: "Top Sorotan", bold: true, color: COLOR.positive, margin: [0, 0, 0, 4] },
          list(args.topHighlights, "Belum ada sorotan."),
        ],
      },
      {
        width: "*",
        stack: [
          { text: "Top Saran perbaikan", bold: true, color: COLOR.attention, margin: [0, 0, 0, 4] },
          list(args.topImprovements, "Belum ada saran."),
        ],
      },
    ],
    columnGap: 20,
  };
};

const buildQuoteBlock = (q: ReportFeedback): unknown => ({
  table: {
    widths: ["*"],
    body: [
      [
        {
          stack: [
            { text: `"${q.comment}"`, style: "quote" },
            {
              text: `— ${q.code}${q.submittedAt ? ` · ${q.submittedAt}` : ""}`,
              style: "muted",
              margin: [0, 4, 0, 0],
            },
          ],
        },
      ],
    ],
  },
  layout: {
    hLineWidth: () => 0,
    vLineWidth: (i: number) => (i === 0 ? 2 : 0),
    vLineColor: () => COLOR.gold,
    paddingLeft: () => 12,
    paddingRight: () => 8,
    paddingTop: () => 6,
    paddingBottom: () => 6,
  },
  margin: [0, 0, 0, 6],
});

const buildFollowUpTable = (args: DocBuildArgs): unknown => {
  if (args.followUps.length === 0) {
    return {
      text: "Tidak ada feedback dengan rating ≤ 2 pada periode ini. ",
      style: "muted",
    };
  }
  const body: unknown[][] = [
    [
      { text: "Kode", style: "tableHeader" },
      { text: "Rating", style: "tableHeader", alignment: "center" },
      { text: "Komentar", style: "tableHeader" },
      { text: "Saran perbaikan", style: "tableHeader" },
    ],
  ];
  args.followUps.forEach((f, idx) => {
    const fill = idx % 2 === 1 ? COLOR.goldLight : undefined;
    body.push([
      { text: f.code, style: "tableCell", fillColor: fill },
      {
        text: `${f.rating}★`,
        style: "tableCell",
        alignment: "center",
        bold: true,
        color: COLOR.attention,
        fillColor: fill,
      },
      { text: truncate(f.comment, 220), style: "tableCell", fillColor: fill },
      { text: f.improvements.join(", ") || "—", style: "tableCell", fillColor: fill },
    ]);
  });
  return {
    table: { widths: [80, 40, "*", 130], body, dontBreakRows: true },
    layout: {
      hLineColor: () => COLOR.whisper,
      vLineWidth: () => 0,
      hLineWidth: (i: number) => (i === 0 || i === 1 ? 0 : 0.5),
      paddingLeft: () => 6,
      paddingRight: () => 6,
      paddingTop: () => 6,
      paddingBottom: () => 6,
    },
  };
};

// Monthly executive report generator.
//
// Produces an A4 portrait PDF summarizing booking + feedback over a chosen
// period. Designed for *reading*, not for further data manipulation:
// pimpinan/protokoler open it, skim KPIs, optionally print or forward.
//
// Shared PDF scaffolding (pdfmake loading, styles, cover/KPI/footer, and the
// feedback "voice of visitor" section) lives in exportPdfShared.ts so the
// booking and feedback PDF reports stay consistent with this one.

import {
  bookingReportDate,
  feedbackReportDate,
  formatDateKey,
  isWithinRangeByDate,
  monthNamesId,
  resolveRange,
} from "./exportShared";
import { BOOKING_STATUS_LABELS } from "./domain/booking";
import type { ExportRange } from "./exportShared";
import {
  COLOR,
  PDF_DEFAULT_STYLE,
  PDF_STYLES,
  buildCoverHeader,
  buildFeedbackVoiceBody,
  buildFollowUpNodes,
  buildKpiRow,
  buildFooter,
  buildStatusTable,
  computeFeedbackInsights,
  fetchImageAsDataUrl,
  generateAndDownloadPdf,
  periodLabelHumanOf,
} from "./exportPdfShared";
import type { FeedbackInsights, PeriodResolved } from "./exportPdfShared";

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
  reportDate?: string | null;
  time: string;
  status: "Pending" | "Accepted" | "Rejected" | "Reschedule" | "Completed" | "Expired";
  submittedAt: string | null;
  completedAt?: string;
  rejectedAt?: string;
  expiredAt?: string;
  proposedDate?: string | null;
  note?: string;
};

export type ReportFeedback = {
  code: string;
  rating: number;
  bookingEase: number;
  service: number;
  guideQuality?: number | null;
  facilityComfort?: number | null;
  recommend: number;
  visitedBefore?: boolean | null;
  discoverySource?: string | null;
  discoverySourceOther?: string;
  highlights: string[];
  improvements: string[];
  comment: string;
  allowPublish: boolean;
  submittedAt?: string;
  dateKey?: string;
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

const RANGE_TITLE_LABEL: Record<MonthlyReportRange, string> = {
  week: "Mingguan",
  month: "Bulanan",
  quarter: "Triwulanan",
  year: "Tahunan",
  custom: "Periode Pilihan",
};

// Triwulan = 3 bulan kalender berjalan (Jan-Mar, Apr-Jun, Jul-Sep, Okt-Des).
const resolveQuarter = (): PeriodResolved => {
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
): PeriodResolved => {
  if (range === "quarter") return resolveQuarter();
  return resolveRange(range as ExportRange, customFrom, customTo);
};

const bookingFilterDate = (b: ReportBooking): Date => bookingReportDate(b);

const feedbackFilterDate = (
  f: ReportFeedback,
  bookingDateByCode: Map<string, string>,
): Date => feedbackReportDate({ ...f, dateKey: f.dateKey ?? bookingDateByCode.get(f.code) });

// ---------- main entry ----------

export const exportMonthlyReport = async (
  options: MonthlyReportOptions,
): Promise<MonthlyReportResult> => {
  const { bookings, feedbacks, range, customFrom, customTo, generatedBy, logoUrl } = options;

  const period = resolvePeriod(range, customFrom, customTo);
  const bookingDateByCode = new Map(bookings.map((booking) => [booking.code, booking.date]));

  const periodBookings = bookings.filter((b) =>
    isWithinRangeByDate(bookingFilterDate(b), period.from, period.to),
  );
  const periodFeedbacks = feedbacks.filter((f) =>
    isWithinRangeByDate(feedbackFilterDate(f, bookingDateByCode), period.from, period.to),
  );

  // Booking KPIs.
  const total = periodBookings.length;
  const completed = periodBookings.filter((b) => b.status === "Completed");
  const accepted = periodBookings.filter((b) => b.status === "Accepted");
  const rejected = periodBookings.filter((b) => b.status === "Rejected");
  const reschedule = periodBookings.filter((b) => b.status === "Reschedule");
  const pending = periodBookings.filter((b) => b.status === "Pending");
  const expired = periodBookings.filter((b) => b.status === "Expired");
  const totalVisitors = completed.reduce((sum, b) => sum + (b.groupSize ?? 0), 0);
  const pct = (count: number) => (total === 0 ? 0 : Math.round((count / total) * 1000) / 10);

  // Feedback insights (shared with the standalone feedback report).
  const insights = computeFeedbackInsights(periodFeedbacks, (f) =>
    feedbackFilterDate(f, bookingDateByCode),
  );

  const logoDataUrl = logoUrl ? await fetchImageAsDataUrl(logoUrl) : null;

  const docDefinition = buildDocDefinition({
    period,
    range,
    generatedBy,
    logoDataUrl,
    kpis: { total, completed: completed.length, totalVisitors, overallAvg: insights.dimensions.overallAvg },
    statusBreakdown: [
      { label: BOOKING_STATUS_LABELS.Pending, count: pending.length, color: COLOR.muted },
      { label: BOOKING_STATUS_LABELS.Accepted, count: accepted.length, color: "#3B82F6" },
      { label: BOOKING_STATUS_LABELS.Reschedule, count: reschedule.length, color: COLOR.gold },
      { label: BOOKING_STATUS_LABELS.Expired, count: expired.length, color: COLOR.muted },
      { label: BOOKING_STATUS_LABELS.Completed, count: completed.length, color: COLOR.positive },
      { label: BOOKING_STATUS_LABELS.Rejected, count: rejected.length, color: COLOR.attention },
    ],
    pct,
    insights,
  });

  const filename = `ISTURA-Laporan-${RANGE_TITLE_LABEL[range]}-${formatDateKey(new Date()).replace(/-/g, "")}.pdf`;
  await generateAndDownloadPdf(docDefinition, filename);

  return {
    filename,
    bookingCount: periodBookings.length,
    feedbackCount: periodFeedbacks.length,
  };
};

// ---------- docDefinition builder ----------

type DocBuildArgs = {
  period: PeriodResolved;
  range: MonthlyReportRange;
  generatedBy?: string;
  logoDataUrl: string | null;
  kpis: { total: number; completed: number; totalVisitors: number; overallAvg: number };
  statusBreakdown: Array<{ label: string; count: number; color: string }>;
  pct: (count: number) => number;
  insights: FeedbackInsights;
};

const buildDocDefinition = (args: DocBuildArgs): unknown => {
  const periodLabelHuman = periodLabelHumanOf(args.period);

  return {
    pageSize: "A4",
    pageMargins: [40, 60, 40, 60],
    info: {
      title: `Laporan ${RANGE_TITLE_LABEL[args.range]} ISTURA`,
      author: args.generatedBy ?? "ISTURA Admin",
    },
    defaultStyle: PDF_DEFAULT_STYLE,
    styles: PDF_STYLES,
    footer: buildFooter(`Laporan ${RANGE_TITLE_LABEL[args.range]}`),
    content: [
      // ---------- Halaman 1: Cover & Ringkasan Eksekutif ----------
      buildCoverHeader({
        eyebrow: `Laporan ${RANGE_TITLE_LABEL[args.range]}`,
        period: args.period,
        generatedBy: args.generatedBy,
        logoDataUrl: args.logoDataUrl,
      }),
      { text: "Ringkasan Eksekutif", style: "h2" },
      buildKpiRow([
        { label: "Total Booking", value: String(args.kpis.total), unit: "permohonan" },
        { label: "Kunjungan Terlaksana", value: String(args.kpis.completed), unit: `${args.pct(args.kpis.completed)}% dari total` },
        { label: "Total Pengunjung", value: args.kpis.totalVisitors.toLocaleString("id-ID"), unit: "orang" },
        { label: "Rating Rata-rata", value: args.kpis.overallAvg.toFixed(1), unit: "/ 5.0" },
      ]),
      { text: "Sorotan periode", style: "h3", margin: [0, 12, 0, 4] },
      buildExecutiveNarrative(args),
      { text: "Distribusi status permohonan", style: "h3", margin: [0, 14, 0, 6] },
      buildStatusTable(args.statusBreakdown, args.pct),

      // ---------- Halaman 2: Suara Pengunjung ----------
      { text: "", pageBreak: "before" },
      { text: "Suara Pengunjung", style: "h1" },
      { text: `${args.insights.feedbackCount} feedback diterima · ${periodLabelHuman}`, style: "muted", margin: [0, 0, 0, 12] },
      ...buildFeedbackVoiceBody(args.insights),

      // ---------- Halaman 3: Tindak Lanjut (halaman sendiri bila ada isi) ----------
      ...buildFollowUpNodes(args.insights),
    ],
  };
};

// ---------- booking-specific section builders ----------

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

  if (args.insights.feedbackCount > 0) {
    sentences.push(
      `Sebanyak ${args.insights.feedbackCount} pengunjung mengisi feedback dengan rata-rata rating ${args.insights.dimensions.overallAvg.toFixed(1)} dari 5.`,
    );
    if (args.insights.topHighlights.length > 0) {
      sentences.push(
        `Aspek paling diapresiasi: ${args.insights.topHighlights.slice(0, 3).map(([t]) => t).join(", ")}.`,
      );
    }
    if (args.insights.topImprovements.length > 0) {
      sentences.push(
        `Area yang masih perlu peningkatan: ${args.insights.topImprovements.slice(0, 3).map(([t]) => t).join(", ")}.`,
      );
    }
  }

  if (args.insights.followUps.length > 0) {
    sentences.push(
      `Terdapat ${args.insights.followUps.length} feedback dengan rating rendah (≤ 2) yang dirinci pada lampiran tindak lanjut.`,
    );
  }

  return {
    text: sentences.join(" "),
    margin: [0, 0, 0, 6],
    alignment: "justify",
  };
};

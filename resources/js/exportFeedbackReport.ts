// Feedback PDF report generator.
//
// Executive-style A4 portrait PDF scoped to feedback only (companion to the
// detailed Excel export). Reuses the shared "voice of visitor" section so the
// rating dimensions, distribution, visitor profile, discovery source, tags,
// quotes, and follow-up render identically to the monthly report.

import {
  RANGE_FILENAME,
  feedbackReportDate,
  formatDateKey,
  isWithinRangeByDate,
  resolveRange,
} from "./exportShared";
import type { ExportRange } from "./exportShared";
import type { FeedbackExportInput, FeedbackExportScope } from "./exportFeedback";
import {
  buildCoverHeader,
  buildFeedbackVoiceBody,
  buildFollowUpNodes,
  buildFooter,
  buildKpiRow,
  computeFeedbackInsights,
  fetchImageAsDataUrl,
  generateAndDownloadPdf,
  PDF_DEFAULT_STYLE,
  PDF_STYLES,
  periodLabelHumanOf,
} from "./exportPdfShared";

export type FeedbackReportOptions = {
  feedbacks: FeedbackExportInput[];
  scope: FeedbackExportScope;
  range: ExportRange;
  customFrom?: string;
  customTo?: string;
  generatedBy?: string;
  logoUrl?: string;
};

export type FeedbackReportResult = {
  filename: string;
  feedbackCount: number;
};

const SCOPE_LABEL: Record<FeedbackExportScope, string> = {
  all: "Semua",
  positive: "Positif",
  attention: "Perhatian",
};

const SCOPE_TITLE: Record<FeedbackExportScope, string> = {
  all: "Semua feedback",
  positive: "Feedback positif (rating ≥ 4)",
  attention: "Feedback perlu perhatian (rating ≤ 3)",
};

const RANGE_TITLE: Record<ExportRange, string> = {
  week: "Mingguan",
  month: "Bulanan",
  year: "Tahunan",
  custom: "Periode Pilihan",
};

const inScope = (f: FeedbackExportInput, scope: FeedbackExportScope): boolean => {
  if (scope === "all") return true;
  if (scope === "positive") return f.rating >= 4;
  return f.rating <= 3;
};

export const exportFeedbackReport = async (
  options: FeedbackReportOptions,
): Promise<FeedbackReportResult> => {
  const { feedbacks, scope, range, customFrom, customTo, generatedBy, logoUrl } = options;

  const { from, to } = resolveRange(range, customFrom, customTo);
  const period = { from, to, label: `Feedback ${RANGE_TITLE[range]}` };

  const scoped = feedbacks
    .filter((f) => inScope(f, scope))
    .filter((f) => isWithinRangeByDate(feedbackReportDate(f), from, to));

  const insights = computeFeedbackInsights(scoped, (f) => feedbackReportDate(f));

  const positiveCount = scoped.filter((f) => f.rating >= 4).length;
  const attentionCount = scoped.filter((f) => f.rating <= 3).length;
  const sharePct = (count: number) =>
    scoped.length === 0 ? 0 : Math.round((count / scoped.length) * 1000) / 10;

  const logoDataUrl = logoUrl ? await fetchImageAsDataUrl(logoUrl) : null;
  const periodLabelHuman = periodLabelHumanOf(period);

  const docDefinition = {
    pageSize: "A4",
    pageMargins: [40, 60, 40, 60],
    info: {
      title: `Laporan Feedback ${RANGE_TITLE[range]} ISTURA`,
      author: generatedBy ?? "ISTURA Admin",
    },
    defaultStyle: PDF_DEFAULT_STYLE,
    styles: PDF_STYLES,
    footer: buildFooter(`Laporan Feedback ${RANGE_TITLE[range]}`),
    content: [
      buildCoverHeader({
        eyebrow: `Laporan Feedback ${RANGE_TITLE[range]}`,
        period,
        generatedBy,
        logoDataUrl,
      }),
      { text: `Lingkup: ${SCOPE_TITLE[scope]}`, style: "muted", margin: [0, 0, 0, 12] },
      { text: "Ringkasan", style: "h2" },
      buildKpiRow([
        { label: "Total Feedback", value: String(insights.feedbackCount), unit: "tanggapan" },
        { label: "Rating Rata-rata", value: insights.dimensions.overallAvg.toFixed(1), unit: "/ 5.0" },
        { label: "Positif (≥4)", value: String(positiveCount), unit: `${sharePct(positiveCount)}% dari total` },
        { label: "Perlu Perhatian (≤3)", value: String(attentionCount), unit: `${sharePct(attentionCount)}% dari total` },
      ]),
      { text: `Suara Pengunjung`, style: "h2" },
      { text: `${insights.feedbackCount} feedback · ${periodLabelHuman}`, style: "muted", margin: [0, 0, 0, 12] },
      ...buildFeedbackVoiceBody(insights),

      ...buildFollowUpNodes(insights),
    ],
  };

  const filename = `ISTURA-Feedback-${SCOPE_LABEL[scope]}-${RANGE_FILENAME[range]}-${formatDateKey(new Date()).replace(/-/g, "")}.pdf`;
  await generateAndDownloadPdf(docDefinition, filename);

  return { filename, feedbackCount: insights.feedbackCount };
};

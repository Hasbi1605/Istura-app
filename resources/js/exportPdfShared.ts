// Shared scaffolding for browser-generated PDF reports (monthly executive,
// booking, feedback). Centralizes pdfmake loading, color tokens, base styles,
// cover/KPI/footer builders, and the feedback "voice of visitor" section so
// the three report generators stay consistent and DRY.
//
// pdfmake is dynamically imported by loadPdfMake() so the initial bundle stays
// lean. Image embedding converts WebP UI assets to PNG because pdfmake only
// accepts PNG/JPEG.

import { THEME, formatLongLabel, formatNowLabel } from "./exportShared";

// ---------- color tokens & base styles ----------

// pdfmake expects #RRGGBB; THEME constants are ARGB. Convert once.
const argbToHex = (argb: string) => `#${argb.slice(2)}`;

export const COLOR = {
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

export const PDF_DEFAULT_STYLE = {
  font: "Roboto",
  fontSize: 10,
  color: COLOR.black,
  lineHeight: 1.35,
};

export const PDF_STYLES = {
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
};

// Shared layout for borderless metric tables (status / dimensions).
export const METRIC_TABLE_LAYOUT = {
  hLineColor: () => COLOR.whisper,
  vLineWidth: () => 0,
  hLineWidth: (i: number) => (i === 0 || i === 1 ? 0 : 0.5),
  paddingLeft: () => 8,
  paddingRight: () => 8,
  paddingTop: () => 5,
  paddingBottom: () => 5,
};

// ---------- small utils ----------

// Average + round to one decimal. 0 for empty input (not NaN).
export const avg1 = (values: number[]): number => {
  if (values.length === 0) return 0;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
};

export const tally = (lists: string[][]): Map<string, number> => {
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

export const truncate = (text: string, max: number): string => {
  if (!text) return "";
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trimEnd() + "…";
};

// pdfmake's default Roboto VFS font has no ★ (U+2605) glyph, so a literal star
// renders as a notdef box. Draw a real vector star via the SVG element.
export const starSvg = (color: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path d="M12 .587l3.668 7.431 8.2 1.192-5.934 5.787 1.401 8.172L12 18.896l-7.335 3.863 1.401-8.172L.132 9.21l8.2-1.192z" fill="${color}"/></svg>`;

export const ratingTierColor = (stars: number): string =>
  stars >= 4 ? COLOR.positive : stars >= 3 ? COLOR.gold : COLOR.attention;

// Label sumber informasi (selaras dengan default CMS feedback di constants.ts).
export const DISCOVERY_LABELS: Record<string, string> = {
  social_media: "Media sosial",
  friends_family: "Teman atau keluarga",
  school_institution: "Sekolah atau instansi",
  web_search: "Situs web atau Google",
  previous_visit: "Kunjungan sebelumnya",
  other: "Lainnya",
};

// ---------- pdfmake loading & output ----------

const PDF_GENERATION_TIMEOUT_MS = 30000;

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

const canUseDataUrlInPdf = (dataUrl: string): boolean =>
  /^data:image\/(png|jpe?g);base64,/i.test(dataUrl);

const rasterImageDataUrlToPngDataUrl = async (dataUrl: string): Promise<string | null> => {
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Report logo failed to load"));
      image.src = dataUrl;
    });

    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    if (!width || !height) return null;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
};

// Convert URL-fetched image to a pdfmake-safe data URL. Browser UI uses WebP
// assets, but pdfmake accepts PNG/JPEG only for embedded images.
export const fetchImageAsDataUrl = async (url: string): Promise<string | null> => {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    const dataUrl = await blobToDataUrl(blob);
    if (canUseDataUrlInPdf(dataUrl)) return dataUrl;
    return await rasterImageDataUrlToPngDataUrl(dataUrl);
  } catch {
    return null;
  }
};

type PdfDoc = { getBlob: (callback: (blob: Blob) => void) => void };

export const createPdfBlob = (pdfDoc: PdfDoc): Promise<Blob> =>
  new Promise<Blob>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(new Error("PDF generation timed out"));
    }, PDF_GENERATION_TIMEOUT_MS);

    pdfDoc.getBlob((blob) => {
      window.clearTimeout(timeout);
      resolve(blob);
    });
  });

type PdfMake = {
  createPdf: (def: unknown) => PdfDoc;
  vfs?: Record<string, string>;
};

// Dynamically import pdfmake + its VFS fonts and wire them together. The UMD
// bundle exposes createPdf/vfs under different keys depending on the bundler
// shim, so probe a few shapes.
export const loadPdfMake = async (): Promise<PdfMake> => {
  const pdfMakeModule = await import("pdfmake/build/pdfmake.js");
  const vfsModule = await import("pdfmake/build/vfs_fonts.js");
  const pdfMakeAny = pdfMakeModule as unknown as Record<string, unknown>;
  const pdfMake = (pdfMakeAny.default ?? pdfMakeAny) as PdfMake;
  const vfsAny = vfsModule as unknown as Record<string, unknown>;
  const vfsCandidate =
    (vfsAny.pdfMake as { vfs?: Record<string, string> } | undefined)?.vfs ??
    ((vfsAny.default as { pdfMake?: { vfs?: Record<string, string> } } | undefined)?.pdfMake?.vfs);
  if (vfsCandidate) pdfMake.vfs = vfsCandidate;
  return pdfMake;
};

// Build → download a PDF in the browser. Returns nothing; throws on timeout.
export const generateAndDownloadPdf = async (
  docDefinition: unknown,
  filename: string,
): Promise<void> => {
  const pdfMake = await loadPdfMake();
  const blob = await createPdfBlob(pdfMake.createPdf(docDefinition));
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

// ---------- generic document builders ----------

export type PeriodResolved = { from: Date; to: Date; label: string };

export const periodLabelHumanOf = (period: PeriodResolved): string =>
  `${formatLongLabel(period.from)} – ${formatLongLabel(period.to)}`;

// Centered footer with page numbers. `scope` is e.g. "Laporan Bulanan".
export const buildFooter = (scope: string) =>
  (currentPage: number, pageCount: number) => ({
    text: `ISTURA · ${scope} · Halaman ${currentPage} dari ${pageCount}`,
    alignment: "center",
    style: "footerNote",
    margin: [40, 20, 40, 0],
  });

// Cover header: gold eyebrow + ISTURA title + period + generated-by, with an
// optional logo aligned right.
export const buildCoverHeader = (opts: {
  eyebrow: string;
  period: PeriodResolved;
  generatedBy?: string;
  logoDataUrl: string | null;
}): unknown => {
  const titleColumn: unknown = {
    stack: [
      { text: opts.eyebrow.toUpperCase(), style: "kpiLabel", color: COLOR.gold, margin: [0, 0, 0, 4] },
      { text: "ISTURA", style: "h1", margin: [0, 0, 0, 2] },
      { text: "Istana Kepresidenan Yogyakarta", color: COLOR.muted, margin: [0, 0, 0, 12] },
      { text: opts.period.label, fontSize: 12, bold: true, color: COLOR.navy },
      { text: periodLabelHumanOf(opts.period), style: "muted" },
      {
        text: `Dibuat: ${formatNowLabel()}${opts.generatedBy ? ` · oleh ${opts.generatedBy}` : ""}`,
        style: "muted",
        margin: [0, 4, 0, 0],
      },
    ],
  };

  if (opts.logoDataUrl) {
    return {
      columns: [titleColumn, { image: opts.logoDataUrl, width: 80, alignment: "right" }],
      columnGap: 16,
      margin: [0, 0, 0, 20],
    };
  }
  return { ...(titleColumn as object), margin: [0, 0, 0, 20] };
};

export type KpiCard = { label: string; value: string; unit?: string };

// KPI cards row (2-4 cards). pdfmake has no card primitive, so we fake them
// with a borderless table whose cells get a fillColor + padding.
export const buildKpiRow = (cards: KpiCard[]): unknown => {
  const cell = ({ label, value, unit }: KpiCard) => ({
    stack: [
      { text: label.toUpperCase(), style: "kpiLabel" },
      { text: value, style: "kpiValue", margin: [0, 4, 0, 0] },
      unit ? { text: unit, style: "kpiUnit" } : undefined,
    ].filter(Boolean),
    fillColor: COLOR.goldLight,
    margin: [0, 0, 0, 0],
  });
  return {
    table: {
      widths: cards.map(() => "*"),
      body: [cards.map(cell)],
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

// ---------- feedback ("voice of visitor") insights & builders ----------

// Minimal structural shape needed to compute feedback insights. Both the
// monthly report and the standalone feedback report satisfy this.
export type FeedbackInsightInput = {
  code: string;
  rating: number;
  bookingEase: number;
  service: number;
  guideQuality?: number | null;
  facilityComfort?: number | null;
  recommend: number;
  visitedBefore?: boolean | null;
  discoverySource?: string | null;
  highlights: string[];
  improvements: string[];
  comment: string;
  allowPublish: boolean;
  submittedAt?: string;
};

export type FeedbackInsights = {
  feedbackCount: number;
  dimensions: {
    overallAvg: number;
    easeAvg: number;
    serviceAvg: number;
    guideAvg: number | null;
    facilityAvg: number | null;
    recommendAvg: number;
  };
  distribution: Array<{ stars: number; count: number }>;
  maxDistCount: number;
  visitorProfile: { first: number; repeat: number };
  discoveryDistribution: Array<{ label: string; count: number }>;
  topHighlights: Array<[string, number]>;
  topImprovements: Array<[string, number]>;
  positiveQuotes: FeedbackInsightInput[];
  followUps: FeedbackInsightInput[];
};

// Compute all feedback aggregates from an already period-filtered list.
// `dateOf` orders the positive quotes (most recent first).
export const computeFeedbackInsights = <T extends FeedbackInsightInput>(
  feedbacks: T[],
  dateOf: (f: T) => Date,
): FeedbackInsights => {
  const overallAvg = avg1(feedbacks.map((f) => f.rating));
  const easeAvg = avg1(feedbacks.map((f) => f.bookingEase));
  const serviceAvg = avg1(feedbacks.map((f) => f.service));
  const recommendAvg = avg1(feedbacks.map((f) => f.recommend));

  const validScore = (v: number | null | undefined): v is number =>
    typeof v === "number" && v > 0;
  const guideValues = feedbacks.map((f) => f.guideQuality).filter(validScore);
  const facilityValues = feedbacks.map((f) => f.facilityComfort).filter(validScore);
  const guideAvg = guideValues.length > 0 ? avg1(guideValues) : null;
  const facilityAvg = facilityValues.length > 0 ? avg1(facilityValues) : null;

  const distribution = [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    count: feedbacks.filter((f) => f.rating === stars).length,
  }));
  const maxDistCount = Math.max(1, ...distribution.map((d) => d.count));

  const firstVisitCount = feedbacks.filter((f) => f.visitedBefore === false).length;
  const repeatVisitCount = feedbacks.filter((f) => f.visitedBefore === true).length;

  const discoveryTally = new Map<string, number>();
  for (const f of feedbacks) {
    if (!f.discoverySource) continue;
    discoveryTally.set(f.discoverySource, (discoveryTally.get(f.discoverySource) ?? 0) + 1);
  }
  const discoveryDistribution = Array.from(discoveryTally.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([source, count]) => ({ label: DISCOVERY_LABELS[source] ?? source, count }));

  const topHighlights = Array.from(tally(feedbacks.map((f) => f.highlights)).entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const topImprovements = Array.from(tally(feedbacks.map((f) => f.improvements)).entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const positiveQuotes = feedbacks
    .filter((f) => f.rating === 5 && f.allowPublish && f.comment.trim().length > 0)
    .sort((a, b) => dateOf(b).getTime() - dateOf(a).getTime())
    .slice(0, 3);

  const followUps = feedbacks
    .filter((f) => f.rating <= 2)
    .sort((a, b) => a.rating - b.rating);

  return {
    feedbackCount: feedbacks.length,
    dimensions: { overallAvg, easeAvg, serviceAvg, guideAvg, facilityAvg, recommendAvg },
    distribution,
    maxDistCount,
    visitorProfile: { first: firstVisitCount, repeat: repeatVisitCount },
    discoveryDistribution,
    topHighlights,
    topImprovements,
    positiveQuotes,
    followUps,
  };
};

const buildDimensionsTable = (insights: FeedbackInsights): unknown => {
  const { dimensions } = insights;
  const dims = [
    { label: "Overall", value: dimensions.overallAvg },
    { label: "Kemudahan booking", value: dimensions.easeAvg },
    { label: "Layanan", value: dimensions.serviceAvg },
    { label: "Kualitas pemandu", value: dimensions.guideAvg },
    { label: "Kebersihan & kenyamanan", value: dimensions.facilityAvg },
    { label: "Recommend (NPS-style)", value: dimensions.recommendAvg },
  ];
  const body: unknown[][] = [
    [
      { text: "Dimensi", style: "tableHeader" },
      { text: "Skor (1-5)", style: "tableHeader", alignment: "right" },
      { text: "Visual", style: "tableHeader" },
    ],
  ];
  dims.forEach((d, idx) => {
    const value = d.value;
    const barWidth = value !== null ? Math.max(0, (value / 5) * 140) : 0;
    const barColor =
      value === null
        ? COLOR.whisper
        : value >= 4
          ? COLOR.positive
          : value >= 3
            ? COLOR.gold
            : COLOR.attention;
    body.push([
      { text: d.label, style: "tableCell", fillColor: idx % 2 === 1 ? COLOR.goldLight : undefined },
      {
        text: value !== null ? value.toFixed(1) : "—",
        style: "tableCell",
        alignment: "right",
        bold: true,
        color: value !== null ? COLOR.black : COLOR.muted,
        fillColor: idx % 2 === 1 ? COLOR.goldLight : undefined,
      },
      {
        canvas: [
          { type: "rect", x: 0, y: 4, w: 140, h: 6, color: COLOR.whisper, lineColor: COLOR.whisper },
          { type: "rect", x: 0, y: 4, w: barWidth, h: 6, color: barColor, lineColor: barColor },
        ],
        fillColor: idx % 2 === 1 ? COLOR.goldLight : undefined,
      },
    ]);
  });
  return {
    table: { widths: ["*", "auto", 150], body },
    layout: METRIC_TABLE_LAYOUT,
  };
};

const buildDistributionRows = (insights: FeedbackInsights): unknown => {
  const rows = insights.distribution.map(({ stars, count }) => {
    const w = Math.max(0, (count / insights.maxDistCount) * 200);
    return {
      columns: [
        {
          width: 26,
          columns: [
            { width: "auto", text: `${stars}`, color: COLOR.navy, bold: true, fontSize: 11, margin: [0, 0, 3, 0] },
            { width: "auto", svg: starSvg(ratingTierColor(stars)), fit: [11, 11], margin: [0, 2, 0, 0] },
          ],
          columnGap: 0,
        },
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
              color: ratingTierColor(stars),
              lineColor: ratingTierColor(stars),
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

const buildVisitorProfile = (insights: FeedbackInsights): unknown => {
  const { first, repeat } = insights.visitorProfile;
  const answered = first + repeat;
  if (answered === 0) {
    return { text: "Belum ada data profil kunjungan pada periode ini.", style: "muted" };
  }
  const row = (label: string, count: number, color: string) => {
    const pctVal = Math.round((count / answered) * 100);
    const w = (count / answered) * 200;
    return {
      columns: [
        { width: 120, text: label, color: COLOR.navy, fontSize: 9 },
        {
          width: 210,
          canvas: [
            { type: "rect", x: 0, y: 4, w: 200, h: 8, color: COLOR.whisper, lineColor: COLOR.whisper },
            { type: "rect", x: 0, y: 4, w: Math.max(0, w), h: 8, color, lineColor: color },
          ],
        },
        { width: "auto", text: `${count} (${pctVal}%)`, color: COLOR.muted, fontSize: 9 },
      ],
      columnGap: 8,
      margin: [0, 2, 0, 2],
    };
  };
  return {
    stack: [
      row("Kunjungan pertama", first, COLOR.gold),
      row("Pernah berkunjung", repeat, COLOR.positive),
    ],
  };
};

const buildDiscoveryRows = (insights: FeedbackInsights): unknown => {
  if (insights.discoveryDistribution.length === 0) {
    return { text: "Belum ada data sumber informasi pada periode ini.", style: "muted" };
  }
  const maxCount = Math.max(1, ...insights.discoveryDistribution.map((d) => d.count));
  const rows = insights.discoveryDistribution.map(({ label, count }) => {
    const w = (count / maxCount) * 200;
    return {
      columns: [
        { width: 120, text: label, color: COLOR.navy, fontSize: 9 },
        {
          width: 210,
          canvas: [
            { type: "rect", x: 0, y: 4, w: 200, h: 8, color: COLOR.whisper, lineColor: COLOR.whisper },
            { type: "rect", x: 0, y: 4, w: Math.max(0, w), h: 8, color: COLOR.gold, lineColor: COLOR.gold },
          ],
        },
        { width: "auto", text: String(count), color: COLOR.muted, fontSize: 9 },
      ],
      columnGap: 8,
      margin: [0, 2, 0, 2],
    };
  });
  return { stack: rows };
};

const buildTagsTwoColumn = (insights: FeedbackInsights): unknown => {
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
          list(insights.topHighlights, "Belum ada sorotan."),
        ],
      },
      {
        width: "*",
        stack: [
          { text: "Top Saran perbaikan", bold: true, color: COLOR.attention, margin: [0, 0, 0, 4] },
          list(insights.topImprovements, "Belum ada saran."),
        ],
      },
    ],
    columnGap: 20,
  };
};

const buildQuoteBlock = (q: FeedbackInsightInput): unknown => ({
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

export const buildFollowUpTable = (insights: FeedbackInsights): unknown => {
  if (insights.followUps.length === 0) {
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
  insights.followUps.forEach((f, idx) => {
    const fill = idx % 2 === 1 ? COLOR.goldLight : undefined;
    body.push([
      { text: f.code, style: "tableCell", fillColor: fill },
      {
        fillColor: fill,
        margin: [0, 2, 0, 2],
        columns: [
          { width: "*", text: "" },
          { width: "auto", text: `${f.rating}`, bold: true, color: COLOR.attention, fontSize: 9, margin: [0, 0, 3, 0] },
          { width: "auto", svg: starSvg(COLOR.attention), fit: [9, 9], margin: [0, 1, 0, 0] },
          { width: "*", text: "" },
        ],
        columnGap: 0,
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
      paddingLeft: () => 8,
      paddingRight: () => 8,
      paddingTop: () => 5,
      paddingBottom: () => 5,
    },
  };
};

// The shared "voice of visitor" body: dimensions, distribution, visitor
// profile, discovery, highlights/improvements, and optional positive quotes.
// Callers prepend their own heading/intro and append the follow-up section.
export const buildFeedbackVoiceBody = (insights: FeedbackInsights): unknown[] => {
  const nodes: unknown[] = [
    { text: "Rata-rata penilaian", style: "h3" },
    buildDimensionsTable(insights),

    { text: "Distribusi rating overall", style: "h3", margin: [0, 14, 0, 6] },
    buildDistributionRows(insights),

    { text: "Profil pengunjung", style: "h3", margin: [0, 14, 0, 6] },
    buildVisitorProfile(insights),

    { text: "Sumber mengetahui ISTURA", style: "h3", margin: [0, 14, 0, 6] },
    buildDiscoveryRows(insights),

    { text: "Sorotan & Saran perbaikan", style: "h3", margin: [0, 14, 0, 6] },
    buildTagsTwoColumn(insights),
  ];
  if (insights.positiveQuotes.length > 0) {
    nodes.push({ text: "Komentar positif terpilih", style: "h3", margin: [0, 14, 0, 6] });
    insights.positiveQuotes.forEach((q) => nodes.push(buildQuoteBlock(q)));
  }
  return nodes;
};

// Follow-up section nodes. Gets its own page only when there is content;
// otherwise it is appended inline to avoid a nearly-empty page.
export const buildFollowUpNodes = (insights: FeedbackInsights): unknown[] =>
  insights.followUps.length > 0
    ? [
        { text: "", pageBreak: "before" },
        { text: "Tindak Lanjut", style: "h1" },
        { text: "Feedback dengan rating ≤ 2 yang membutuhkan perhatian.", style: "muted", margin: [0, 0, 0, 12] },
        buildFollowUpTable(insights),
      ]
    : [
        { text: "Tindak Lanjut", style: "h2" },
        buildFollowUpTable(insights),
      ];

// ---------- booking status distribution table ----------

export type StatusBreakdownEntry = { label: string; count: number; color: string };

// "Distribusi status permohonan" table: status | jumlah | persentase | bar.
export const buildStatusTable = (
  statusBreakdown: StatusBreakdownEntry[],
  pct: (count: number) => number,
): unknown => {
  const body: unknown[][] = [
    [
      { text: "Status", style: "tableHeader" },
      { text: "Jumlah", style: "tableHeader", alignment: "right" },
      { text: "Persentase", style: "tableHeader", alignment: "right" },
      { text: "Visual", style: "tableHeader" },
    ],
  ];
  statusBreakdown.forEach((entry, idx) => {
    const percent = pct(entry.count);
    const fill = idx % 2 === 1 ? COLOR.goldLight : undefined;
    body.push([
      { text: entry.label, style: "tableCell", fillColor: fill },
      { text: String(entry.count), style: "tableCell", alignment: "right", fillColor: fill },
      { text: `${percent.toFixed(1)}%`, style: "tableCell", alignment: "right", fillColor: fill },
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
        fillColor: fill,
      },
    ]);
  });
  return {
    table: { widths: ["*", "auto", "auto", 150], body },
    layout: METRIC_TABLE_LAYOUT,
  };
};

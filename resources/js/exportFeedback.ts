// Feedback export module.
//
// Generates a multi-sheet Excel report:
//   1. Ringkasan   - high-level metrics + distribution + top tags
//   2. Detail      - per-feedback rows with all fields
//   3. Highlights  - aggregated tag counts (descending)
//   4. Improvements- aggregated tag counts (descending)
//
// Unlike booking, feedback has no attachments so the deliverable is a single
// .xlsx (no ZIP wrapper). ExcelJS is dynamically imported by the consumer so
// the initial bundle stays lean.

import type ExcelJS from "exceljs";
import {
  RANGE_FILENAME,
  THEME,
  feedbackReportDate,
  formatDateKey,
  formatNowLabel,
  isWithinRangeByDate,
  resolveRange,
} from "./exportShared";
import type { ExportRange } from "./exportShared";

export type { ExportRange } from "./exportShared";

// Structural subset of the App Feedback type, plus the bits enriched from
// Booking (institution, contactName, dateLabel, dateKey) so the report can
// stand on its own.
export type FeedbackExportInput = {
  code: string;
  rating: number;
  bookingEase: number;
  service: number;
  guideQuality: number | null;
  facilityComfort: number | null;
  recommend: number;
  visitedBefore: boolean | null;
  discoverySourceLabel: string;
  discoverySourceOther: string;
  highlights: string[];
  improvements: string[];
  comment: string;
  allowPublish: boolean;
  submittedAt?: string;
  // Enriched join from booking. Optional because feedbacks may exist without
  // a paired booking in legacy data.
  institution?: string;
  contactName?: string;
  dateLabel?: string; // human label of the visit date
  dateKey?: string;   // YYYY-MM-DD of the visit date, preferred for reports.
};

// Threshold consistent with the in-app chip filter on AdminFeedbackList:
//   - Positif  : rating >= 4
//   - Perhatian: rating <= 3
export type FeedbackExportScope = "all" | "positive" | "attention";

export type FeedbackExportOptions = {
  feedbacks: FeedbackExportInput[];
  scope: FeedbackExportScope;
  range: ExportRange;
  customFrom?: string;
  customTo?: string;
  generatedBy?: string;
  filenameStem?: string;
};

export type FeedbackExportResult = {
  filename: string;
  rowCount: number;
};

const SCOPE_LABEL: Record<FeedbackExportScope, string> = {
  all: "Semua",
  positive: "Positif",
  attention: "Perhatian",
};

// ---------- helpers ----------

const dateForFiltering = (f: FeedbackExportInput): Date => feedbackReportDate(f);

const isWithin = (f: FeedbackExportInput, from: Date, to: Date): boolean =>
  isWithinRangeByDate(dateForFiltering(f), from, to);

const inScope = (f: FeedbackExportInput, scope: FeedbackExportScope): boolean => {
  if (scope === "all") return true;
  if (scope === "positive") return f.rating >= 4;
  return f.rating <= 3;
};

// Average a numeric field, returning 0 (not NaN) for empty input so cells
// don't render "#DIV/0!" in Excel.
const average = (values: number[]): number => {
  if (values.length === 0) return 0;
  const sum = values.reduce((a, b) => a + b, 0);
  return sum / values.length;
};

// Round to one decimal so "Rata-rata" reads cleanly in the Excel.
const round1 = (n: number): number => Math.round(n * 10) / 10;

const tally = (lists: string[][]): Map<string, number> => {
  const map = new Map<string, number>();
  for (const list of lists) {
    for (const tag of list) {
      const trimmed = tag.trim();
      if (!trimmed) continue;
      map.set(trimmed, (map.get(trimmed) ?? 0) + 1);
    }
  }
  return map;
};

// ---------- Excel building ----------

type Column = {
  header: string;
  width: number;
};

const DETAIL_COLUMNS: Column[] = [
  { header: "No", width: 5 },
  { header: "Kode", width: 22 },
  { header: "Tanggal Submit", width: 24 },
  { header: "Instansi", width: 32 },
  { header: "Contact Person", width: 22 },
  { header: "Tanggal Kunjungan", width: 26 },
  { header: "Rating", width: 8 },
  { header: "Booking Ease", width: 14 },
  { header: "Layanan", width: 10 },
  { header: "Kualitas Pemandu", width: 18 },
  { header: "Kebersihan & Fasilitas", width: 22 },
  { header: "Recommend", width: 12 },
  { header: "Pernah Berkunjung", width: 18 },
  { header: "Sumber Informasi", width: 30 },
  { header: "Highlights", width: 36 },
  { header: "Improvements", width: 36 },
  { header: "Komentar", width: 60 },
  { header: "Boleh Dipublish", width: 16 },
];

const SUMMARY_COLUMN_WIDTHS = [32, 18, 18, 18, 18];

// Apply the standard "table header" treatment to a row so all four sheets
// look like siblings.
const styleHeaderRow = (
  row: ExcelJS.Row,
  columnCount: number,
): void => {
  for (let i = 1; i <= columnCount; i += 1) {
    const cell = row.getCell(i);
    cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: THEME.headerFont } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: THEME.headerFill },
    };
    cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: THEME.borderGold } },
      bottom: { style: "thin", color: { argb: THEME.borderGold } },
    };
  }
  row.height = 28;
};

const styleDataCell = (cell: ExcelJS.Cell, zebra: boolean): void => {
  cell.alignment = { vertical: "top", horizontal: "left", wrapText: true };
  cell.font = { name: "Calibri", size: 10, color: { argb: THEME.navy } };
  if (zebra) {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: THEME.zebraFill },
    };
  }
};

const buildRingkasanSheet = (
  workbook: ExcelJS.Workbook,
  rows: FeedbackExportInput[],
  meta: { scopeLabel: string; periodLabel: string; generatedAt: string; generatedBy?: string },
): void => {
  const sheet = workbook.addWorksheet("Ringkasan");
  SUMMARY_COLUMN_WIDTHS.forEach((w, idx) => {
    sheet.getColumn(idx + 1).width = w;
  });

  // Title block (rows 1-2).
  sheet.mergeCells("A1:E1");
  const titleCell = sheet.getCell("A1");
  titleCell.value = "ISTURA · Ringkasan Feedback";
  titleCell.font = { name: "Calibri", size: 16, bold: true, color: { argb: THEME.navy } };
  sheet.getRow(1).height = 26;

  sheet.mergeCells("A2:E2");
  const metaCell = sheet.getCell("A2");
  metaCell.value =
    `Lingkup: ${meta.scopeLabel}   ·   Periode: ${meta.periodLabel}   ·   ` +
    `Total feedback: ${rows.length}   ·   Dibuat: ${meta.generatedAt}` +
    (meta.generatedBy ? `   ·   Oleh: ${meta.generatedBy}` : "");
  metaCell.font = { name: "Calibri", size: 10, color: { argb: THEME.muted } };

  // Section: average ratings (rows 4-9).
  sheet.getCell("A4").value = "Rata-rata rating";
  sheet.getCell("A4").font = { name: "Calibri", size: 11, bold: true, color: { argb: THEME.navy } };

  const avgHeader = sheet.getRow(5);
  avgHeader.values = ["Dimensi", "Skor (1-5)"];
  styleHeaderRow(avgHeader, 2);

  const dimensions: Array<{ label: string; values: number[] }> = [
    { label: "Overall", values: rows.map((r) => r.rating) },
    { label: "Kemudahan booking", values: rows.map((r) => r.bookingEase) },
    { label: "Layanan", values: rows.map((r) => r.service) },
    {
      label: "Kualitas pemandu",
      values: rows.flatMap((r) => (r.guideQuality === null ? [] : [r.guideQuality])),
    },
    {
      label: "Kebersihan & fasilitas",
      values: rows.flatMap((r) => (r.facilityComfort === null ? [] : [r.facilityComfort])),
    },
    { label: "Recommend (NPS-style)", values: rows.map((r) => r.recommend) },
  ];
  dimensions.forEach((d, idx) => {
    const row = sheet.getRow(6 + idx);
    row.getCell(1).value = d.label;
    row.getCell(2).value = round1(average(d.values));
    styleDataCell(row.getCell(1), idx % 2 === 1);
    styleDataCell(row.getCell(2), idx % 2 === 1);
    row.getCell(2).numFmt = "0.0";
  });

  // Section: distribution (rows 11-17).
  const distHeaderRowIdx = 6 + dimensions.length + 1;
  sheet.getCell(`A${distHeaderRowIdx}`).value = "Distribusi rating overall";
  sheet.getCell(`A${distHeaderRowIdx}`).font = {
    name: "Calibri", size: 11, bold: true, color: { argb: THEME.navy },
  };

  const distHeader = sheet.getRow(distHeaderRowIdx + 1);
  distHeader.values = ["Bintang", "Jumlah", "Persentase"];
  styleHeaderRow(distHeader, 3);

  const total = rows.length;
  for (let stars = 5; stars >= 1; stars -= 1) {
    const count = rows.filter((r) => r.rating === stars).length;
    const rowIdx = distHeader.number + (5 - stars) + 1;
    const row = sheet.getRow(rowIdx);
    row.getCell(1).value = `${stars}★`;
    row.getCell(2).value = count;
    row.getCell(3).value = total === 0 ? 0 : count / total;
    row.getCell(3).numFmt = "0.0%";
    [1, 2, 3].forEach((c) => styleDataCell(row.getCell(c), (5 - stars) % 2 === 1));
  }

  // Section: publish / non-publish split.
  const publishRowIdx = distHeader.number + 6 + 1;
  sheet.getCell(`A${publishRowIdx}`).value = "Izin publikasi";
  sheet.getCell(`A${publishRowIdx}`).font = {
    name: "Calibri", size: 11, bold: true, color: { argb: THEME.navy },
  };
  const publishHeader = sheet.getRow(publishRowIdx + 1);
  publishHeader.values = ["Status", "Jumlah", "Persentase"];
  styleHeaderRow(publishHeader, 3);
  const allowed = rows.filter((r) => r.allowPublish).length;
  const denied = rows.length - allowed;
  [
    { label: "Boleh dipublish", count: allowed },
    { label: "Tidak diizinkan", count: denied },
  ].forEach((entry, idx) => {
    const row = sheet.getRow(publishRowIdx + 2 + idx);
    row.getCell(1).value = entry.label;
    row.getCell(2).value = entry.count;
    row.getCell(3).value = total === 0 ? 0 : entry.count / total;
    row.getCell(3).numFmt = "0.0%";
    [1, 2, 3].forEach((c) => styleDataCell(row.getCell(c), idx % 2 === 1));
  });

  const visitRowIdx = publishRowIdx + 5;
  sheet.getCell(`A${visitRowIdx}`).value = "Riwayat kunjungan";
  sheet.getCell(`A${visitRowIdx}`).font = {
    name: "Calibri", size: 11, bold: true, color: { argb: THEME.navy },
  };
  const visitHeader = sheet.getRow(visitRowIdx + 1);
  visitHeader.values = ["Status", "Jumlah", "Persentase dari jawaban"];
  styleHeaderRow(visitHeader, 3);
  const knownVisits = rows.filter((row) => row.visitedBefore !== null);
  const visitEntries = [
    { label: "Pertama kali", count: knownVisits.filter((row) => row.visitedBefore === false).length },
    { label: "Pernah berkunjung", count: knownVisits.filter((row) => row.visitedBefore === true).length },
  ];
  visitEntries.forEach((entry, idx) => {
    const row = sheet.getRow(visitRowIdx + 2 + idx);
    row.getCell(1).value = entry.label;
    row.getCell(2).value = entry.count;
    row.getCell(3).value = knownVisits.length === 0 ? 0 : entry.count / knownVisits.length;
    row.getCell(3).numFmt = "0.0%";
    [1, 2, 3].forEach((column) => styleDataCell(row.getCell(column), idx % 2 === 1));
  });

  const sourceRowIdx = visitRowIdx + 5;
  sheet.getCell(`A${sourceRowIdx}`).value = "Sumber informasi";
  sheet.getCell(`A${sourceRowIdx}`).font = {
    name: "Calibri", size: 11, bold: true, color: { argb: THEME.navy },
  };
  const sourceHeader = sheet.getRow(sourceRowIdx + 1);
  sourceHeader.values = ["Sumber", "Jumlah", "Persentase dari jawaban"];
  styleHeaderRow(sourceHeader, 3);
  const sourceCounts = Array.from(
    rows.reduce((counts, row) => {
      const label = row.discoverySourceLabel.trim();
      if (label) counts.set(label, (counts.get(label) ?? 0) + 1);
      return counts;
    }, new Map<string, number>()),
  ).sort((a, b) => b[1] - a[1]);
  const sourceTotal = sourceCounts.reduce((sum, [, count]) => sum + count, 0);
  (sourceCounts.length > 0 ? sourceCounts : [["(belum ada data)", 0] as [string, number]]).forEach(
    ([label, count], idx) => {
      const row = sheet.getRow(sourceRowIdx + 2 + idx);
      row.getCell(1).value = label;
      row.getCell(2).value = count;
      row.getCell(3).value = sourceTotal === 0 ? 0 : count / sourceTotal;
      row.getCell(3).numFmt = "0.0%";
      [1, 2, 3].forEach((column) => styleDataCell(row.getCell(column), idx % 2 === 1));
    },
  );

  // Section: top tags side-by-side (rows starting after source distribution).
  const tagsRowIdx = sourceRowIdx + Math.max(sourceCounts.length, 1) + 4;
  sheet.getCell(`A${tagsRowIdx}`).value = "Top 5 Highlights & Improvements";
  sheet.getCell(`A${tagsRowIdx}`).font = {
    name: "Calibri", size: 11, bold: true, color: { argb: THEME.navy },
  };

  const tagHeader = sheet.getRow(tagsRowIdx + 1);
  tagHeader.values = ["Highlights", "Jumlah", "", "Improvements", "Jumlah"];
  styleHeaderRow(tagHeader, 5);
  // The empty middle column is just a visual gap — don't paint it gold.
  tagHeader.getCell(3).fill = { type: "pattern", pattern: "none" } as ExcelJS.Fill;
  tagHeader.getCell(3).border = {};
  tagHeader.getCell(3).value = "";

  const sortedTags = (m: Map<string, number>) =>
    Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const topHighlights = sortedTags(tally(rows.map((r) => r.highlights)));
  const topImprovements = sortedTags(tally(rows.map((r) => r.improvements)));
  const tagRowCount = Math.max(topHighlights.length, topImprovements.length, 1);
  for (let i = 0; i < tagRowCount; i += 1) {
    const row = sheet.getRow(tagsRowIdx + 2 + i);
    const h = topHighlights[i];
    const im = topImprovements[i];
    row.getCell(1).value = h ? h[0] : "";
    row.getCell(2).value = h ? h[1] : "";
    row.getCell(4).value = im ? im[0] : "";
    row.getCell(5).value = im ? im[1] : "";
    [1, 2, 4, 5].forEach((c) => styleDataCell(row.getCell(c), i % 2 === 1));
  }

  sheet.views = [{ state: "frozen", ySplit: 2 }];
};

const buildDetailSheet = (
  workbook: ExcelJS.Workbook,
  rows: FeedbackExportInput[],
): void => {
  const sheet = workbook.addWorksheet("Detail", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  const headerRow = sheet.getRow(1);
  DETAIL_COLUMNS.forEach((col, idx) => {
    headerRow.getCell(idx + 1).value = col.header;
    sheet.getColumn(idx + 1).width = col.width;
  });
  styleHeaderRow(headerRow, DETAIL_COLUMNS.length);

  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: DETAIL_COLUMNS.length },
  };

  rows.forEach((feedback, rowIdx) => {
    const excelRowIdx = rowIdx + 2;
    const row = sheet.getRow(excelRowIdx);
    const zebra = rowIdx % 2 === 1;

    row.getCell(1).value = rowIdx + 1;
    row.getCell(2).value = feedback.code;
    row.getCell(3).value = feedback.submittedAt ?? "";
    row.getCell(4).value = feedback.institution ?? "";
    row.getCell(5).value = feedback.contactName ?? "";
    row.getCell(6).value = feedback.dateLabel ?? "";
    row.getCell(7).value = feedback.rating;
    row.getCell(8).value = feedback.bookingEase;
    row.getCell(9).value = feedback.service;
    row.getCell(10).value = feedback.guideQuality ?? "";
    row.getCell(11).value = feedback.facilityComfort ?? "";
    row.getCell(12).value = feedback.recommend;
    row.getCell(13).value =
      feedback.visitedBefore === null ? "" : feedback.visitedBefore ? "Ya" : "Belum";
    row.getCell(14).value =
      feedback.discoverySourceOther && feedback.discoverySourceLabel
        ? `${feedback.discoverySourceLabel}: ${feedback.discoverySourceOther}`
        : feedback.discoverySourceLabel;
    row.getCell(15).value = feedback.highlights.join(", ");
    row.getCell(16).value = feedback.improvements.join(", ");
    row.getCell(17).value = feedback.comment;
    row.getCell(18).value = feedback.allowPublish ? "Ya" : "Tidak";

    for (let i = 1; i <= DETAIL_COLUMNS.length; i += 1) {
      styleDataCell(row.getCell(i), zebra);
    }

    // Color the rating cell so positive vs perhatian is glanceable.
    const ratingCell = row.getCell(7);
    const ratingFill =
      feedback.rating >= 4
        ? "FFD9F2DF"
        : feedback.rating <= 2
          ? "FFF8DEDA"
          : "FFFCEFCD";
    ratingCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: ratingFill },
    };
    ratingCell.font = { name: "Calibri", size: 10, bold: true, color: { argb: THEME.navy } };
    ratingCell.alignment = { vertical: "top", horizontal: "center" };

    row.height = 22;
  });
};

const buildTagSheet = (
  workbook: ExcelJS.Workbook,
  sheetName: string,
  rows: FeedbackExportInput[],
  pick: (f: FeedbackExportInput) => string[],
): void => {
  const sheet = workbook.addWorksheet(sheetName, {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  const header = sheet.getRow(1);
  header.values = ["Tag", "Jumlah", "Persentase dari total feedback"];
  [32, 12, 28].forEach((w, idx) => {
    sheet.getColumn(idx + 1).width = w;
  });
  styleHeaderRow(header, 3);
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 3 } };

  const counts = Array.from(tally(rows.map(pick)).entries()).sort(
    (a, b) => b[1] - a[1],
  );
  const total = rows.length;

  counts.forEach(([tag, count], idx) => {
    const row = sheet.getRow(idx + 2);
    row.getCell(1).value = tag;
    row.getCell(2).value = count;
    row.getCell(3).value = total === 0 ? 0 : count / total;
    row.getCell(3).numFmt = "0.0%";
    [1, 2, 3].forEach((c) => styleDataCell(row.getCell(c), idx % 2 === 1));
  });

  if (counts.length === 0) {
    const row = sheet.getRow(2);
    row.getCell(1).value = "(belum ada data pada lingkup ini)";
    row.getCell(1).font = { name: "Calibri", size: 10, italic: true, color: { argb: THEME.muted } };
  }
};

// ---------- main entry point ----------

export const exportFeedbackToXlsx = async (
  options: FeedbackExportOptions,
): Promise<FeedbackExportResult> => {
  const { feedbacks, scope, range, customFrom, customTo, filenameStem } = options;

  // 1. Filter by scope (rating bucket).
  const scoped = feedbacks.filter((f) => inScope(f, scope));

  // 2. Filter by date range.
  const { from, to, label: periodLabel } = resolveRange(range, customFrom, customTo);
  const filtered = scoped.filter((f) => isWithin(f, from, to));

  // 3. Sort terbaru → terlama.
  filtered.sort((a, b) => dateForFiltering(b).getTime() - dateForFiltering(a).getTime());

  // 4. Build workbook.
  const ExcelJSModule = await import("exceljs");
  const ExcelJSCtor = ExcelJSModule.default ?? ExcelJSModule;
  const workbook = new ExcelJSCtor.Workbook();
  workbook.creator = options.generatedBy ?? "ISTURA Admin";
  workbook.created = new Date();

  const meta = {
    scopeLabel: SCOPE_LABEL[scope],
    periodLabel,
    generatedAt: formatNowLabel(),
    generatedBy: options.generatedBy,
  };

  buildRingkasanSheet(workbook, filtered, meta);
  buildDetailSheet(workbook, filtered);
  buildTagSheet(workbook, "Highlights", filtered, (f) => f.highlights);
  buildTagSheet(workbook, "Improvements", filtered, (f) => f.improvements);

  // 5. Trigger download.
  const xlsxBuffer = await workbook.xlsx.writeBuffer();
  const stem =
    filenameStem ??
    `ISTURA-Feedback-${SCOPE_LABEL[scope]}-${RANGE_FILENAME[range]}-${formatDateKey(new Date()).replace(/-/g, "")}`;
  const filename = `${stem}.xlsx`;

  const blob = new Blob([xlsxBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  return { filename, rowCount: filtered.length };
};

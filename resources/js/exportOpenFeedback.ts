// Istura Open feedback export module.
//
// Generates a styled Excel (.xlsx) of the feedback submissions for an event.
// ExcelJS is dynamically imported so the dependency stays out of the initial
// bundle for users who never trigger an export.

import type ExcelJS from "exceljs";
import type { OpenFeedbackAdmin } from "./domain/types";
import { THEME, formatNowLabel } from "./exportShared";

const MONTHS_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const longDate = (key?: string | null): string => {
  if (!key) return "-";
  const [year, month, day] = key.split("-").map(Number);
  if (!year || !month || !day) return key;
  return `${day} ${MONTHS_ID[month - 1]} ${year}`;
};

const GENDER_LABELS: Record<string, string> = { male: "Laki-laki", female: "Perempuan" };

const DISCOVERY_LABELS: Record<string, string> = {
  social_media: "Media sosial",
  friends_family: "Teman/keluarga",
  school_institution: "Sekolah/instansi",
  web_search: "Pencarian web",
  previous_visit: "Kunjungan sebelumnya",
  other: "Lainnya",
};

export type OpenFeedbackExportOptions = {
  feedbacks: OpenFeedbackAdmin[];
  eventName: string;
  eventSlug: string;
  generatedBy?: string;
};

type Column = {
  header: string;
  width: number;
  value: (r: OpenFeedbackAdmin) => string | number | null;
};

const COLUMNS: Column[] = [
  { header: "No", width: 5, value: () => "" },
  { header: "Hari Kunjungan", width: 20, value: (r) => longDate(r.dayDate) },
  { header: "Nama", width: 24, value: (r) => r.visitorName ?? "-" },
  { header: "Jenis Kelamin", width: 14, value: (r) => (r.gender ? GENDER_LABELS[r.gender] ?? r.gender : "-") },
  { header: "Usia", width: 8, value: (r) => r.age ?? "-" },
  { header: "Asal", width: 20, value: (r) => r.origin ?? "-" },
  { header: "NIK", width: 20, value: (r) => r.nik ?? "-" },
  { header: "Nomor HP", width: 16, value: (r) => r.whatsapp },
  { header: "Rating", width: 8, value: (r) => r.rating },
  { header: "Kemudahan Booking", width: 16, value: (r) => r.bookingEase },
  { header: "Pelayanan", width: 12, value: (r) => r.service },
  { header: "Kualitas Pemandu", width: 16, value: (r) => r.guideQuality ?? "-" },
  { header: "Kenyamanan Fasilitas", width: 18, value: (r) => r.facilityComfort ?? "-" },
  { header: "Rekomendasi", width: 12, value: (r) => r.recommend },
  { header: "Pernah Berkunjung", width: 16, value: (r) => (r.visitedBefore === null ? "-" : r.visitedBefore ? "Ya" : "Belum") },
  { header: "Sumber Info", width: 18, value: (r) => (r.discoverySource ? DISCOVERY_LABELS[r.discoverySource] ?? r.discoverySource : "-") },
  { header: "Aspek Terbaik", width: 30, value: (r) => (r.highlights.length > 0 ? r.highlights.join("; ") : "-") },
  { header: "Aspek Perbaikan", width: 30, value: (r) => (r.improvements.length > 0 ? r.improvements.join("; ") : "-") },
  { header: "Cerita", width: 40, value: (r) => r.comment ?? "-" },
  { header: "Boleh Dipublikasikan", width: 16, value: (r) => (r.allowPublish ? "Ya" : "Tidak") },
  { header: "Waktu Kirim", width: 24, value: (r) => r.submittedAt ?? "" },
];

const sanitize = (value: string) => value.replace(/[^a-z0-9-]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();

export const exportOpenFeedbackToExcel = async (options: OpenFeedbackExportOptions): Promise<{ filename: string; rowCount: number }> => {
  const ExcelJSModule = await import("exceljs");
  const ExcelJSCtor = (ExcelJSModule.default ?? ExcelJSModule) as typeof ExcelJS;
  const workbook = new ExcelJSCtor.Workbook();
  workbook.creator = options.generatedBy ?? "ISTURA Admin";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Feedback Istura Open", { views: [{ state: "frozen", ySplit: 4 }] });
  sheet.properties.defaultRowHeight = 18;
  const lastColLetter = sheet.getColumn(COLUMNS.length).letter;
  const generatedAt = formatNowLabel();

  sheet.mergeCells(`A1:${lastColLetter}1`);
  const titleCell = sheet.getCell("A1");
  titleCell.value = `Feedback Istura Open · ${options.eventName}`;
  titleCell.font = { name: "Calibri", size: 16, bold: true, color: { argb: THEME.navy } };
  titleCell.alignment = { vertical: "middle", horizontal: "left" };
  sheet.getRow(1).height = 26;

  sheet.mergeCells(`A2:${lastColLetter}2`);
  const metaCell = sheet.getCell("A2");
  metaCell.value =
    `Total feedback: ${options.feedbacks.length}   ·   Dibuat: ${generatedAt}` +
    (options.generatedBy ? `   ·   Oleh: ${options.generatedBy}` : "");
  metaCell.font = { name: "Calibri", size: 10, color: { argb: THEME.muted } };
  metaCell.alignment = { vertical: "middle", horizontal: "left" };
  sheet.getRow(2).height = 18;

  const headerRow = sheet.getRow(4);
  COLUMNS.forEach((col, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = col.header;
    cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: THEME.headerFont } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME.headerFill } };
    cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: THEME.borderGold } },
      bottom: { style: "thin", color: { argb: THEME.borderGold } },
    };
    sheet.getColumn(idx + 1).width = col.width;
  });
  headerRow.height = 28;

  sheet.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: COLUMNS.length } };

  options.feedbacks.forEach((feedback, rowIdx) => {
    const row = sheet.getRow(rowIdx + 5);
    COLUMNS.forEach((col, colIdx) => {
      const cell = row.getCell(colIdx + 1);
      cell.value = colIdx === 0 ? rowIdx + 1 : col.value(feedback);
      cell.font = { name: "Calibri", size: 10 };
      cell.alignment = { vertical: "top", horizontal: "left", wrapText: colIdx >= 16 };
      if (rowIdx % 2 === 1) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME.zebraFill } };
      }
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `feedback-istura-open-${sanitize(options.eventSlug)}-${Date.now()}.xlsx`;
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);

  return { filename, rowCount: options.feedbacks.length };
};

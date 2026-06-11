// Istura Open registrations export module.
//
// Generates a styled Excel (.xlsx) of the registrants for an active event,
// optionally scoped to a single day. Unlike the booking export there are no
// attached files, so this downloads a plain .xlsx (no ZIP).
//
// ExcelJS is dynamically imported so the ~900KB dependency stays out of the
// initial bundle for users who never trigger an export.

import type ExcelJS from "exceljs";
import type { OpenRegistrationAdmin } from "./domain/types";
import { THEME, formatDateKey, formatNowLabel } from "./exportShared";

const MONTHS_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const STATUS_LABELS: Record<string, string> = {
  Registered: "Terdaftar",
  Confirmed: "Terkonfirmasi",
  Cancelled: "Batal",
  Waitlisted: "Daftar tunggu",
};

const longDate = (key?: string | null): string => {
  if (!key) return "-";
  const [year, month, day] = key.split("-").map(Number);
  if (!year || !month || !day) return key;
  return `${day} ${MONTHS_ID[month - 1]} ${year}`;
};

export type OpenExportOptions = {
  registrations: OpenRegistrationAdmin[];
  eventName: string;
  eventSlug: string;
  // When set, only this day's rows are exported and the filename/title scope
  // narrows to that date (YYYY-MM-DD).
  dayDate?: string;
  generatedBy?: string;
};

export type OpenExportResult = {
  filename: string;
  rowCount: number;
};

type Column = {
  header: string;
  width: number;
  value: (r: OpenRegistrationAdmin) => string | number | null;
};

const COLUMNS: Column[] = [
  { header: "No", width: 5, value: () => "" }, // filled later (row index)
  { header: "Kode", width: 24, value: (r) => r.code },
  { header: "Hari Kunjungan", width: 22, value: (r) => longDate(r.dayDate) },
  { header: "Nama", width: 26, value: (r) => r.contactName },
  { header: "NIK", width: 20, value: (r) => r.nik ?? r.nikMasked },
  { header: "WhatsApp", width: 18, value: (r) => r.whatsapp },
  { header: "Asal Kota", width: 20, value: (r) => r.city ?? "-" },
  { header: "Jumlah Kepala", width: 14, value: (r) => r.headcount },
  { header: "Add-on", width: 36, value: (r) => (r.members.length > 0 ? r.members.join("; ") : "-") },
  { header: "Status", width: 16, value: (r) => STATUS_LABELS[r.status] ?? r.status },
  { header: "Waktu Daftar", width: 24, value: (r) => r.registeredAt ?? "" },
];

const buildWorkbook = async (
  rows: OpenRegistrationAdmin[],
  meta: { eventName: string; scopeLabel: string; generatedAt: string; generatedBy?: string },
): Promise<ExcelJS.Workbook> => {
  const ExcelJSModule = await import("exceljs");
  const ExcelJSCtor = ExcelJSModule.default ?? ExcelJSModule;
  const workbook = new ExcelJSCtor.Workbook();
  workbook.creator = meta.generatedBy ?? "ISTURA Admin";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Pendaftar Istura Open", {
    views: [{ state: "frozen", ySplit: 4 }],
  });
  sheet.properties.defaultRowHeight = 18;

  const lastColLetter = sheet.getColumn(COLUMNS.length).letter;

  // ---- Title block (rows 1-3) -----------------------------------------
  sheet.mergeCells(`A1:${lastColLetter}1`);
  const titleCell = sheet.getCell("A1");
  titleCell.value = `ISTURA Open · ${meta.eventName}`;
  titleCell.font = { name: "Calibri", size: 16, bold: true, color: { argb: THEME.navy } };
  titleCell.alignment = { vertical: "middle", horizontal: "left" };
  sheet.getRow(1).height = 26;

  sheet.mergeCells(`A2:${lastColLetter}2`);
  const metaCell = sheet.getCell("A2");
  metaCell.value =
    `Lingkup: ${meta.scopeLabel}   ·   Total pendaftar: ${rows.length}   ·   ` +
    `Dibuat: ${meta.generatedAt}` +
    (meta.generatedBy ? `   ·   Oleh: ${meta.generatedBy}` : "");
  metaCell.font = { name: "Calibri", size: 10, color: { argb: THEME.muted } };
  metaCell.alignment = { vertical: "middle", horizontal: "left" };
  sheet.getRow(2).height = 18;

  // Row 3 left blank for breathing room.

  // ---- Column headers (row 4) -----------------------------------------
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

  sheet.autoFilter = {
    from: { row: 4, column: 1 },
    to: { row: 4, column: COLUMNS.length },
  };

  // ---- Data rows ------------------------------------------------------
  rows.forEach((registration, rowIdx) => {
    const row = sheet.getRow(rowIdx + 5);
    COLUMNS.forEach((col, colIdx) => {
      const cell = row.getCell(colIdx + 1);
      cell.value = colIdx === 0 ? rowIdx + 1 : col.value(registration);
      cell.alignment = { vertical: "top", horizontal: "left", wrapText: true };
      cell.font = { name: "Calibri", size: 10, color: { argb: THEME.navy } };
      if (rowIdx % 2 === 1) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME.zebraFill } };
      }
    });

    // Status tint, glanceable but report-friendly.
    const statusCell = row.getCell(10);
    const statusFill =
      registration.status === "Confirmed"
        ? "FFD9F2DF"
        : registration.status === "Cancelled"
          ? "FFF8DEDA"
          : registration.status === "Waitlisted"
            ? "FFE2EBFF"
            : "FFFCEFCD"; // Registered
    statusCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: statusFill } };
    statusCell.font = { name: "Calibri", size: 10, bold: true, color: { argb: THEME.navy } };

    row.height = 22;
  });

  return workbook;
};

const triggerDownload = (buffer: ArrayBuffer, filename: string): void => {
  const blob = new Blob([buffer], {
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
};

export const exportOpenRegistrationsToExcel = async (
  options: OpenExportOptions,
): Promise<OpenExportResult> => {
  const { registrations, eventName, eventSlug, dayDate, generatedBy } = options;

  const rows = dayDate
    ? registrations.filter((r) => r.dayDate === dayDate)
    : registrations.slice();

  // Newest-first by registration time falls back to insertion order.
  rows.sort((a, b) => (b.registeredAt ?? "").localeCompare(a.registeredAt ?? ""));

  const scopeLabel = dayDate ? longDate(dayDate) : "Semua hari";

  const workbook = await buildWorkbook(rows, {
    eventName,
    scopeLabel,
    generatedAt: formatNowLabel(),
    generatedBy,
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const stamp = formatDateKey(new Date()).replace(/-/g, "");
  const scopeStem = dayDate ? dayDate.replace(/-/g, "") : "semua";
  const filename = `ISTURA-Open-${eventSlug}-${scopeStem}-${stamp}.xlsx`;

  triggerDownload(buffer as ArrayBuffer, filename);

  return { filename, rowCount: rows.length };
};

// Booking export module.
//
// Generates an Excel report of bookings (Completed and/or Rejected) bundled
// with the original surat permohonan files inside a ZIP. The Excel ships with
// a header block (judul, periode, lingkup, total baris, tanggal generate),
// auto-filter on the data header, and clickable hyperlinks pointing at each
// surat file's relative path inside the ZIP.
//
// ExcelJS + JSZip are dynamically imported by the consumer so the initial
// bundle stays lean for users who never trigger an export.

import type ExcelJS from "exceljs";
import { BOOKING_STATUS_LABELS } from "./domain/booking";
import {
  RANGE_FILENAME,
  THEME,
  bookingReportDate,
  formatDateKey,
  formatLongLabel,
  formatNowLabel,
  isWithinRangeByDate,
  parseSubmittedAt,
  resolveRange,
} from "./exportShared";
import type { ExportRange } from "./exportShared";

// Re-export so consumers can keep importing from one place.
export type { ExportRange } from "./exportShared";

// Structural subset of the App-side Booking type. Keeps this module decoupled
// from App.tsx and easy to test/move to a workers later if needed.
export type BookingExportInput = {
  code: string;
  contactName: string;
  nik: string;
  whatsapp: string;
  institution: string;
  groupSize: number;
  segments?: { order: number; time: string; groupSize: number }[];
  date: string;        // YYYY-MM-DD (visit date)
  dateLabel: string;   // human-readable visit date
  time: string;        // HH.MM
  status: "Pending" | "Accepted" | "Rejected" | "Reschedule" | "Completed";
  documentName: string;
  submittedAt: string | null; // "23 Mei 2026, 14.12 WIB"
  note?: string;
  completedAt?: string;
  rejectedAt?: string;
};

export type ExportScope = "all" | "completed" | "rejected";

export type ExportOptions = {
  bookings: BookingExportInput[];
  scope: ExportScope;
  range: ExportRange;
  customFrom?: string; // YYYY-MM-DD inclusive
  customTo?: string;   // YYYY-MM-DD inclusive
  // Resolves a booking to a fetchable URL of its surat permohonan. The demo
  // returns the shared kop-surat asset; production wires this to whatever
  // storage is in front of the actual upload.
  documentUrlFor: (booking: BookingExportInput) => string;
  // Used to render the "Dibuat oleh" footer in the Excel header block.
  generatedBy?: string;
  // Optional override for the filename stem (default derives from scope+range).
  filenameStem?: string;
};

export type ExportResult = {
  filename: string;
  rowCount: number;
  // Skipped surat downloads (CORS error, 404, etc.) so the UI can warn.
  missingDocuments: string[];
};

// ---------- date helpers ----------

const isWithin = (booking: BookingExportInput, from: Date, to: Date): boolean => {
  return isWithinRangeByDate(bookingReportDate(booking), from, to);
};

// ---------- filename + path helpers ----------

const SCOPE_LABEL: Record<ExportScope, string> = {
  all: "Semua",
  completed: BOOKING_STATUS_LABELS.Completed,
  rejected: BOOKING_STATUS_LABELS.Rejected,
};

// Strip characters that misbehave in Windows/macOS filenames so the surat
// files can be safely written into the ZIP without surprising the user when
// they extract.
const sanitizeFilename = (name: string): string =>
  name.replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, " ").trim();

const buildSuratPath = (booking: BookingExportInput): string =>
  `surat-permohonan/${sanitizeFilename(booking.code)}-${sanitizeFilename(
    booking.documentName,
  )}`;

// ---------- Excel building ----------

const HEADER_FILL_COLOR = THEME.headerFill;
const HEADER_FONT_COLOR = THEME.headerFont;
const ZEBRA_FILL_COLOR = THEME.zebraFill;
const NAVY_FONT_COLOR = THEME.navy;

type Column = {
  header: string;
  width: number;
  // Pull a printable value out of the booking row. Null = leave blank.
  value: (b: BookingExportInput) => string | number | null;
};

const COLUMNS: Column[] = [
  { header: "No", width: 5, value: () => "" }, // filled later (row index)
  { header: "Kode", width: 22, value: (b) => b.code },
  { header: "Tanggal Pengajuan", width: 24, value: (b) => b.submittedAt },
  { header: "Status", width: 18, value: (b) => BOOKING_STATUS_LABELS[b.status] },
  { header: "Contact Person", width: 22, value: (b) => b.contactName },
  { header: "NIK", width: 20, value: (b) => b.nik },
  { header: "WhatsApp", width: 16, value: (b) => b.whatsapp },
  { header: "Instansi", width: 32, value: (b) => b.institution },
  { header: "Rombongan", width: 18, value: (b) => b.segments && b.segments.length > 1 ? `${b.groupSize} (${b.segments.length} kloter)` : b.groupSize },
  { header: "Tanggal Kunjungan", width: 26, value: (b) => b.dateLabel },
  { header: "Jam", width: 36, value: (b) => b.segments && b.segments.length > 1 ? b.segments.map((s) => `K${s.order} ${s.time} (${s.groupSize})`).join("; ") : b.time },
  {
    header: "Tanggal Selesai / Tolak",
    width: 24,
    value: (b) =>
      b.status === "Completed"
        ? b.completedAt ?? ""
        : b.status === "Rejected"
          ? b.rejectedAt ?? b.submittedAt
          : "",
  },
  { header: "Catatan", width: 40, value: (b) => b.note ?? "" },
  { header: "Surat Permohonan", width: 28, value: () => "" }, // hyperlink later
];

const SURAT_COLUMN_INDEX = COLUMNS.length; // 1-based for ExcelJS

const buildWorkbook = async (
  rows: BookingExportInput[],
  meta: { scopeLabel: string; periodLabel: string; generatedAt: string; generatedBy?: string },
): Promise<ExcelJS.Workbook> => {
  // Dynamic import keeps ExcelJS (~900KB) out of the initial bundle.
  const ExcelJSModule = await import("exceljs");
  const ExcelJSCtor = ExcelJSModule.default ?? ExcelJSModule;
  const workbook = new ExcelJSCtor.Workbook();
  workbook.creator = meta.generatedBy ?? "ISTURA Admin";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Laporan Booking", {
    views: [{ state: "frozen", ySplit: 4 }],
  });
  sheet.properties.defaultRowHeight = 18;

  // ---- Title block (rows 1-3) -----------------------------------------
  const lastColLetter = sheet.getColumn(COLUMNS.length).letter;

  sheet.mergeCells(`A1:${lastColLetter}1`);
  const titleCell = sheet.getCell("A1");
  titleCell.value = "ISTURA · Laporan Booking";
  titleCell.font = { name: "Calibri", size: 16, bold: true, color: { argb: NAVY_FONT_COLOR } };
  titleCell.alignment = { vertical: "middle", horizontal: "left" };
  sheet.getRow(1).height = 26;

  sheet.mergeCells(`A2:${lastColLetter}2`);
  const metaCell = sheet.getCell("A2");
  metaCell.value =
    `Lingkup: ${meta.scopeLabel}   ·   Periode: ${meta.periodLabel}   ·   ` +
    `Total baris: ${rows.length}   ·   Dibuat: ${meta.generatedAt}` +
    (meta.generatedBy ? `   ·   Oleh: ${meta.generatedBy}` : "");
  metaCell.font = { name: "Calibri", size: 10, color: { argb: "FF5F6477" } };
  metaCell.alignment = { vertical: "middle", horizontal: "left" };
  sheet.getRow(2).height = 18;

  // Row 3 left intentionally blank for visual breathing room.

  // ---- Column headers (row 4) -----------------------------------------
  const headerRow = sheet.getRow(4);
  COLUMNS.forEach((col, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = col.header;
    cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: HEADER_FONT_COLOR } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: HEADER_FILL_COLOR },
    };
    cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: "FFD7B25C" } },
      bottom: { style: "thin", color: { argb: "FFD7B25C" } },
    };
    sheet.getColumn(idx + 1).width = col.width;
  });
  headerRow.height = 28;

  // Auto-filter on the data header so admins can slice in Excel without
  // touching us afterwards.
  sheet.autoFilter = {
    from: { row: 4, column: 1 },
    to: { row: 4, column: COLUMNS.length },
  };

  // ---- Data rows ------------------------------------------------------
  rows.forEach((booking, rowIdx) => {
    const excelRowIdx = rowIdx + 5; // header row is 4
    const row = sheet.getRow(excelRowIdx);
    COLUMNS.forEach((col, colIdx) => {
      const cell = row.getCell(colIdx + 1);
      // Column 1 = "No" (1-based row counter).
      if (colIdx === 0) {
        cell.value = rowIdx + 1;
      } else {
        cell.value = col.value(booking);
      }
      cell.alignment = { vertical: "top", horizontal: "left", wrapText: true };
      cell.font = { name: "Calibri", size: 10, color: { argb: NAVY_FONT_COLOR } };
      // Zebra striping for readability on large reports.
      if (rowIdx % 2 === 1) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: ZEBRA_FILL_COLOR },
        };
      }
    });

    // Status badge styling: light tint so the color is glanceable while the
    // sheet still looks like a formal report.
    const statusCell = row.getCell(4);
    const statusFill =
      booking.status === "Completed"
        ? "FFD9F2DF"
        : booking.status === "Rejected"
          ? "FFF8DEDA"
          : booking.status === "Accepted"
            ? "FFE2EBFF"
            : booking.status === "Reschedule"
              ? "FFFCEFCD"
              : "FFEDEFF3";
    statusCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: statusFill },
    };
    statusCell.font = { name: "Calibri", size: 10, bold: true, color: { argb: NAVY_FONT_COLOR } };

    // Surat hyperlink uses a relative path that resolves once the user
    // extracts the ZIP and opens the .xlsx from the same folder.
    const suratCell = row.getCell(SURAT_COLUMN_INDEX);
    const suratPath = buildSuratPath(booking);
    suratCell.value = {
      text: booking.documentName,
      hyperlink: suratPath,
      tooltip: "Buka surat permohonan",
    };
    suratCell.font = {
      name: "Calibri",
      size: 10,
      color: { argb: "FF1A56DB" },
      underline: true,
    };

    row.height = 22;
  });

  // ---- Footer note ----------------------------------------------------
  const footerRowIdx = rows.length + 6;
  sheet.mergeCells(`A${footerRowIdx}:${lastColLetter}${footerRowIdx}`);
  const footerCell = sheet.getCell(`A${footerRowIdx}`);
  footerCell.value =
    'Klik tautan di kolom "Surat Permohonan" untuk membuka file. ' +
    'Pastikan file Excel ini dibuka dari folder hasil extract ZIP.';
  footerCell.font = { name: "Calibri", size: 9, italic: true, color: { argb: "FF8A8FA1" } };

  return workbook;
};

// ---------- main entry point ----------

export const exportBookingsToZip = async (
  options: ExportOptions,
): Promise<ExportResult> => {
  const { bookings, scope, range, customFrom, customTo, documentUrlFor, filenameStem } = options;

  // 1. Filter by scope (status) ----------------------------------------
  const scoped = bookings.filter((b) => {
    if (scope === "all") return b.status === "Completed" || b.status === "Rejected";
    if (scope === "completed") return b.status === "Completed";
    return b.status === "Rejected";
  });

  // 2. Filter by date range --------------------------------------------
  const { from, to, label: periodLabel } = resolveRange(range, customFrom, customTo);
  const filtered = scoped.filter((b) => isWithin(b, from, to));

  // 3. Sort by tanggal laporan, terbaru → terlama ----------------------
  filtered.sort(
    (a, b) =>
      bookingReportDate(b).getTime() - bookingReportDate(a).getTime() ||
      parseSubmittedAt(b.submittedAt ?? "").getTime() -
        parseSubmittedAt(a.submittedAt ?? "").getTime(),
  );

  // 4. Build workbook --------------------------------------------------
  const workbook = await buildWorkbook(filtered, {
    scopeLabel: SCOPE_LABEL[scope],
    periodLabel,
    generatedAt: formatNowLabel(),
    generatedBy: options.generatedBy,
  });

  const xlsxBuffer = await workbook.xlsx.writeBuffer();

  // 5. Bundle into ZIP with surat files --------------------------------
  const JSZipModule = await import("jszip");
  const JSZipCtor = JSZipModule.default ?? JSZipModule;
  const zip = new JSZipCtor();

  const stemBase =
    filenameStem ??
    `ISTURA-Laporan-${SCOPE_LABEL[scope]}-${RANGE_FILENAME[range]}-${formatDateKey(new Date()).replace(/-/g, "")}`;

  zip.file(`${stemBase}.xlsx`, xlsxBuffer);

  // Fetch surat files in parallel. Failures are non-fatal: the row stays in
  // the report with a hyperlink that simply won't resolve, and the failing
  // codes bubble up to the UI for an explanatory toast.
  const missingDocuments: string[] = [];
  const seenPaths = new Set<string>();

  await Promise.all(
    filtered.map(async (booking) => {
      const path = buildSuratPath(booking);
      // Same booking code shouldn't appear twice, but guard anyway so we
      // don't double-fetch if the caller passes duplicates.
      if (seenPaths.has(path)) return;
      seenPaths.add(path);

      try {
        const url = documentUrlFor(booking);
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        zip.file(path, blob);
      } catch (err) {
        missingDocuments.push(booking.code);
        console.warn(`[exportBookings] Failed to fetch surat for ${booking.code}`, err);
      }
    }),
  );

  // 6. Trigger browser download ----------------------------------------
  const zipBlob = await zip.generateAsync({ type: "blob" });
  const filename = `${stemBase}.zip`;

  const url = URL.createObjectURL(zipBlob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Revoke after a tick so the browser has time to commit the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  return {
    filename,
    rowCount: filtered.length,
    missingDocuments,
  };
};

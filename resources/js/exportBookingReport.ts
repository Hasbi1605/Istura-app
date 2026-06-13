// Booking PDF report generator.
//
// Executive-style A4 portrait PDF scoped to booking only (companion to the
// detailed Excel/ZIP export). Shows KPIs, status distribution, a short
// narrative, and a compact Top-N detail table. NIK is intentionally OMITTED:
// a PDF report is likely printed/forwarded, so raw NIK must never surface
// here (the Excel export remains the channel for full identity data).

import {
  RANGE_FILENAME,
  bookingReportDate,
  formatDateKey,
  isWithinRangeByDate,
  resolveRange,
} from "./exportShared";
import type { ExportRange } from "./exportShared";
import type { ExportScope } from "./exportBookings";
import { BOOKING_STATUS_LABELS } from "./domain/booking";
import type { ReportBooking } from "./exportMonthlyReport";
import {
  COLOR,
  METRIC_TABLE_LAYOUT,
  PDF_DEFAULT_STYLE,
  PDF_STYLES,
  buildCoverHeader,
  buildFooter,
  buildKpiRow,
  buildStatusTable,
  fetchImageAsDataUrl,
  generateAndDownloadPdf,
  truncate,
} from "./exportPdfShared";

export type BookingReportOptions = {
  bookings: ReportBooking[];
  scope: ExportScope;
  range: ExportRange;
  customFrom?: string;
  customTo?: string;
  generatedBy?: string;
  logoUrl?: string;
};

export type BookingReportResult = {
  filename: string;
  bookingCount: number;
};

const SCOPE_LABEL: Record<ExportScope, string> = {
  all: "Semua",
  completed: BOOKING_STATUS_LABELS.Completed,
  rejected: BOOKING_STATUS_LABELS.Rejected,
};

const SCOPE_TITLE: Record<ExportScope, string> = {
  all: "Booking selesai & ditolak",
  completed: "Booking selesai",
  rejected: "Booking ditolak",
};

const RANGE_TITLE: Record<ExportRange, string> = {
  week: "Mingguan",
  month: "Bulanan",
  year: "Tahunan",
  custom: "Periode Pilihan",
};

// Max rows in the compact detail table; full data lives in the Excel export.
const MAX_DETAIL_ROWS = 40;

const inScope = (b: ReportBooking, scope: ExportScope): boolean => {
  if (scope === "all") return b.status === "Completed" || b.status === "Rejected";
  if (scope === "completed") return b.status === "Completed";
  return b.status === "Rejected";
};

export const exportBookingReport = async (
  options: BookingReportOptions,
): Promise<BookingReportResult> => {
  const { bookings, scope, range, customFrom, customTo, generatedBy, logoUrl } = options;

  const { from, to } = resolveRange(range, customFrom, customTo);
  const period = { from, to, label: `Booking ${RANGE_TITLE[range]}` };

  // Executive summary covers all bookings in the period (full status picture).
  const periodBookings = bookings.filter((b) =>
    isWithinRangeByDate(bookingReportDate(b), from, to),
  );
  const total = periodBookings.length;
  const completed = periodBookings.filter((b) => b.status === "Completed");
  const rejected = periodBookings.filter((b) => b.status === "Rejected");
  const reschedule = periodBookings.filter((b) => b.status === "Reschedule");
  const pending = periodBookings.filter((b) => b.status === "Pending");
  const accepted = periodBookings.filter((b) => b.status === "Accepted");
  const expired = periodBookings.filter((b) => b.status === "Expired");
  const totalVisitors = completed.reduce((sum, b) => sum + (b.groupSize ?? 0), 0);
  const pct = (count: number) => (total === 0 ? 0 : Math.round((count / total) * 1000) / 10);

  // Detail table is scoped (mirrors the Excel scope selector) and capped.
  const scopedBookings = periodBookings
    .filter((b) => inScope(b, scope))
    .sort((a, b) => bookingReportDate(b).getTime() - bookingReportDate(a).getTime());
  const detailRows = scopedBookings.slice(0, MAX_DETAIL_ROWS);

  const logoDataUrl = logoUrl ? await fetchImageAsDataUrl(logoUrl) : null;

  const docDefinition = {
    pageSize: "A4",
    pageMargins: [40, 60, 40, 60],
    info: {
      title: `Laporan Booking ${RANGE_TITLE[range]} ISTURA`,
      author: generatedBy ?? "ISTURA Admin",
    },
    defaultStyle: PDF_DEFAULT_STYLE,
    styles: PDF_STYLES,
    footer: buildFooter(`Laporan Booking ${RANGE_TITLE[range]}`),
    content: [
      buildCoverHeader({
        eyebrow: `Laporan Booking ${RANGE_TITLE[range]}`,
        period,
        generatedBy,
        logoDataUrl,
      }),
      { text: "Ringkasan Eksekutif", style: "h2" },
      buildKpiRow([
        { label: "Total Booking", value: String(total), unit: "permohonan" },
        { label: "Kunjungan Terlaksana", value: String(completed.length), unit: `${pct(completed.length)}% dari total` },
        { label: "Total Pengunjung", value: totalVisitors.toLocaleString("id-ID"), unit: "orang" },
        { label: "Ditolak", value: String(rejected.length), unit: `${pct(rejected.length)}% dari total` },
      ]),
      { text: "Sorotan periode", style: "h3", margin: [0, 12, 0, 4] },
      buildBookingNarrative({ total, completed: completed.length, totalVisitors, completedPct: pct(completed.length) }),
      { text: "Distribusi status permohonan", style: "h3", margin: [0, 14, 0, 6] },
      buildStatusTable(
        [
          { label: BOOKING_STATUS_LABELS.Pending, count: pending.length, color: COLOR.muted },
          { label: BOOKING_STATUS_LABELS.Accepted, count: accepted.length, color: "#3B82F6" },
          { label: BOOKING_STATUS_LABELS.Reschedule, count: reschedule.length, color: COLOR.gold },
          { label: BOOKING_STATUS_LABELS.Expired, count: expired.length, color: COLOR.muted },
          { label: BOOKING_STATUS_LABELS.Completed, count: completed.length, color: COLOR.positive },
          { label: BOOKING_STATUS_LABELS.Rejected, count: rejected.length, color: COLOR.attention },
        ],
        pct,
      ),

      { text: "", pageBreak: "before" },
      { text: `Daftar permohonan — ${SCOPE_TITLE[scope]}`, style: "h2" },
      buildDetailNote(scopedBookings.length, detailRows.length),
      buildDetailTable(detailRows),
    ],
  };

  const filename = `ISTURA-LaporanBooking-${SCOPE_LABEL[scope]}-${RANGE_FILENAME[range]}-${formatDateKey(new Date()).replace(/-/g, "")}.pdf`;
  await generateAndDownloadPdf(docDefinition, filename);

  return { filename, bookingCount: scopedBookings.length };
};

const buildBookingNarrative = (k: {
  total: number;
  completed: number;
  totalVisitors: number;
  completedPct: number;
}): unknown => {
  const sentences: string[] = [];
  if (k.total === 0) {
    sentences.push("Tidak ada permohonan kunjungan masuk pada periode ini.");
  } else {
    sentences.push(
      `Periode ini menerima ${k.total} permohonan kunjungan. ` +
        `${k.completed} kunjungan terlaksana (${k.completedPct}%) dengan total ${k.totalVisitors.toLocaleString("id-ID")} pengunjung.`,
    );
  }
  return { text: sentences.join(" "), margin: [0, 0, 0, 6], alignment: "justify" };
};

const buildDetailNote = (scopedCount: number, shownCount: number): unknown => {
  if (scopedCount === 0) {
    return {
      text: "Tidak ada permohonan pada lingkup & periode ini.",
      style: "muted",
      margin: [0, 0, 0, 8],
    };
  }
  const text =
    shownCount < scopedCount
      ? `Menampilkan ${shownCount} dari ${scopedCount} permohonan (terbaru). Untuk data lengkap, gunakan ekspor Excel.`
      : `${scopedCount} permohonan. NIK tidak ditampilkan pada laporan PDF; gunakan ekspor Excel bila perlu data identitas.`;
  return { text, style: "muted", margin: [0, 0, 0, 8] };
};

const buildDetailTable = (rows: ReportBooking[]): unknown => {
  if (rows.length === 0) {
    return { text: "—", style: "muted" };
  }
  const statusColor: Record<ReportBooking["status"], string> = {
    Pending: COLOR.muted,
    Accepted: "#3B82F6",
    Reschedule: COLOR.gold,
    Completed: COLOR.positive,
    Rejected: COLOR.attention,
    Expired: COLOR.muted,
  };
  const body: unknown[][] = [
    [
      { text: "Kode", style: "tableHeader" },
      { text: "Tanggal kunjungan", style: "tableHeader" },
      { text: "Instansi", style: "tableHeader" },
      { text: "Contact Person", style: "tableHeader" },
      { text: "Jumlah", style: "tableHeader", alignment: "right" },
      { text: "Status", style: "tableHeader" },
    ],
  ];
  rows.forEach((b, idx) => {
    const fill = idx % 2 === 1 ? COLOR.goldLight : undefined;
    body.push([
      { text: b.code, style: "tableCell", fillColor: fill },
      { text: b.dateLabel || "—", style: "tableCell", fillColor: fill },
      { text: truncate(b.institution || "—", 40), style: "tableCell", fillColor: fill },
      { text: truncate(b.contactName || "—", 28), style: "tableCell", fillColor: fill },
      { text: (b.groupSize ?? 0).toLocaleString("id-ID"), style: "tableCell", alignment: "right", fillColor: fill },
      {
        text: BOOKING_STATUS_LABELS[b.status],
        style: "tableCell",
        bold: true,
        color: statusColor[b.status],
        fillColor: fill,
      },
    ]);
  });
  return {
    table: { widths: [55, "auto", "*", "*", 38, 60], body, dontBreakRows: true },
    layout: METRIC_TABLE_LAYOUT,
  };
};

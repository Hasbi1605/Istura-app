// Booking admin screen + sub-components. Extracted from App.tsx (refactor F6.5).
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Filter,
  Image as ImageIcon,
  Rows3,
  Rows4,
  Search,
  X,
} from "lucide-react";
import type {
  Booking,
  VisitDay,
  VisitStatus,
  BookingStatus,
  BookingStatusFilter,
  BookingSort,
  BookingDateRange,
  BookingViewMode,
  BookingDensity,
  AdminAction,
} from "../../domain/types";
import {
  sortBookings,
  inDateRange,
  parseProposedSlot,
  BOOKING_STATUS_CHIPS,
  PAGE_SIZE_BOOKING_SPLIT,
  PAGE_SIZE_BOOKING_TABLE,
  VIRTUALIZE_THRESHOLD,
} from "../../domain/booking";
import { formatCount, formatCountShort, parseDateKey } from "../../lib/date";
import { ASSETS } from "../../lib/assets";
import { openWhatsApp, createWhatsappMessage } from "../../lib/waActions";
import { useMediaQuery, useVirtualWindow } from "../../hooks";
import {
  acceptBooking as apiAcceptBooking,
  rejectBooking as apiRejectBooking,
  rescheduleBooking as apiRescheduleBooking,
  completeBooking as apiCompleteBooking,
} from "../../api/bookings";
import { StatCard } from "../ui/StatCard";
import { DetailItem } from "../ui/DetailItem";
import { StatusBadge } from "../ui/StatusBadge";
import { Pagination } from "../ui/Pagination";
import { BookingExportModal, MonthlyReportModal } from "./ExportModals";

export function AdminScreen({
  schedules,
  bookings,
  onBookingsChange,
  onSchedulesChange,
  focusCode,
  onFocusCodeConsumed,
  adminName,
}: {
  schedules: VisitDay[];
  bookings: Booking[];
  onBookingsChange: (bookings: Booking[]) => void;
  onSchedulesChange: (schedules: VisitDay[]) => void;
  focusCode?: string | null;
  onFocusCodeConsumed?: () => void;
  adminName?: string;
}) {
  const [selectedCode, setSelectedCode] = useState(
    focusCode ?? bookings[0]?.code ?? "",
  );
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<BookingStatusFilter>(null);
  const [sort, setSort] = useState<BookingSort>("smart");
  const [dateRange, setDateRange] = useState<BookingDateRange>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<BookingViewMode>("split");
  const [density, setDensity] = useState<BookingDensity>("comfortable");
  const [showSlideOver, setShowSlideOver] = useState(false);
  const [showFilterPopover, setShowFilterPopover] = useState(false);
  const [modal, setModal] = useState<{ action: AdminAction; booking: Booking } | null>(null);
  const [previewBooking, setPreviewBooking] = useState<Booking | null>(null);
  // Mobile breakpoint: split-pane tidak punya cukup ruang untuk dua kolom,
  // jadi kita reuse pola SlideOver (yang sudah dipakai di mode "table" desktop)
  // sebagai panel detail. List tetap full-width.
  const isCompactScreen = useMediaQuery("(max-width: 980px)");
  const [showExportModal, setShowExportModal] = useState(false);

  // In production this would resolve to the user-uploaded file. The demo
  // reuses the shared kop-surat asset for every booking so admins can still
  // exercise the preview/download UI end-to-end.
  const documentUrlFor = (_booking: Booking) => ASSETS.letterExample;

  const handleDownloadDocument = (booking: Booking) => {
    const url = documentUrlFor(booking);
    const link = document.createElement("a");
    link.href = url;
    link.download = booking.documentName;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Saat ada permintaan fokus dari modul lain (misal dari Jadwal Kunjungan),
  // pilih booking itu dan reset filter agar booking pasti terlihat.
  useEffect(() => {
    if (!focusCode) return;
    setSelectedCode(focusCode);
    setStatusFilter(null);
    setSearch("");
    setDateRange("all");
    setPage(1);
    if (viewMode === "table" || isCompactScreen) setShowSlideOver(true);
    onFocusCodeConsumed?.();
  }, [focusCode, viewMode, isCompactScreen, onFocusCodeConsumed]);

  // Per-status counts always reference the full dataset so the chips stay
  // stable while the admin narrows the list.
  const counts = useMemo(() => {
    const total = bookings.length;
    const byStatus: Record<BookingStatus, number> = {
      Pending: 0,
      Accepted: 0,
      Reschedule: 0,
      Completed: 0,
      Rejected: 0,
    };
    bookings.forEach((booking) => {
      byStatus[booking.status] += 1;
    });
    return { total, byStatus };
  }, [bookings]);

  const visibleBookings = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matched = bookings.filter((booking) => {
      if (q) {
        const haystack =
          `${booking.code} ${booking.contactName} ${booking.institution}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (statusFilter !== null && booking.status !== statusFilter) return false;
      if (!inDateRange(booking, dateRange, customFrom, customTo)) return false;
      return true;
    });
    return sortBookings(matched, sort);
  }, [bookings, search, statusFilter, dateRange, customFrom, customTo, sort]);

  // Reset pagination whenever the underlying list shrinks/grows from a filter
  // change so the user is never stranded on an empty page.
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, dateRange, customFrom, customTo, sort, viewMode]);

  const pageSize = viewMode === "table" ? PAGE_SIZE_BOOKING_TABLE : PAGE_SIZE_BOOKING_SPLIT;
  const totalPages = Math.max(1, Math.ceil(visibleBookings.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const useVirtual = visibleBookings.length > VIRTUALIZE_THRESHOLD;
  const pagedBookings = useVirtual
    ? visibleBookings
    : visibleBookings.slice((safePage - 1) * pageSize, safePage * pageSize);

  const selectedBooking =
    visibleBookings.find((booking) => booking.code === selectedCode) ??
    pagedBookings[0] ??
    null;

  // Booking-page KPIs focus on operational workload, not visitor sentiment.
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setHours(0, 0, 0, 0);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  const completedThisWeek = bookings.filter(
    (booking) => booking.status === "Completed" && parseDateKey(booking.date) >= startOfWeek,
  ).length;
  const totalThisWeek = bookings.filter(
    (booking) => parseDateKey(booking.date) >= startOfWeek,
  ).length;

  const updateBooking = (
    booking: Booking,
    patch: Partial<Booking>,
  ) => {
    onBookingsChange(
      bookings.map((item) =>
        item.code === booking.code ? { ...item, ...patch } : item,
      ),
    );
  };

  const updateBookingStatus = (booking: Booking, status: BookingStatus, note?: string) => {
    updateBooking(booking, {
      status,
      note,
      completedAt:
        status === "Completed"
          ? new Date().toLocaleString("id-ID", {
              day: "2-digit",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            }) + " WIB"
          : booking.completedAt,
    });
    // Persist to API. Optimistic local update sudah dilakukan di atas; jika
    // API gagal, realtime broadcast atau refetch berikutnya akan rekonsiliasi.
    const apiCall =
      status === "Accepted"
        ? apiAcceptBooking(booking.code, note)
        : status === "Rejected"
          ? apiRejectBooking(booking.code, note)
          : status === "Completed"
            ? apiCompleteBooking(booking.code)
            : null;
    if (apiCall) void apiCall.catch(() => {});
  };

  const handleMarkCompleted = (booking: Booking) => {
    updateBookingStatus(booking, "Completed");
    openWhatsApp(booking, createWhatsappMessage(booking, "Completed"));
  };

  const updateSlotStatus = (booking: Booking, status: VisitStatus) => {
    onSchedulesChange(
      schedules.map((day) =>
        day.date === booking.date
          ? {
              ...day,
              slots: day.slots.map((slot) => (slot.time === booking.time ? { ...slot, status } : slot)),
            }
          : day,
      ),
    );
  };

  // Reschedule lifecycle helpers ---------------------------------------------

  const setSlotStatusAt = (date: string, time: string, status: VisitStatus) => {
    onSchedulesChange(
      schedules.map((day) =>
        day.date === date
          ? {
              ...day,
              slots: day.slots.map((slot) =>
                slot.time === time ? { ...slot, status } : slot,
              ),
            }
          : day,
      ),
    );
  };

  const formatNow = () =>
    new Date().toLocaleString("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }) + " WIB";

  // Admin proposes a new slot. Original slot is held (Reschedule Hold) so it
  // is not handed to another visitor while we wait for the user reply on
  // WhatsApp. Proposed slot is *not* held yet because the user has not agreed.
  const handleProposeReschedule = (
    booking: Booking,
    proposedDate: string,
    proposedDateLabel: string,
    proposedTime: string,
    note: string,
  ) => {
    updateBooking(booking, {
      status: "Reschedule",
      note,
      proposedDate,
      proposedDateLabel,
      proposedTime,
      proposedAt: formatNow(),
    });
    void apiRescheduleBooking(booking.code, { proposedDate, proposedTime, note }).catch(() => {});
    setSlotStatusAt(booking.date, booking.time, "Reschedule Hold");
    const proposalText = `${proposedDateLabel}, ${proposedTime} WIB`;
    openWhatsApp(
      booking,
      createWhatsappMessage(booking, "Reschedule", note ? `${proposalText} - ${note}` : proposalText),
    );
  };

  // User accepted via WhatsApp. Move booking to its proposed slot, free the
  // old hold, and lock the new slot as Booked. WhatsApp re-opens with the
  // standard "Accepted" template so the user receives a final confirmation.
  const handleConfirmReschedule = (booking: Booking) => {
    if (!booking.proposedDate || !booking.proposedTime) return;
    setSlotStatusAt(booking.date, booking.time, "Available");
    setSlotStatusAt(booking.proposedDate, booking.proposedTime, "Booked");
    const promoted: Booking = {
      ...booking,
      status: "Accepted",
      date: booking.proposedDate,
      dateLabel: booking.proposedDateLabel ?? booking.proposedDate,
      time: booking.proposedTime,
      proposedDate: undefined,
      proposedDateLabel: undefined,
      proposedTime: undefined,
      proposedAt: undefined,
    };
    onBookingsChange(
      bookings.map((item) => (item.code === booking.code ? promoted : item)),
    );
    void apiAcceptBooking(booking.code).catch(() => {});
    openWhatsApp(promoted, createWhatsappMessage(promoted, "Accepted"));
  };

  // User declined the proposed slot. Mark booking as rejected and free the
  // original slot so it can be picked up by someone else.
  const handleCancelReschedule = (booking: Booking) => {
    updateBooking(booking, {
      status: "Rejected",
      note: booking.note ?? "User menolak usulan reschedule",
      proposedDate: undefined,
      proposedDateLabel: undefined,
      proposedTime: undefined,
      proposedAt: undefined,
    });
    setSlotStatusAt(booking.date, booking.time, "Available");
    openWhatsApp(
      booking,
      createWhatsappMessage(booking, "Rejected", "Reschedule tidak dapat diakomodasi."),
    );
  };

  const handleAction = (action: AdminAction, booking: Booking, note: string, proposed?: string) => {
    if (action === "accept") {
      updateBookingStatus(booking, "Accepted", note);
      updateSlotStatus(booking, "Booked");
      openWhatsApp(booking, createWhatsappMessage(booking, "Accepted"));
    }
    if (action === "reject") {
      updateBookingStatus(booking, "Rejected", note);
      updateSlotStatus(booking, "Available");
      openWhatsApp(booking, createWhatsappMessage(booking, "Rejected", note));
    }
    if (action === "reschedule" && proposed) {
      // proposed is "Senin, 1 Juni 2026, 09.00 WIB" - parse back to date/time
      const parsed = parseProposedSlot(proposed, schedules);
      if (parsed) {
        handleProposeReschedule(booking, parsed.date, parsed.dateLabel, parsed.time, note);
      }
    }
    setModal(null);
  };

  const handleRowClick = (code: string) => {
    setSelectedCode(code);
    // Di mobile slideover juga dipakai pada split mode karena kolom detail
    // tidak tampil — selektor CSS .booking-split-detail di-hide @ ≤980px.
    if (viewMode === "table" || isCompactScreen) setShowSlideOver(true);
  };

  const resetFilters = () => {
    setSearch("");
    setStatusFilter(null);
    setDateRange("all");
    setCustomFrom("");
    setCustomTo("");
    setSort("smart");
  };

  const filtersActive =
    !!search.trim() ||
    statusFilter !== null ||
    dateRange !== "all" ||
    sort !== "smart";

  // Active filters that pertain only to the popover (sort + date range), used
  // to drive the indicator dot on the filter button.
  const popoverFiltersActive = dateRange !== "all" || sort !== "smart";

  const rowHeight = density === "compact" ? 44 : 64;

  return (
    <div className="admin-cms-page admin-bookings-page">
      <div className="admin-heading">
        <div>
          <h1>Booking Permohonan</h1>
          <p>Tinjau permohonan masuk, kirim konfirmasi WhatsApp, dan tandai kunjungan selesai.</p>
        </div>
        <div className="admin-heading-actions">
          <div className="search-box">
            <Search size={18} aria-hidden="true" />
            <input
              placeholder="Cari kode, CP, instansi"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <button
            type="button"
            className="booking-export-button"
            onClick={() => setShowExportModal(true)}
            title="Export laporan booking ke Excel"
          >
            <FileSpreadsheet size={14} aria-hidden="true" />
            Export
          </button>
        </div>
      </div>

      <div className="admin-stats">
        <StatCard label="Pending" value={counts.byStatus.Pending} />
        <StatCard label="Accepted" value={counts.byStatus.Accepted} />
        <StatCard label="Completed minggu ini" value={completedThisWeek} />
        <StatCard label="Total minggu ini" value={totalThisWeek} />
      </div>

      <div className="booking-toolbar" role="region" aria-label="Filter dan tampilan booking">
        <div className="booking-chip-group" role="tablist" aria-label="Filter status">
          <button
            type="button"
            role="tab"
            aria-selected={statusFilter === null}
            className={`booking-chip booking-chip--all${statusFilter === null ? " is-active" : ""}`}
            onClick={() => setStatusFilter(null)}
            title="Tampilkan semua status"
          >
            <span>Semua</span>
            <em>{formatCountShort(counts.total)}</em>
          </button>
          {BOOKING_STATUS_CHIPS.map((chip) => {
            const count = counts.byStatus[chip.value];
            const isActive = statusFilter === chip.value;
            return (
              <button
                key={chip.value}
                type="button"
                role="tab"
                aria-selected={isActive}
                data-empty={count === 0 ? "true" : undefined}
                className={`booking-chip${isActive ? " is-active" : ""} booking-chip--${chip.value.toLowerCase()}`}
                onClick={() => setStatusFilter(isActive ? null : chip.value)}
                title={isActive ? "Klik untuk hapus filter" : `Filter ${chip.label}`}
              >
                <span>{chip.label}</span>
                <em>{formatCountShort(count)}</em>
              </button>
            );
          })}
        </div>

        <div className="booking-toolbar-spacer" aria-hidden="true" />

        <BookingFilterPopover
          open={showFilterPopover}
          onToggle={() => setShowFilterPopover((prev) => !prev)}
          onClose={() => setShowFilterPopover(false)}
          hasActive={popoverFiltersActive}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          customFrom={customFrom}
          customTo={customTo}
          onCustomFromChange={setCustomFrom}
          onCustomToChange={setCustomTo}
          sort={sort}
          onSortChange={setSort}
          canReset={filtersActive}
          onReset={resetFilters}
        />

        <div className="booking-toggle" role="group" aria-label="Mode tampilan">
          <button
            type="button"
            aria-pressed={viewMode === "split"}
            onClick={() => setViewMode("split")}
            title="Master-detail"
          >
            Split
          </button>
          <button
            type="button"
            aria-pressed={viewMode === "table"}
            onClick={() => setViewMode("table")}
            title="Tabel full-width"
          >
            Tabel
          </button>
        </div>

        <div className="booking-toggle" role="group" aria-label="Density">
          <button
            type="button"
            aria-pressed={density === "comfortable"}
            onClick={() => setDensity("comfortable")}
            title="Comfortable"
          >
            <Rows3 size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-pressed={density === "compact"}
            onClick={() => setDensity("compact")}
            title="Compact"
          >
            <Rows4 size={14} aria-hidden="true" />
          </button>
        </div>

        <div className="booking-summary" aria-live="polite">
          {visibleBookings.length === counts.total ? (
            <>
              <strong>{formatCount(counts.total)}</strong> booking
            </>
          ) : (
            <>
              <strong>{formatCount(visibleBookings.length)}</strong> dari{" "}
              <strong>{formatCount(counts.total)}</strong>
            </>
          )}
          {useVirtual ? " · virtualized" : ""}
        </div>
      </div>

      {viewMode === "split" ? (
        <div className={`admin-workspace booking-density-${density}`}>
          <div className="booking-split-list">
            <div className="booking-table">
              {pagedBookings.length === 0 ? (
                <p className="admin-card-empty">
                  {filtersActive
                    ? "Tidak ada booking yang cocok dengan filter."
                    : "Belum ada booking masuk."}
                </p>
              ) : useVirtual ? (
                <BookingVirtualList
                  bookings={pagedBookings}
                  rowHeight={rowHeight}
                  selectedCode={selectedBooking?.code ?? null}
                  density={density}
                  onSelect={handleRowClick}
                />
              ) : (
                pagedBookings.map((booking) => (
                  <BookingListRow
                    key={booking.code}
                    booking={booking}
                    isSelected={selectedBooking?.code === booking.code}
                    density={density}
                    onSelect={handleRowClick}
                  />
                ))
              )}
            </div>

            {!useVirtual && totalPages > 1 && (
              <Pagination
                page={safePage}
                totalPages={totalPages}
                onChange={setPage}
              />
            )}
          </div>

          <div className="booking-split-detail">
            {selectedBooking ? (
              <BookingDetailPanel
                booking={selectedBooking}
                onAccept={() => setModal({ action: "accept", booking: selectedBooking })}
                onReject={() => setModal({ action: "reject", booking: selectedBooking })}
                onReschedule={() => setModal({ action: "reschedule", booking: selectedBooking })}
                onMarkCompleted={() => handleMarkCompleted(selectedBooking)}
                onConfirmReschedule={() => handleConfirmReschedule(selectedBooking)}
                onCancelReschedule={() => handleCancelReschedule(selectedBooking)}
                onResendReschedule={() => setModal({ action: "reschedule", booking: selectedBooking })}
                onPreviewDocument={(booking) => setPreviewBooking(booking)}
                onDownloadDocument={handleDownloadDocument}
              />
            ) : (
              <div className="booking-detail booking-detail--empty">
                <p>Pilih booking untuk melihat detail.</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <BookingTable
          bookings={pagedBookings}
          density={density}
          rowHeight={rowHeight}
          useVirtual={useVirtual}
          selectedCode={selectedBooking?.code ?? null}
          onSelect={handleRowClick}
          emptyLabel={
            filtersActive
              ? "Tidak ada booking yang cocok dengan filter."
              : "Belum ada booking masuk."
          }
        />
      )}

      {viewMode === "table" && !useVirtual && totalPages > 1 && (
        <Pagination
          page={safePage}
          totalPages={totalPages}
          onChange={setPage}
        />
      )}

      {((viewMode === "table" || isCompactScreen) && showSlideOver && selectedBooking) && (
        <BookingSlideOver
          booking={selectedBooking}
          onClose={() => setShowSlideOver(false)}
          onAccept={() => setModal({ action: "accept", booking: selectedBooking })}
          onReject={() => setModal({ action: "reject", booking: selectedBooking })}
          onReschedule={() => setModal({ action: "reschedule", booking: selectedBooking })}
          onMarkCompleted={() => handleMarkCompleted(selectedBooking)}
          onConfirmReschedule={() => handleConfirmReschedule(selectedBooking)}
          onCancelReschedule={() => handleCancelReschedule(selectedBooking)}
          onResendReschedule={() => setModal({ action: "reschedule", booking: selectedBooking })}
          onPreviewDocument={(booking) => setPreviewBooking(booking)}
          onDownloadDocument={handleDownloadDocument}
        />
      )}

      {modal && (
        <AdminActionModal
          modal={modal}
          schedules={schedules}
          onClose={() => setModal(null)}
          onConfirm={handleAction}
        />
      )}

      {previewBooking && (
        <DocumentPreviewModal
          documentName={previewBooking.documentName}
          documentUrl={documentUrlFor(previewBooking)}
          onClose={() => setPreviewBooking(null)}
          onDownload={() => handleDownloadDocument(previewBooking)}
        />
      )}

      {showExportModal && (
        <BookingExportModal
          bookings={bookings}
          adminName={adminName}
          documentUrlFor={documentUrlFor}
          onClose={() => setShowExportModal(false)}
        />
      )}
    </div>
  );
}

export function BookingListRow({
  booking,
  isSelected,
  density,
  onSelect,
  style,
}: {
  booking: Booking;
  isSelected: boolean;
  density: BookingDensity;
  onSelect: (code: string) => void;
  style?: React.CSSProperties;
}) {
  return (
    <button
      type="button"
      className={`booking-row${isSelected ? " is-selected" : ""} booking-row--${density}`}
      onClick={() => onSelect(booking.code)}
      style={style}
    >
      <span className="booking-row-main">
        <strong>{booking.code}</strong>
        <small>{booking.institution}</small>
      </span>
      <StatusBadge status={booking.status} />
    </button>
  );
}

export function BookingVirtualList({
  bookings,
  rowHeight,
  selectedCode,
  density,
  onSelect,
}: {
  bookings: Booking[];
  rowHeight: number;
  selectedCode: string | null;
  density: BookingDensity;
  onSelect: (code: string) => void;
}) {
  const { containerRef, visible, totalHeight, offsetY } = useVirtualWindow(bookings, rowHeight);
  return (
    <div className="booking-virtual" ref={containerRef}>
      <div className="booking-virtual-spacer" style={{ height: totalHeight }}>
        <div className="booking-virtual-window" style={{ transform: `translateY(${offsetY}px)` }}>
          {visible.map(({ item, index }) => (
            <BookingListRow
              key={item.code}
              booking={item}
              isSelected={selectedCode === item.code}
              density={density}
              onSelect={onSelect}
              style={{ height: rowHeight, ['--row-index' as never]: index }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function BookingTable({
  bookings,
  density,
  rowHeight,
  useVirtual,
  selectedCode,
  onSelect,
  emptyLabel,
}: {
  bookings: Booking[];
  density: BookingDensity;
  rowHeight: number;
  useVirtual: boolean;
  selectedCode: string | null;
  onSelect: (code: string) => void;
  emptyLabel: string;
}) {
  if (bookings.length === 0) {
    return <p className="admin-card-empty">{emptyLabel}</p>;
  }

  return (
    <div className={`booking-grid booking-grid--${density}`}>
      <div className="booking-grid-head" role="row">
        <span>Kode</span>
        <span>Instansi</span>
        <span>Contact person</span>
        <span>Jadwal</span>
        <span>Rombongan</span>
        <span>Submitted</span>
        <span>Status</span>
      </div>
      {useVirtual ? (
        <BookingTableVirtual
          bookings={bookings}
          rowHeight={rowHeight}
          selectedCode={selectedCode}
          onSelect={onSelect}
        />
      ) : (
        bookings.map((booking) => (
          <BookingTableRow
            key={booking.code}
            booking={booking}
            isSelected={selectedCode === booking.code}
            onSelect={onSelect}
          />
        ))
      )}
    </div>
  );
}

export function BookingTableVirtual({
  bookings,
  rowHeight,
  selectedCode,
  onSelect,
}: {
  bookings: Booking[];
  rowHeight: number;
  selectedCode: string | null;
  onSelect: (code: string) => void;
}) {
  const { containerRef, visible, totalHeight, offsetY } = useVirtualWindow(bookings, rowHeight);
  return (
    <div className="booking-grid-virtual" ref={containerRef}>
      <div className="booking-grid-spacer" style={{ height: totalHeight }}>
        <div className="booking-grid-window" style={{ transform: `translateY(${offsetY}px)` }}>
          {visible.map(({ item }) => (
            <BookingTableRow
              key={item.code}
              booking={item}
              isSelected={selectedCode === item.code}
              onSelect={onSelect}
              fixedHeight={rowHeight}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function BookingTableRow({
  booking,
  isSelected,
  onSelect,
  fixedHeight,
}: {
  booking: Booking;
  isSelected: boolean;
  onSelect: (code: string) => void;
  fixedHeight?: number;
}) {
  return (
    <button
      type="button"
      role="row"
      className={`booking-grid-row${isSelected ? " is-selected" : ""}`}
      onClick={() => onSelect(booking.code)}
      style={fixedHeight ? { height: fixedHeight } : undefined}
    >
      <span className="booking-grid-cell booking-grid-code">{booking.code}</span>
      <span className="booking-grid-cell">{booking.institution}</span>
      <span className="booking-grid-cell">{booking.contactName}</span>
      <span className="booking-grid-cell">
        {booking.dateLabel}
        <small>{booking.time} WIB</small>
      </span>
      <span className="booking-grid-cell">{booking.groupSize} orang</span>
      <span className="booking-grid-cell booking-grid-meta">{booking.submittedAt}</span>
      <span className="booking-grid-cell">
        <StatusBadge status={booking.status} />
      </span>
    </button>
  );
}

export function BookingDetailPanel({
  booking,
  onAccept,
  onReject,
  onReschedule,
  onMarkCompleted,
  onConfirmReschedule,
  onCancelReschedule,
  onResendReschedule,
  onPreviewDocument,
  onDownloadDocument,
}: {
  booking: Booking;
  onAccept: () => void;
  onReject: () => void;
  onReschedule: () => void;
  onMarkCompleted: () => void;
  onConfirmReschedule?: () => void;
  onCancelReschedule?: () => void;
  onResendReschedule?: () => void;
  onPreviewDocument: (booking: Booking) => void;
  onDownloadDocument: (booking: Booking) => void;
}) {
  return (
    <div className="booking-detail">
      <div className="detail-head">
        <span>
          <strong>{booking.code}</strong>
          <small>Diajukan {booking.submittedAt}</small>
        </span>
        <StatusBadge status={booking.status} />
      </div>
      {booking.status === "Reschedule" && booking.proposedDate && (
        <RescheduleProposalBanner booking={booking} />
      )}
      <div className="detail-grid">
        <DetailItem label="Contact person" value={booking.contactName} />
        <DetailItem label="NIK" value={booking.nik} />
        <DetailItem label="WhatsApp" value={booking.whatsapp} />
        <DetailItem label="Instansi" value={booking.institution} />
        <DetailItem label="Rombongan" value={`${booking.groupSize} orang`} />
        <DetailItem
          label="Jadwal"
          value={`${booking.dateLabel}, ${booking.time} WIB`}
        />
        <DocumentDetailItem
          label="Surat"
          documentName={booking.documentName}
          onPreview={() => onPreviewDocument(booking)}
          onDownload={() => onDownloadDocument(booking)}
        />
      </div>
      <BookingActions
        booking={booking}
        onAccept={onAccept}
        onReject={onReject}
        onReschedule={onReschedule}
        onMarkCompleted={onMarkCompleted}
        onConfirmReschedule={onConfirmReschedule}
        onCancelReschedule={onCancelReschedule}
        onResendReschedule={onResendReschedule}
      />
    </div>
  );
}

export function RescheduleProposalBanner({ booking }: { booking: Booking }) {
  // Surface the original vs proposed slot so the admin sees exactly what was
  // offered to the visitor without re-reading the WhatsApp thread.
  return (
    <div className="reschedule-banner" role="status">
      <div className="reschedule-banner-head">
        <Clock3 size={14} aria-hidden="true" />
        Menunggu konfirmasi user
      </div>
      <div className="reschedule-banner-grid">
        <div className="reschedule-banner-slot">
          <span>Jadwal awal</span>
          <strong>{booking.dateLabel}</strong>
          <small>{booking.time} WIB</small>
        </div>
        <div className="reschedule-banner-arrow" aria-hidden="true">
          <ArrowRight size={14} />
        </div>
        <div className="reschedule-banner-slot">
          <span>Usulan baru</span>
          <strong>{booking.proposedDateLabel ?? booking.proposedDate}</strong>
          <small>{booking.proposedTime} WIB</small>
        </div>
      </div>
      {booking.proposedAt && (
        <div className="reschedule-banner-meta">Diusulkan {booking.proposedAt}</div>
      )}
      {booking.note && <div className="reschedule-banner-note">Catatan admin: {booking.note}</div>}
    </div>
  );
}

export function BookingActions({
  booking,
  onAccept,
  onReject,
  onReschedule,
  onMarkCompleted,
  onConfirmReschedule,
  onCancelReschedule,
  onResendReschedule,
}: {
  booking: Booking;
  onAccept: () => void;
  onReject: () => void;
  onReschedule: () => void;
  onMarkCompleted: () => void;
  onConfirmReschedule?: () => void;
  onCancelReschedule?: () => void;
  onResendReschedule?: () => void;
}) {
  return (
    <div className="admin-actions">
      {booking.status === "Pending" && (
        <>
          <button className="button button-accept" type="button" onClick={onAccept}>
            Accept
          </button>
          <button className="button button-danger" type="button" onClick={onReject}>
            Reject
          </button>
          <button className="button button-outline" type="button" onClick={onReschedule}>
            Reschedule
          </button>
        </>
      )}
      {booking.status === "Accepted" && (
        <>
          <button
            className="button button-primary"
            type="button"
            onClick={onMarkCompleted}
            title="Tandai kunjungan selesai dan kirim link feedback via WhatsApp"
          >
            <BadgeCheck size={16} aria-hidden="true" />
            Tandai Selesai
          </button>
          <button className="button button-outline" type="button" onClick={onReschedule}>
            Reschedule
          </button>
        </>
      )}
      {booking.status === "Reschedule" && (
        <>
          <button
            className="button button-accept"
            type="button"
            onClick={onConfirmReschedule}
            title="User setuju jadwal baru, kunci slot dan kirim WhatsApp konfirmasi"
          >
            User setuju, konfirmasi
          </button>
          <button
            className="button button-outline"
            type="button"
            onClick={onResendReschedule}
            title="Tawarkan jadwal alternatif lain"
          >
            Tawarkan jadwal lain
          </button>
          <button
            className="button button-danger"
            type="button"
            onClick={onCancelReschedule}
            title="User menolak, batalkan permohonan"
          >
            User menolak, batalkan
          </button>
        </>
      )}
      {(booking.status === "Rejected" || booking.status === "Completed") && (
        <span className="admin-actions-locked">Status: {booking.status}</span>
      )}
    </div>
  );
}

export function BookingFilterPopover({
  open,
  onToggle,
  onClose,
  hasActive,
  dateRange,
  onDateRangeChange,
  customFrom,
  customTo,
  onCustomFromChange,
  onCustomToChange,
  sort,
  onSortChange,
  canReset,
  onReset,
}: {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  hasActive: boolean;
  dateRange: BookingDateRange;
  onDateRangeChange: (next: BookingDateRange) => void;
  customFrom: string;
  customTo: string;
  onCustomFromChange: (next: string) => void;
  onCustomToChange: (next: string) => void;
  sort: BookingSort;
  onSortChange: (next: BookingSort) => void;
  canReset: boolean;
  onReset: () => void;
}) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // Outside-click + Escape close. Both are mandatory so the popover behaves
  // like the rest of the menu/modal patterns in the app.
  useEffect(() => {
    if (!open) return undefined;
    const handlePointer = (event: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(event.target as Node)) onClose();
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open, onClose]);

  return (
    <div className="booking-filter" ref={wrapperRef}>
      <button
        type="button"
        className={`booking-filter-trigger${hasActive ? " has-active" : ""}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={onToggle}
      >
        <Filter size={14} aria-hidden="true" />
        Filter & Urutan
        {hasActive && <span className="booking-filter-dot" aria-hidden="true" />}
      </button>
      {open && (
        <div className="booking-filter-popover" role="dialog" aria-label="Filter dan urutan">
          <div className="booking-filter-section">
            <span className="booking-filter-label">Tanggal kunjungan</span>
            <div className="booking-filter-options">
              {(
                [
                  { value: "all", label: "Semua" },
                  { value: "today", label: "Hari ini" },
                  { value: "week", label: "Minggu ini" },
                  { value: "month", label: "Bulan ini" },
                  { value: "custom", label: "Custom" },
                ] as { value: BookingDateRange; label: string }[]
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={dateRange === opt.value}
                  className={`booking-filter-option${dateRange === opt.value ? " is-active" : ""}`}
                  onClick={() => onDateRangeChange(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {dateRange === "custom" && (
              <div className="booking-filter-range">
                <input
                  type="date"
                  value={customFrom}
                  max={customTo || undefined}
                  onChange={(event) => onCustomFromChange(event.target.value)}
                  aria-label="Dari tanggal"
                />
                <span aria-hidden="true">-</span>
                <input
                  type="date"
                  value={customTo}
                  min={customFrom || undefined}
                  onChange={(event) => onCustomToChange(event.target.value)}
                  aria-label="Sampai tanggal"
                />
              </div>
            )}
          </div>

          <div className="booking-filter-section">
            <span className="booking-filter-label">Urutan</span>
            <div className="booking-filter-options booking-filter-options--column">
              {(
                [
                  { value: "smart", label: "Smart sort (rekomendasi)" },
                  { value: "submitted-desc", label: "Submit terbaru" },
                  { value: "submitted-asc", label: "Submit terlama" },
                  { value: "date-asc", label: "Jadwal terdekat" },
                  { value: "date-desc", label: "Jadwal terjauh" },
                ] as { value: BookingSort; label: string }[]
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={sort === opt.value}
                  className={`booking-filter-option${sort === opt.value ? " is-active" : ""}`}
                  onClick={() => onSortChange(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="booking-filter-footer">
            <button
              type="button"
              className="booking-filter-reset"
              onClick={onReset}
              disabled={!canReset}
            >
              Reset semua
            </button>
            <button
              type="button"
              className="booking-filter-apply"
              onClick={onClose}
            >
              Selesai
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function BookingSlideOver({
  booking,
  onClose,
  onAccept,
  onReject,
  onReschedule,
  onMarkCompleted,
  onConfirmReschedule,
  onCancelReschedule,
  onResendReschedule,
  onPreviewDocument,
  onDownloadDocument,
}: {
  booking: Booking;
  onClose: () => void;
  onAccept: () => void;
  onReject: () => void;
  onReschedule: () => void;
  onMarkCompleted: () => void;
  onConfirmReschedule?: () => void;
  onCancelReschedule?: () => void;
  onResendReschedule?: () => void;
  onPreviewDocument: (booking: Booking) => void;
  onDownloadDocument: (booking: Booking) => void;
}) {
  // Close on Escape so power users can navigate the table without leaving the
  // keyboard.
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div className="booking-slideover" role="dialog" aria-modal="true" aria-label="Detail booking">
      <button
        type="button"
        className="booking-slideover-backdrop"
        aria-label="Tutup detail"
        onClick={onClose}
      />
      <aside className="booking-slideover-panel">
        <header>
          <span>
            <strong>{booking.code}</strong>
            <small>Diajukan {booking.submittedAt}</small>
          </span>
          <button type="button" className="booking-slideover-close" onClick={onClose} aria-label="Tutup">
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <div className="booking-slideover-status">
          <StatusBadge status={booking.status} />
        </div>
        {booking.status === "Reschedule" && booking.proposedDate && (
          <RescheduleProposalBanner booking={booking} />
        )}
        <div className="detail-grid">
          <DetailItem label="Contact person" value={booking.contactName} />
          <DetailItem label="NIK" value={booking.nik} />
          <DetailItem label="WhatsApp" value={booking.whatsapp} />
          <DetailItem label="Instansi" value={booking.institution} />
          <DetailItem label="Rombongan" value={`${booking.groupSize} orang`} />
          <DetailItem label="Jadwal" value={`${booking.dateLabel}, ${booking.time} WIB`} />
          <DocumentDetailItem
            label="Surat"
            documentName={booking.documentName}
            onPreview={() => onPreviewDocument(booking)}
            onDownload={() => onDownloadDocument(booking)}
          />
        </div>
        <BookingActions
          booking={booking}
          onAccept={onAccept}
          onReject={onReject}
          onReschedule={onReschedule}
          onMarkCompleted={onMarkCompleted}
          onConfirmReschedule={onConfirmReschedule}
          onCancelReschedule={onCancelReschedule}
          onResendReschedule={onResendReschedule}
        />
      </aside>
    </div>
  );
}

export function AdminActionModal({
  modal,
  schedules,
  onClose,
  onConfirm,
}: {
  modal: { action: AdminAction; booking: Booking };
  schedules: VisitDay[];
  onClose: () => void;
  onConfirm: (action: AdminAction, booking: Booking, note: string, proposed?: string) => void;
}) {
  const [note, setNote] = useState("");
  const availableSlots = schedules.flatMap((day) =>
    day.slots
      .filter((slot) => slot.status === "Available")
      .map((slot) => `${day.label}, ${slot.time} WIB`),
  );
  const [proposed, setProposed] = useState(availableSlots[0] ?? "");
  const titleMap = {
    accept: "Setujui Booking",
    reject: "Tolak Booking",
    reschedule: "Tawarkan Reschedule",
  };
  const needsNote = modal.action !== "accept";

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal-card" role="dialog" aria-modal="true" aria-label={titleMap[modal.action]}>
        <button className="modal-close" type="button" onClick={onClose} aria-label="Tutup modal">
          <X size={18} aria-hidden="true" />
        </button>
        <h2>{titleMap[modal.action]}</h2>
        <p>{modal.booking.code} - {modal.booking.institution}</p>
        {modal.action === "reschedule" && (
          <label className="form-field">
            <span>Jadwal alternatif</span>
            <select value={proposed} onChange={(event) => setProposed(event.target.value)}>
              {availableSlots.map((slot) => (
                <option key={slot} value={slot}>
                  {slot}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="form-field">
          <span>{needsNote ? "Alasan" : "Catatan admin opsional"}</span>
          <textarea value={note} onChange={(event) => setNote(event.target.value)} />
        </label>
        <div className="modal-actions">
          <button className="button button-ghost" type="button" onClick={onClose}>
            Batal
          </button>
          <button
            className="button button-primary"
            type="button"
            disabled={needsNote && !note.trim()}
            onClick={() => onConfirm(modal.action, modal.booking, note, proposed)}
          >
            Konfirmasi & Buka WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
}

export function DocumentDetailItem({
  label,
  documentName,
  onPreview,
  onDownload,
}: {
  label: string;
  documentName: string;
  onPreview: () => void;
  onDownload: () => void;
}) {
  // Icon picker keyed off the file extension. PDFs get the document icon,
  // anything else (jpg/png) gets the image icon. Keeps the row visually
  // honest about the kind of attachment being previewed.
  const ext = documentName.split(".").pop()?.toLowerCase() ?? "";
  const Icon = ext === "pdf" ? FileText : ImageIcon;

  return (
    <div className="detail-item detail-item--document">
      <span>{label}</span>
      <div className="document-detail-row">
        <button
          type="button"
          className="document-detail-link"
          onClick={onPreview}
          aria-label={`Pratinjau ${documentName}`}
        >
          <Icon size={16} aria-hidden="true" />
          <strong>{documentName}</strong>
        </button>
        <button
          type="button"
          className="document-detail-download"
          onClick={onDownload}
          aria-label={`Unduh ${documentName}`}
          title="Unduh surat"
        >
          <Download size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export function DocumentPreviewModal({
  documentName,
  documentUrl,
  onClose,
  onDownload,
}: {
  documentName: string;
  documentUrl: string;
  onClose: () => void;
  onDownload: () => void;
}) {
  // Esc to dismiss, mirroring the slideover keyboard behaviour so admins can
  // breeze through pending bookings without leaving the keyboard.
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Render mode is decided from the actual asset URL extension, not the
  // displayed file name: in the demo every booking previews the shared
  // contoh-kop-surat.png even when documentName ends in .pdf.
  const urlExt = documentUrl.split(".").pop()?.toLowerCase() ?? "";
  const isPdf = urlExt === "pdf";
  const isImage = urlExt === "jpg" || urlExt === "jpeg" || urlExt === "png";

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-card document-preview-card"
        role="dialog"
        aria-modal="true"
        aria-label={`Pratinjau ${documentName}`}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          className="modal-close"
          type="button"
          onClick={onClose}
          aria-label="Tutup pratinjau"
        >
          <X size={18} aria-hidden="true" />
        </button>
        <header className="document-preview-head">
          <FileText size={18} aria-hidden="true" />
          <div>
            <h2>Pratinjau surat permohonan</h2>
            <p>{documentName}</p>
          </div>
        </header>
        <div className="document-preview-body">
          {isPdf && (
            <iframe
              title={`Pratinjau ${documentName}`}
              src={documentUrl}
              className="document-preview-frame"
            />
          )}
          {isImage && (
            <img
              src={documentUrl}
              alt={`Pratinjau ${documentName}`}
              className="document-preview-image"
            />
          )}
          {!isPdf && !isImage && (
            <div className="document-preview-fallback">
              <FileText size={32} aria-hidden="true" />
              <p>Format file tidak bisa ditampilkan langsung.</p>
              <p>Silakan unduh untuk membukanya di komputer.</p>
            </div>
          )}
        </div>
        <div className="document-preview-actions">
          <a
            className="button button-ghost"
            href={documentUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink size={16} aria-hidden="true" />
            Buka di tab baru
          </a>
          <button
            className="button button-primary"
            type="button"
            onClick={onDownload}
          >
            <Download size={16} aria-hidden="true" />
            Unduh
          </button>
        </div>
      </div>
    </div>
  );
}

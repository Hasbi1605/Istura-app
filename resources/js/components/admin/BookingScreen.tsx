// Booking admin screen + sub-components. Extracted from App.tsx (refactor F6.5).
import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Filter,
  Image as ImageIcon,
  Loader2,
  Plus,
  Rows3,
  Rows4,
  Search,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import type {
  Booking,
  BookingSegment,
  VisitDay,
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
  bookingKloterSummary,
  bookingScheduleSummary,
  bookingSegments,
  bookingTimeSummary,
  canFitConsecutiveSlots,
  bookingLeadTimeLabel,
  isShortNoticeBooking,
  ADMIN_MAX_BOOKING_GROUP_SIZE,
  BOOKING_STATUS_CHIPS,
  BOOKING_STATUS_LABELS,
  SLOT_CAPACITY,
  PAGE_SIZE_BOOKING_SPLIT,
  PAGE_SIZE_BOOKING_TABLE,
  segmentListLabel,
  splitGroupSizes,
  VIRTUALIZE_THRESHOLD,
} from "../../domain/booking";
import { addDays, addMonths, formatCount, formatCountShort, formatDateKey, formatLongDate, jakartaToday, parseDateKey } from "../../lib/date";
import { openWhatsApp, createWhatsappMessage } from "../../lib/waActions";
import { useMediaQuery, useVirtualWindow } from "../../hooks";
import {
		acceptBooking as apiAcceptBooking,
  createAdminBooking as apiCreateAdminBooking,
  rejectBooking as apiRejectBooking,
  rescheduleBooking as apiRescheduleBooking,
  cancelRescheduleBooking as apiCancelRescheduleBooking,
  completeBooking as apiCompleteBooking,
  updateBookingSegments as apiUpdateBookingSegments,
  moveBookingDirectly as apiMoveBookingDirectly,
} from "../../api/bookings";
import { fetchAdminSchedule } from "../../api/schedule";
import { apiBookingToLocal, apiVisitDayToLocal } from "../../api/adapters";
import { ApiError } from "../../api/client";
import { StatCard } from "../ui/StatCard";
import { DetailItem } from "../ui/DetailItem";
import { StatusBadge } from "../ui/StatusBadge";
import { Pagination } from "../ui/Pagination";
import { ButtonSpinner, InlineSpinner, StatCardSkeleton, TableSkeleton } from "../ui/LoadingStates";
import { BookingExportModal } from "./ExportModals";

const MAX_ADMIN_DOCUMENT_BYTES = 5 * 1024 * 1024;

export function AdminScreen({
	schedules,
	bookings,
	loading = false,
	onBookingsChange,
  onSchedulesChange,
  focusCode,
  onFocusCodeConsumed,
  adminName,
  readOnly = false,
}: {
	schedules: VisitDay[];
	bookings: Booking[];
	loading?: boolean;
	onBookingsChange: (bookings: Booking[]) => void;
  onSchedulesChange: (schedules: VisitDay[]) => void;
  focusCode?: string | null;
  onFocusCodeConsumed?: () => void;
  adminName?: string;
  readOnly?: boolean;
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
	const [segmentModal, setSegmentModal] = useState<{ booking: Booking } | null>(null);
	const [moveModal, setMoveModal] = useState<{ booking: Booking } | null>(null);
	const [showCreateModal, setShowCreateModal] = useState(false);
	const [creatingBooking, setCreatingBooking] = useState(false);
	const [previewBooking, setPreviewBooking] = useState<Booking | null>(null);
	const [pendingAction, setPendingAction] = useState<{ code: string; label: string } | null>(null);
	const [downloadingCode, setDownloadingCode] = useState<string | null>(null);
	const [actionError, setActionError] = useState("");
	const [actionNotice, setActionNotice] = useState("");
  // Mobile breakpoint: split-pane tidak punya cukup ruang untuk dua kolom,
  // jadi kita reuse pola SlideOver (yang sudah dipakai di mode "table" desktop)
  // sebagai panel detail. List tetap full-width.
  const isCompactScreen = useMediaQuery("(max-width: 980px)");
  const [showExportModal, setShowExportModal] = useState(false);

  const documentUrlFor = (booking: Booking, inline = false) =>
    `/api/admin/bookings/${encodeURIComponent(booking.code)}/document${inline ? "?disposition=inline" : ""}`;

  const handleDownloadDocument = async (booking: Booking) => {
    if (downloadingCode) return;
    setDownloadingCode(booking.code);
    setActionError("");
    try {
      const response = await fetch(documentUrlFor(booking), {
        credentials: "include",
        headers: { "X-Requested-With": "XMLHttpRequest" },
      });
      if (!response.ok) {
        setActionError(response.status === 403 ? "Sesi admin tidak valid atau tidak berwenang." : `Gagal mengunduh dokumen (${response.status}).`);
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = booking.documentName;
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      setActionError("Gagal mengunduh dokumen. Periksa koneksi lalu coba lagi.");
    } finally {
      setDownloadingCode(null);
    }
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
      Expired: 0,
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
  const replaceBooking = (booking: Booking) => {
    onBookingsChange(
      bookings.map((item) => (item.code === booking.code ? booking : item)),
    );
  };

	const refreshSchedulesFromApi = () =>
		fetchAdminSchedule().then((days) => onSchedulesChange(days.map(apiVisitDayToLocal)));

	const pendingLabelFor = (booking: Booking) =>
		pendingAction?.code === booking.code ? pendingAction.label : null;

	const messageForActionError = (err: unknown) =>
		err instanceof ApiError
			? err.message
			: err instanceof Error
				? err.message
				: "Gagal menyimpan perubahan booking. Coba lagi.";

	const runBookingAction = async (
		booking: Booking,
		label: string,
		task: () => Promise<void>,
	) => {
		if (pendingAction) return;
		setPendingAction({ code: booking.code, label });
		setActionError("");
		setActionNotice("");
		try {
			await task();
		} catch (err) {
			setActionError(messageForActionError(err));
		} finally {
			setPendingAction((current) => (current?.code === booking.code ? null : current));
		}
	};

	const syncBookingFromApi = async (updated: Awaited<ReturnType<typeof apiAcceptBooking>>) => {
		const localBooking = apiBookingToLocal(updated);
		replaceBooking(localBooking);
		try {
			await refreshSchedulesFromApi();
		} catch {
			setActionError("Booking tersimpan, tetapi jadwal terbaru gagal dimuat ulang. Muat ulang halaman jika status slot belum berubah.");
		}
		return localBooking;
	};

	const updateBookingStatus = async (
		booking: Booking,
		status: BookingStatus,
		note?: string,
		documentationLink?: string,
	) => {
		const updated =
			status === "Accepted"
				? await apiAcceptBooking(booking.code, note)
				: status === "Rejected"
					? await apiRejectBooking(booking.code, note)
					: status === "Completed"
						? await apiCompleteBooking(booking.code, { note, documentationLink })
						: null;

		if (!updated) {
			throw new Error(`Aksi status ${BOOKING_STATUS_LABELS[status]} tidak didukung dari layar admin.`);
		}

		return syncBookingFromApi(updated);
	};

	const handleMarkCompleted = (booking: Booking) => {
		setModal({ action: "complete", booking });
	};

  // Admin proposes a new slot. Original and proposed slots are held while we
  // wait for the user reply on WhatsApp.
	const handleProposeReschedule = async (
		booking: Booking,
    proposedDate: string,
		proposedTime: string,
		note: string,
	) => {
		const updated = await apiRescheduleBooking(booking.code, { proposedDate, proposedTime, note });
		const localBooking = await syncBookingFromApi(updated);
		openWhatsApp(
			localBooking,
			createWhatsappMessage(localBooking, "Reschedule", note),
		);
	};

  // User accepted via WhatsApp. Move booking to its proposed slot, free the
  // old hold, and lock the new slot as Booked. WhatsApp re-opens with the
  // standard "Accepted" template so the user receives a final confirmation.
	const handleConfirmReschedule = (booking: Booking) => {
		if (!booking.proposedDate || !booking.proposedTime) return;
		void runBookingAction(booking, "Mengonfirmasi jadwal...", async () => {
			const updated = await updateBookingStatus(booking, "Accepted");
			openWhatsApp(updated, createWhatsappMessage(updated, "Accepted"));
		});
	};

  // User declined the proposed slot. Free the proposed hold and restore the
  // original booking state.
	const handleCancelReschedule = (booking: Booking) => {
		void runBookingAction(booking, "Membatalkan reschedule...", async () => {
			const note = "User menolak usulan reschedule.";
			const updated = await apiCancelRescheduleBooking(booking.code, note);
			const localBooking = await syncBookingFromApi(updated);
			const messageStatus = localBooking.status === "Pending" ? "Pending" : "Accepted";
			openWhatsApp(localBooking, createWhatsappMessage(localBooking, messageStatus, note));
		});
	};

	const handleRejectRescheduledBooking = (booking: Booking) => {
		void runBookingAction(booking, "Membatalkan booking...", async () => {
			const note = "Jadwal yang diminta belum dapat diakomodasi. Silakan melakukan booking ulang untuk periode berikutnya.";
			const updated = await updateBookingStatus(booking, "Rejected", note);
			openWhatsApp(updated, createWhatsappMessage(updated, "Rejected", note));
		});
	};

	const handleAction = (action: AdminAction, booking: Booking, note: string, proposed?: string, documentationLink?: string) => {
		const labelMap: Record<AdminAction, string> = {
			accept: "Menyetujui booking...",
			reject: booking.status === "Expired" ? "Menutup kasus..." : "Menolak booking...",
			reschedule: "Menyimpan reschedule...",
			complete: "Menandai selesai...",
		};
		void runBookingAction(booking, labelMap[action], async () => {
			if (action === "accept") {
				const updated = await updateBookingStatus(booking, "Accepted", note);
				openWhatsApp(updated, createWhatsappMessage(updated, "Accepted"));
				setModal(null);
			}
			if (action === "reject") {
				const updated = await updateBookingStatus(booking, "Rejected", note);
				openWhatsApp(updated, createWhatsappMessage(updated, "Rejected", note));
				setModal(null);
			}
			if (action === "complete") {
				const trimmedLink = documentationLink?.trim() || undefined;
				const updated = await updateBookingStatus(booking, "Completed", undefined, trimmedLink);
				openWhatsApp(updated, createWhatsappMessage(updated, "Completed"));
				setModal(null);
			}
			if (action === "reschedule") {
			if (!proposed) throw new Error("Pilih jadwal alternatif yang tersedia.");
			// proposed is "Senin, 1 Juni 2026, 09.00 WIB" - parse back to date/time
			const parsed = parseProposedSlot(proposed, schedules);
			if (!parsed) throw new Error("Pilih jadwal alternatif yang tersedia.");
			await handleProposeReschedule(booking, parsed.date, parsed.time, note);
			setModal(null);
			}
		});
	};

	const handleUpdateSegments = (booking: Booking, groupSize: number, segments: BookingSegment[], allowOverbook: boolean, correctGroupSize: boolean, confirmRisk: boolean) => {
		void runBookingAction(booking, "Menyimpan kloter manual...", async () => {
			const updated = await apiUpdateBookingSegments(booking.code, {
				groupSize,
				segments: segments.map((segment) => ({
					date: segment.date,
					time: segment.time,
					groupSize: segment.groupSize,
				})),
				allowOverbook: allowOverbook || undefined,
				correctGroupSize: correctGroupSize || undefined,
				confirmRisk: confirmRisk || undefined,
			});
			await syncBookingFromApi(updated);
			setSegmentModal(null);
		});
	};

	const handleMoveDirectly = (booking: Booking, date: string, time: string, allowOverbook: boolean, confirmedDirectMove: boolean) => {
		void runBookingAction(booking, "Memindahkan jadwal...", async () => {
			const updated = await apiMoveBookingDirectly(booking.code, {
				date,
				time,
				allowOverbook: allowOverbook || undefined,
				confirmedDirectMove,
			});
			await syncBookingFromApi(updated);
			setMoveModal(null);
		});
	};

	const handleCreateAdminBooking = async (payload: Parameters<typeof apiCreateAdminBooking>[0]) => {
		if (creatingBooking) return;
		setCreatingBooking(true);
		setActionError("");
		setActionNotice("");
		try {
			const created = apiBookingToLocal(await apiCreateAdminBooking(payload));
			onBookingsChange([created, ...bookings]);
			setSelectedCode(created.code);
			await refreshSchedulesFromApi();
			setShowCreateModal(false);
			setActionNotice(`Booking admin ${created.code} dibuat.`);
		} catch (err) {
			setActionError(messageForActionError(err));
		} finally {
			setCreatingBooking(false);
		}
	};

	useEffect(() => {
		if (!actionNotice) return;
		const timeout = window.setTimeout(() => setActionNotice(""), 5000);
		return () => window.clearTimeout(timeout);
	}, [actionNotice]);

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
				{loading && <InlineSpinner label="Memuat booking terbaru" />}
			</div>
		<div className="admin-heading-actions">
		  {!readOnly && (
		    <button type="button" className="button button-primary admin-create-booking-button" onClick={() => setShowCreateModal(true)} title="Buat booking manual" aria-label="Buat booking manual">
		      <UserPlus size={16} aria-hidden="true" />
		      Booking Manual
		    </button>
		  )}
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
            title="Ekspor laporan booking ke Excel"
          >
            <FileSpreadsheet size={14} aria-hidden="true" />
            Ekspor
          </button>
        </div>
      </div>

		<div className="admin-stats" aria-busy={loading}>
			{loading && bookings.length === 0 ? (
				<StatCardSkeleton />
			) : (
				<>
					<StatCard label="Menunggu" value={counts.byStatus.Pending} />
					<StatCard label="Kedaluwarsa" value={counts.byStatus.Expired} />
					<StatCard label="Disetujui" value={counts.byStatus.Accepted} />
					<StatCard label="Selesai minggu ini" value={completedThisWeek} />
				</>
			)}
		</div>

		{actionError && <strong className="form-message form-message--error">{actionError}</strong>}
		{actionNotice && <strong className="form-message">{actionNotice}</strong>}

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

            // Permanent status chips that are always visible
            const isPermanent = ["Pending", "Accepted", "Rejected"].includes(chip.value);
            if (!isPermanent && count === 0 && !isActive) {
              return null;
            }

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
				{loading && bookings.length === 0 ? (
					<TableSkeleton rows={8} />
				) : pagedBookings.length === 0 ? (
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
					pendingLabel={pendingLabelFor(selectedBooking)}
                onAccept={() => setModal({ action: "accept", booking: selectedBooking })}
                onReject={() => setModal({ action: "reject", booking: selectedBooking })}
                onReschedule={() => setModal({ action: "reschedule", booking: selectedBooking })}
                onEditSegments={() => setSegmentModal({ booking: selectedBooking })}
                onMoveDirectly={() => setMoveModal({ booking: selectedBooking })}
                onMarkCompleted={() => handleMarkCompleted(selectedBooking)}
                onConfirmReschedule={() => handleConfirmReschedule(selectedBooking)}
                onCancelReschedule={() => handleCancelReschedule(selectedBooking)}
                onRejectRescheduledBooking={() => handleRejectRescheduledBooking(selectedBooking)}
                onResendReschedule={() => setModal({ action: "reschedule", booking: selectedBooking })}
                onPreviewDocument={(booking) => setPreviewBooking(booking)}
                onDownloadDocument={handleDownloadDocument}
                downloadingDocument={downloadingCode === selectedBooking.code}
                readOnly={readOnly}
              />
            ) : (
              <div className="booking-detail booking-detail--empty">
                <p>Pilih booking untuk melihat detail.</p>
              </div>
            )}
          </div>
        </div>
      ) : (
		loading && bookings.length === 0 ? (
			<TableSkeleton rows={8} />
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
		)
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
			pendingLabel={pendingLabelFor(selectedBooking)}
          onClose={() => setShowSlideOver(false)}
          onAccept={() => setModal({ action: "accept", booking: selectedBooking })}
          onReject={() => setModal({ action: "reject", booking: selectedBooking })}
          onReschedule={() => setModal({ action: "reschedule", booking: selectedBooking })}
          onEditSegments={() => setSegmentModal({ booking: selectedBooking })}
          onMoveDirectly={() => setMoveModal({ booking: selectedBooking })}
          onMarkCompleted={() => handleMarkCompleted(selectedBooking)}
          onConfirmReschedule={() => handleConfirmReschedule(selectedBooking)}
          onCancelReschedule={() => handleCancelReschedule(selectedBooking)}
          onRejectRescheduledBooking={() => handleRejectRescheduledBooking(selectedBooking)}
          onResendReschedule={() => setModal({ action: "reschedule", booking: selectedBooking })}
          onPreviewDocument={(booking) => setPreviewBooking(booking)}
          onDownloadDocument={handleDownloadDocument}
          downloadingDocument={downloadingCode === selectedBooking.code}
          readOnly={readOnly}
        />
      )}

      {modal && (
		<AdminActionModal
			modal={modal}
			schedules={schedules}
			pendingLabel={pendingLabelFor(modal.booking)}
			error={actionError}
			onClose={() => setModal(null)}
          onConfirm={handleAction}
        />
      )}

      {segmentModal && (
		<SegmentOverrideModal
			booking={segmentModal.booking}
			schedules={schedules}
			pendingLabel={pendingLabelFor(segmentModal.booking)}
			error={actionError}
			onClose={() => setSegmentModal(null)}
			onConfirm={handleUpdateSegments}
		/>
      )}

	  {moveModal && (
		<DirectMoveModal
		  booking={moveModal.booking}
		  schedules={schedules}
		  pendingLabel={pendingLabelFor(moveModal.booking)}
		  error={actionError}
		  onClose={() => setMoveModal(null)}
		  onConfirm={handleMoveDirectly}
		/>
	  )}

	  {showCreateModal && (
		<AdminBookingCreateModal
		  schedules={schedules}
		  busy={creatingBooking}
		  error={actionError}
		  onClose={() => setShowCreateModal(false)}
		  onConfirm={handleCreateAdminBooking}
		/>
	  )}

      {previewBooking && (
        <DocumentPreviewModal
          documentName={previewBooking.documentName}
          documentUrl={documentUrlFor(previewBooking, true)}
          onClose={() => setPreviewBooking(null)}
          onDownload={() => handleDownloadDocument(previewBooking)}
          downloading={downloadingCode === previewBooking.code}
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
        <span>Narahubung</span>
        <span>Jadwal</span>
        <span>Rombongan</span>
        <span>Diajukan</span>
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
      <span className="booking-grid-cell booking-grid-code" data-label="Kode">
        {booking.code}
        <ShortNoticeBadge booking={booking} />
      </span>
      <span className="booking-grid-cell" data-label="Instansi">{booking.institution}</span>
      <span className="booking-grid-cell" data-label="Narahubung">{booking.contactName}</span>
      <span className="booking-grid-cell" data-label="Jadwal">
        {booking.dateLabel}
        <small>{bookingTimeSummary(booking)}</small>
      </span>
      <span className="booking-grid-cell" data-label="Rombongan">{bookingKloterSummary(booking)}</span>
      <span className="booking-grid-cell booking-grid-meta" data-label="Diajukan">{booking.submittedAt}</span>
      <span className="booking-grid-cell" data-label="Status">
        <StatusBadge status={booking.status} />
      </span>
    </button>
  );
}

export function BookingDetailPanel({
  booking,
  pendingLabel,
  onAccept,
  onReject,
  onReschedule,
  onEditSegments,
  onMoveDirectly,
  onMarkCompleted,
  onConfirmReschedule,
  onCancelReschedule,
  onRejectRescheduledBooking,
  onResendReschedule,
  onPreviewDocument,
  onDownloadDocument,
  downloadingDocument = false,
  readOnly = false,
}: {
  booking: Booking;
  pendingLabel?: string | null;
  onAccept: () => void;
  onReject: () => void;
  onReschedule: () => void;
  onEditSegments: () => void;
  onMoveDirectly: () => void;
  onMarkCompleted: () => void;
  onConfirmReschedule?: () => void;
  onCancelReschedule?: () => void;
  onRejectRescheduledBooking?: () => void;
  onResendReschedule?: () => void;
  onPreviewDocument: (booking: Booking) => void;
  onDownloadDocument: (booking: Booking) => void;
  downloadingDocument?: boolean;
  readOnly?: boolean;
}) {
  return (
    <div className="booking-detail">
      <div className="detail-head">
        <span>
          <strong>{booking.code}</strong>
          <small>Diajukan {booking.submittedAt}</small>
          <ShortNoticeBadge booking={booking} />
        </span>
        <StatusBadge status={booking.status} />
      </div>
      {booking.status === "Reschedule" && booking.proposedDate && (
        <RescheduleProposalBanner booking={booking} />
      )}
      <div className="detail-grid">
        <DetailItem label="Narahubung" value={booking.contactName} />
        <DetailItem label="NIK" value={booking.nik} />
        <DetailItem label="WhatsApp" value={booking.whatsapp} />
        <DetailItem label="Instansi" value={booking.institution} />
        <DetailItem label="Rombongan" value={bookingKloterSummary(booking)} />
        <DetailItem
          label="Jadwal"
          value={bookingScheduleSummary(booking)}
        />
        {bookingSegments(booking).length > 1 && (
          <KloterDetailList segments={bookingSegments(booking)} />
        )}
        {booking.expiredAt && <DetailItem label="Kedaluwarsa" value={booking.expiredAt} />}
        <BookingNoteDetails note={booking.note} />
        <DocumentDetailItem
          label="Surat"
          documentName={booking.documentName}
          hasDocument={booking.hasDocument ?? true}
          onPreview={() => onPreviewDocument(booking)}
          onDownload={() => onDownloadDocument(booking)}
          downloading={downloadingDocument}
        />
      </div>
      <BookingActions
        booking={booking}
        pendingLabel={pendingLabel}
        onAccept={onAccept}
        onReject={onReject}
        onReschedule={onReschedule}
        onEditSegments={onEditSegments}
        onMoveDirectly={onMoveDirectly}
        onMarkCompleted={onMarkCompleted}
        onConfirmReschedule={onConfirmReschedule}
        onCancelReschedule={onCancelReschedule}
        onRejectRescheduledBooking={onRejectRescheduledBooking}
        onResendReschedule={onResendReschedule}
        readOnly={readOnly}
      />
    </div>
  );
}

export function RescheduleProposalBanner({ booking }: { booking: Booking }) {
  const notes = splitBookingNotes(booking.note);
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
          <small>{bookingTimeSummary(booking)}</small>
        </div>
        <div className="reschedule-banner-arrow" aria-hidden="true">
          <ArrowRight size={14} />
        </div>
        <div className="reschedule-banner-slot">
          <span>Usulan baru</span>
          <strong>{booking.proposedDateLabel ?? booking.proposedDate}</strong>
          <small>
            {booking.proposedSegments?.length
              ? segmentListLabel(booking.proposedSegments)
              : `${booking.proposedTime} WIB`}
          </small>
        </div>
      </div>
      {booking.proposedAt && (
        <div className="reschedule-banner-meta">Diusulkan {booking.proposedAt}</div>
      )}
      {notes.admin.length > 0 && <div className="reschedule-banner-note">Catatan admin: {notes.admin.join(" ")}</div>}
    </div>
  );
}

export function BookingActions({
  booking,
  pendingLabel,
  onAccept,
  onReject,
  onReschedule,
  onEditSegments,
  onMoveDirectly,
  onMarkCompleted,
  onConfirmReschedule,
  onCancelReschedule,
  onRejectRescheduledBooking,
  onResendReschedule,
  readOnly = false,
}: {
  booking: Booking;
  pendingLabel?: string | null;
  onAccept: () => void;
  onReject: () => void;
  onReschedule: () => void;
  onEditSegments: () => void;
  onMoveDirectly: () => void;
  onMarkCompleted: () => void;
  onConfirmReschedule?: () => void;
  onCancelReschedule?: () => void;
  onRejectRescheduledBooking?: () => void;
  onResendReschedule?: () => void;
  readOnly?: boolean;
}) {
  if (readOnly) {
    return (
      <div className="admin-actions">
        <span className="admin-actions-locked">Status: {BOOKING_STATUS_LABELS[booking.status]}</span>
      </div>
    );
  }
  const busy = Boolean(pendingLabel);
  return (
    <div className="admin-actions">
      {busy && <InlineSpinner label={pendingLabel ?? "Menyimpan perubahan"} />}
      {booking.status === "Pending" && (
        <>
          <button className="button button-accept" type="button" onClick={onAccept} disabled={busy}>
            Setujui
          </button>
          <button className="button button-danger" type="button" onClick={onReject} disabled={busy}>
            Tolak
          </button>
          <button className="button button-outline" type="button" onClick={onReschedule} disabled={busy}>
            Jadwalkan ulang
          </button>
          <button className="button button-outline" type="button" onClick={onEditSegments} disabled={busy}>
            Atur kloter
          </button>
          <button className="button button-outline" type="button" onClick={onMoveDirectly} disabled={busy}>
            <CalendarClock size={16} aria-hidden="true" />
            Pindah langsung
          </button>
        </>
      )}
      {booking.status === "Accepted" && (
        <>
          <button
            className="button button-primary"
            type="button"
            onClick={onMarkCompleted}
            disabled={busy}
            title="Tandai kunjungan selesai dan kirim link feedback via WhatsApp"
          >
            <BadgeCheck size={16} aria-hidden="true" />
            Tandai Selesai
          </button>
          <button className="button button-outline" type="button" onClick={onReschedule} disabled={busy}>
            Jadwalkan ulang
          </button>
          <button className="button button-outline" type="button" onClick={onEditSegments} disabled={busy}>
            Atur kloter
          </button>
          <button className="button button-outline" type="button" onClick={onMoveDirectly} disabled={busy}>
            <CalendarClock size={16} aria-hidden="true" />
            Pindah langsung
          </button>
          <button className="button button-danger" type="button" onClick={onReject} disabled={busy}>
            Batalkan Jadwal
          </button>
        </>
      )}
      {booking.status === "Reschedule" && (
        <>
          <button
            className="button button-accept"
            type="button"
            onClick={onConfirmReschedule}
            disabled={busy}
            title="User setuju jadwal baru, kunci slot dan kirim WhatsApp konfirmasi"
          >
            User setuju, konfirmasi
          </button>
          <button
            className="button button-outline"
            type="button"
            onClick={onResendReschedule}
            disabled={busy}
            title="Tawarkan jadwal alternatif lain"
          >
            Tawarkan jadwal lain
          </button>
          <button
            className="button button-danger"
            type="button"
            onClick={onCancelReschedule}
            disabled={busy}
            title="User menolak usulan, jadwal awal tetap berlaku"
          >
            User menolak usulan
          </button>
          <button
            className="button button-danger"
            type="button"
            onClick={onRejectRescheduledBooking}
            disabled={busy}
            title="Batalkan booking dan minta user booking ulang"
          >
            Batalkan booking
          </button>
        </>
      )}
      {booking.status === "Expired" && (
        <>
          <button className="button button-outline" type="button" onClick={onReschedule} disabled={busy}>
            Tawarkan jadwal baru
          </button>
          <button className="button button-danger" type="button" onClick={onReject} disabled={busy}>
            Tutup kasus
          </button>
        </>
      )}
      {(booking.status === "Rejected" || booking.status === "Completed") && (
        <span className="admin-actions-locked">Status: {BOOKING_STATUS_LABELS[booking.status]}</span>
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
  pendingLabel,
  onClose,
  onAccept,
  onReject,
  onReschedule,
  onEditSegments,
  onMoveDirectly,
  onMarkCompleted,
  onConfirmReschedule,
  onCancelReschedule,
  onRejectRescheduledBooking,
  onResendReschedule,
  onPreviewDocument,
  onDownloadDocument,
  downloadingDocument = false,
  readOnly = false,
}: {
  booking: Booking;
  pendingLabel?: string | null;
  onClose: () => void;
  onAccept: () => void;
  onReject: () => void;
  onReschedule: () => void;
  onEditSegments: () => void;
  onMoveDirectly: () => void;
  onMarkCompleted: () => void;
  onConfirmReschedule?: () => void;
  onCancelReschedule?: () => void;
  onRejectRescheduledBooking?: () => void;
  onResendReschedule?: () => void;
  onPreviewDocument: (booking: Booking) => void;
  onDownloadDocument: (booking: Booking) => void;
  downloadingDocument?: boolean;
  readOnly?: boolean;
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
            <ShortNoticeBadge booking={booking} />
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
          <DetailItem label="Narahubung" value={booking.contactName} />
          <DetailItem label="NIK" value={booking.nik} />
          <DetailItem label="WhatsApp" value={booking.whatsapp} />
          <DetailItem label="Instansi" value={booking.institution} />
          <DetailItem label="Rombongan" value={bookingKloterSummary(booking)} />
          <DetailItem label="Jadwal" value={bookingScheduleSummary(booking)} />
          {bookingSegments(booking).length > 1 && (
            <KloterDetailList segments={bookingSegments(booking)} />
          )}
          {booking.expiredAt && <DetailItem label="Kedaluwarsa" value={booking.expiredAt} />}
          <BookingNoteDetails note={booking.note} />
          <DocumentDetailItem
            label="Surat"
            documentName={booking.documentName}
            hasDocument={booking.hasDocument ?? true}
            onPreview={() => onPreviewDocument(booking)}
            onDownload={() => onDownloadDocument(booking)}
            downloading={downloadingDocument}
          />
        </div>
        <BookingActions
          booking={booking}
          pendingLabel={pendingLabel}
          onAccept={onAccept}
          onReject={onReject}
          onReschedule={onReschedule}
          onEditSegments={onEditSegments}
          onMoveDirectly={onMoveDirectly}
          onMarkCompleted={onMarkCompleted}
          onConfirmReschedule={onConfirmReschedule}
          onCancelReschedule={onCancelReschedule}
          onRejectRescheduledBooking={onRejectRescheduledBooking}
          onResendReschedule={onResendReschedule}
          readOnly={readOnly}
        />
      </aside>
    </div>
  );
}

export function AdminActionModal({
  modal,
  schedules,
  pendingLabel,
  error,
  onClose,
  onConfirm,
}: {
  modal: { action: AdminAction; booking: Booking };
  schedules: VisitDay[];
  pendingLabel?: string | null;
  error?: string;
  onClose: () => void;
  onConfirm: (action: AdminAction, booking: Booking, note: string, proposed?: string, documentationLink?: string) => void;
}) {
  const [note, setNote] = useState("");
  const [documentationLink, setDocumentationLink] = useState(modal.booking.documentationLink ?? "");
  const segments = bookingSegments(modal.booking);
  const requiredSlots = segments.length > 1 ? segments.length : 1;
  const minProposedDate = addDays(jakartaToday(), 1);
  const rescheduleDateOptions = schedules
    .filter((day) => parseDateKey(day.date) >= minProposedDate)
    .map((day) => guestDateOption(day, requiredSlots))
    .filter((option) => !option.disabled);
  const eligibleDays = rescheduleDateOptions.map((option) => option.day);
  const bookingDateInList = eligibleDays.find((day) => day.date === modal.booking.date);
  const defaultDate = bookingDateInList?.date ?? eligibleDays[0]?.date ?? "";
  const [selectedDay, setSelectedDay] = useState(defaultDate);
  const currentDay = eligibleDays.find((day) => day.date === selectedDay) ?? eligibleDays[0];
  const [selectedTime, setSelectedTime] = useState(() => {
    if (!currentDay) return "";
    const first = currentDay.slots.find((slot) => slot.status === "Available" && canFitConsecutiveSlots(currentDay, slot.time, requiredSlots));
    return first?.time ?? "";
  });
  const proposed = currentDay && selectedTime ? `${currentDay.label}, ${selectedTime} WIB` : "";
  const titleMap = {
    accept: "Setujui booking",
    reject: modal.booking.status === "Expired" ? "Tutup kasus" : modal.booking.status === "Accepted" ? "Batalkan jadwal yang disetujui" : "Tolak booking",
    reschedule: "Tawarkan jadwal lain",
    complete: "Tandai selesai",
  };
  const needsNote = modal.action === "reject" || modal.action === "reschedule";

  const handleDayChange = (date: string) => {
    setSelectedDay(date);
    const day = eligibleDays.find((d) => d.date === date);
    if (day) {
      const first = day.slots.find((slot) => slot.status === "Available" && canFitConsecutiveSlots(day, slot.time, requiredSlots));
      setSelectedTime(first?.time ?? "");
    } else {
      setSelectedTime("");
    }
  };

  // Compute the set of consecutive slot times that are part of the selection
  const selectedSlotSet = useMemo(() => {
    const set = new Set<string>();
    if (!currentDay || !selectedTime || requiredSlots <= 1) {
      if (selectedTime) set.add(selectedTime);
      return set;
    }
    const startIndex = currentDay.slots.findIndex((s) => s.time === selectedTime);
    if (startIndex === -1) return set;
    for (let i = 0; i < requiredSlots && startIndex + i < currentDay.slots.length; i++) {
      set.add(currentDay.slots[startIndex + i].time);
    }
    return set;
  }, [currentDay, selectedTime, requiredSlots]);

  const slotChipClass = (slot: { time: string; status: string }) => {
    const available = slot.status === "Available";
    const closed = slot.status === "Closed";
    const selected = selectedSlotSet.has(slot.time);
    const fits = currentDay ? canFitConsecutiveSlots(currentDay, slot.time, requiredSlots) : false;
    return [
      "segment-slot-chip",
      selected ? "is-selected" : "",
      !selected && available && fits ? "is-available" : "",
      !selected && available && !fits ? "is-full" : "",
      !selected && !available && !closed ? "is-occupied" : "",
      !selected && closed ? "is-closed" : "",
    ].filter(Boolean).join(" ");
  };

  const slotLabel = (slot: { time: string; status: string }) => {
    if (selectedSlotSet.has(slot.time) && requiredSlots > 1) {
      const startIndex = currentDay ? currentDay.slots.findIndex((s) => s.time === selectedTime) : -1;
      const slotIndex = currentDay ? currentDay.slots.findIndex((s) => s.time === slot.time) : -1;
      if (startIndex >= 0 && slotIndex >= 0) {
        return `Kloter ${slotIndex - startIndex + 1}`;
      }
    }
    if (slot.status === "Available") {
      const fits = currentDay ? canFitConsecutiveSlots(currentDay, slot.time, requiredSlots) : false;
      return fits ? "Tersedia" : "Tidak cukup";
    }
    if (slot.status === "Closed") return "Tutup";
    if (slot.status === "Booked") return "Penuh";
    if (slot.status === "Held" || slot.status === "Reschedule Hold") return "Diproses";
    return segmentStatusLabel[slot.status] ?? "Terisi";
  };

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal-card" role="dialog" aria-modal="true" aria-label={titleMap[modal.action]}>
        <button
          className="modal-close"
          type="button"
          onClick={onClose}
          aria-label="Tutup modal"
          disabled={Boolean(pendingLabel)}
        >
          <X size={18} aria-hidden="true" />
        </button>
        <h2>{titleMap[modal.action]}</h2>
        <p>{modal.booking.code} - {modal.booking.institution}</p>
        {modal.action === "reschedule" && (
          <div className="segment-slot-picker">
            <p className="segment-slot-picker-context">
              Jadwal saat ini: <strong>{modal.booking.dateLabel}, {modal.booking.time} WIB</strong>
              {segments.length > 1 && <> ({segments.length} kloter)</>}
            </p>
            <label className="form-field">
              <span>Pilih tanggal baru</span>
              <select value={selectedDay} onChange={(event) => handleDayChange(event.target.value)}>
                {rescheduleDateOptions.map((option) => (
                  <option key={option.day.date} value={option.day.date}>
                    {option.day.label} - {option.label}
                  </option>
                ))}
              </select>
              {eligibleDays.length === 0 && <small>Tidak ada tanggal tersedia untuk dijadwalkan ulang.</small>}
            </label>
            {currentDay && (
              <>
                <div className="segment-slot-picker-head">
                  <span>Pilih jam{requiredSlots > 1 ? ` (butuh ${requiredSlots} slot layanan)` : ""}</span>
                </div>
                <div className="segment-slot-grid">
                  {currentDay.slots.map((slot) => {
                    const closed = slot.status === "Closed";
                    const fits = canFitConsecutiveSlots(currentDay, slot.time, requiredSlots);
                    const available = slot.status === "Available";
                    return (
                      <button
                        key={slot.time}
                        type="button"
                        className={slotChipClass(slot)}
                        onClick={() => setSelectedTime(slot.time)}
                        disabled={!selectedSlotSet.has(slot.time) && (closed || !(available && fits))}
                      >
                        <strong>{slot.time}</strong>
                        <small>{slotLabel(slot)}</small>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
        {modal.action === "complete" && (
          <label className="form-field">
            <span>Link dokumentasi (opsional)</span>
            <input
              type="url"
              inputMode="url"
              placeholder="https://drive.google.com/drive/folders/..."
              value={documentationLink}
              onChange={(event) => setDocumentationLink(event.target.value)}
            />
            <small>Gunakan tautan HTTPS dari penyedia dokumentasi yang disetujui. Tautan akan disisipkan pada pesan WhatsApp lewat variabel {"{dokumentasi}"}.</small>
          </label>
        )}
        {needsNote && (
          <label className="form-field">
            <span>Alasan untuk tamu</span>
            <textarea value={note} onChange={(event) => setNote(event.target.value)} />
          </label>
        )}
        {error && <strong className="form-message form-message--error">{error}</strong>}
        <div className="modal-actions">
          <button className="button button-ghost" type="button" onClick={onClose} disabled={Boolean(pendingLabel)}>
            Batal
          </button>
          <button
            className="button button-primary"
            type="button"
            disabled={Boolean(pendingLabel) || (needsNote && !note.trim()) || (modal.action === "reschedule" && !proposed)}
            onClick={() => onConfirm(modal.action, modal.booking, note, proposed, documentationLink)}
          >
            {pendingLabel ? <ButtonSpinner label={pendingLabel} /> : "Konfirmasi & Buka WhatsApp"}
          </button>
        </div>
      </div>
    </div>
  );
}

function useModalEscape(onClose: () => void, busy = false) {
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [busy, onClose]);
}

function candidateSlots(day: VisitDay | undefined, startTime: string, groupSizeOrSegments: number | number[]) {
  const sizes = Array.isArray(groupSizeOrSegments) ? groupSizeOrSegments : splitGroupSizes(groupSizeOrSegments);
  const startIndex = day?.slots.findIndex((slot) => slot.time === startTime) ?? -1;
  if (!day || startIndex < 0) return [];
  return day.slots.slice(startIndex, startIndex + sizes.length).map((slot, index) => ({ slot, size: sizes[index] }));
}

function isPastVisitTime(date: string, time: string) {
  if (!date || !time) return false;
  const [hours, minutes] = time.split(".").map(Number);
  const visit = parseDateKey(date);
  visit.setHours(hours, minutes, 0, 0);
  return visit.getTime() <= Date.now();
}

type DateOptionSummary = {
  day: VisitDay;
  label: string;
  disabled: boolean;
};

const optionUnit = (requiredSlots: number) => requiredSlots > 1 ? "pilihan" : "slot";

const consecutiveSlotGroups = (day: VisitDay, requiredSlots: number) => {
  const slotCount = Math.max(1, requiredSlots);

  return day.slots
    .map((_, index) => day.slots.slice(index, index + slotCount))
    .filter((group) => group.length === slotCount);
};

const guestDateOption = (day: VisitDay, requiredSlots: number): DateOptionSummary => {
  const availableStarts = day.slots.filter((slot) => canFitConsecutiveSlots(day, slot.time, requiredSlots)).length;

  return {
    day,
    label: `${availableStarts} ${optionUnit(requiredSlots)} tersedia`,
    disabled: availableStarts === 0,
  };
};

const adminDateOption = (day: VisitDay, requiredSlots: number): DateOptionSummary => {
  const groups = consecutiveSlotGroups(day, requiredSlots).filter((group) =>
    group.every((slot) => slot.status !== "Closed" && !isPastVisitTime(day.date, slot.time)),
  );
  const availableStarts = groups.filter((group) => group.every((slot) => slot.status === "Available")).length;
  const unit = optionUnit(requiredSlots);

  let label = "tidak ada jam operasional";
  if (availableStarts > 0) {
    label = `${availableStarts} ${unit} kosong`;
  } else if (groups.length > 0) {
    label = "penuh";
  }

  return {
    day,
    label,
    disabled: groups.length === 0,
  };
};

const adminManualDateOption = (day: VisitDay): DateOptionSummary => {
  const slots = day.slots.filter((slot) => slot.status !== "Closed" && !isPastVisitTime(day.date, slot.time));
  const availableSlots = slots.filter((slot) => slot.status === "Available").length;

  let label = "tidak ada jam operasional";
  if (availableSlots > 0) {
    label = `${availableSlots} slot kosong`;
  } else if (slots.length > 0) {
    label = "penuh";
  }

  return {
    day,
    label,
    disabled: slots.length === 0,
  };
};

const firstSelectableDate = (options: DateOptionSummary[], preferredDate?: string) =>
  options.find((option) => option.day.date === preferredDate && !option.disabled)?.day.date ??
  options.find((option) => !option.disabled)?.day.date ??
  options[0]?.day.date ??
  "";

export function DirectMoveModal({
  booking,
  schedules,
  pendingLabel,
  error,
  onClose,
  onConfirm,
}: {
  booking: Booking;
  schedules: VisitDay[];
  pendingLabel?: string | null;
  error?: string;
  onClose: () => void;
  onConfirm: (booking: Booking, date: string, time: string, allowOverbook: boolean, confirmedDirectMove: boolean) => void;
}) {
  const todayKey = formatDateKey(jakartaToday());
  const maxDateKey = formatDateKey(addMonths(jakartaToday(), 2));
  const days = schedules.filter((day) => day.date >= todayKey && day.date <= maxDateKey);
  const moveSegments = booking.segments?.length ? booking.segments : [];
  const moveSegmentSizes = moveSegments.length > 0 ? moveSegments.map((segment) => segment.groupSize) : splitGroupSizes(booking.groupSize);
  const requiredSlots = moveSegmentSizes.length;
  const dateOptions = days.map((day) => adminDateOption(day, requiredSlots));
  const [date, setDate] = useState(firstSelectableDate(dateOptions, booking.date >= todayKey ? booking.date : undefined));
  const [time, setTime] = useState("");
  const [allowOverbook, setAllowOverbook] = useState(false);
  const [confirmedDirectMove, setConfirmedDirectMove] = useState(false);
  const selectedDateOption = dateOptions.find((item) => item.day.date === date);
  const day = selectedDateOption?.day ?? days.find((item) => item.date === date);
  const activeSegments = bookingSegments(booking);
  const candidates = candidateSlots(day, time, moveSegmentSizes);
  const ownKeys = new Set(activeSegments.map((segment) => `${segment.date}|${segment.time}`));
  const hasClosed = candidates.some(({ slot }) => slot.status === "Closed");
  const hasPast = candidates.some(({ slot }) => isPastVisitTime(date, slot.time));
  const targetTouchesCurrentSchedule = candidates.some(({ slot }) => ownKeys.has(`${date}|${slot.time}`));
  const conflicts = candidates.filter(({ slot }) => slot.status !== "Available" && !ownKeys.has(`${date}|${slot.time}`));
  const sameSchedule = date === booking.date && time === booking.time;
  const busy = Boolean(pendingLabel);
  const invalid = selectedDateOption?.disabled || !date || !time || candidates.length !== requiredSlots || hasClosed || isPastVisitTime(date, time)
    || hasPast || targetTouchesCurrentSchedule || conflicts.length > 0 && !allowOverbook || !confirmedDirectMove || sameSchedule;

  const startCandidates = (startTime: string) => candidateSlots(day, startTime, moveSegmentSizes);
  const isCurrentScheduleStart = (startTime: string) => {
    const group = startCandidates(startTime);
    if (date !== booking.date || group.length !== activeSegments.length || group.length !== requiredSlots) return false;

    return group.every(({ slot, size }, index) => {
      const segment = activeSegments[index];
      return segment?.date === date
        && segment.time === slot.time
        && segment.groupSize === size;
    });
  };
  const canSelectStart = (slot: VisitDay["slots"][number]) => {
    const group = startCandidates(slot.time);
    return group.length === requiredSlots
      && !isCurrentScheduleStart(slot.time)
      && !isPastVisitTime(date, slot.time)
      && group.every(({ slot: item }) => item.status !== "Closed" && !isPastVisitTime(date, item.time) && !ownKeys.has(`${date}|${item.time}`));
  };

  const selectedSlotSet = useMemo(() => {
    const set = new Set<string>();
    if (!day || !time) return set;
    const startIndex = day.slots.findIndex((slot) => slot.time === time);
    if (startIndex < 0) return set;
    for (let index = 0; index < requiredSlots && startIndex + index < day.slots.length; index += 1) {
      set.add(day.slots[startIndex + index].time);
    }
    return set;
  }, [day, requiredSlots, time]);

  const slotChipClass = (slot: VisitDay["slots"][number]) => {
    const selected = selectedSlotSet.has(slot.time);
    const own = ownKeys.has(`${date}|${slot.time}`);
    const currentStart = isCurrentScheduleStart(slot.time);
    const available = slot.status === "Available";
    const closed = slot.status === "Closed";
    const selectable = canSelectStart(slot);
    return [
      "segment-slot-chip",
      selected && !own ? "is-selected" : "",
      own ? "is-own" : "",
      own || currentStart ? "is-current-schedule" : "",
      !selected && available && selectable ? "is-available" : "",
      !selected && available && !selectable && !own ? "is-full" : "",
      !selected && !available && !closed && !own ? "is-occupied" : "",
      !selected && !own && (closed || isPastVisitTime(date, slot.time)) ? "is-closed" : "",
    ].filter(Boolean).join(" ");
  };

  const slotLabel = (slot: VisitDay["slots"][number]) => {
    const own = ownKeys.has(`${date}|${slot.time}`);
    if (own) return "Jadwal saat ini";
    if (selectedSlotSet.has(slot.time) && requiredSlots > 1) {
      const startIndex = day ? day.slots.findIndex((item) => item.time === time) : -1;
      const slotIndex = day ? day.slots.findIndex((item) => item.time === slot.time) : -1;
      if (startIndex >= 0 && slotIndex >= 0) return `Kloter ${slotIndex - startIndex + 1}`;
    }
    if (isPastVisitTime(date, slot.time)) return "Lewat";
    if (slot.status === "Available") return canSelectStart(slot) ? "Tersedia" : "Tidak cukup";
    if (slot.status === "Closed") return "Tutup";
    if (slot.status === "Booked") return "Penuh";
    if (slot.status === "Held" || slot.status === "Reschedule Hold") return "Diproses";
    return segmentStatusLabel[slot.status] ?? "Terisi";
  };

  useModalEscape(onClose, busy);

  useEffect(() => {
    const nextDate = firstSelectableDate(dateOptions, date);
    if (date !== nextDate) setDate(nextDate);
  }, [date, dateOptions]);

  useEffect(() => {
    const first = day?.slots.find((slot) => slot.status === "Available" && canSelectStart(slot))
      ?? day?.slots.find((slot) => canSelectStart(slot));
    setTime(first?.time ?? "");
    setAllowOverbook(false);
  }, [date, day, requiredSlots]);

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal-card" role="dialog" aria-modal="true" aria-label="Pindah jadwal langsung">
        <button className="modal-close" type="button" onClick={onClose} disabled={busy} aria-label="Tutup modal"><X size={18} /></button>
        <h2>Pindah jadwal langsung</h2>
        <p>{booking.code} - {booking.institution}</p>
        <div className="segment-slot-picker">
          <p className="segment-slot-picker-context">
            Jadwal saat ini: <strong>{booking.dateLabel}, {booking.time} WIB</strong>
            {requiredSlots > 1 && <> ({requiredSlots} kloter)</>}
          </p>
          <label className="form-field">
            <span>Pilih tanggal tujuan</span>
            <select value={date} onChange={(event) => setDate(event.target.value)}>
              {dateOptions.map((option) => (
                <option key={option.day.date} value={option.day.date} disabled={option.disabled}>
                  {option.day.label} - {option.label}
                </option>
              ))}
            </select>
            {days.length === 0 && <small>Tidak ada tanggal tujuan yang tersedia.</small>}
          </label>
          {day && (
            <>
              <div className="segment-slot-picker-head">
                <span>Pilih jam{requiredSlots > 1 ? ` (butuh ${requiredSlots} slot layanan)` : ""}</span>
                <small>Slot terisi butuh izin gabung.</small>
              </div>
              <div className="segment-slot-grid">
                {day.slots.map((slot) => {
                  const selected = selectedSlotSet.has(slot.time);
                  const own = ownKeys.has(`${date}|${slot.time}`);
                  const disabled = own || isCurrentScheduleStart(slot.time) || (!selected && !canSelectStart(slot));
                  return (
                    <button
                      key={slot.time}
                      type="button"
                      className={slotChipClass(slot)}
                      onClick={() => { setTime(slot.time); setAllowOverbook(false); }}
                      disabled={disabled}
                    >
                      <strong>{slot.time}</strong>
                      <small>{slotLabel(slot)}</small>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
        <div className="admin-confirmation-group direct-move-confirmation-group" aria-label="Konfirmasi pindah jadwal">
          <span className="admin-confirmation-title">Konfirmasi</span>
          {conflicts.length > 0 && (
            <SlotConflictPermission
              slots={conflicts.map(({ slot }) => slot)}
              checked={allowOverbook}
              onChange={setAllowOverbook}
              disabled={busy}
            />
          )}
          <label className="form-check admin-confirm-check">
            <input
              type="checkbox"
              checked={confirmedDirectMove}
              onChange={(event) => setConfirmedDirectMove(event.target.checked)}
              disabled={busy}
            />
            <span>{booking.status === "Accepted" ? "Tamu sudah diberi tahu bahwa jadwal akan langsung berubah." : "Perubahan jadwal langsung ini dikonfirmasi untuk proses booking."}</span>
          </label>
        </div>
        {(sameSchedule || targetTouchesCurrentSchedule) && <strong className="form-message form-message--error">Pilih jadwal di luar jadwal saat ini.</strong>}
        {(isPastVisitTime(date, time) || hasPast) && <strong className="form-message form-message--error">Jam tujuan sudah lewat.</strong>}
        {error && <strong className="form-message form-message--error">{error}</strong>}
        <div className="modal-actions"><button className="button button-ghost" type="button" onClick={onClose} disabled={busy}>Batal</button><button className="button button-primary" type="button" disabled={invalid || busy} onClick={() => onConfirm(booking, date, time, allowOverbook, confirmedDirectMove)}>{pendingLabel ? <ButtonSpinner label={pendingLabel} /> : "Pindahkan jadwal"}</button></div>
      </div>
    </div>
  );
}

function conflictSummaryText(slots: VisitDay["slots"]) {
  const details = slots.flatMap((slot) => {
    const slotConflicts = slot.bookingConflicts ?? [];
    if (slotConflicts.length === 0) return [`${slot.time} WIB sudah terisi`];

    return slotConflicts.map((item) => (
      `${slot.time} WIB terisi: ${item.code} · ${item.groupSize} peserta · ${BOOKING_STATUS_LABELS[item.status as BookingStatus] ?? item.status}`
    ));
  });
  const uniqueDetails = [...new Set(details)];
  const firstDetail = uniqueDetails[0] ?? "Booking lain menempati salah satu slot tujuan.";
  const restCount = Math.max(uniqueDetails.length - 1, 0);

  return restCount > 0 ? `${firstDetail} +${restCount} lainnya` : firstDetail;
}

function SlotConflictPermission({
  slots,
  checked,
  onChange,
  disabled = false,
}: {
  slots: VisitDay["slots"];
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="form-check admin-confirm-check admin-slot-conflict-check">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        disabled={disabled}
      />
      <span className="admin-confirm-check-copy">
        <span>Izinkan gabung ke slot yang sudah terisi</span>
        <small>{conflictSummaryText(slots)}</small>
      </span>
    </label>
  );
}

const systemAdminNotePattern = /^\[\d{2}-\d{2}-\d{4} \d{2}\.\d{2} WIB\]\s*Konfirmasi admin:/;

const splitBookingNotes = (note?: string | null) => {
  const entries = (note ?? "")
    .split(/\n+/)
    .map((entry) => entry.trim())
    .filter(Boolean);

  return entries.reduce(
    (grouped, entry) => {
      if (systemAdminNotePattern.test(entry)) {
        grouped.system.push(entry);
      } else {
        grouped.admin.push(entry);
      }

      return grouped;
    },
    { admin: [] as string[], system: [] as string[] },
  );
};

function BookingNoteDetails({ note }: { note?: string | null }) {
  const notes = splitBookingNotes(note);
  if (notes.admin.length === 0 && notes.system.length === 0) return null;

  return (
    <>
      {notes.admin.length > 0 && (
        <div className="detail-item detail-item--admin-note">
          <span>Catatan admin</span>
          <div className="booking-admin-note-list">
            {notes.admin.map((entry, index) => (
              <strong key={`${entry}-${index}`}>{entry}</strong>
            ))}
          </div>
        </div>
      )}
      {notes.system.length > 0 && (
        <div className="detail-item detail-item--system-note">
          <span>Riwayat sistem</span>
          <details className="booking-system-note">
            <summary>{notes.system.length} catatan otomatis</summary>
            <div className="booking-system-note-list">
              {notes.system.map((entry, index) => (
                <p key={`${entry}-${index}`}>{entry}</p>
              ))}
            </div>
          </details>
        </div>
      )}
    </>
  );
}

type KloterMode = "auto" | "manual";

export function AdminBookingCreateModal({
  schedules,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  schedules: VisitDay[];
  busy: boolean;
  error?: string;
  onClose: () => void;
  onConfirm: (payload: Parameters<typeof apiCreateAdminBooking>[0]) => void;
}) {
  const todayKey = formatDateKey(jakartaToday());
  const days = schedules.filter((day) => day.date >= todayKey && day.date <= formatDateKey(addMonths(jakartaToday(), 2)));
  const initialDateOptions = days.map((day) => adminDateOption(day, 1));
  const [form, setForm] = useState({ contactName: "", nik: "", whatsapp: "", institution: "", groupSize: "", date: firstSelectableDate(initialDateOptions), time: "", status: "Accepted" as "Pending" | "Accepted" });
  const [kloterMode, setKloterMode] = useState<KloterMode>("auto");
  const [manualRows, setManualRows] = useState<SegmentDraftRow[]>([]);
  const [confirmManualBooking, setConfirmManualBooking] = useState(false);
  const [allowOverbook, setAllowOverbook] = useState(false);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentError, setDocumentError] = useState("");
  const documentInputRef = useRef<HTMLInputElement | null>(null);
  const groupSize = Number(form.groupSize);
  const validGroupSize = Number.isInteger(groupSize) && groupSize >= 1 && groupSize <= ADMIN_MAX_BOOKING_GROUP_SIZE;
  const requiredSlots = splitGroupSizes(validGroupSize ? groupSize : 1).length;
  const dateOptions = days.map((day) => kloterMode === "manual" ? adminManualDateOption(day) : adminDateOption(day, requiredSlots));
  const selectedDateOption = dateOptions.find((item) => item.day.date === form.date);
  const day = selectedDateOption?.day ?? days.find((item) => item.date === form.date);
  const candidates = candidateSlots(day, form.time, groupSize);
  const hasClosed = candidates.some(({ slot }) => slot.status === "Closed");
  const autoConflicts = candidates.filter(({ slot }) => slot.status !== "Available");
  const normalizedManualRows = normalizeSegmentRows(manualRows.map((row) => ({ ...row, date: form.date })));
  const manualTotal = normalizedManualRows.reduce((sum, row) => sum + (Number(row.groupSize) || 0), 0);
  const manualRowStates = normalizedManualRows.map((row) => {
    const slot = day?.slots.find((item) => item.time === row.time);
    const status = slot?.status ?? "Missing";
    const group = Number(row.groupSize);
    const issues: string[] = [];

    if (!row.time) issues.push("Pilih jam kloter.");
    if (!slot) issues.push("Jam kloter tidak ada pada tanggal ini.");
    if (!Number.isInteger(group) || group < 1) issues.push("Jumlah peserta kloter minimal 1.");
    if (status === "Closed" || status === "Missing") issues.push("Slot tutup atau belum dibuka.");
    if (row.time && isPastVisitTime(form.date, row.time)) issues.push("Jam kloter sudah lewat.");

    return {
      issues,
      needsOverbook: Boolean(slot) && status !== "Available" && status !== "Closed" && status !== "Missing",
      slot,
    };
  });
  const manualConflictSlots = manualRowStates
    .filter((state) => state.needsOverbook && state.slot)
    .map((state) => state.slot)
    .filter((slot): slot is VisitDay["slots"][number] => Boolean(slot));
  const conflicts = kloterMode === "manual" ? manualConflictSlots.map((slot) => ({ slot, size: 0 })) : autoConflicts;
  const manualValidationMessages = [
    kloterMode === "manual" && normalizedManualRows.length === 0 ? "Minimal harus ada 1 kloter." : "",
    kloterMode === "manual" && manualTotal !== groupSize ? `Total kloter ${manualTotal}/${groupSize || 0} peserta.` : "",
    ...manualRowStates.flatMap((state, index) => state.issues.map((issue) => `Kloter ${index + 1}: ${issue}`)),
  ].filter((message, index, messages): message is string => Boolean(message) && messages.indexOf(message) === index);
  const baseInvalid = !form.contactName.trim() || !/^\d{16}$/.test(form.nik) || !/^(08|628)\d{8,13}$/.test(form.whatsapp)
    || !form.institution.trim() || !validGroupSize || selectedDateOption?.disabled || !form.date
    || Boolean(documentError) || !confirmManualBooking;
  const autoInvalid = !form.time || candidates.length !== requiredSlots || hasClosed || isPastVisitTime(form.date, form.time);
  const manualInvalid = manualValidationMessages.length > 0;
  const invalid = baseInvalid || (kloterMode === "manual" ? manualInvalid : autoInvalid)
    || conflicts.length > 0 && !allowOverbook;

  const startCandidates = (startTime: string) => candidateSlots(day, startTime, groupSize);
  const canSelectStart = (slot: VisitDay["slots"][number]) => {
    const group = startCandidates(slot.time);
    return group.length === requiredSlots
      && !isPastVisitTime(form.date, slot.time)
      && group.every(({ slot: item }) => item.status !== "Closed" && !isPastVisitTime(form.date, item.time));
  };

  const selectedSlotSet = useMemo(() => {
    const set = new Set<string>();
    if (!day || !form.time) return set;
    const startIndex = day.slots.findIndex((slot) => slot.time === form.time);
    if (startIndex < 0) return set;
    for (let index = 0; index < requiredSlots && startIndex + index < day.slots.length; index += 1) {
      set.add(day.slots[startIndex + index].time);
    }
    return set;
  }, [day, form.time, requiredSlots]);

  const slotChipClass = (slot: VisitDay["slots"][number]) => {
    const selected = selectedSlotSet.has(slot.time);
    const available = slot.status === "Available";
    const closed = slot.status === "Closed";
    const selectable = canSelectStart(slot);
    return [
      "segment-slot-chip",
      selected ? "is-selected" : "",
      !selected && available && selectable ? "is-available" : "",
      !selected && available && !selectable ? "is-full" : "",
      !selected && !available && !closed ? "is-occupied" : "",
      !selected && (closed || isPastVisitTime(form.date, slot.time)) ? "is-closed" : "",
    ].filter(Boolean).join(" ");
  };

  const slotLabel = (slot: VisitDay["slots"][number]) => {
    if (selectedSlotSet.has(slot.time) && requiredSlots > 1) {
      const startIndex = day ? day.slots.findIndex((item) => item.time === form.time) : -1;
      const slotIndex = day ? day.slots.findIndex((item) => item.time === slot.time) : -1;
      if (startIndex >= 0 && slotIndex >= 0) return `Kloter ${slotIndex - startIndex + 1}`;
    }
    if (isPastVisitTime(form.date, slot.time)) return "Lewat";
    if (slot.status === "Available") return canSelectStart(slot) ? "Tersedia" : "Tidak cukup";
    if (slot.status === "Closed") return "Tutup";
    if (slot.status === "Booked") return "Penuh";
    if (slot.status === "Held" || slot.status === "Reschedule Hold") return "Diproses";
    return segmentStatusLabel[slot.status] ?? "Terisi";
  };

  const manualSlotOptions = day?.slots.filter((slot) => !isPastVisitTime(form.date, slot.time)) ?? [];
  const slotStatusText = (slot: VisitDay["slots"][number]) => {
    if (slot.status === "Available") return "Kosong";
    if (slot.status === "Closed") return "Tutup";
    return segmentStatusLabel[slot.status] ?? slot.status;
  };
  const firstManualTime = (usedTimes = new Set<string>()) =>
    manualSlotOptions.find((slot) => slot.status !== "Closed" && !usedTimes.has(slot.time))?.time ??
    manualSlotOptions.find((slot) => !usedTimes.has(slot.time))?.time ??
    "";
  const automaticManualRows = (): SegmentDraftRow[] => {
    const sizes = splitGroupSizes(validGroupSize ? groupSize : 1);
    const startIndex = day?.slots.findIndex((slot) => slot.time === form.time) ?? -1;
    const usedTimes = new Set<string>();

    return sizes.map((size, index) => ({
      date: form.date,
      time: startIndex >= 0
        ? day?.slots[startIndex + index]?.time ?? ""
        : (() => {
            const time = firstManualTime(usedTimes);
            if (time) usedTimes.add(time);
            return time;
          })(),
      groupSize: String(size),
    }));
  };
  const setMode = (mode: KloterMode) => {
    setKloterMode(mode);
    setAllowOverbook(false);
    if (mode === "manual") setManualRows(automaticManualRows());
  };
  const updateManualRow = (index: number, patch: Partial<SegmentDraftRow>) => {
    setManualRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch, date: form.date } : row)));
  };
  const addManualRow = () => {
    const usedTimes = new Set(manualRows.map((row) => row.time).filter(Boolean));
    setManualRows((current) => [...current, { date: form.date, time: firstManualTime(usedTimes), groupSize: "" }]);
  };

  useModalEscape(onClose, busy);

  useEffect(() => {
    const nextDate = firstSelectableDate(dateOptions, form.date);
    if (form.date !== nextDate) {
      setForm((current) => current.date === nextDate ? current : { ...current, date: nextDate, time: "" });
    }
  }, [dateOptions, form.date]);

  useEffect(() => {
    const first = day?.slots.find((slot) => slot.status === "Available" && canSelectStart(slot))
      ?? day?.slots.find((slot) => canSelectStart(slot));
    setForm((current) => ({ ...current, time: first?.time ?? "" }));
    setAllowOverbook(false);
  }, [day, form.date, requiredSlots]);

  useEffect(() => {
    if (kloterMode === "manual") {
      setManualRows(automaticManualRows());
      setAllowOverbook(false);
    }
  }, [form.date, form.time, kloterMode, requiredSlots]);

  const setField = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const clearDocument = () => {
    setDocumentFile(null);
    setDocumentError("");
    if (documentInputRef.current) documentInputRef.current.value = "";
  };
  const handleDocument = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;
    if (!/\.(pdf|jpg|jpeg|png)$/i.test(file.name)) {
      setDocumentFile(null);
      setDocumentError("Surat permohonan harus PDF, JPG, JPEG, atau PNG.");
      event.target.value = "";
      return;
    }
    if (file.size > MAX_ADMIN_DOCUMENT_BYTES) {
      setDocumentFile(null);
      setDocumentError("Ukuran surat maksimal 5 MB.");
      event.target.value = "";
      return;
    }
    setDocumentFile(file);
    setDocumentError("");
  };
  const confirmationLabel = form.status === "Accepted"
    ? "Jadwal sudah disepakati dengan tamu dan booking manual siap dibuat."
    : "Booking manual dibuat dari koordinasi admin. Surat boleh kosong bila tidak tersedia.";
  const manualSegments = normalizedManualRows.map((row) => ({
    date: row.date,
    time: row.time,
    groupSize: Number(row.groupSize),
  }));

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal-card admin-flex-modal admin-create-booking-modal" role="dialog" aria-modal="true" aria-label="Buat booking manual">
        <button className="modal-close" type="button" onClick={onClose} disabled={busy} aria-label="Tutup modal"><X size={18} /></button>
        <header className="segment-modal-head"><span className="segment-modal-kicker">Tamu khusus</span><h2>Buat booking manual</h2><p>Surat permohonan boleh dilampirkan bila tersedia. NIK tersimpan terenkripsi dan tampil penuh hanya untuk admin.</p></header>
        <div className="admin-flex-grid">
          <label className="form-field"><span>Nama contact person</span><input value={form.contactName} onChange={(event) => setField("contactName", event.target.value)} /></label>
          <label className="form-field"><span>NIK</span><input inputMode="numeric" maxLength={16} value={form.nik} onChange={(event) => setField("nik", event.target.value.replace(/\D/g, ""))} /></label>
          <label className="form-field"><span>WhatsApp</span><input inputMode="tel" value={form.whatsapp} onChange={(event) => setField("whatsapp", event.target.value.replace(/\D/g, ""))} /></label>
          <label className="form-field"><span>Instansi / keterangan tamu</span><input value={form.institution} onChange={(event) => setField("institution", event.target.value)} /></label>
          <label className="form-field"><span>Jumlah peserta</span><input type="number" min={1} max={ADMIN_MAX_BOOKING_GROUP_SIZE} value={form.groupSize} onChange={(event) => setField("groupSize", event.target.value)} /></label>
          <label className="form-field"><span>Status awal</span><select value={form.status} onChange={(event) => setField("status", event.target.value)}><option value="Accepted">Disetujui</option><option value="Pending">Menunggu</option></select></label>
        </div>
        <div className="segment-slot-picker">
          <label className="form-field">
            <span>Tanggal</span>
            <select value={form.date} onChange={(event) => setField("date", event.target.value)}>
              {dateOptions.map((option) => (
                <option key={option.day.date} value={option.day.date} disabled={option.disabled}>
                  {option.day.label} - {option.label}
                </option>
              ))}
            </select>
            {days.length === 0 && <small>Tidak ada tanggal yang tersedia.</small>}
          </label>
          <div className="admin-kloter-mode">
            <span>Pembagian kloter</span>
            <div className="admin-segmented-control" role="group" aria-label="Mode pembagian kloter">
              <button type="button" className={kloterMode === "auto" ? "is-active" : ""} onClick={() => setMode("auto")} disabled={busy}>
                Otomatis
              </button>
              <button type="button" className={kloterMode === "manual" ? "is-active" : ""} onClick={() => setMode("manual")} disabled={busy}>
                Manual
              </button>
            </div>
          </div>
          {day && (
            <>
              {kloterMode === "auto" ? (
                <>
                  <div className="segment-slot-picker-head">
                    <span>Pilih jam{requiredSlots > 1 ? ` (butuh ${requiredSlots} slot layanan)` : ""}</span>
                    <small>Slot terisi butuh izin gabung.</small>
                  </div>
                  <div className="segment-slot-grid">
                    {day.slots.map((slot) => {
                      const selected = selectedSlotSet.has(slot.time);
                      const disabled = !selected && !canSelectStart(slot);
                      return (
                        <button
                          key={slot.time}
                          type="button"
                          className={slotChipClass(slot)}
                          onClick={() => { setField("time", slot.time); setAllowOverbook(false); }}
                          disabled={disabled}
                        >
                          <strong>{slot.time}</strong>
                          <small>{slotLabel(slot)}</small>
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="admin-manual-kloter">
                  <div className="segment-table-toolbar">
                    <span className={manualTotal === groupSize ? "admin-manual-total" : "admin-manual-total is-warning"}>
                      Total kloter {manualTotal}/{groupSize || 0}
                    </span>
                    <button type="button" className="button button-outline" onClick={() => setManualRows(automaticManualRows())} disabled={busy}>
                      Isi otomatis
                    </button>
                    <button type="button" className="button button-outline segment-add-button" onClick={addManualRow} disabled={busy || manualRows.length >= 7}>
                      <Plus size={15} aria-hidden="true" />
                      Tambah
                    </button>
                  </div>
                  <div className="segment-table admin-manual-segment-table" aria-label="Editor kloter booking manual">
                    <div className="segment-table-head" aria-hidden="true">
                      <span>Kloter</span>
                      <span>Jam</span>
                      <span>Peserta</span>
                      <span />
                    </div>
                    {manualRows.map((row, index) => (
                      <div className="segment-table-row" key={index}>
                        <strong>{index + 1}</strong>
                        <select value={row.time} onChange={(event) => updateManualRow(index, { time: event.target.value })} disabled={busy}>
                          {manualSlotOptions.map((slot) => (
                            <option key={slot.time} value={slot.time} disabled={slot.status === "Closed"}>
                              {slot.time} - {slotStatusText(slot)}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min={1}
                          inputMode="numeric"
                          value={row.groupSize}
                          onChange={(event) => updateManualRow(index, { groupSize: event.target.value })}
                          disabled={busy}
                        />
                        <button
                          type="button"
                          className="segment-icon-button"
                          onClick={() => setManualRows((current) => current.filter((_, rowIndex) => rowIndex !== index))}
                          disabled={busy || manualRows.length <= 1}
                          aria-label={`Hapus kloter ${index + 1}`}
                        >
                          <Trash2 size={15} aria-hidden="true" />
                        </button>
                      </div>
                    ))}
                  </div>
                  {manualValidationMessages.length > 0 && (
                    <p className="segment-row-note segment-row-note--warning">{manualValidationMessages[0]}</p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
        <div className="admin-file-field admin-create-booking-document">
          <span className="admin-file-field-label">Surat permohonan (opsional)</span>
          <div className="admin-file-row">
            <label className="admin-file-button button button-ghost">
              <FileText size={15} aria-hidden="true" />
              <span>{documentFile ? "Ganti surat" : "Pilih surat"}</span>
              <input ref={documentInputRef} className="admin-file-input" type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleDocument} disabled={busy} />
            </label>
            {(documentFile || documentError) && (
              <button className="button button-ghost" type="button" onClick={clearDocument} disabled={busy}>
                <Trash2 size={14} aria-hidden="true" />
                Bersihkan
              </button>
            )}
            <span className="admin-file-name">{documentFile?.name ?? "PDF/JPG/PNG maks. 5 MB. Boleh dikosongkan."}</span>
          </div>
          {documentError && <strong className="form-message form-message--error">{documentError}</strong>}
        </div>
        <div className="admin-confirmation-group" aria-label="Konfirmasi booking manual">
          <span className="admin-confirmation-title">Konfirmasi</span>
          {conflicts.length > 0 && (
            <SlotConflictPermission
              slots={conflicts.map(({ slot }) => slot)}
              checked={allowOverbook}
              onChange={setAllowOverbook}
              disabled={busy}
            />
          )}
          <label className="form-check admin-confirm-check">
            <input type="checkbox" checked={confirmManualBooking} onChange={(event) => setConfirmManualBooking(event.target.checked)} disabled={busy} />
            <span>{confirmationLabel}</span>
          </label>
        </div>
        {error && <strong className="form-message form-message--error">{error}</strong>}
        <div className="modal-actions">
          <button className="button button-ghost" type="button" onClick={onClose} disabled={busy}>Batal</button>
          <button
            className="button button-primary"
            type="button"
            disabled={invalid || busy}
            onClick={() => onConfirm({
              ...form,
              time: kloterMode === "manual" ? manualSegments[0]?.time ?? form.time : form.time,
              groupSize,
              segments: kloterMode === "manual" ? manualSegments : undefined,
              confirmedWithGuest: form.status === "Accepted" ? confirmManualBooking : undefined,
              confirmManualBooking,
              allowOverbook: allowOverbook || undefined,
              document: documentFile,
            })}
          >
            {busy ? <ButtonSpinner label="Membuat booking..." /> : "Buat booking"}
          </button>
        </div>
      </div>
    </div>
  );
}

type SegmentDraftRow = {
  date: string;
  time: string;
  groupSize: string;
};

type SegmentRowState = {
  issues: string[];
  needsOverbook: boolean;
  oversized: boolean;
};

const segmentStatusLabel: Record<string, string> = {
  Available: "Kosong",
  Held: "Diproses",
  Booked: "Terisi",
  Closed: "Tutup",
  "Reschedule Hold": "Reschedule",
  Missing: "Tidak ada",
};

const isDateKey = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

const fallbackVisitDay = (date: string): VisitDay => {
  const parsed = isDateKey(date) ? parseDateKey(date) : jakartaToday();

  return {
    date,
    label: isDateKey(date) ? formatLongDate(parsed) : date,
    short: isDateKey(date) ? `${parsed.getDate()} ${parsed.toLocaleString("id-ID", { month: "short" })}` : date,
    slots: [],
  };
};

const normalizeSegmentRows = (rows: SegmentDraftRow[]): SegmentDraftRow[] => {
  const grouped = new Map<string, SegmentDraftRow>();

  rows.forEach((row) => {
    const key = `${row.date}|${row.time}`;
    const groupSize = Math.max(0, Number(row.groupSize) || 0);
    const existing = grouped.get(key);

    grouped.set(key, {
      date: row.date,
      time: row.time,
      groupSize: String((existing ? Number(existing.groupSize) : 0) + groupSize),
    });
  });

  return Array.from(grouped.values());
};

export function SegmentOverrideModal({
  booking,
  schedules,
  pendingLabel,
  error,
  onClose,
  onConfirm,
}: {
  booking: Booking;
  schedules: VisitDay[];
  pendingLabel?: string | null;
  error?: string;
  onClose: () => void;
  onConfirm: (booking: Booking, groupSize: number, segments: BookingSegment[], allowOverbook: boolean, correctGroupSize: boolean, confirmRisk: boolean) => void;
}) {
  const initialSegments = bookingSegments(booking);
  const [rows, setRows] = useState(() =>
    initialSegments.map((segment) => ({
      date: segment.date,
      time: segment.time,
      groupSize: String(segment.groupSize),
    })),
  );
  const selectedDate = initialSegments[0]?.date ?? booking.date;
  const [allowOverbook, setAllowOverbook] = useState(false);
  const [correctGroupSize, setCorrectGroupSize] = useState(false);
  const [confirmRisk, setConfirmRisk] = useState(false);
  const ownSlotKeys = new Set(initialSegments.map((segment) => `${segment.date}|${segment.time}`));
  const scheduleByDate = new Map(schedules.map((day) => [day.date, day]));
  const segmentToday = jakartaToday();
  const minSegmentDateKey = formatDateKey(segmentToday);
  const maxSegmentDateKey = formatDateKey(addMonths(segmentToday, 2));
  const dateOptions = [
    ...schedules.filter((day) => day.date >= minSegmentDateKey && day.date <= maxSegmentDateKey),
    ...rows
      .map((row) => row.date)
      .filter((date, index, dates) => date && dates.indexOf(date) === index && !scheduleByDate.has(date))
      .map(fallbackVisitDay),
  ].sort((a, b) => a.date.localeCompare(b.date));
  const selectedDay = scheduleByDate.get(selectedDate) ?? dateOptions.find((day) => day.date === selectedDate) ?? fallbackVisitDay(selectedDate);
  const slotOptions = [
    ...selectedDay.slots,
    ...rows
      .filter((row) => row.time && !selectedDay.slots.some((slot) => slot.time === row.time))
      .map((row) => ({ time: row.time, status: "Missing", custom: true })),
  ];
  const normalizedRows = normalizeSegmentRows(rows.map((row) => ({ ...row, date: selectedDate })));
  const rowStates: SegmentRowState[] = normalizedRows.map((row) => {
    const key = `${row.date}|${row.time}`;
    const slot = selectedDay.slots.find((item) => item.time === row.time);
    const status = slot?.status ?? "Missing";
    const isOwnSlot = ownSlotKeys.has(key) && status !== "Closed";
    const groupSize = Number(row.groupSize);
    const issues: string[] = [];
    const oversized = groupSize > SLOT_CAPACITY;

    if (!isDateKey(row.date)) {
      issues.push("Pilih tanggal dari daftar jadwal.");
    } else if (row.date < minSegmentDateKey) {
      issues.push("Tanggal sudah lewat.");
    } else if (row.date > maxSegmentDateKey) {
      issues.push("Tanggal maksimal 2 bulan dari hari ini.");
    }

    if (!row.time) {
      issues.push("Pilih jam tujuan.");
    } else if (!slot) {
      issues.push("Jam ini tidak ada pada tanggal terpilih.");
    }

    if (!Number.isInteger(groupSize) || groupSize < 1) {
      issues.push("Jumlah peserta kloter minimal 1 orang.");
    }

    if (status === "Closed" || status === "Missing") {
      issues.push("Slot tutup atau belum dibuka.");
    }

    const needsOverbook = !isOwnSlot && status !== "Available" && status !== "Closed" && status !== "Missing";

    return {
      issues,
      needsOverbook,
      oversized,
    };
  });
  const overbookRows = rowStates.filter((state) => state.needsOverbook);
  const overbookSlots = normalizedRows
    .filter((_, index) => rowStates[index]?.needsOverbook)
    .map((row) => selectedDay.slots.find((slot) => slot.time === row.time))
    .filter((slot): slot is VisitDay["slots"][number] => Boolean(slot));
  const oversizedRows = rowStates.filter((state) => state.oversized);
  const total = normalizedRows.reduce((sum, row) => {
    const value = Number(row.groupSize);
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);
  const validTotal = Number.isInteger(total) && total >= 1 && total <= ADMIN_MAX_BOOKING_GROUP_SIZE;
  const groupSizeChanged = validTotal && total !== booking.groupSize;
  const hasChanges = groupSizeChanged ||
    normalizedRows.length !== initialSegments.length ||
    normalizedRows.some((row, index) => {
      const initial = initialSegments[index];
      return !initial || row.time !== initial.time || Number(row.groupSize) !== initial.groupSize;
    });
  const busy = Boolean(pendingLabel);
  const shouldAllowOverbook = overbookRows.length > 0 && allowOverbook;
  const riskReasons = [
    groupSizeChanged && correctGroupSize ? `koreksi total ${booking.groupSize} -> ${total} peserta` : "",
    oversizedRows.length > 0 ? "kloter di atas kapasitas standar 80 peserta" : "",
  ].filter(Boolean);
  const riskConfirmationRequired = hasChanges && riskReasons.length > 0;
  const showRiskConfirmationWarning = riskConfirmationRequired && !confirmRisk;
  const validationMessages = [
    normalizedRows.length < 1 ? "Minimal harus ada 1 kloter." : "",
    dateOptions.length === 0 ? "Data jadwal belum dimuat. Muat ulang halaman jika daftar tanggal kosong." : "",
    !validTotal ? `Total peserta harus 1-${ADMIN_MAX_BOOKING_GROUP_SIZE}.` : "",
    groupSizeChanged && !correctGroupSize ? "Aktifkan mode koreksi total peserta untuk mengubah jumlah rombongan." : "",
    overbookRows.length > 0 && !allowOverbook ? "Centang izin gabung untuk slot yang sudah terisi." : "",
    showRiskConfirmationWarning ? "Centang konfirmasi perubahan berisiko." : "",
    ...rowStates.flatMap((state, index) => state.issues.map((issue) => `Kloter ${index + 1}: ${issue}`)),
  ].filter((message, index, messages) => message && messages.indexOf(message) === index);
  const invalid =
    validationMessages.length > 0 ||
    (overbookRows.length > 0 && !allowOverbook) ||
    !validTotal ||
    (riskConfirmationRequired && !confirmRisk) ||
    !hasChanges;
  const totalStatusLabel = validTotal ? `${total} peserta` : "Total belum valid";
  const shouldCorrectGroupSize = groupSizeChanged && correctGroupSize;

  useModalEscape(onClose, busy);

  useEffect(() => {
    if (overbookRows.length === 0 && allowOverbook) {
      setAllowOverbook(false);
    }
  }, [allowOverbook, overbookRows.length]);

  useEffect(() => {
    if (!riskConfirmationRequired && confirmRisk) {
      setConfirmRisk(false);
    }
  }, [confirmRisk, riskConfirmationRequired]);

  const firstUsableTimeForDay = (day: VisitDay, date: string, preferredTime?: string, usedTimes = new Set<string>()) => {
    const preferred = day.slots.find((slot) => slot.time === preferredTime);
    if (preferred && preferred.status !== "Closed" && !usedTimes.has(preferred.time)) return preferred.time;

    return (
      day.slots.find((slot) => slot.status === "Available" && !usedTimes.has(slot.time))?.time ??
      day.slots.find((slot) => ownSlotKeys.has(`${date}|${slot.time}`) && slot.status !== "Closed" && !usedTimes.has(slot.time))?.time ??
      day.slots.find((slot) => slot.status !== "Closed" && !usedTimes.has(slot.time))?.time ??
      day.slots[0]?.time ??
      ""
    );
  };

  const firstUsableTime = (preferredTime?: string, usedTimes = new Set<string>()) =>
    firstUsableTimeForDay(selectedDay, selectedDate, preferredTime, usedTimes);

  const splitRowsFor = (groupSize = String(total || booking.groupSize)): SegmentDraftRow[] => {
    const numericGroupSize = Number(groupSize);
    const sizeForSplit = Number.isInteger(numericGroupSize) && numericGroupSize >= 1 ? numericGroupSize : booking.groupSize;
    const sizes = splitGroupSizes(Math.min(sizeForSplit, ADMIN_MAX_BOOKING_GROUP_SIZE));
    const usedTimes = new Set<string>();
    const ownTimes = initialSegments.map((segment) => segment.time);

    return sizes.map((size, index) => {
      const time = firstUsableTime(ownTimes[index], usedTimes);
      if (time) usedTimes.add(time);

      return { date: selectedDate, time, groupSize: String(size) };
    });
  };

  const firstOpenDraftRow = (): SegmentDraftRow => {
    const usedTimes = new Set(rows.map((row) => row.time).filter(Boolean));
    return { date: selectedDate, time: firstUsableTime(undefined, usedTimes), groupSize: "" };
  };

  const updateRow = (index: number, patch: Partial<SegmentDraftRow>) => {
    setRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  };

  const addManualRow = () => {
    setRows((current) => [...current, firstOpenDraftRow()]);
  };

  const slotStatusText = (slot: { time: string; status?: string }) => {
    const status = slot.status ?? "Missing";
    const own = ownSlotKeys.has(`${selectedDate}|${slot.time}`) && status !== "Closed";
    return own ? "Booking ini" : segmentStatusLabel[status] ?? status;
  };

  const submit = () => {
    if (invalid || busy) return;
    onConfirm(
      booking,
      total,
      normalizedRows.map((row, index) => ({
        order: index + 1,
        date: row.date,
        dateLabel: scheduleByDate.get(row.date)?.label ?? (isDateKey(row.date) ? formatLongDate(parseDateKey(row.date)) : row.date),
        time: row.time,
        groupSize: Number(row.groupSize),
      })),
      shouldAllowOverbook,
      shouldCorrectGroupSize,
      confirmRisk || shouldAllowOverbook,
    );
  };

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal-card segment-modal-card" role="dialog" aria-modal="true" aria-label="Atur pembagian kloter">
        <button
          className="modal-close"
          type="button"
          onClick={onClose}
          aria-label="Tutup modal"
          disabled={busy}
        >
          <X size={18} aria-hidden="true" />
        </button>
        <header className="segment-modal-head">
          <span className="segment-modal-kicker">{booking.code}</span>
          <h2>Atur pembagian kloter</h2>
          <p>
            Data awal: <strong>{booking.groupSize}</strong> peserta - {booking.dateLabel}, {booking.time} WIB.
          </p>
        </header>

        <section className="segment-task-panel" aria-label="Pengaturan kloter">
          <div className="segment-total-field" aria-live="polite">
            <span>Total peserta</span>
            <strong>{totalStatusLabel}{groupSizeChanged ? ` (${total > booking.groupSize ? "+" : ""}${total - booking.groupSize})` : ""}</strong>
          </div>

          <label className="form-check segment-correction-toggle">
            <input
              type="checkbox"
              checked={correctGroupSize}
              onChange={(event) => setCorrectGroupSize(event.target.checked)}
              disabled={busy}
            />
            <span>Koreksi total peserta</span>
          </label>
          <p className="segment-row-note">
            Total awal {booking.groupSize} peserta. Tanpa mode koreksi, perubahan hanya boleh membagi atau menggabungkan kloter.
          </p>

            <div className="segment-table-wrap">
              <div className="segment-table-toolbar">
                <button type="button" className="button button-outline" onClick={() => setRows(splitRowsFor())} disabled={busy}>
                  Pecah otomatis
                </button>
                <button
                  type="button"
                  className="button button-outline segment-add-button"
                  onClick={addManualRow}
                  disabled={busy || rows.length >= 7}
                >
                  <Plus size={16} aria-hidden="true" />
                  Tambah kloter
                </button>
              </div>
              <div className="segment-table" aria-label="Editor pembagian kloter">
                <div className="segment-table-head" aria-hidden="true">
                  <span>Kloter</span>
                  <span>Jam</span>
                  <span>Peserta</span>
                  <span />
                </div>
                {rows.map((row, index) => (
                  <div className="segment-table-row" key={index}>
                    <strong>{index + 1}</strong>
                    <select value={row.time} onChange={(event) => updateRow(index, { time: event.target.value })} disabled={busy}>
                      {slotOptions.map((slot) => {
                        const status = slot.status ?? "Missing";

                        return (
                          <option key={slot.time} value={slot.time} disabled={status === "Closed" || status === "Missing"}>
                            {slot.time} - {slotStatusText(slot)}
                          </option>
                        );
                      })}
                    </select>
                    <input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={row.groupSize}
                      onChange={(event) => updateRow(index, { groupSize: event.target.value })}
                      disabled={busy}
                    />
                    <button
                      type="button"
                      className="segment-icon-button"
                      onClick={() => setRows((current) => current.filter((_, rowIndex) => rowIndex !== index))}
                      disabled={busy || rows.length <= 1}
                      aria-label={`Hapus kloter ${index + 1}`}
                    >
                      <Trash2 size={15} aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
        </section>

        {normalizedRows.length !== rows.length && (
          <p className="segment-row-note">Baris dengan jam sama akan digabung saat disimpan.</p>
        )}

        {(overbookRows.length > 0 || riskConfirmationRequired) && (
          <div className="admin-confirmation-group" aria-label="Konfirmasi perubahan kloter">
            <span className="admin-confirmation-title">Konfirmasi</span>
            {overbookRows.length > 0 && (
              <SlotConflictPermission
                slots={overbookSlots}
                checked={allowOverbook}
                onChange={setAllowOverbook}
                disabled={busy}
              />
            )}
            {riskConfirmationRequired && (
              <label className="form-check admin-confirm-check">
                <input
                  type="checkbox"
                  checked={confirmRisk}
                  onChange={(event) => setConfirmRisk(event.target.checked)}
                  disabled={busy}
                />
                <span>Konfirmasi perubahan berisiko untuk audit operasional: {riskReasons.join(", ")}.</span>
              </label>
            )}
          </div>
        )}

        {validationMessages.length > 0 && (
          <p className="segment-preview-state has-error" role="alert">
            <AlertTriangle size={16} aria-hidden="true" />
            <span>{validationMessages[0]}</span>
          </p>
        )}

        {error && <strong className="form-message form-message--error">{error}</strong>}
        <div className="modal-actions">
          <button className="button button-ghost" type="button" onClick={onClose} disabled={busy}>
            Batal
          </button>
          <button className="button button-primary" type="button" disabled={invalid || busy} onClick={submit}>
            {pendingLabel ? <ButtonSpinner label={pendingLabel} /> : "Simpan perubahan"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ShortNoticeBadge({ booking }: { booking: Booking }) {
  if (booking.status !== "Pending") return null;
  if (!isShortNoticeBooking(booking)) return null;

  return <span className="booking-short-notice">{bookingLeadTimeLabel(booking)}</span>;
}

function KloterDetailList({ segments }: { segments: BookingSegment[] }) {
  return (
    <div className="detail-item detail-item--kloter-list">
      <span>Pembagian kloter</span>
      <div className="kloter-detail-list" aria-label="Pembagian kloter">
        {segments.map((segment) => (
          <div className="kloter-detail-row" key={segment.order}>
            <strong>Kloter {segment.order}</strong>
            <span>{segment.time} WIB</span>
            <span>{segment.groupSize} orang</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DocumentDetailItem({
  label,
  documentName,
  hasDocument,
  onPreview,
  onDownload,
  downloading = false,
}: {
  label: string;
  documentName: string;
  hasDocument: boolean;
  onPreview: () => void;
  onDownload: () => void;
  downloading?: boolean;
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
          disabled={!hasDocument}
          aria-label={`Pratinjau ${documentName}`}
        >
          <Icon size={16} aria-hidden="true" />
          <strong>{hasDocument ? documentName : `${documentName} (tidak tersedia)`}</strong>
        </button>
        <button
          type="button"
          className="document-detail-download"
          onClick={onDownload}
          disabled={!hasDocument || downloading}
          aria-label={`Unduh ${documentName}`}
          title="Unduh surat"
        >
          {downloading
            ? <Loader2 size={16} aria-hidden="true" className="button-spinner" />
            : <Download size={16} aria-hidden="true" />}
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
  downloading = false,
}: {
  documentName: string;
  documentUrl: string;
  onClose: () => void;
  onDownload: () => void;
  downloading?: boolean;
}) {
  const [previewLoading, setPreviewLoading] = useState(true);
  const [previewError, setPreviewError] = useState(false);

  // Esc to dismiss, mirroring the slideover keyboard behaviour so admins can
  // breeze through pending bookings without leaving the keyboard.
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Render mode follows the uploaded file name because the document endpoint
  // is a private API URL without a stable file extension.
  const urlExt = documentName.split(".").pop()?.toLowerCase() ?? "";
  const isPdf = urlExt === "pdf";
  const isImage = urlExt === "jpg" || urlExt === "jpeg" || urlExt === "png";

  useEffect(() => {
    setPreviewLoading(isPdf || isImage);
    setPreviewError(false);
  }, [documentUrl, isImage, isPdf]);

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
        <div className="document-preview-body" aria-busy={previewLoading}>
          {previewLoading && !previewError && (
            <div className="document-preview-loading">
              <InlineSpinner label="Memuat pratinjau surat" />
            </div>
          )}
          {previewError && (
            <div className="document-preview-fallback" role="status">
              <FileText size={32} aria-hidden="true" />
              <p>Pratinjau gagal dimuat.</p>
              <p>Silakan buka di tab baru atau unduh file.</p>
            </div>
          )}
          {isPdf && (
            <iframe
              title={`Pratinjau ${documentName}`}
              src={documentUrl}
              className="document-preview-frame"
              onLoad={() => setPreviewLoading(false)}
            />
          )}
          {isImage && (
            <img
              src={documentUrl}
              alt={`Pratinjau ${documentName}`}
              className="document-preview-image"
              onLoad={() => setPreviewLoading(false)}
              onError={() => {
                setPreviewLoading(false);
                setPreviewError(true);
              }}
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
            disabled={downloading}
          >
            {downloading
              ? <><Loader2 size={16} aria-hidden="true" className="button-spinner" /> Mengunduh...</>
              : <><Download size={16} aria-hidden="true" /> Unduh</>}
          </button>
        </div>
      </div>
    </div>
  );
}

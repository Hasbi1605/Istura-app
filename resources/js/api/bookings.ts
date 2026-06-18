import { api, fetchAllPages } from "./client";

export type ApiBookingSegment = {
  order: number;
  date: string;
  dateLabel: string;
  time: string;
  groupSize: number;
};

// Mirror structural dari type Booking di App.tsx supaya data API bisa dipakai
// langsung oleh komponen admin dan public flow.
export type ApiBooking = {
  code: string;
  source?: "public" | "admin";
  contactName: string;
  nik?: string;
  nikMasked: string;
  whatsapp: string;
  institution: string;
  groupSize: number;
  kloterCount?: number;
  segments?: ApiBookingSegment[];
  date: string;
  dateLabel: string;
  reportDate?: string | null;
  time: string;
  status: "Pending" | "Accepted" | "Rejected" | "Reschedule" | "Completed" | "Expired";
  documentName: string;
  hasDocument?: boolean;
  submittedAt: string | null;
  leadTimeDays?: number | null;
  isShortNotice?: boolean;
  note?: string | null;
  documentationLink?: string | null;
  feedbackToken?: string;
  completedAt?: string | null;
  rejectedAt?: string | null;
  expiredAt?: string | null;
  proposedDate?: string | null;
  proposedDateLabel?: string | null;
  proposedTime?: string | null;
  proposedSegments?: ApiBookingSegment[] | null;
  proposedAt?: string | null;
};

export const fetchAdminBookings = (params?: {
  status?: string;
  search?: string;
  from?: string;
  to?: string;
  page?: number;
  perPage?: number;
}): Promise<ApiBooking[]> => {
  return fetchAllPages<ApiBooking>("/api/admin/bookings", {
    status: params?.status,
    search: params?.search,
    from: params?.from,
    to: params?.to,
    perPage: params?.perPage ?? 500,
  });
};

export const fetchAdminBooking = (code: string): Promise<ApiBooking> =>
  api<{ data: ApiBooking }>(`/api/admin/bookings/${encodeURIComponent(code)}`).then((r) => r.data);

export const acceptBooking = (code: string, note?: string) =>
  api<{ data: ApiBooking }>(`/api/admin/bookings/${encodeURIComponent(code)}/accept`, {
    method: "POST",
    body: { note },
  }).then((r) => r.data);

export const rejectBooking = (code: string, note?: string) =>
  api<{ data: ApiBooking }>(`/api/admin/bookings/${encodeURIComponent(code)}/reject`, {
    method: "POST",
    body: { note },
  }).then((r) => r.data);

export const rescheduleBooking = (
  code: string,
  payload: { proposedDate: string; proposedTime: string; note?: string },
) =>
  api<{ data: ApiBooking }>(`/api/admin/bookings/${encodeURIComponent(code)}/reschedule`, {
    method: "POST",
    body: payload,
  }).then((r) => r.data);

export const cancelRescheduleBooking = (code: string, note?: string) =>
  api<{ data: ApiBooking }>(`/api/admin/bookings/${encodeURIComponent(code)}/reschedule/cancel`, {
    method: "POST",
    body: { note },
  }).then((r) => r.data);

export const completeBooking = (
  code: string,
  payload?: { note?: string; documentationLink?: string },
) =>
  api<{ data: ApiBooking }>(`/api/admin/bookings/${encodeURIComponent(code)}/complete`, {
    method: "POST",
    body: payload ?? {},
  }).then((r) => r.data);

export const updateBookingSegments = (
  code: string,
  payload: {
    groupSize?: number;
    segments: Array<{ date: string; time: string; groupSize: number }>;
    note?: string;
    allowOverbook?: boolean;
    correctGroupSize?: boolean;
    confirmRisk?: boolean;
  },
) =>
  api<{ data: ApiBooking }>(`/api/admin/bookings/${encodeURIComponent(code)}/segments`, {
    method: "POST",
    body: payload,
  }).then((r) => r.data);

export const createAdminBooking = (payload: {
  contactName: string;
  nik: string;
  whatsapp: string;
  institution: string;
  groupSize: number;
  date: string;
  time: string;
  status: "Pending" | "Accepted";
  confirmedWithGuest?: boolean;
  confirmManualBooking: boolean;
  allowOverbook?: boolean;
  note?: string;
}) =>
  api<{ data: ApiBooking }>("/api/admin/bookings", {
    method: "POST",
    body: payload,
  }).then((r) => r.data);

export const moveBookingDirectly = (
  code: string,
  payload: {
    date: string;
    time: string;
    allowOverbook?: boolean;
    confirmedDirectMove: boolean;
    note?: string;
  },
) =>
  api<{ data: ApiBooking }>(`/api/admin/bookings/${encodeURIComponent(code)}/move`, {
    method: "POST",
    body: payload,
  }).then((r) => r.data);

export const submitPublicBooking = (form: FormData) =>
  api<{ data: ApiBooking }>("/api/public/bookings", {
    method: "POST",
    formData: form,
  }).then((r) => r.data);

export const precheckBookingIdentity = (payload: { nik: string; whatsapp: string }) =>
  api<{ data: { allowed: boolean } }>("/api/public/bookings/precheck", {
    method: "POST",
    body: payload,
  }).then((r) => r.data);

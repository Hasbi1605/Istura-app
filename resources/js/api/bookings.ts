import { api } from "./client";

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
  time: string;
  status: "Pending" | "Accepted" | "Rejected" | "Reschedule" | "Completed";
  documentName: string;
  hasDocument?: boolean;
  submittedAt: string;
  leadTimeDays?: number | null;
  isShortNotice?: boolean;
  note?: string | null;
  feedbackToken: string;
  completedAt?: string | null;
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
}): Promise<ApiBooking[]> => {
  const search = new URLSearchParams();
  if (params?.status) search.set("status", params.status);
  if (params?.search) search.set("search", params.search);
  if (params?.from) search.set("from", params.from);
  if (params?.to) search.set("to", params.to);
  const qs = search.toString();
  return api<{ data: ApiBooking[] }>(`/api/admin/bookings${qs ? `?${qs}` : ""}`).then((r) => r.data);
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

export const completeBooking = (code: string) =>
  api<{ data: ApiBooking }>(`/api/admin/bookings/${encodeURIComponent(code)}/complete`, {
    method: "POST",
  }).then((r) => r.data);

export const submitPublicBooking = (form: FormData) =>
  api<{ data: ApiBooking }>("/api/public/bookings", {
    method: "POST",
    formData: form,
  }).then((r) => r.data);

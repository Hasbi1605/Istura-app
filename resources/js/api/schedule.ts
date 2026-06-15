import { api } from "./client";
import type { ClosureReason, NationalHolidayInfo } from "../domain/types";

export type ApiVisitDay = {
  date: string;
  label: string;
  short: string;
  closureReason?: ClosureReason | null;
  holiday?: NationalHolidayInfo | null;
  slots: {
    time: string;
    status: string;
    custom: boolean;
    bookingCount?: number;
    overbooked?: boolean;
    participantCount?: number;
    bookingConflicts?: Array<{ code: string; groupSize: number; status: string }>;
    shortNotice?: {
      mode: "admin" | "public";
      closesAt?: string | null;
      capacity: number;
      remainingCapacity: number;
      active: boolean;
    } | null;
    remainingCapacity?: number | null;
    closureReason?: ClosureReason | null;
  }[];
};

export const fetchAdminSchedule = (from?: string, to?: string): Promise<ApiVisitDay[]> => {
  const search = new URLSearchParams();
  if (from) search.set("from", from);
  if (to) search.set("to", to);
  const qs = search.toString();
  return api<{ data: ApiVisitDay[] }>(`/api/admin/schedule${qs ? `?${qs}` : ""}`).then((r) => r.data);
};

export const fetchPublicSchedule = (from?: string, to?: string): Promise<ApiVisitDay[]> => {
  const search = new URLSearchParams();
  if (from) search.set("from", from);
  if (to) search.set("to", to);
  const qs = search.toString();
  return api<{ data: ApiVisitDay[] }>(`/api/public/schedule${qs ? `?${qs}` : ""}`, { cache: "no-cache" }).then((r) => r.data);
};

export const upsertScheduleSlot = (date: string, time: string, status: string, note?: string) =>
  api("/api/admin/schedule/slot", { method: "POST", body: { date, time, status, note } });

export const deleteScheduleSlot = (date: string, time: string) =>
  api("/api/admin/schedule/slot", { method: "DELETE", body: { date, time } });

export const upsertScheduleRange = (payload: {
  from: string;
  to: string;
  weekdays?: number[];
  time?: string;
  status: string;
  note?: string;
}) => api("/api/admin/schedule/range", { method: "POST", body: payload });

export const upsertShortNoticeSlot = (payload: {
  date: string;
  time: string;
  audience: "admin" | "public";
  closesAt?: string;
  capacity: number;
  note: string;
}) => api("/api/admin/schedule/short-notice", { method: "POST", body: payload });

export const deleteShortNoticeSlot = (date: string, time: string) =>
  api("/api/admin/schedule/short-notice", { method: "DELETE", body: { date, time } });

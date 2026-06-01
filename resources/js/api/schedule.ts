import { api } from "./client";

export type ApiVisitDay = {
  date: string;
  label: string;
  short: string;
  slots: { time: string; status: string; custom: boolean; bookingCount?: number; overbooked?: boolean }[];
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
  return api<{ data: ApiVisitDay[] }>(`/api/public/schedule${qs ? `?${qs}` : ""}`, { cache: "no-cache" }).then(
    (r) => r.data,
  );
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

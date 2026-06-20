import { api } from "./client";
import type {
  OpenEventAdmin,
  OpenEventDayAdmin,
  OpenEventPublic,
  OpenQuotaSummary,
  OpenRegistrationAdmin,
  OpenRegistrationResult,
} from "../domain/types";

// ---- Public --------------------------------------------------------------

export const fetchPublicOpenEvent = () =>
  api<{ data: OpenEventPublic | null }>("/api/public/open-event", { cache: "no-cache" }).then((r) => r.data);

export const precheckOpenRegistration = (nik: string, whatsapp: string) =>
  api<{ data: { identityAvailable: boolean; alreadyRegistered: boolean } }>(
    "/api/public/open-registrations/precheck",
    { method: "POST", body: { nik, whatsapp } },
  ).then((r) => r.data);

export type StoreOpenRegistrationPayload = {
  contactName: string;
  nik: string;
  whatsapp: string;
  city: string;
  assignedDayId: number;
  members: string[];
  agreement: boolean;
};

export const storeOpenRegistration = (payload: StoreOpenRegistrationPayload) =>
  api<{ data: OpenRegistrationResult }>("/api/public/open-registrations", {
    method: "POST",
    body: payload,
  }).then((r) => r.data);

export const lookupOpenRegistration = (nik: string, whatsapp: string) =>
  api<{ data: OpenRegistrationResult | null }>("/api/public/open-registrations/lookup", {
    method: "POST",
    body: { nik, whatsapp },
  }).then((r) => r.data);

export const cancelOpenRegistration = (nik: string, whatsapp: string) =>
  api<{ data: { cancelled: boolean } }>("/api/public/open-registrations/cancel", {
    method: "POST",
    body: { nik, whatsapp },
  }).then((r) => r.data);

// ---- Admin ---------------------------------------------------------------

export const fetchAdminOpenEvents = () =>
  api<{ data: OpenEventAdmin[]; quota: Record<number, OpenQuotaSummary[]> }>("/api/admin/open-events");

export type CreateOpenEventPayload = {
  name: string;
  dates: string[];
  startDate?: string;
  endDate?: string;
  perDayQuota: number;
  maxAddons: number;
  releaseMode?: string;
  registrationOpensAt?: string | null;
  registrationClosesAt?: string | null;
  agreementText?: string | null;
  promoSubtitle?: string | null;
  bannerText?: string | null;
};

export const createOpenEvent = (payload: CreateOpenEventPayload) =>
  api<{ data: OpenEventAdmin }>("/api/admin/open-events", { method: "POST", body: payload }).then((r) => r.data);

export const updateOpenEvent = (eventId: number, payload: Partial<CreateOpenEventPayload>) =>
  api<{ data: OpenEventAdmin }>(`/api/admin/open-events/${eventId}`, { method: "PUT", body: payload }).then(
    (r) => r.data,
  );

export const deleteOpenEvent = (eventId: number) =>
  api<{ data: { deleted: boolean } }>(`/api/admin/open-events/${eventId}`, { method: "DELETE" }).then(
    (r) => r.data,
  );

export const activateOpenEvent = (eventId: number, acknowledgeConflicts = false) =>
  api<{ data: OpenEventAdmin }>(`/api/admin/open-events/${eventId}/activate`, {
    method: "POST",
    body: acknowledgeConflicts ? { acknowledgeConflicts: true } : undefined,
  }).then(
    (r) => r.data,
  );

export const deactivateOpenEvent = (eventId: number) =>
  api<{ data: OpenEventAdmin }>(`/api/admin/open-events/${eventId}/deactivate`, { method: "POST" }).then(
    (r) => r.data,
  );

export const archiveOpenEvent = (eventId: number) =>
  api<{ data: OpenEventAdmin }>(`/api/admin/open-events/${eventId}/archive`, { method: "POST" }).then(
    (r) => r.data,
  );

export const unarchiveOpenEvent = (eventId: number) =>
  api<{ data: OpenEventAdmin }>(`/api/admin/open-events/${eventId}/unarchive`, { method: "POST" }).then(
    (r) => r.data,
  );

export const uploadOpenEventPoster = (eventId: number, poster: File) => {
  const formData = new FormData();
  formData.append("poster", poster);
  return api<{ data: OpenEventAdmin }>(`/api/admin/open-events/${eventId}/poster`, {
    method: "POST",
    formData,
  }).then((r) => r.data);
};

export const deleteOpenEventPoster = (eventId: number) =>
  api<{ data: OpenEventAdmin }>(`/api/admin/open-events/${eventId}/poster`, { method: "DELETE" }).then(
    (r) => r.data,
  );

export type UpdateOpenEventDayPayload = {
  quotaOverride?: number | null;
  whatsappGroupUrl?: string | null;
  opensAt?: string | null;
  isOpen?: boolean;
  acknowledgeConflicts?: boolean;
};

export const updateOpenEventDay = (eventId: number, dayId: number, payload: UpdateOpenEventDayPayload) =>
  api<{ data: OpenEventDayAdmin }>(`/api/admin/open-events/${eventId}/days/${dayId}`, {
    method: "PUT",
    body: payload,
  }).then((r) => r.data);

export const fetchAdminOpenRegistrations = (
  eventId: number,
  params: { dayId?: number; status?: string; search?: string; page?: number } = {},
) => {
  const search = new URLSearchParams();
  if (params.dayId) search.set("dayId", String(params.dayId));
  if (params.status) search.set("status", params.status);
  if (params.search) search.set("search", params.search);
  if (params.page) search.set("page", String(params.page));
  const query = search.toString();
  return api<{
    data: OpenRegistrationAdmin[];
    meta: {
      currentPage: number;
      lastPage: number;
      perPage: number;
      total: number;
      counts: { total: number; registered: number; cancelled: number };
    };
  }>(`/api/admin/open-events/${eventId}/registrations${query ? `?${query}` : ""}`);
};

export const cancelAdminOpenRegistration = (eventId: number, code: string) =>
  api<{ data: OpenRegistrationAdmin }>(`/api/admin/open-events/${eventId}/registrations/${code}/cancel`, {
    method: "POST",
  }).then((r) => r.data);

export const fetchOpenEventExport = (eventId: number) =>
  api<{ data: OpenRegistrationAdmin[]; event: OpenEventAdmin }>(`/api/admin/open-events/${eventId}/export`);

import { api } from "./client";

export type AdminRole = "super_admin" | "admin";

export type ApiAdminUser = {
  id: number;
  name: string;
  email: string;
  role: AdminRole;
  roleLabel: string;
  status: "Aktif" | "Nonaktif";
  lastLogin: string | null;
};

export type ApiAuditLog = {
  id: number;
  actor: string | null;
  action: string;
  ipAddress: string | null;
  userAgent: string | null;
  at: string | null;
};

export type ApiDashboard = {
  kpis: {
    pending: number;
    todayBookings: number;
    weekBookings: number;
    monthBookings: number;
    totalCompleted: number;
    feedbacks: number;
    avgRating: number;
  };
  todayBookings: unknown[];
  recentFeedbacks: unknown[];
};

export const fetchAdminUsers = () =>
  api<{ data: ApiAdminUser[] }>("/api/admin/users").then((r) => r.data);

export type AdminUserInput = {
  name: string;
  email: string;
  password?: string;
  role: AdminRole;
  status?: "Aktif" | "Nonaktif";
};

export const createAdminUser = (input: AdminUserInput) =>
  api<{ data: ApiAdminUser }>("/api/admin/users", { method: "POST", body: input }).then(
    (r) => r.data,
  );

export const updateAdminUser = (id: number, input: Partial<AdminUserInput>) =>
  api<{ data: ApiAdminUser }>(`/api/admin/users/${id}`, { method: "PUT", body: input }).then(
    (r) => r.data,
  );

export const deleteAdminUser = (id: number) =>
  api<{ ok: boolean }>(`/api/admin/users/${id}`, { method: "DELETE" });

export type ApiAuditLogPage = {
  data: ApiAuditLog[];
  meta: {
    currentPage: number;
    perPage: number;
    total: number;
    lastPage: number;
  };
};

export const fetchAdminAuditLogs = (
  params: { page?: number; perPage?: number; from?: string; to?: string } = {},
) => {
  const search = new URLSearchParams();
  search.set("page", String(params.page ?? 1));
  search.set("perPage", String(params.perPage ?? 20));
  if (params.from) search.set("from", params.from);
  if (params.to) search.set("to", params.to);
  return api<ApiAuditLogPage>(`/api/admin/audit-logs?${search.toString()}`);
};

export const fetchAdminDashboard = () => api<ApiDashboard>("/api/admin/dashboard");

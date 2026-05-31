import { api } from "./client";

export type ApiAdminUser = {
  id: number;
  name: string;
  email: string;
  role: string;
  roleLabel: string;
  status: "Aktif" | "Nonaktif";
  lastLogin: string | null;
};

export type ApiAuditLog = {
  id: number;
  actor: string | null;
  action: string;
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
  role: "super_admin" | "admin" | "viewer";
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

export const fetchAdminAuditLogs = () =>
  api<{ data: ApiAuditLog[] }>("/api/admin/audit-logs?perPage=250").then((r) => r.data);

export const fetchAdminDashboard = () => api<ApiDashboard>("/api/admin/dashboard");

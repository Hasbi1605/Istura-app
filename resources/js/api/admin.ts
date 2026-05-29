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

export const fetchAdminAuditLogs = () =>
  api<{ data: ApiAuditLog[] }>("/api/admin/audit-logs").then((r) => r.data);

export const fetchAdminDashboard = () => api<ApiDashboard>("/api/admin/dashboard");

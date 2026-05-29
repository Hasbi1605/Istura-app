import { api, resetCsrf } from "./client";

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  role: "super_admin" | "admin" | "viewer";
  roleLabel: string;
  status: "Aktif" | "Nonaktif";
  lastLogin: string | null;
};

export async function login(email: string, password: string): Promise<AuthUser> {
  const res = await api<{ user: AuthUser }>("/api/auth/login", {
    method: "POST",
    body: { email, password },
  });
  return res.user;
}

export async function logout(): Promise<void> {
  await api("/api/auth/logout", { method: "POST" });
  resetCsrf();
}

export async function me(): Promise<AuthUser | null> {
  const res = await api<{ user: AuthUser | null }>("/api/auth/me");
  return res.user;
}

import { api, resetCsrf } from "./client";
import type { AdminRole } from "./admin";

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  role: AdminRole;
  roleLabel: string;
  status: "Aktif" | "Nonaktif";
  lastLogin: string | null;
  twoFactorEnabled: boolean;
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

// --- Two-Factor Authentication ---

export type TwoFactorStatus = {
  enabled: boolean;
  confirmed_at: string | null;
};

export type TwoFactorSetupResponse = {
  secret: string;
  qr_svg: string;
};

export type TwoFactorConfirmResponse = {
  recovery_codes: string[];
};

export async function twoFactorStatus(): Promise<TwoFactorStatus> {
  return api<TwoFactorStatus>("/api/auth/two-factor/status");
}

export async function twoFactorSetup(): Promise<TwoFactorSetupResponse> {
  return api<TwoFactorSetupResponse>("/api/auth/two-factor/setup", { method: "POST" });
}

export async function twoFactorConfirm(code: string): Promise<TwoFactorConfirmResponse> {
  return api<TwoFactorConfirmResponse>("/api/auth/two-factor/confirm", {
    method: "POST",
    body: { code },
  });
}

export async function twoFactorVerify(code: string, trustDevice: boolean): Promise<void> {
  await api("/api/auth/two-factor/verify", {
    method: "POST",
    body: { code, trust_device: trustDevice },
  });
}

export async function twoFactorDisable(password: string, code: string): Promise<void> {
  await api("/api/auth/two-factor/disable", {
    method: "POST",
    body: { password, code },
  });
}

export async function twoFactorRegenerateCodes(password: string, code: string): Promise<TwoFactorConfirmResponse> {
  return api<TwoFactorConfirmResponse>("/api/auth/two-factor/recovery-codes", {
    method: "POST",
    body: { password, code },
  });
}

export async function twoFactorChallenge(): Promise<{ requires_2fa: boolean }> {
  return api<{ requires_2fa: boolean }>("/api/auth/two-factor/challenge");
}

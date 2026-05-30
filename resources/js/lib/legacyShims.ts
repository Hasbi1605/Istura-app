import type { AdminSession } from "../domain/types";

// Shim sinkron warisan dari versi localStorage. Auth & CMS sekarang dijaga
// server (Sanctum cookie + REST API), jadi helper ini sengaja no-op / hanya
// mengembalikan fallback supaya call-site lama tetap kompatibel tanpa diubah.

export const ADMIN_SESSION_KEY = "istura-admin-session";

export function readAdminSession(): AdminSession | null {
  return null;
}

export function writeAdminSession(_session: AdminSession) {
  /* no-op: session di server */
}

export function clearAdminSession() {
  /* no-op */
}

// CMS data sekarang di server. Helper ini mengembalikan fallback statis supaya
// initial render aman; data asli di-replace oleh useEffect fetcher.
export function readCmsCollection<T>(_key: string, fallback: T[]): T[] {
  return fallback;
}

export function writeCmsCollection<T>(_key: string, _value: T[]) {
  /* no-op: persistence delegated to API hooks */
}

// fetch wrapper sesuai pola Laravel + Sanctum (cookie SPA auth).
//
// Aturan:
// - Kirim credentials untuk request yang butuh sesi; GET publik sengaja omit
//   supaya hard refresh tidak ikut menunggu cookie/Sanctum path.
// - Sebelum mutating request, ambil CSRF cookie via /sanctum/csrf-cookie lalu
//   sertakan token dari cookie XSRF-TOKEN ke header X-XSRF-TOKEN.
// - Response dinormalisasi: 200/201 -> JSON, 422 -> ValidationError, lainnya
//   -> ApiError supaya consumer punya satu bentuk error.

const BASE_URL = "";

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export class ValidationError extends ApiError {
  errors: Record<string, string[]>;
  constructor(message: string, body: { message?: string; errors: Record<string, string[]> }) {
    super(422, message, body);
    this.errors = body.errors ?? {};
  }
}

let csrfPrimed = false;

type AdminAuthFailureContext = {
  path: string;
  status: number;
  message: string;
};

const adminAuthFailureListeners = new Set<(context: AdminAuthFailureContext) => void>();

export function onAdminAuthFailure(listener: (context: AdminAuthFailureContext) => void): () => void {
  adminAuthFailureListeners.add(listener);

  return () => adminAuthFailureListeners.delete(listener);
}

function notifyAdminAuthFailure(context: AdminAuthFailureContext) {
  adminAuthFailureListeners.forEach((listener) => listener(context));
}

function shouldNotifyAdminAuthFailure(path: string, status: number, message: string, body: unknown): boolean {
  if (!path.startsWith("/api/admin/")) return false;
  if (status === 401) return true;
  if (status !== 403) return false;

  if (body && typeof body === "object") {
    const error = body as { two_factor_required?: unknown; two_factor_setup_required?: unknown };
    if (error.two_factor_required || error.two_factor_setup_required) return false;
  }

  return message !== "Hanya Super Admin yang dapat mengakses area ini.";
}

async function ensureCsrf(): Promise<void> {
  if (csrfPrimed) return;
  const response = await fetch(`${BASE_URL}/sanctum/csrf-cookie`, { credentials: "include" });
  if (!response.ok) {
    throw new ApiError(response.status, "Gagal menyiapkan sesi keamanan.", null);
  }
  csrfPrimed = true;
}

async function refreshCsrf(): Promise<void> {
  csrfPrimed = false;
  await ensureCsrf();
}

function readXsrfToken(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  formData?: FormData;
  signal?: AbortSignal;
  credentials?: RequestCredentials;
};

type PaginatedResponse<T> = {
  data: T[];
  meta?: {
    currentPage: number;
    perPage: number;
    total: number;
    lastPage: number;
  };
};

export async function api<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  return apiRequest<T>(path, options, true);
}

export async function fetchAllPages<T>(
  path: string,
  params: Record<string, string | number | undefined> = {},
): Promise<T[]> {
  const items: T[] = [];
  let page = 1;
  let lastPage = 1;

  do {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== "") search.set(key, String(value));
    });
    search.set("page", String(page));
    search.set("perPage", String(params.perPage ?? 500));

    const response = await api<PaginatedResponse<T>>(`${path}?${search.toString()}`);
    items.push(...response.data);
    lastPage = response.meta?.lastPage ?? page;
    page += 1;
  } while (page <= lastPage);

  return items;
}

async function apiRequest<T = unknown>(path: string, options: RequestOptions, retryOnCsrf: boolean): Promise<T> {
  const method = options.method ?? "GET";
  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-Requested-With": "XMLHttpRequest",
  };

  if (method !== "GET") {
    await ensureCsrf();
    const token = readXsrfToken();
    if (token) headers["X-XSRF-TOKEN"] = token;
  }

  let body: BodyInit | undefined;
  if (options.formData) {
    body = options.formData;
  } else if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body,
    credentials: options.credentials ?? (method === "GET" && path.startsWith("/api/public/") ? "omit" : "include"),
    signal: options.signal,
  });

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const json = text ? safeParse(text) : null;

  if (!response.ok) {
    if (response.status === 419 && method !== "GET" && retryOnCsrf) {
      await refreshCsrf();
      return apiRequest<T>(path, options, false);
    }
    if (response.status === 422 && json && typeof json === "object") {
      throw new ValidationError(
        (json as { message?: string }).message ?? "Validasi gagal",
        json as { errors: Record<string, string[]> },
      );
    }
    const message =
      json && typeof json === "object" && "message" in json
        ? String((json as { message: unknown }).message)
        : `Permintaan gagal (${response.status})`;
    if (shouldNotifyAdminAuthFailure(path, response.status, message, json)) {
      notifyAdminAuthFailure({ path, status: response.status, message });
    }
    throw new ApiError(response.status, message, json);
  }

  return json as T;
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export function resetCsrf() {
  csrfPrimed = false;
}

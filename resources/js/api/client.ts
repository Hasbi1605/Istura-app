// fetch wrapper sesuai pola Laravel + Sanctum (cookie SPA auth).
//
// Aturan:
// - Selalu kirim credentials supaya cookie session terbawa.
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

async function ensureCsrf(): Promise<void> {
  if (csrfPrimed) return;
  await fetch(`${BASE_URL}/sanctum/csrf-cookie`, { credentials: "include" });
  csrfPrimed = true;
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
};

export async function api<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
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
    credentials: "include",
    signal: options.signal,
  });

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const json = text ? safeParse(text) : null;

  if (!response.ok) {
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

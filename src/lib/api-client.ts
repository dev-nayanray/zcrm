// API client wrapper used by all frontend components. Handles the standard
// envelope, throws on error, and parses Decimal values transparently.

export type ApiResult<T> = { success: true; data: T } | { success: false; error: { code: string; message: string; details?: unknown } };

export class ApiError extends Error {
  code: string;
  status: number;
  details?: unknown;
  constructor(message: string, code: string, status: number, details?: unknown) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

async function request<T>(method: string, url: string, body?: unknown, opts?: { signal?: AbortSignal }): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
    signal: opts?.signal,
  });
  let json: ApiResult<T> | null = null;
  const text = await res.text();
  if (text) {
    try { json = JSON.parse(text) as ApiResult<T>; } catch { /* non-JSON */ }
  }
  if (!json) {
    throw new ApiError(`Request failed (${res.status})`, "REQUEST_FAILED", res.status);
  }
  if (!json.success) {
    throw new ApiError(json.error.message, json.error.code, res.status, json.error.details);
  }
  return json.data;
}

export const api = {
  get: <T>(url: string, signal?: AbortSignal) => request<T>("GET", url, undefined, { signal }),
  post: <T>(url: string, body?: unknown) => request<T>("POST", url, body),
  put: <T>(url: string, body?: unknown) => request<T>("PUT", url, body),
  patch: <T>(url: string, body?: unknown) => request<T>("PATCH", url, body),
  del: <T>(url: string) => request<T>("DELETE", url),
};

// Helpers to format currency display (BDT)
export function money(value: string | number | null | undefined, symbol = "৳"): string {
  if (value === null || value === undefined) return `${symbol}0.00`;
  const num = typeof value === "number" ? value : Number(value);
  if (isNaN(num)) return `${symbol}0.00`;
  return `${symbol}${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function num(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === "number" ? value : Number(value);
  return isNaN(n) ? 0 : n;
}

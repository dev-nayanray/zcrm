import { getCurrentUser, hasPermission } from "@/lib/auth";
import { forbidden, unauthorized } from "@/lib/api";
import type { Permission } from "@/lib/constants";
import type { NextRequest } from "next/server";

// requireAuth: returns the user or a 401 NextResponse. Use as `const [user, err] = await requireAuth(request); if (err) return err;`
export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    return [null, unauthorized()] as const;
  }
  return [user, null] as const;
}

// requirePermission: returns the user or a 401/403 NextResponse.
export async function requirePermission(permission: Permission) {
  const [user, authErr] = await requireAuth();
  if (authErr) return [null, authErr] as const;
  if (!hasPermission(user!, permission)) {
    return [null, forbidden()] as const;
  }
  return [user!, null] as const;
}

// Helper to read JSON body safely.
export async function readJsonBody<T = unknown>(request: NextRequest): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new Error("Invalid JSON body");
  }
}

// --- In-memory per-IP rate limiter (token bucket) ---
// Suitable for a single-instance deployment. For multi-instance, swap for
// Redis. The state is a Map<key, { tokens, lastRefill }>. Buckets are sized
// `capacity` and refill at `refillPerSec` tokens per second.
type RateBucket = { tokens: number; lastRefill: number };
const rateBuckets = new Map<string, RateBucket>();

// Prune stale buckets every 5 minutes to keep the map bounded.
const PRUNE_INTERVAL_MS = 5 * 60 * 1000;
let lastPrune = Date.now();

export function rateLimit(opts: {
  key: string;
  capacity: number;
  refillPerSec: number;
}): { ok: boolean; remaining: number; retryAfterSec: number } {
  const now = Date.now();
  if (now - lastPrune > PRUNE_INTERVAL_MS) {
    for (const [k, v] of rateBuckets) {
      if (now - v.lastRefill > 60 * 60 * 1000) rateBuckets.delete(k);
    }
    lastPrune = now;
  }
  const bucket = rateBuckets.get(opts.key);
  if (!bucket) {
    rateBuckets.set(opts.key, { tokens: opts.capacity - 1, lastRefill: now });
    return { ok: true, remaining: opts.capacity - 1, retryAfterSec: 0 };
  }
  const elapsed = (now - bucket.lastRefill) / 1000;
  const refilled = Math.min(opts.capacity, bucket.tokens + elapsed * opts.refillPerSec);
  if (refilled < 1) {
    const retryAfterSec = Math.ceil((1 - refilled) / opts.refillPerSec);
    return { ok: false, remaining: 0, retryAfterSec };
  }
  const tokens = refilled - 1;
  rateBuckets.set(opts.key, { tokens, lastRefill: now });
  return { ok: true, remaining: Math.floor(tokens), retryAfterSec: 0 };
}

// Convenience: extract a client IP from the request, preferring forwarded
// headers since the gateway runs behind Caddy.
export function clientIp(request: NextRequest): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const xri = request.headers.get("x-real-ip");
  if (xri) return xri.trim();
  return "anonymous";
}

// Auth: secure cookie-based session with HMAC-signed tokens.
// Mirrors the Supabase Auth contract (login/logout/session/server-side user validation)
// while remaining portable to SQLite in this sandbox. In production, swap this for
// Supabase Auth by replacing these helpers — the rest of the app calls the same API.
//
// NEVER trust authentication information supplied by the frontend; always re-derive
// the session from the signed cookie on the server.

import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { Role, User } from "@prisma/client";
import { RoleName, PERMISSIONS, ROLE_PERMISSIONS, Permission } from "@/lib/constants";

const SESSION_COOKIE = "zcrm_session";

// SECURITY: Auth signing secret MUST come from the environment. We refuse to
// boot with a fallback because a known fallback means anyone with source
// access can forge a valid session cookie for ANY user id (including the
// SUPER_ADMIN), which is full account takeover. The fallback is only used in
// the test environment (NODE_ENV === "test") so the test suite can run
// without env configuration.
const SECRET = (function resolveSecret() {
  const v = process.env.AUTH_SECRET;
  if (v && v.length >= 32) return v;
  if (process.env.NODE_ENV === "test" || process.env.JEST_WORKER_ID) {
    return "test-only-secret-32-chars-min-aaaaaaaaaaaaa";
  }
  if (process.env.NODE_ENV === "development") {
    // Generate a stable per-process random secret for dev so that source
    // inspection does not reveal the secret. Sessions will not persist
    // across restarts in dev, which is acceptable.
    return "dev-auto-" + Array.from(crypto.getRandomValues(new Uint8Array(24)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  throw new Error(
    "FATAL: AUTH_SECRET environment variable is missing or too short (must be >=32 chars). " +
    "Set it in your environment (e.g. `openssl rand -hex 32`) before starting the CRM."
  );
})();

// --- crypto helpers (Web Crypto API, available in Node 20+ / Next 16 runtime) ---

function toHex(buf: ArrayBuffer) {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string) {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < arr.length; i++) arr[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return arr;
}

async function hmacSign(message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return toHex(sig);
}

function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

async function signToken(payload: { uid: string; ts: number; tv: number }): Promise<string> {
  const body = btoa(JSON.stringify(payload));
  const sig = await hmacSign(body);
  return `${body}.${sig}`;
}

async function verifyToken(token: string): Promise<{ uid: string; ts: number; tv: number } | null> {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expected = await hmacSign(body);
  if (!constantTimeEqual(sig, expected)) return null;
  try {
    const payload = JSON.parse(atob(body)) as { uid: string; ts: number; tv: number };
    const ageMs = Date.now() - payload.ts;
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    if (ageMs > sevenDays) return null;
    return payload;
  } catch {
    return null;
  }
}

// --- password hashing (PBKDF2 via Web Crypto) ---

// OWASP 2023 recommends ≥600,000 iterations for PBKDF2-SHA256. New hashes use
// this; existing 100k hashes still verify (iter stored in the hash string)
// and are transparently rehashed on next successful login.
const ITER = 600_000;
const MIN_ITER = 100_000;
const KEY_LEN = 32;
const SALT_LEN = 16;

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN));
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: ITER, hash: "SHA-256" },
    keyMaterial,
    KEY_LEN * 8,
  );
  const hash = toHex(bits);
  return `pbkdf2$${ITER}$${toHex(salt.buffer)}$${hash}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iter = parseInt(parts[1], 10);
  const saltHex = parts[2];
  const expected = parts[3];
  // Reject manipulated hashes: iteration count must be at least MIN_ITER and
  // salt must be exactly SALT_LEN bytes (32 hex chars). Without this, an
  // attacker with a DB-write exploit could swap the iter field to "1" to
  // make brute-force trivial.
  if (!Number.isFinite(iter) || iter < MIN_ITER) return false;
  if (saltHex.length !== SALT_LEN * 2) return false;
  const salt = fromHex(saltHex);
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: iter, hash: "SHA-256" },
    keyMaterial,
    KEY_LEN * 8,
  );
  return constantTimeEqual(toHex(bits), expected);
}

// Returns true if the stored hash uses an older iteration count and should be
// transparently rehashed on the next successful login.
export function shouldRehash(stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iter = parseInt(parts[1], 10);
  return Number.isFinite(iter) && iter < ITER;
}

// --- session management ---

// Account lockout configuration
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export async function createSession(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId } });
  const token = await signToken({ uid: userId, ts: Date.now(), tv: user?.tokenVersion ?? 0 });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export type AuthUser = User & { role: Role };

// Always re-derive the user from the signed cookie + DB lookup on the server.
export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    const payload = await verifyToken(token);
    if (!payload) return null;
    const user = await db.user.findUnique({
      where: { id: payload.uid },
      include: { role: true },
    });
    if (!user || !user.isActive) return null;
    // Verify token version matches (session revocation check)
    if (payload.tv !== user.tokenVersion) return null;
    // Check account lockout
    if (user.lockedUntil && new Date() < user.lockedUntil) return null;
    return user;
  } catch {
    return null;
  }
}

// Increment token version to invalidate all sessions for a user
export async function revokeAllSessions(userId: string): Promise<void> {
  await db.user.update({
    where: { id: userId },
    data: { tokenVersion: { increment: 1 } },
  });
}

// Record a failed login attempt; lock account if threshold exceeded
export async function recordFailedLogin(email: string): Promise<{ justLocked: boolean }> {
  const user = await db.user.findUnique({ where: { email } });
  if (!user) return { justLocked: false };
  const attempts = user.failedLoginAttempts + 1;
  const data: { failedLoginAttempts: number; lockedUntil?: Date } = { failedLoginAttempts: attempts };
  const justLocked = attempts >= MAX_FAILED_ATTEMPTS;
  if (justLocked) {
    data.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
  }
  await db.user.update({ where: { id: user.id }, data });
  return { justLocked };
}

// Reset failed login attempts on successful login
export async function resetFailedLogins(userId: string): Promise<void> {
  await db.user.update({
    where: { id: userId },
    data: { failedLoginAttempts: 0, lockedUntil: null },
  });
}

// --- RBAC helpers ---

// Resolved permission set for a user's role. SUPER_ADMIN/ADMIN resolve to ALL.
export function resolveRolePermissions(roleName: RoleName): Permission[] {
  const perms = ROLE_PERMISSIONS[roleName] ?? [];
  if (roleName === "SUPER_ADMIN" || roleName === "ADMIN") return [...PERMISSIONS];
  return perms;
}

export function hasPermission(user: { role: { name: string } }, permission: Permission): boolean {
  const roleName = user.role.name as RoleName;
  if (roleName === "SUPER_ADMIN" || roleName === "ADMIN") return true;
  const perms = resolveRolePermissions(roleName);
  return perms.includes(permission);
}

// Re-export for convenience in API routes
export { SESSION_COOKIE };

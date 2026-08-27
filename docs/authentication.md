# Authentication

> **Never trust authentication information supplied by the frontend. Always re-derive the session from the signed cookie on the server.**

## Implementation

The sandbox cannot use Supabase Auth directly, so this project ships a portable, secure cookie-session implementation in `src/lib/auth.ts` that **mirrors the Supabase Auth contract** (login / logout / session / protected routes / server-side user validation). In production, swap the four helpers (`createSession`, `destroySession`, `getCurrentUser`, `requirePermission`) for Supabase Auth calls — the rest of the app is unchanged.

### Session token

- A signed JWT-like token: `base64(JSON({uid, ts})).<HMAC-SHA256(body, AUTH_SECRET)>`.
- Stored in an `httpOnly`, `sameSite=lax`, `secure` (in production) cookie `zcrm_session`, 7-day max age.
- Verified on every request via constant-time signature comparison.

### Password hashing

PBKDF2 (SHA-256, 100,000 iterations, 16-byte random salt, 32-byte derived key) via the Web Crypto API. Stored as `pbkdf2$<iter>$<hex-salt>$<hex-hash>`.

## Server-side flow

```
request → cookies().get('zcrm_session')
        → verifyToken(token)             // signature + age check
        → db.user.findUnique({include:{role}}) + isActive check
        → AuthUser (with role.name)
```

`getCurrentUser()` is async and called by `requirePermission(permission)`, which returns `[user, null]` or `[null, NextResponse(401|403)]`. Every route handler uses it:

```ts
const [user, err] = await requirePermission("orders:create");
if (err) return err;
```

## What is NOT security

- Hiding UI buttons based on permissions is a UX convenience, **not** a security control.
- Frontend-supplied `userId`, `customerId`, totals, etc. are **always** re-validated server-side.
- The session cookie cannot be forged without `AUTH_SECRET`; it cannot be read by JavaScript (`httpOnly`); it is not sent cross-site (`sameSite=lax`).

## Environment

- `AUTH_SECRET` — long random string used to sign cookies. Generate with `openssl rand -hex 32`.
- Production Supabase migration: set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` and replace the four helpers.

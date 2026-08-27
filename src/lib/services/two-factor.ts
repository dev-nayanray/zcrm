import { db } from "@/lib/db";
import { TelegramService } from "./telegram";

// TwoFactorService — Telegram-based 2FA for CRM login.
//
// Flow:
//  1. A logged-in user generates a link code (Settings → Security) and
//     sends "/link <code>" to the bot in a PRIVATE Telegram chat. This sets
//     TelegramUser.crmUserId, connecting their Telegram identity to their
//     CRM account.
//  2. The user enables 2FA on their account (requires step 1 first).
//  3. On next login, after the password is verified, a 6-digit code is
//     generated, hashed (SHA-256) and stored with a short expiry, and the
//     plaintext code is DMed to the user's linked Telegram chat. The login
//     endpoint returns a `challengeToken` instead of creating a session.
//  4. The client posts { challengeToken, code } to /api/v1/auth/2fa/verify,
//     which validates the code and only then creates the real session.
//
// Codes are never stored in plaintext, expire quickly, and are single-use
// with a limited number of verification attempts to resist brute force.

const LINK_CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ATTEMPTS = 5;

function randomDigits(len: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, (b) => (b % 10).toString()).join("");
}

function randomAlnumCode(len: number): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

async function sha256(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const TwoFactorService = {
  // --- Account linking (CRM User <-> Telegram identity) ---

  async getLinkedTelegramUser(userId: string) {
    return db.telegramUser.findFirst({ where: { crmUserId: userId } });
  },

  async generateLinkCode(userId: string) {
    // Invalidate any previous unused codes for this user.
    await db.telegramLinkCode.updateMany({ where: { userId, consumed: false }, data: { consumed: true } });
    const code = randomAlnumCode(8);
    const expiresAt = new Date(Date.now() + LINK_CODE_TTL_MS);
    await db.telegramLinkCode.create({ data: { userId, code, expiresAt } });
    const cfg = await TelegramService.getConfig();
    return { code, expiresAt, botUsername: cfg?.botUsername ?? null };
  },

  // Called from the Telegram command handler when a user DMs "/link CODE".
  async consumeLinkCode(code: string, telegramId: string, meta: { username?: string; firstName?: string; lastName?: string }) {
    const normalized = code.trim().toUpperCase();
    const record = await db.telegramLinkCode.findUnique({ where: { code: normalized } });
    if (!record || record.consumed || record.expiresAt < new Date()) {
      return { ok: false, message: "That link code is invalid or has expired. Generate a new one from CRM → Settings → Security." };
    }
    const user = await db.user.findUnique({ where: { id: record.userId } });
    if (!user) return { ok: false, message: "That CRM account no longer exists." };

    await db.$transaction([
      db.telegramLinkCode.update({ where: { id: record.id }, data: { consumed: true } }),
      db.telegramUser.upsert({
        where: { telegramId },
        create: { telegramId, crmUserId: user.id, ...meta },
        update: { crmUserId: user.id, ...meta },
      }),
    ]);
    return { ok: true, message: `✅ Linked to Z-CRM account <b>${user.name}</b> (${user.email}). You can now enable two-step verification in CRM → Settings → Security.` };
  },

  async unlink(userId: string) {
    await db.telegramUser.updateMany({ where: { crmUserId: userId }, data: { crmUserId: null } });
    await db.user.update({ where: { id: userId }, data: { twoFactorEnabled: false } });
  },

  // --- 2FA enable/disable ---

  async setEnabled(userId: string, enabled: boolean) {
    if (enabled) {
      const linked = await this.getLinkedTelegramUser(userId);
      if (!linked) {
        throw new Error("Link your Telegram account first (Settings → Security → Connect Telegram).");
      }
    }
    return db.user.update({ where: { id: userId }, data: { twoFactorEnabled: enabled } });
  },

  async status(userId: string) {
    const [user, linked] = await Promise.all([
      db.user.findUnique({ where: { id: userId } }),
      this.getLinkedTelegramUser(userId),
    ]);
    return {
      enabled: !!user?.twoFactorEnabled,
      linked: !!linked,
      telegramUsername: linked?.username ?? null,
    };
  },

  // --- Login challenge ---

  async createLoginChallenge(
    userId: string,
    meta?: { ipAddress?: string; userAgent?: string },
  ): Promise<{ ok: true; challengeToken: string } | { ok: false; message: string }> {
    const linked = await this.getLinkedTelegramUser(userId);
    if (!linked) {
      return { ok: false, message: "Two-step verification is enabled but no Telegram account is linked. Contact an administrator." };
    }
    const code = randomDigits(6);
    const codeHash = await sha256(code);
    const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS);
    const challenge = await db.twoFactorChallenge.create({
      data: { userId, codeHash, expiresAt, ipAddress: meta?.ipAddress, userAgent: meta?.userAgent },
    });
    const contextLine = meta?.ipAddress ? `\n📍 IP: <code>${meta.ipAddress}</code>${meta.userAgent ? `\n💻 ${escapeHtml(meta.userAgent.slice(0, 60))}` : ""}` : "";
    const sent = await TelegramService.sendMessage(
      linked.telegramId,
      `🔐 <b>Z-CRM login verification</b>${contextLine}\n\nCode: <code>${code}</code>\n\nTap a button below, or type the code in the app. Expires in 5 minutes.\n\n<i>If this wasn't you, tap "Not me" — it will block this login attempt.</i>`,
      {
        inline_keyboard: [
          [
            { text: "✅ Approve", callback_data: `2fa_decide:${challenge.id}:APPROVED` },
            { text: "🚫 Not me", callback_data: `2fa_decide:${challenge.id}:DENIED` },
          ],
        ],
      },
    );
    if (sent && (sent as any).ok === false) {
      return { ok: false, message: "Could not deliver the verification code via Telegram. Make sure you've started a chat with the bot." };
    }
    return { ok: true, challengeToken: challenge.id };
  },

  async resendLoginChallenge(challengeToken: string) {
    const existing = await db.twoFactorChallenge.findUnique({ where: { id: challengeToken } });
    if (!existing || existing.consumed) return { ok: false, message: "Verification session expired. Please log in again." };
    await db.twoFactorChallenge.update({ where: { id: challengeToken }, data: { consumed: true } });
    return this.createLoginChallenge(existing.userId, { ipAddress: existing.ipAddress ?? undefined, userAgent: existing.userAgent ?? undefined });
  },

  async verifyLoginChallenge(challengeToken: string, code: string): Promise<{ ok: true; userId: string } | { ok: false; message: string }> {
    const challenge = await db.twoFactorChallenge.findUnique({ where: { id: challengeToken } });
    if (!challenge) {
      return { ok: false, message: "Verification code expired. Please log in again." };
    }
    if (challenge.decision === "DENIED") {
      return { ok: false, message: "This login was blocked from Telegram." };
    }
    if (challenge.consumed || challenge.expiresAt < new Date()) {
      return { ok: false, message: "Verification code expired. Please log in again." };
    }
    if (challenge.attempts >= MAX_ATTEMPTS) {
      await db.twoFactorChallenge.update({ where: { id: challenge.id }, data: { consumed: true } });
      await this.notifyBruteForceAttempt(challenge.userId, challenge.ipAddress ?? undefined);
      return { ok: false, message: "Too many incorrect attempts. Please log in again." };
    }
    // A tap on "Approve" satisfies verification without needing the typed code.
    if (challenge.decision === "APPROVED") {
      await db.twoFactorChallenge.update({ where: { id: challenge.id }, data: { consumed: true } });
      return { ok: true, userId: challenge.userId };
    }
    const hash = await sha256(code.trim());
    // constant-time-ish compare via hash equality (hash length fixed)
    if (hash !== challenge.codeHash) {
      await db.twoFactorChallenge.update({ where: { id: challenge.id }, data: { attempts: { increment: 1 } } });
      return { ok: false, message: "Incorrect code." };
    }
    await db.twoFactorChallenge.update({ where: { id: challenge.id }, data: { consumed: true } });
    return { ok: true, userId: challenge.userId };
  },

  // Poll target for the client while it's waiting on a button tap instead
  // of (or alongside) typed-code entry.
  async pollChallenge(challengeToken: string): Promise<{ status: "PENDING" | "APPROVED" | "DENIED" | "EXPIRED" }> {
    const challenge = await db.twoFactorChallenge.findUnique({ where: { id: challengeToken } });
    if (!challenge) return { status: "EXPIRED" };
    if (challenge.decision === "APPROVED") return { status: "APPROVED" };
    if (challenge.decision === "DENIED") return { status: "DENIED" };
    if (challenge.consumed || challenge.expiresAt < new Date()) return { status: "EXPIRED" };
    return { status: "PENDING" };
  },

  // Called from the Telegram callback handler when the user taps
  // Approve/Deny on the login-verification DM.
  async decideChallenge(challengeId: string, telegramId: string, decision: "APPROVED" | "DENIED"): Promise<{ ok: boolean; message: string }> {
    const challenge = await db.twoFactorChallenge.findUnique({ where: { id: challengeId } });
    if (!challenge) return { ok: false, message: "This verification request no longer exists." };
    const linked = await this.getLinkedTelegramUser(challenge.userId);
    if (!linked || linked.telegramId !== telegramId) {
      return { ok: false, message: "This verification request doesn't belong to your account." };
    }
    if (challenge.consumed || challenge.expiresAt < new Date()) {
      return { ok: false, message: "This verification request has expired." };
    }
    if (challenge.decision) {
      return { ok: false, message: `Already marked as ${challenge.decision.toLowerCase()}.` };
    }
    await db.twoFactorChallenge.update({
      where: { id: challengeId },
      data: { decision, decidedAt: new Date() },
    });
    if (decision === "DENIED") {
      await this.notifyBruteForceAttempt(challenge.userId, challenge.ipAddress ?? undefined, true);
    }
    return {
      ok: true,
      message: decision === "APPROVED"
        ? "✅ Login approved. You can return to the app — it will continue automatically."
        : "🚫 Login blocked. That sign-in attempt has been stopped.",
    };
  },

  // Best-effort personal security alert to the account owner's Telegram DM.
  // Respects the user's mute preference — but is only used for "FYI"
  // notifications (login/logout/failed-attempt/lockout/2FA-toggle), never
  // for the verification code or approve/deny buttons themselves, which
  // always send via createLoginChallenge()/sendMessage directly.
  async notifySecurityEvent(userId: string, text: string) {
    try {
      const [linked, user] = await Promise.all([
        this.getLinkedTelegramUser(userId),
        db.user.findUnique({ where: { id: userId }, select: { securityNotifyMuted: true } }),
      ]);
      if (!linked || user?.securityNotifyMuted) return;
      await TelegramService.sendMessage(linked.telegramId, text);
    } catch (e) {
      console.error("[TwoFactorService] notifySecurityEvent failed:", e);
    }
  },

  async notifyBruteForceAttempt(userId: string, ipAddress?: string, wasExplicitDeny = false) {
    const suffix = ipAddress ? `\n📍 IP: <code>${ipAddress}</code>` : "";
    await this.notifySecurityEvent(
      userId,
      wasExplicitDeny
        ? `🚫 <b>Login attempt blocked</b>\nYou marked a login attempt as "Not me."${suffix}\n\nIf you don't recognize this, consider changing your password.`
        : `🚨 <b>Suspicious activity</b>\nToo many incorrect verification codes were entered for your account.${suffix}\n\nIf this wasn't you, consider changing your password.`,
    );
  },
};

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

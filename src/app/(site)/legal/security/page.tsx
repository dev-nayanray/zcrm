import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ShieldCheck, KeyRound, Lock, FileLock, Webhook, UserX, EyeOff, Gauge } from "lucide-react";
import { PageHero } from "@/components/site/PageHero";
import { Section, SectionHeader } from "@/components/site/Section";
import { CTASection } from "@/components/site/CTASection";
import { SITE } from "@/lib/site-content";

export const metadata: Metadata = {
  title: "Security — How Z-CRM protects your data",
  description:
    "Z-CRM's security posture: HMAC-signed sessions, PBKDF2-600k password hashing, 60+ permissions RBAC, immutable audit logs, signed webhooks, rate limiting, encryption, and vulnerability reporting.",
  alternates: { canonical: "https://z-crm.app/legal/security" },
};

const LAST_UPDATED = "August 26, 2026";

const SECURITY_PILLARS = [
  {
    icon: "KeyRound",
    title: "HMAC-Signed Sessions",
    description:
      "Session cookies are HMAC-SHA256 signed with a 32+ character secret. Tamper-proof and verifiable server-side — a forged cookie is rejected before reaching any business logic.",
    points: [
      "HttpOnly + Secure + SameSite=Strict flags on every session cookie",
      "Cookie is opaque to JavaScript — XSS cannot exfiltrate it",
      "Server validates HMAC on every request before rehydrating the user",
      "Session secret rotated quarterly; old sessions invalidated on rotation",
    ],
  },
  {
    icon: "Lock",
    title: "PBKDF2-600k Password Hashing",
    description:
      "Passwords hashed with PBKDF2-SHA256 at 600,000 iterations (OWASP 2023 recommendation), with a unique 16-byte random salt per hash. We never store plaintext passwords.",
    points: [
      "Per-hash random 16-byte salt — rainbow tables are useless against our hashes",
      "600,000 iterations — ~600ms per verification on modern hardware, tolerable for users",
      "Transparent rehashing: legacy 100k hashes are upgraded to 600k on next successful login",
      "Password reset tokens are single-use, expire in 60 minutes, and are hashed at rest",
    ],
  },
  {
    icon: "ShieldCheck",
    title: "Server-Side RBAC with 60+ Permissions",
    description:
      "6 system roles (SUPER_ADMIN, ADMIN, MANAGER, SALES, INVENTORY, ACCOUNTANT) with 60+ granular permissions. Every API route enforces permissions server-side — no client-side bypass is possible.",
    points: [
      "Permission checks at the route handler, not in middleware — defense in depth",
      "Custom roles supported: create any subset of the 60+ permissions and assign to users",
      "Last-super-admin guard: prevents demoting or deleting the last super-admin (no lockout)",
      "ADMIN role cannot create or modify SUPER_ADMIN users — only SUPER_ADMIN can",
    ],
  },
  {
    icon: "FileLock",
    title: "Immutable Audit Logs",
    description:
      "Every mutation is logged inside the same database transaction as the change. The audit log table has no update or delete API — append-only by design.",
    points: [
      "Logs include userId, action, entityId, before/after diff, IP address, and user agent",
      "Recorded inside the transaction — if the change rolls back, the log rolls back too",
      "No update or delete API: even a SUPER_ADMIN cannot rewrite history",
      "Retained for 7 years for compliance with Bangladesh financial record-keeping requirements",
    ],
  },
  {
    icon: "Webhook",
    title: "HMAC-Signed Inbound Webhooks",
    description:
      "All inbound webhooks from Meta (Facebook/Instagram), WhatsApp Business Cloud API, Telegram, and WooCommerce are verified with HMAC signatures. Unsigned POSTs are rejected with 401 Unauthorized.",
    points: [
      "Meta + WhatsApp: X-Hub-Signature-256 verified with HMAC-SHA256 against the connection's appSecret",
      "Telegram: X-Telegram-Bot-Api-Secret-Token verified against the configured webhook secret",
      "WooCommerce: HMAC-SHA256 (base64) verified against the per-store webhook secret",
      "Idempotent processing: duplicate deliveries deduplicated by (provider, eventId)",
    ],
  },
  {
    icon: "Gauge",
    title: "Rate Limiting and Brute-Force Defense",
    description:
      "Per-IP rate limits on authentication endpoints, timing-equalized user lookups, and decoy password hashes mitigate enumeration and brute-force attacks.",
    points: [
      "Login: 10 attempts per IP per minute; persistent abusers are auto-throttled",
      "Registration: 5 per IP per hour; honeypot field rejects bots automatically",
      "Timing-equalized user-not-found vs wrong-password responses (no email enumeration)",
      "Decoy password hash for non-existent users: timing matches the real verification path",
    ],
  },
  {
    icon: "EyeOff",
    title: "Token and Secret Masking",
    description:
      "Access tokens, app secrets, and webhook secrets are never returned to the client. Only masked previews (last 4 characters) are visible in the UI.",
    points: [
      "Meta and WhatsApp app secrets are stored server-side and never exposed via API",
      "WooCommerce API keys returned only at connection time; subsequent reads return masked",
      "Token rotation supported in Settings → Integrations → Rotate Token",
      "Audit logs record which user rotated which secret, but never the secret itself",
    ],
  },
  {
    icon: "UserX",
    title: "Account Protection Guards",
    description:
      "Last-super-admin guard prevents lockout; password change requires the current password; password is redacted from audit log entries (stored as '[REDACTED]').",
    points: [
      "PUT /auth/me requires currentPassword to change password (mitigates session-hijack takeover)",
      "Audit log records '[REDACTED]' instead of cleartext passwords (no sensitive data exposure)",
      "Bootstrap policy: once any user exists, new registrations require an admin-issued invite token",
      "Failed login attempts logged to audit log with IP and user agent for forensic review",
    ],
  },
];

const SECTIONS = [
  {
    id: "overview",
    heading: "1. Overview",
    body: [
      `Security is the foundation of Z-CRM — not a feature. We built the Service with a security-first mindset, layering defense in depth across authentication, authorization, audit logging, webhook verification, transport encryption, and operational practices.`,
      `This page documents our security posture so you can evaluate Z-CRM for your business, security review, or compliance assessment. If anything is unclear or you need additional information, contact security@z-crm.app.`,
    ],
  },
  {
    id: "authentication",
    heading: "2. Authentication",
    body: [
      `User authentication in Z-CRM is based on HMAC-signed session cookies combined with PBKDF2 password hashing — both industry best practices.`,
    ],
    bullets: [
      `Session cookies: HMAC-SHA256 signed with a 32+ character AUTH_SECRET. The secret is required to be at least 32 characters in production; in development, a per-process secret is generated. Without the secret, no cookie can be forged.`,
      `Cookie flags: HttpOnly (not readable by JavaScript), Secure (only over HTTPS), SameSite=Strict (not sent on third-party requests).`,
      `Password hashing: PBKDF2-SHA256 at 600,000 iterations (OWASP 2023), with a unique 16-byte random salt per hash. Old 100k-iteration hashes are transparently rehashed on next successful login.`,
      `Password verification: verifyPassword validates the salt and iteration count before comparing, rejecting manipulated hashes.`,
      `Password reset: single-use tokens, hashed at rest, expire in 60 minutes, and are immediately invalidated after use.`,
      `Password change: requires the current password to be supplied (PUT /auth/me), mitigating session-hijack → account-takeover.`,
    ],
  },
  {
    id: "authorization",
    heading: "3. Authorization (RBAC)",
    body: [
      `Z-CRM ships with 6 system roles and 60+ granular permissions. Every API route enforces permissions server-side — there is no client-side bypass.`,
    ],
    bullets: [
      `System roles: SUPER_ADMIN, ADMIN, MANAGER, SALES, INVENTORY, ACCOUNTANT. Each has a curated permission set.`,
      `Custom roles: create any subset of the 60+ permissions and assign to users — perfect for segregation-of-duties in finance teams.`,
      `Permission checks: enforced at the route handler, not in middleware, so each route validates the exact permission it needs.`,
      `Last-super-admin guard: prevents demoting or deleting the last SUPER_ADMIN, so you cannot lock yourself out.`,
      `ADMIN cannot create or modify SUPER_ADMIN users — only SUPER_ADMIN can.`,
      `Password redaction: audit logs record '[REDACTED]' instead of cleartext passwords when a user's password is changed.`,
    ],
  },
  {
    id: "audit-logs",
    heading: "4. Audit Logs",
    body: [
      `Every state-changing operation in Z-CRM is recorded in an immutable audit log. The audit log is the foundation of accountability for a business system handling money.`,
    ],
    bullets: [
      `Append-only: the audit table has no update or delete API. Even a SUPER_ADMIN cannot rewrite history.`,
      `Transactional: logs are written inside the same database transaction as the change. If the change rolls back, the log rolls back too — never a "log says yes, data says no" mismatch.`,
      `Detail: each entry records userId, action, entityId, before/after diff, IP address, user agent, and timestamp.`,
      `Coverage: every mutation in orders, inventory, customers, payments, expenses, returns, refunds, suppliers, purchases, cash register, users, roles, integrations, automation rules, and settings.`,
      `Retention: 7 years, in line with Bangladesh financial record-keeping requirements.`,
      `Access: gated behind audit_logs:read permission — typically restricted to ADMIN and SUPER_ADMIN.`,
    ],
  },
  {
    id: "webhooks",
    heading: "5. Webhook Signature Verification",
    body: [
      `All inbound webhooks from third-party integrations are verified with HMAC signatures. Unsigned or incorrectly-signed POSTs are rejected with 401 Unauthorized before any business logic runs.`,
    ],
    bullets: [
      `Meta (Facebook/Instagram): X-Hub-Signature-256 verified with HMAC-SHA256 against the connection's appSecret.`,
      `WhatsApp Business Cloud API: same HMAC-SHA256 verification against the WhatsApp connection's appSecret.`,
      `Telegram: X-Telegram-Bot-Api-Secret-Token verified against the configured webhook secret.`,
      `WooCommerce: HMAC-SHA256 (base64-encoded) verified against the per-store webhook secret using a constant-time comparison.`,
      `Idempotency: Meta, WhatsApp, and Telegram webhooks are deduplicated by (provider, eventId), so a redelivery never double-processes an order or message.`,
      `Raw body: each receiver reads the raw body once and computes the signature before any parsing — preventing signature mismatch on JSON re-serialization.`,
    ],
  },
  {
    id: "rate-limiting",
    heading: "6. Rate Limiting and Brute-Force Defense",
    body: [
      `We apply per-IP rate limits on authentication endpoints and timing-equalize user lookups to mitigate enumeration and brute-force attacks.`,
    ],
    bullets: [
      `Login: 10 attempts per IP per minute via an in-memory token bucket. Persistent abusers are throttled progressively.`,
      `Registration: 5 per IP per hour; honeypot field rejects bots automatically without revealing that they were caught.`,
      `User enumeration defense: user-not-found and wrong-password responses take the same time. A decoy password hash for non-existent users makes timing match the real verification path.`,
      `Failed login logging: every failed attempt is recorded in the audit log with IP and user agent for forensic review.`,
      `Bootstrap policy: once any user exists, new registrations require an admin-issued invite token. This prevents open registration after the first admin is created.`,
    ],
  },
  {
    id: "data-encryption",
    heading: "7. Data Encryption",
    body: [
      `All data in transit and at rest is encrypted to protect confidentiality and integrity.`,
    ],
    bullets: [
      `In transit: TLS 1.2+ for all HTTP traffic. HSTS is enforced with a max-age of 1 year and includes subdomains.`,
      `At rest: AES-256 encryption for production databases, object storage, and backups.`,
      `Database secrets: AUTH_SECRET, payment processor keys, and integration secrets are stored as environment variables on the server — never in the database in plaintext.`,
      `Password reset tokens: hashed at rest using PBKDF2-SHA256.`,
      `Payment data: we never store full card numbers or bKash PINs. Only the last 4 digits and a token from the payment processor are retained.`,
    ],
  },
  {
    id: "operational",
    heading: "8. Operational Security",
    body: [
      `Our engineering and operational practices extend security beyond the code:`,
    ],
    bullets: [
      `Code review: every change is reviewed by at least one other engineer before merge.`,
      `Static analysis: ESLint with strict TypeScript catches common security anti-patterns at build time.`,
      `Dependency scanning: automated scans flag packages with known vulnerabilities (CVEs).`,
      `Backups: encrypted backups taken daily, retained for 30 days, stored in a separate Bangladesh-region facility.`,
      `Incident response: documented incident response plan with roles, escalation paths, and communication templates. On-call engineer reachable 24/7.`,
      `Access control: engineers access production through short-lived credentials with MFA. No standing access to customer data.`,
      `Penetration testing: conducted by an independent third party at least once per year. Findings are remediated within 90 days for high-severity issues.`,
    ],
  },
  {
    id: "vulnerability-reporting",
    heading: "9. Vulnerability Reporting",
    body: [
      `We welcome responsible disclosure of security vulnerabilities. If you believe you have found a security issue in Z-CRM, please report it responsibly:`,
    ],
    bullets: [
      `Email security@z-crm.app with a detailed description of the vulnerability, including reproduction steps.`,
      `Do not access, modify, or destroy data that does not belong to you. Do not degrade service for other customers.`,
      `Provide a reasonable time (at least 90 days) for us to remediate before public disclosure.`,
      `We acknowledge receipt within 48 hours and provide an initial assessment within 5 business days.`,
      `We do not currently offer a bug bounty, but we will publicly credit responsible reporters (with permission) and thank them on our security page.`,
    ],
    bodyAfter: [
      `We do not pursue legal action against reporters who follow responsible disclosure, even if their testing violates our Terms. We do pursue legal action against attackers who access, exfiltrate, or destroy customer data.`,
    ],
  },
  {
    id: "data-subprocessors",
    heading: "10. Sub-Processors and Data Location",
    body: [
      `We host data in a Bangladesh-region cloud environment to keep your business data within Bangladesh where possible. A current list of sub-processors and their processing locations is available at /legal/data-protection.`,
    ],
    bullets: [
      `Primary hosting: Bangladesh-region cloud infrastructure for application servers, databases, and primary backups.`,
      `Email delivery: outbound transactional and marketing email. Email addresses and message content are processed briefly to deliver mail.`,
      `Error monitoring: anonymized error reports and stack traces (with PII scrubbed) to help us diagnose production issues.`,
      `Payment processing: bKash, Nagad, and bank card processors. We do not store full card numbers — only the last 4 digits and a token.`,
    ],
  },
  {
    id: "compliance",
    heading: "11. Compliance",
    body: [
      `Z-CRM complies with the following laws and standards:`,
    ],
    bullets: [
      `Bangladesh: Information and Communication Technology (ICT) Act, 2006 (as amended), Cyber Security Act, 2023, Bangladesh Bank guidelines on electronic fund transfers and mobile financial services.`,
      `Proposed Personal Data Protection Act, 2023 (Bangladesh, in draft): we follow the draft law's core principles ahead of enactment.`,
      `GDPR (EU, UK, Switzerland): we act as a data processor for Business Data and a data controller for account/billing data. DPA available on request.`,
      `CCPA/CPRA (California): cookies are not "sold" or "shared" as defined under California law.`,
      `PCI DSS: payment card data is handled by PCI-DSS-compliant processors. We never store full card numbers.`,
    ],
  },
  {
    id: "security-contact",
    heading: "12. Security Contact",
    body: [
      `For security-related questions, vulnerability reports, or compliance inquiries:`,
    ],
    bullets: [
      `Security email: security@z-crm.app (PGP key fingerprint available on request)`,
      `Data Protection Officer (DPO): dpo@z-crm.app — see /legal/data-protection for full contact details`,
      `Privacy: privacy@z-crm.app — see /legal/privacy`,
      `Mail: ${SITE.address}`,
    ],
    bodyAfter: [
      `For urgent security incidents affecting production, mark your email subject with "URGENT — SECURITY" and we will respond within 4 hours (24/7).`,
    ],
  },
];

export default function SecurityPage() {
  return (
    <>
      <PageHero
        eyebrow="Security"
        title="How Z-CRM protects your data"
        description="A transparent overview of our security posture — authentication, authorization, audit logging, webhooks, encryption, and operational practices. Security is the foundation, not a feature."
        breadcrumbs={[{ label: "Legal" }, { label: "Security" }]}
      />

      {/* Security pillars grid */}
      <Section className="pt-0">
        <SectionHeader
          eyebrow="Security pillars"
          title="Defense in depth, layer by layer"
          description="Each pillar is described in detail in the sections below — this grid is a quick visual overview."
          align="left"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          {SECURITY_PILLARS.map((p) => {
            const Icon = ({ ShieldCheck, KeyRound, Lock, FileLock, Webhook, UserX, EyeOff, Gauge } as Record<string, React.ComponentType<{ className?: string }>>)[p.icon];
            return (
              <div key={p.title} className="rounded-2xl border border-border/60 bg-card p-5 card-hover">
                <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-3">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-sm mb-1.5">{p.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{p.description}</p>
              </div>
            );
          })}
        </div>
      </Section>

      <Section className="pt-0">
        <article className="max-w-3xl mx-auto">
          {/* Last updated + table of contents */}
          <div className="mb-8 pb-6 border-b border-border/40">
            <p className="text-xs text-muted-foreground mb-4">
              Last updated: <span className="font-medium text-foreground">{LAST_UPDATED}</span>
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              This security overview is part of our legal documentation. For data processing specifics, see our{" "}
              <Link href="/legal/data-protection" className="text-primary font-medium hover:underline">
                Data Processing page
              </Link>
              . For questions, email{" "}
              <a href="mailto:security@z-crm.app" className="text-primary font-medium hover:underline">
                security@z-crm.app
              </a>
              .
            </p>
            <details className="group rounded-xl border border-border/60 bg-muted/20 p-3">
              <summary className="text-sm font-medium cursor-pointer flex items-center justify-between">
                <span>Table of contents</span>
                <ArrowRight className="h-4 w-4 group-open:rotate-90 transition-transform" />
              </summary>
              <ol className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {SECTIONS.map((s) => (
                  <li key={s.id}>
                    <a
                      href={`#${s.id}`}
                      className="block text-xs text-muted-foreground hover:text-primary transition-colors"
                    >
                      {s.heading}
                    </a>
                  </li>
                ))}
              </ol>
            </details>
          </div>

          {/* Sections */}
          <div className="space-y-10">
            {SECTIONS.map((section) => (
              <section key={section.id} id={section.id} className="scroll-mt-24">
                <h2 className="text-xl font-bold tracking-tight mb-4">{section.heading}</h2>
                {section.body.map((p, i) => (
                  <p key={i} className="text-sm text-muted-foreground leading-relaxed mb-3">
                    {p}
                  </p>
                ))}
                {section.bullets && (
                  <ul className="space-y-2 mb-3 pl-1">
                    {section.bullets.map((b, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground leading-relaxed">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary/50 shrink-0 mt-2" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {section.bodyAfter?.map((p, i) => (
                  <p key={i} className="text-sm text-muted-foreground leading-relaxed">
                    {p}
                  </p>
                ))}
              </section>
            ))}
          </div>

          {/* Footer of article */}
          <div className="mt-10 pt-6 border-t border-border/40 text-xs text-muted-foreground">
            Security questions?{" "}
            <Link href="/contact" className="text-primary font-medium hover:underline">
              Contact us
            </Link>{" "}
            or read our{" "}
            <Link href="/legal/privacy" className="text-primary font-medium hover:underline">
              Privacy Policy
            </Link>{" "}
            and{" "}
            <Link href="/legal/data-protection" className="text-primary font-medium hover:underline">
              Data Processing page
            </Link>
            .
          </div>
        </article>
      </Section>

      <CTASection
        title="Built secure, by design"
        subtitle="Start your 7-day free trial. No credit card required. Security-first from day one."
        secondaryCTA="View pricing"
        secondaryHref="/pricing"
      />
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageHero } from "@/components/site/PageHero";
import { Section } from "@/components/site/Section";
import { CTASection } from "@/components/site/CTASection";
import { SITE } from "@/lib/site-content";

export const metadata: Metadata = {
  title: "Cookie Policy — How Z-CRM uses cookies",
  description:
    "Z-CRM's Cookie Policy: what cookies are, the types we use (essential, analytics, preference), managing cookies, third-party cookies, and updates.",
  alternates: { canonical: "https://z-crm.app/legal/cookies" },
};

const LAST_UPDATED = "August 26, 2026";

const COOKIE_TYPES = [
  {
    id: "essential",
    name: "Essential cookies",
    purpose: "Required for the Service to function. Without these, login, security, and core features would not work.",
    canDisable: false,
    examples: [
      { name: "zcrm_session", purpose: "HMAC-signed session identifier", duration: "Session" },
      { name: "zcsrftoken", purpose: "Cross-site request forgery protection", duration: "Session" },
      { name: "zcrm_locale", purpose: "Stores your language preference (English/Bangla)", duration: "1 year" },
    ],
  },
  {
    id: "analytics",
    name: "Analytics cookies",
    purpose: "Anonymized usage data to help us improve the Service. We do not use cookies for cross-site advertising.",
    canDisable: true,
    examples: [
      { name: "zcrm_anon_id", purpose: "Random anonymous identifier for aggregate analytics", duration: "2 years" },
      { name: "zutm_source", purpose: "Records how you arrived at our site (for first-visit attribution only)", duration: "30 days" },
    ],
  },
  {
    id: "preference",
    name: "Preference cookies",
    purpose: "Remember your settings — theme, last-used filters, table layouts, and other UI preferences.",
    canDisable: true,
    examples: [
      { name: "ztheme", purpose: "Stores your light/dark theme preference", duration: "1 year" },
      { name: "zcrm_filters", purpose: "Stores your last-used list filters (e.g. order status)", duration: "30 days" },
      { name: "zconsent", purpose: "Records your cookie consent decision", duration: "1 year" },
    ],
  },
];

const SECTIONS = [
  {
    id: "what-are-cookies",
    heading: "1. What Are Cookies",
    body: [
      `Cookies are small text files (typically a few hundred bytes) that websites place on your device when you visit them. They are widely used to make websites work efficiently and to provide information to the site owner.`,
      `Cookies serve several purposes: keeping you signed in, remembering your preferences, understanding how the site is used, and providing security features such as cross-site request forgery (CSRF) protection.`,
      `Cookies are not programs and cannot execute code on your device. They cannot read files on your hard drive, capture email addresses, or transmit viruses. Each cookie is specific to a single domain — a cookie set by z-crm.app cannot be read by another website.`,
      `In addition to cookies, we may use similar technologies — including local storage and session storage in your browser, and pixel tags (clear GIFs) in emails — for the same purposes described in this policy.`,
    ],
  },
  {
    id: "types-we-use",
    heading: "2. Types of Cookies We Use",
    body: [
      `We use three categories of cookies on z-crm.app and in the Service:`,
    ],
    bullets: [
      `Essential: strictly necessary for login, security, and core functionality. These cannot be disabled — without them, the Service would not work.`,
      `Analytics: anonymized aggregate usage data to help us improve the Service. These can be disabled without affecting functionality.`,
      `Preference: remember your theme, language, and UI settings. These can be disabled; you'll need to re-enter preferences on each visit.`,
    ],
    bodyAfter: [
      `We do not use cookies for cross-site advertising, retargeting, or sale to third parties. We do not work with advertising networks that combine your browsing data across sites.`,
    ],
  },
  {
    id: "essential-detail",
    heading: "3. Essential Cookies — In Detail",
    body: [
      `Essential cookies are set automatically when you visit z-crm.app or sign in to the Service. They include:`,
    ],
    bullets: [
      `zcrm_session: a tamper-proof HMAC-SHA256 signed session identifier. Without this cookie, you cannot stay signed in across page loads. The cookie is marked HttpOnly (not readable by JavaScript) and SameSite=Strict (not sent on third-party requests).`,
      `zcsrftoken: protects against cross-site request forgery. The token is set on first visit and verified against a server-side store on every state-changing request (POST, PUT, PATCH, DELETE).`,
      `zcrm_locale: stores your language preference (English or Bangla). Set after you choose a language and retained for 1 year to avoid re-prompting.`,
    ],
    bodyAfter: [
      `Essential cookies are not subject to consent — they are required for the Service to function securely. They are automatically deleted when you sign out (session cookies) or after a defined period (persistent cookies).`,
    ],
  },
  {
    id: "analytics-detail",
    heading: "4. Analytics Cookies — In Detail",
    body: [
      `Analytics cookies collect anonymized data about how you use the Service. This helps us understand which features are used, where users encounter errors, and how to improve the product. We do not use cookies to identify you individually.`,
    ],
    bullets: [
      `zcrm_anon_id: a random, opaque identifier generated when you first visit. It is not linked to your account email or any personal identifier. We use it only to count unique sessions in aggregate.`,
      `zutm_source, zutm_medium, zutm_campaign: optional first-visit attribution parameters. We store these for 30 days so we know which marketing channel brought you to us. We do not share this data with advertising networks.`,
    ],
    bodyAfter: [
      `Analytics cookies can be disabled in your browser settings or via our cookie banner. Disabling them does not affect the Service — you simply will not be counted in our aggregate analytics.`,
    ],
  },
  {
    id: "preference-detail",
    heading: "5. Preference Cookies — In Detail",
    body: [
      `Preference cookies remember your settings between visits. They include:`,
    ],
    bullets: [
      `ztheme: stores your light/dark theme preference, applied automatically on next visit.`,
      `zcrm_filters: stores your last-used list filters (e.g. order status, date range) so the same filter is applied when you return.`,
      `zconsent: records your cookie consent decision (which categories you have enabled). We check this cookie before setting non-essential cookies.`,
    ],
    bodyAfter: [
      `If you disable preference cookies, you will need to re-enter your theme, language, and filter settings on each visit. The Service will still function — your experience will simply be less personalized.`,
    ],
  },
  {
    id: "third-party",
    heading: "6. Third-Party Cookies",
    body: [
      `We use a small number of trusted third-party services that may set their own cookies when you interact with them. We do not control these cookies — they are governed by the respective provider's privacy policy.`,
    ],
    bullets: [
      `Payment processors (bKash, Nagad, bank card gateways): when you complete a payment, you may be redirected to the provider's domain, where they may set cookies for fraud detection and session continuity. We never receive your full card number or bKash PIN.`,
      `Integration providers (WooCommerce, WhatsApp, Facebook, Telegram): when you connect an integration, you may be redirected to the provider's domain to authorize the connection. The provider may set cookies during that flow.`,
      `Email delivery (used to send transactional emails): may use tracking pixels in emails to detect whether an email was opened. This is used solely for deliverability and is disabled for users who opt out in their profile settings.`,
    ],
    bodyAfter: [
      `We do not embed third-party advertising widgets, social media "like" buttons, or other trackers on our marketing pages. The third-party cookies listed above only activate when you explicitly use those services.`,
    ],
  },
  {
    id: "manage-cookies",
    heading: "7. Managing and Disabling Cookies",
    body: [
      `You have full control over cookies. Here are the main options:`,
    ],
    bullets: [
      `Cookie banner: on your first visit, we show a banner asking for your consent for analytics and preference cookies. You can accept all, accept only essential, or customize. Your choice is stored in the zconsent cookie for 1 year.`,
      `Cookie settings page: navigate to Settings → Privacy → Cookie Preferences in the Service to change your consent at any time.`,
      `Browser settings: all modern browsers let you view, delete, and block cookies. Use the help menu in your browser to find these settings. Blocking essential cookies will prevent you from signing in.`,
      `Incognito/private mode: opens a session without storing cookies. When you close the private window, all cookies from that session are deleted.`,
      `Opt out of email tracking: in your profile settings, uncheck "Allow email engagement tracking" to disable tracking pixels in transactional and marketing emails.`,
    ],
    bodyAfter: [
      `If you disable essential cookies, you will not be able to sign in to the Service. Disabling analytics and preference cookies does not affect core functionality.`,
    ],
  },
  {
    id: "cookie-storage",
    heading: "8. Cookie Storage and Security",
    body: [
      `All cookies set by Z-CRM are marked with the following security flags:`,
    ],
    bullets: [
      `HttpOnly: the cookie cannot be read by JavaScript, mitigating cross-site scripting (XSS) attacks.`,
      `Secure: the cookie is only sent over HTTPS, preventing interception on insecure connections.`,
      `SameSite=Strict (essential) or SameSite=Lax (preference): protects against cross-site request forgery (CSRF).`,
      `Encrypted in transit: all cookies travel over TLS 1.2+ connections.`,
    ],
    bodyAfter: [
      `We never store passwords, payment card numbers, or other sensitive data in cookies. Authentication is handled server-side using HMAC-signed session identifiers.`,
    ],
  },
  {
    id: "bangladesh-compliance",
    heading: "9. Bangladesh Compliance",
    body: [
      `Under the Information and Communication Technology (ICT) Act, 2006 (as amended) and the proposed Personal Data Protection Act, 2023 (currently in draft), website operators in Bangladesh must obtain informed consent before setting non-essential cookies.`,
      `We comply by:`,
    ],
    bullets: [
      `Showing a clear cookie banner on first visit, with options to accept all, accept essential only, or customize.`,
      `Providing detailed information about each cookie, including its purpose, duration, and whether it is essential.`,
      `Allowing you to withdraw consent at any time via Settings → Privacy → Cookie Preferences.`,
      `Not using cookies for cross-site advertising or selling cookie data to third parties.`,
    ],
  },
  {
    id: "international",
    heading: "10. International Users",
    body: [
      `For users in the European Economic Area, United Kingdom, and Switzerland, we comply with the General Data Protection Regulation (GDPR) and the UK GDPR. Consent is requested before setting any non-essential cookies, and you can withdraw consent at any time.`,
      `For users in California (USA), we comply with the California Consumer Privacy Act (CCPA) and the California Privacy Rights Act (CPRA). Cookies are not "sold" or "shared" as those terms are defined under California law.`,
    ],
  },
  {
    id: "updates",
    heading: "11. Updates to This Policy",
    body: [
      `We may update this Cookie Policy from time to time — for example, when we add new features that use cookies, when we change our sub-processors, or when Bangladesh law changes.`,
      `For material changes, we will notify you by email and via an in-app announcement at least 30 days before the changes take effect. We will also update the "Last updated" date at the top of this page.`,
      `Continued use of the Service after changes take effect constitutes acceptance of the updated policy. If you do not agree, you can manage or disable cookies as described in Section 7.`,
    ],
  },
  {
    id: "contact",
    heading: "12. Contact Us",
    body: [
      `If you have questions about this Cookie Policy or how we use cookies, please contact us:`,
    ],
    bullets: [
      `By email: privacy@z-crm.app`,
      `By mail: ${SITE.address}`,
      `For technical questions about cookie implementation: security@z-crm.app`,
    ],
  },
];

export default function CookiesPage() {
  return (
    <>
      <PageHero
        eyebrow="Cookie Policy"
        title="How Z-CRM uses cookies"
        description="What cookies are, the types we use (essential, analytics, preference), how to manage them, third-party cookies, and your choices under Bangladesh and international law."
        breadcrumbs={[{ label: "Legal" }, { label: "Cookies" }]}
      />

      {/* Cookie types summary table */}
      <Section className="pt-0">
        <div className="max-w-3xl mx-auto">
          <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border/40 bg-muted/30">
              <h2 className="text-sm font-semibold">Cookies we set, at a glance</h2>
              <p className="text-xs text-muted-foreground mt-0.5">A summary of each cookie type — see sections below for detail.</p>
            </div>
            <div className="divide-y divide-border/20">
              {COOKIE_TYPES.map((ct) => (
                <div key={ct.id} className="p-4">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <h3 className="text-sm font-semibold">{ct.name}</h3>
                    <span
                      className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                        ct.canDisable
                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                          : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                      }`}
                    >
                      {ct.canDisable ? "Optional" : "Required"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-3">{ct.purpose}</p>
                  <ul className="space-y-1.5">
                    {ct.examples.map((ex) => (
                      <li key={ex.name} className="flex items-center gap-2 text-xs">
                        <code className="font-mono text-primary bg-primary/5 border border-primary/10 px-1.5 py-0.5 rounded text-[10px]">
                          {ex.name}
                        </code>
                        <span className="text-muted-foreground flex-1">{ex.purpose}</span>
                        <span className="text-muted-foreground text-[10px] shrink-0">{ex.duration}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
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
              This Cookie Policy forms part of our{" "}
              <Link href="/legal/privacy" className="text-primary font-medium hover:underline">
                Privacy Policy
              </Link>
              . For questions, email{" "}
              <a href="mailto:privacy@z-crm.app" className="text-primary font-medium hover:underline">
                privacy@z-crm.app
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
            Questions about cookies?{" "}
            <Link href="/contact" className="text-primary font-medium hover:underline">
              Contact us
            </Link>{" "}
            or read our{" "}
            <Link href="/legal/privacy" className="text-primary font-medium hover:underline">
              Privacy Policy
            </Link>{" "}
            and{" "}
            <Link href="/legal/security" className="text-primary font-medium hover:underline">
              Security overview
            </Link>
            .
          </div>
        </article>
      </Section>

      <CTASection
        title="Your data is safe with Z-CRM"
        subtitle="Start your 7-day free trial. No credit card required. Manage cookies anytime in Settings."
        secondaryCTA="View security overview"
        secondaryHref="/legal/security"
      />
    </>
  );
}

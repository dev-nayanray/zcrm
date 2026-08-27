import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageHero } from "@/components/site/PageHero";
import { Section } from "@/components/site/Section";
import { CTASection } from "@/components/site/CTASection";
import { SITE } from "@/lib/site-content";

export const metadata: Metadata = {
  title: "Privacy Policy — How Z-CRM handles your data",
  description:
    "Z-CRM's Privacy Policy: what information we collect, how we use it, data retention, sharing, your rights, cookies, and Bangladesh data protection compliance.",
  alternates: { canonical: "https://z-crm.app/legal/privacy" },
};

const LAST_UPDATED = "August 26, 2026";

const SECTIONS = [
  {
    id: "introduction",
    heading: "1. Introduction",
    body: [
      `Z-CRM (the "Service") is operated by Z-CRM (the "Company", "we", or "us"), a Bangladesh-based business management software provider headquartered in ${SITE.address}. This Privacy Policy explains how we collect, use, store, share, and protect personal information when you use our website, mobile applications, and the Z-CRM omnichannel business management suite.`,
      `By using Z-CRM, you consent to the practices described in this Privacy Policy. If you do not agree with these practices, please do not use the Service. This policy applies to all users — owners of business accounts, invited team members, and end customers whose data is processed on behalf of business accounts.`,
      `This Privacy Policy should be read alongside our Terms & Conditions, Cookie Policy, and Data Processing Addendum, which are available at /legal/terms, /legal/cookies, and /legal/data-protection respectively.`,
    ],
  },
  {
    id: "information-we-collect",
    heading: "2. Information We Collect",
    body: [
      `We collect information that you provide directly, information collected automatically when you use the Service, and information from third-party integrations you connect.`,
    ],
    bullets: [
      `Account information: your name, email address, phone number, business name, business address, and a password (stored as a PBKDF2-SHA256 hash at 600,000 iterations — never in plaintext).`,
      `Billing information: your subscription plan, payment method (bKash, Nagad, bank card, or wallet), transaction references, and invoice history. We do not store full card numbers — only the last 4 digits and a token from your payment processor.`,
      `Business data: orders, customers, products, suppliers, inventory movements, payments, expenses, and other records you or your team enter into Z-CRM. This data is processed on your behalf as the business owner — you are the data controller and Z-CRM is the data processor.`,
      `Usage data: pages viewed, features used, session duration, IP address, browser type, and device identifiers. We use this for security (rate limiting, audit logs) and product analytics.`,
      `Integration data: when you connect WooCommerce, WhatsApp Business Cloud API, Meta (Facebook/Instagram), Telegram, Pathao, Steadfast, RedX, bKash, or Nagad, we receive and process data from those providers as needed to deliver the integration.`,
      `Communications: emails, chat messages, and support tickets you send us, and our responses.`,
    ],
  },
  {
    id: "how-we-use-information",
    heading: "3. How We Use Your Information",
    body: [
      `We use the information we collect for the following purposes:`,
    ],
    bullets: [
      `To provide, operate, and maintain the Service — including processing orders, syncing inventory, generating reports, and routing notifications.`,
      `To authenticate users, enforce role-based access control (RBAC with 60+ permissions across 6 system roles), and maintain immutable audit logs of every mutation.`,
      `To process subscription payments, issue invoices, and reconcile wallet balances and payouts.`,
      `To communicate with you about your account, security alerts, billing issues, and important product changes (e.g. new versions, downtime, or policy updates).`,
      `To detect, prevent, and respond to fraud, abuse, security incidents, and violations of our Terms.`,
      `To analyze and improve the Service — for example, by understanding which features are most used and where users encounter errors.`,
      `To comply with legal obligations under Bangladesh law, including the Information and Communication Technology (ICT) Act, 2006 (as amended), and the Bangladesh Bank guidelines on electronic transactions.`,
    ],
  },
  {
    id: "legal-basis",
    heading: "4. Legal Basis for Processing",
    body: [
      `Where required by applicable data protection law, we process your personal information on the following legal bases:`,
    ],
    bullets: [
      `Performance of a contract: to deliver the Service you have subscribed to under our Terms & Conditions.`,
      `Consent: where you have provided explicit consent — for example, to receive marketing emails or to use optional analytics cookies. You can withdraw consent at any time.`,
      `Legal obligation: to comply with Bangladesh law, regulatory requests, or court orders.`,
      `Legitimate interests: to detect fraud, secure the Service, and exercise our legal rights, provided those interests are not overridden by your privacy rights.`,
    ],
  },
  {
    id: "data-retention",
    heading: "5. Data Retention",
    body: [
      `We retain your personal information for as long as your account is active and for a limited period thereafter, as described below.`,
    ],
    bullets: [
      `Active accounts: all data is retained while your subscription is active, including the 7-day free trial.`,
      `Cancelled accounts: we retain business data (orders, customers, inventory, reports) for 90 days after cancellation to allow for reactivation and final export. After 90 days, all business data is permanently deleted from production databases and backups within an additional 30 days.`,
      `Audit logs: retained for a minimum of 7 years for compliance and fraud detection, in line with Bangladesh financial record-keeping requirements.`,
      `Billing records: retained for 7 years to comply with tax and accounting regulations in Bangladesh.`,
      `Marketing data: email subscribers who unsubscribe are removed from marketing lists within 7 days, except where retention is required by law.`,
    ],
  },
  {
    id: "sharing",
    heading: "6. Sharing With Third Parties",
    body: [
      `We do not sell your personal information. We share information only in the following circumstances:`,
    ],
    bullets: [
      `Sub-processors: we use trusted third-party service providers for hosting, database storage, email delivery, payment processing, and error monitoring. Each sub-processor is bound by a Data Processing Addendum and limited to processing data only on our instructions. A current list is available at /legal/data-protection.`,
      `Integrations you connect: when you link WooCommerce, WhatsApp, Meta, Telegram, Pathao, Steadfast, RedX, bKash, or Nagad, data flows between Z-CRM and that provider according to your configuration and the provider's terms.`,
      `Legal compliance: we may disclose information when required by Bangladesh law, court order, or government regulation, or to respond to lawful requests from public authorities.`,
      `Business transfers: in the event of a merger, acquisition, or asset sale, customer information may be transferred subject to the protections described in this policy.`,
      `Consent: with your explicit consent, we may share information with third parties you authorize (e.g. your accountant or a partner).`,
    ],
  },
  {
    id: "your-rights",
    heading: "7. Your Privacy Rights",
    body: [
      `Depending on your jurisdiction, you may have the following rights regarding your personal information:`,
    ],
    bullets: [
      `Access: request a copy of the personal information we hold about you.`,
      `Rectification: request correction of inaccurate or incomplete information.`,
      `Erasure: request deletion of your personal information (also known as "right to be forgotten"), subject to legal retention obligations.`,
      `Restriction: request that we limit processing of your information in certain circumstances.`,
      `Portability: receive your personal information in a structured, machine-readable format and transmit it to another service.`,
      `Objection: object to processing based on legitimate interests or for direct marketing.`,
      `Withdraw consent: at any time, without affecting the lawfulness of processing before withdrawal.`,
    ],
    bodyAfter: [
      `To exercise any of these rights, email privacy@z-crm.app from the email address associated with your account. We respond to verified requests within 30 days. We may need to verify your identity before responding.`,
    ],
  },
  {
    id: "cookies",
    heading: "8. Cookies and Tracking Technologies",
    body: [
      `We use cookies and similar tracking technologies to operate and secure the Service. Our cookies fall into three categories: essential (required for login and security), analytics (anonymized, used to improve the product), and preference (remember your settings).`,
      `We do not use cookies for cross-site advertising or sell cookie data to third parties. For details on each cookie we set and how to manage them, see our Cookie Policy at /legal/cookies.`,
    ],
  },
  {
    id: "security",
    heading: "9. Data Security",
    body: [
      `We take a security-first approach to protecting your information. Our security controls include:`,
    ],
    bullets: [
      `HMAC-SHA256 signed session cookies with a 32+ character secret — tamper-proof and verifiable server-side.`,
      `Passwords hashed with PBKDF2-SHA256 at 600,000 iterations (OWASP 2023 recommendation), with a unique 16-byte salt per hash.`,
      `Server-side RBAC enforced on every API route — 60+ granular permissions across 6 system roles, no client-side bypass possible.`,
      `Immutable audit logs — every mutation is logged inside the same transaction; the audit table has no update or delete API.`,
      `HMAC-signed inbound webhooks — all webhooks from Meta, WhatsApp, Telegram, and WooCommerce are verified with HMAC signatures; unsigned POSTs are rejected.`,
      `Rate limiting on authentication endpoints and timing-equalized user lookups to mitigate enumeration attacks.`,
      `Encryption in transit (TLS 1.2+) and at rest (AES-256) for all data stores and backups.`,
      `Last-super-admin guard preventing accidental account lockout, and password masking so access tokens never leave the server.`,
    ],
    bodyAfter: [
      `For a detailed description of our security posture, see our Security page at /legal/security. Despite these measures, no system can be guaranteed 100% secure. In the event of a breach affecting your personal information, we will notify affected users and the relevant Bangladesh authorities within 72 hours of confirmation, in line with best practices.`,
    ],
  },
  {
    id: "bangladesh-compliance",
    heading: "10. Bangladesh Data Protection",
    body: [
      `Z-CRM is incorporated and operated in Bangladesh. We comply with the Information and Communication Technology (ICT) Act, 2006 (as amended in 2013), the Bangladesh Telecommunication Act, 2001, and Bangladesh Bank guidelines on electronic fund transfers and mobile financial services.`,
      `Where the proposed Personal Data Protection Act, 2023 (currently in draft form before the Bangladesh Parliament) introduces additional requirements, we will update this policy and our practices to comply. We already follow the draft law's core principles: lawful and fair processing, purpose limitation, data minimization, accuracy, storage limitation, integrity and confidentiality, and accountability.`,
      `For customers in the European Economic Area, United Kingdom, or Switzerland, we also comply with the General Data Protection Regulation (GDPR) and the UK GDPR. Z-CRM acts as a data processor for business data (orders, customers, inventory) and a data controller for account and billing data.`,
    ],
  },
  {
    id: "international-transfers",
    heading: "11. International Data Transfers",
    body: [
      `We host data in a Bangladesh-region cloud environment to keep your business data within Bangladesh where possible. Certain sub-processors (e.g. email delivery, error monitoring) may process data outside Bangladesh.`,
      `When data is transferred outside Bangladesh, we ensure an adequate level of protection through Standard Contractual Clauses, Binding Corporate Rules, or other mechanisms recognized by Bangladesh law. A current list of sub-processors and their processing locations is available at /legal/data-protection.`,
    ],
  },
  {
    id: "children",
    heading: "12. Children's Privacy",
    body: [
      `Z-CRM is a business-to-business (B2B) service and is not intended for use by individuals under 18. We do not knowingly collect personal information from children under 18. If you believe we have collected such information, please contact privacy@z-crm.app and we will delete it promptly.`,
    ],
  },
  {
    id: "changes",
    heading: "13. Changes to This Policy",
    body: [
      `We may update this Privacy Policy from time to time. When we do, we will revise the "Last updated" date at the top of this page. For material changes (e.g. new data uses, new sub-processors, or changes to your rights), we will notify you by email and via an in-app announcement at least 30 days before the change takes effect.`,
      `We encourage you to review this page periodically to stay informed of any updates. Continued use of the Service after changes take effect constitutes acceptance of the updated policy.`,
    ],
  },
  {
    id: "contact",
    heading: "14. Contact Us",
    body: [
      `If you have questions about this Privacy Policy or wish to exercise your privacy rights, please contact us:`,
    ],
    bullets: [
      `By email: privacy@z-crm.app`,
      `By mail: ${SITE.address}`,
      `For data protection inquiries specifically: see our Data Processing page at /legal/data-protection for our Data Protection Officer's contact information.`,
    ],
  },
];

export default function PrivacyPage() {
  return (
    <>
      <PageHero
        eyebrow="Privacy Policy"
        title="How Z-CRM handles your data"
        description="What information we collect, how we use it, who we share it with, and the rights you have over your personal information."
        breadcrumbs={[{ label: "Legal" }, { label: "Privacy" }]}
      />

      <Section className="pt-0">
        <article className="max-w-3xl mx-auto">
          {/* Last updated + table of contents */}
          <div className="mb-8 pb-6 border-b border-border/40">
            <p className="text-xs text-muted-foreground mb-4">
              Last updated: <span className="font-medium text-foreground">{LAST_UPDATED}</span>
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              This Privacy Policy applies to all users of Z-CRM. If you have questions, email{" "}
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
            Questions about this policy?{" "}
            <Link href="/contact" className="text-primary font-medium hover:underline">
              Contact us
            </Link>{" "}
            or read our{" "}
            <Link href="/legal/data-protection" className="text-primary font-medium hover:underline">
              Data Processing page
            </Link>
            .
          </div>
        </article>
      </Section>

      <CTASection
        title="Run your business with confidence"
        subtitle="Your data is secure with Z-CRM. Start your 7-day free trial today."
        secondaryCTA="Read security overview"
        secondaryHref="/legal/security"
      />
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageHero } from "@/components/site/PageHero";
import { Section } from "@/components/site/Section";
import { CTASection } from "@/components/site/CTASection";
import { SITE } from "@/lib/site-content";

export const metadata: Metadata = {
  title: "Data Processing — DPA and Bangladesh data protection",
  description:
    "Z-CRM's Data Processing Addendum: data controller vs processor, data we process, data subject rights, retention, sub-processors, international transfers, DPA contact, and Bangladesh data protection compliance.",
  alternates: { canonical: "https://z-crm.app/legal/data-protection" },
};

const LAST_UPDATED = "August 26, 2026";

const SUB_PROCESSORS = [
  { name: "Primary cloud hosting (BD-region)", purpose: "Application servers and primary database", location: "Bangladesh", since: "March 2026" },
  { name: "Encrypted backup storage", purpose: "Daily encrypted backups, retained 30 days", location: "Bangladesh (secondary facility)", since: "March 2026" },
  { name: "Transactional email delivery", purpose: "Sends transactional and marketing email on our behalf", location: "Global (EU/US regions)", since: "March 2026" },
  { name: "Error monitoring", purpose: "Anonymized error reports and stack traces (PII scrubbed)", location: "EU region", since: "April 2026" },
  { name: "Payment processor (bKash)", purpose: "Mobile financial service payment processing", location: "Bangladesh", since: "April 2026" },
  { name: "Payment processor (Nagad)", purpose: "Mobile financial service payment processing", location: "Bangladesh", since: "April 2026" },
  { name: "Payment processor (bank cards)", purpose: "Credit/debit card payment processing via PCI-DSS-compliant gateway", location: "Bangladesh + global (card network)", since: "April 2026" },
];

const SECTIONS = [
  {
    id: "introduction",
    heading: "1. Introduction and Scope",
    body: [
      `This Data Processing page forms part of our Terms & Conditions at /legal/terms and our Privacy Policy at /legal/privacy. It describes how Z-CRM processes personal information as a data processor on behalf of business customers ("Customers"), and as a data controller for account and billing information.`,
      `It applies to all Customers using Z-CRM to process personal information about their customers, employees, suppliers, and other contacts — collectively, "End Users".`,
      `This page also functions as our Data Processing Addendum (DPA) for customers who require one for compliance (e.g. GDPR Article 28). To execute a signed DPA, contact dpo@z-crm.app.`,
    ],
  },
  {
    id: "roles",
    heading: "2. Roles: Controller vs Processor",
    body: [
      `Z-CRM plays two distinct roles under data protection law:`,
    ],
    bullets: [
      `Data controller (for account and billing information): when you create a Z-CRM account, we decide what account information to collect (name, email, business name, billing details), why, and how. We are the controller for this data.`,
      `Data processor (for Business Data): when you use Z-CRM to manage orders, customers, inventory, payments, and other records, you decide what data to enter, why, and how. We process this data only on your documented instructions. You are the controller; we are the processor.`,
      `Joint responsibility: for security incident response and legal compliance, both parties may have responsibility, as described in our Terms & Conditions.`,
    ],
    bodyAfter: [
      `This dual role is standard for SaaS business management software. If you have questions about which role applies to a specific data set, contact dpo@z-crm.app.`,
    ],
  },
  {
    id: "data-we-process",
    heading: "3. Data We Process",
    body: [
      `On your behalf as a data processor, we process the following categories of personal information that you enter into Z-CRM:`,
    ],
    bullets: [
      `Customer data: names, phone numbers, email addresses, billing and shipping addresses, order history, payment history, credit limits, and outstanding balances. This is data about YOUR customers — they are End Users under this DPA.`,
      `Supplier data: supplier names, contact persons, phone numbers, email addresses, payment terms, and supplier payment history.`,
      `Team member data: names, email addresses, phone numbers, role assignments, and audit log entries (actions taken, IP address, user agent).`,
      `Lead data: lead names, contact details, source attribution (Meta Lead Ads), and pipeline status.`,
      `Conversation data: messages exchanged with your customers via WhatsApp, Facebook Messenger, and Instagram DMs, including inbound and outbound message content.`,
      `Order and payment data: line items, prices, payment methods (bKash, Nagad, bank card, cash, wallet), transaction references, and refund history.`,
    ],
    bodyAfter: [
      `We do not process special category data (health, religion, political opinion, biometric) unless you intentionally enter it into a custom field. We encourage you not to enter special category data into Z-CRM.`,
    ],
  },
  {
    id: "data-subject-rights",
    heading: "4. Data Subject Rights",
    body: [
      `End Users (your customers, suppliers, team members, and leads) have rights under Bangladesh's proposed Personal Data Protection Act, 2023 (in draft) and similar laws (GDPR for EU/UK users). As the data controller, you are responsible for responding to End User requests.`,
      `Z-CRM supports you in fulfilling these rights:`,
    ],
    bullets: [
      `Access: you can export any End User's data via the relevant module (Customers, Suppliers, Leads, Orders). CSV and JSON export available.`,
      `Rectification: you can edit any End User record directly in the Service.`,
      `Erasure: you can delete an End User record. We soft-delete on first request (recoverable for 30 days) and hard-delete after 30 days. Audit logs are retained for 7 years per Bangladesh law but are anonymized (entityId removed).`,
      `Restriction: you can mark a Customer as inactive (no new orders, no marketing) without deleting them.`,
      `Portability: export End User data in machine-readable CSV or JSON format.`,
      `Objection: you can mark an End User as "do not contact" to prevent outbound marketing via WhatsApp/SMS/Telegram integrations.`,
    ],
    bodyAfter: [
      `If an End User contacts us directly with a data subject request, we will forward it to you (the controller) within 5 business days and provide reasonable assistance to fulfill the request.`,
    ],
  },
  {
    id: "retention",
    heading: "5. Data Retention",
    body: [
      `We retain personal information as follows, in line with our Privacy Policy:`,
    ],
    bullets: [
      `Active subscriptions: all Business Data retained while your subscription is active (including the 7-day free trial).`,
      `Cancelled subscriptions: Business Data retained for 90 days for reactivation and final export, then permanently deleted from production and backups within an additional 30 days.`,
      `Audit logs: retained for 7 years for compliance and fraud detection. After deletion of an End User record, audit log entries are anonymized (entityId removed) but the action and timestamp remain.`,
      `Billing records: retained for 7 years to comply with Bangladesh tax and accounting regulations.`,
      `Backups: encrypted daily backups retained for 30 days. After retention period, backups are overwritten and unrecoverable.`,
    ],
  },
  {
    id: "sub-processors",
    heading: "6. Sub-Processors",
    body: [
      `We use trusted sub-processors to deliver the Service. Each sub-processor is bound by a written agreement that imposes data protection obligations no less protective than those in this DPA.`,
      `Current sub-processors (as of the Last Updated date at the top of this page):`,
    ],
    bullets: SUB_PROCESSORS.map((s) => `${s.name} — ${s.purpose}. Location: ${s.location}. In use since: ${s.since}.`),
    bodyAfter: [
      `We provide at least 30 days' notice (via email and in-app announcement) before engaging a new sub-processor or changing the location of an existing one. You may object to a new sub-processor by notifying dpo@z-crm.app within the notice period — we will work with you to resolve the objection, which may include providing an alternative service or terminating the affected portion of the Service.`,
    ],
  },
  {
    id: "international-transfers",
    heading: "7. International Data Transfers",
    body: [
      `We host your Business Data in a Bangladesh-region cloud environment. Some sub-processors (e.g. transactional email delivery, error monitoring) may process data outside Bangladesh, as listed in Section 6.`,
      `Where data is transferred outside Bangladesh, we ensure an adequate level of protection through:`,
    ],
    bullets: [
      `Standard Contractual Clauses (SCCs) approved by the relevant data protection authority, where applicable.`,
      `Binding Corporate Rules for intra-group transfers, where applicable.`,
      `Additional safeguards: encryption in transit (TLS 1.2+) and at rest (AES-256), data minimization, and purpose limitation.`,
      `Annual review of sub-processor safeguards and transfer mechanisms.`,
    ],
    bodyAfter: [
      `For End Users in the EU, UK, or Switzerland, we comply with the GDPR's restrictions on international transfers. We do not transfer data to jurisdictions deemed "inadequate" by the relevant data protection authority without appropriate additional safeguards.`,
    ],
  },
  {
    id: "security-measures",
    heading: "8. Technical and Organizational Security Measures",
    body: [
      `We implement industry-standard technical and organizational measures to protect personal information. A summary is provided here; full details are available in our Security overview at /legal/security.`,
    ],
    bullets: [
      `Authentication: HMAC-SHA256 signed session cookies, PBKDF2-600k password hashing, rate limiting on auth endpoints, timing-equalized user lookups.`,
      `Authorization: server-side RBAC with 60+ permissions across 6 system roles. No client-side bypass possible.`,
      `Audit logging: append-only, transactional audit logs of every mutation, retained 7 years.`,
      `Webhook verification: HMAC-signed inbound webhooks from Meta, WhatsApp, Telegram, WooCommerce; unsigned POSTs rejected.`,
      `Encryption: TLS 1.2+ in transit, AES-256 at rest.`,
      `Access control: engineers access production via short-lived credentials with MFA. No standing access to customer data.`,
      `Backups: encrypted daily backups retained 30 days, stored in a separate Bangladesh-region facility.`,
      `Incident response: documented IR plan with 24/7 on-call engineer. Breach notification within 72 hours of confirmation.`,
    ],
  },
  {
    id: "breach-notification",
    heading: "9. Personal Data Breach Notification",
    body: [
      `In the event of a personal data breach affecting your Business Data or the personal information of End Users, we will:`,
    ],
    bullets: [
      `Notify you without undue delay and within 72 hours of becoming aware of the breach, via email to the address on your Account and via in-app announcement.`,
      `Provide a description of the breach, the categories and approximate number of records concerned, the likely consequences, and the measures we are taking to mitigate and contain.`,
      `Coordinate with you on any required notification to End Users or Bangladesh authorities, providing reasonable assistance and information.`,
      `Document the breach, our response, and lessons learned, and provide a post-incident report within 30 days of resolution.`,
    ],
    bodyAfter: [
      `For breaches requiring notification to the Bangladesh Data Protection Authority (once established under the proposed Personal Data Protection Act, 2023) or other authorities (e.g. Bangladesh Bank for payment data), we will notify the relevant authority within 72 hours of confirmation, in line with best practice.`,
    ],
  },
  {
    id: "dpa-execution",
    heading: "10. Executing a Signed DPA",
    body: [
      `This page functions as our standard DPA. For customers who require a signed DPA — for example, enterprises with GDPR Article 28(3) requirements — we will execute a separate signed agreement on request.`,
    ],
    bullets: [
      `Email dpo@z-crm.app with your business name, contact details, and the applicable compliance framework.`,
      `We will provide our standard DPA template within 5 business days.`,
      `Mutually signed DPAs are stored with your Account record and made available in Settings → Compliance.`,
      `For customers requiring a Signed DPA before subscribing, we can execute one during the trial period at no charge.`,
    ],
  },
  {
    id: "bangladesh-compliance",
    heading: "11. Bangladesh Data Protection Compliance",
    body: [
      `Z-CRM is incorporated and operated in Bangladesh. We comply with:`,
    ],
    bullets: [
      `The Information and Communication Technology (ICT) Act, 2006 (as amended in 2013).`,
      `The Cyber Security Act, 2023.`,
      `Bangladesh Bank guidelines on electronic fund transfers and mobile financial services.`,
      `The proposed Personal Data Protection Act, 2023 (in draft): we already follow the draft law's core principles — lawful and fair processing, purpose limitation, data minimization, accuracy, storage limitation, integrity and confidentiality, and accountability.`,
    ],
    bodyAfter: [
      `When the Personal Data Protection Act is enacted, we will update this DPA, our Privacy Policy, and our practices to comply with any additional requirements. We will provide customers with at least 90 days' notice of material changes that affect your obligations as a data controller.`,
    ],
  },
  {
    id: "audit-rights",
    heading: "12. Customer Audit Rights",
    body: [
      `You may audit our compliance with this DPA under the following conditions:`,
    ],
    bullets: [
      `Once per calendar year, on at least 30 days' written notice.`,
      `Conducted by an independent auditor reasonably acceptable to us, bound by confidentiality.`,
      `Limited to documentation and controls relevant to Z-CRM's processing of your Business Data.`,
      `We will provide reasonable cooperation, including SOC 2 / ISO 27001 reports where available, to minimize the need for on-site audits.`,
      `If an audit reveals a material non-compliance, we will remediate within 90 days at our cost.`,
    ],
  },
  {
    id: "dpo-contact",
    heading: "13. Data Protection Officer Contact",
    body: [
      `Our Data Protection Officer (DPO) is available to assist with data protection inquiries, End User rights requests, DPA execution, and breach notification coordination:`,
    ],
    bullets: [
      `Email: dpo@z-crm.app`,
      `Mail: ${SITE.address}`,
      `For urgent breach notifications, mark the subject line "URGENT — DATA BREACH" and we will respond within 4 hours (24/7).`,
    ],
    bodyAfter: [
      `For general privacy questions (not DPA-specific), contact privacy@z-crm.app. For security questions, contact security@z-crm.app.`,
    ],
  },
];

export default function DataProtectionPage() {
  return (
    <>
      <PageHero
        eyebrow="Data Processing"
        title="DPA and Bangladesh data protection"
        description="How Z-CRM processes personal data as a controller and processor, your rights and your End Users' rights, sub-processors, international transfers, breach notification, and DPO contact."
        breadcrumbs={[{ label: "Legal" }, { label: "Data Protection" }]}
      />

      {/* Sub-processor summary table */}
      <Section className="pt-0">
        <div className="max-w-3xl mx-auto rounded-2xl border border-border/60 bg-card overflow-hidden overflow-x-auto">
          <div className="px-4 py-3 border-b border-border/40 bg-muted/30">
            <h2 className="text-sm font-semibold">Current sub-processors</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              We notify customers at least 30 days before adding or changing sub-processors.
            </p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/40">
                <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sub-processor</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Purpose</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Location</th>
              </tr>
            </thead>
            <tbody>
              {SUB_PROCESSORS.map((s) => (
                <tr key={s.name} className="border-b border-border/20 last:border-b-0">
                  <td className="px-4 py-3 text-xs font-medium">{s.name}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{s.purpose}</td>
                  <td className="px-4 py-3 text-xs">{s.location}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
              This Data Processing page is part of our{" "}
              <Link href="/legal/privacy" className="text-primary font-medium hover:underline">
                Privacy Policy
              </Link>{" "}
              and{" "}
              <Link href="/legal/terms" className="text-primary font-medium hover:underline">
                Terms & Conditions
              </Link>
              . To execute a signed DPA, email{" "}
              <a href="mailto:dpo@z-crm.app" className="text-primary font-medium hover:underline">
                dpo@z-crm.app
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
            Questions about data processing?{" "}
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
        title="Your data, processed responsibly"
        subtitle="Start your 7-day free trial. No credit card required. Compliant with Bangladesh data protection law."
        secondaryCTA="View security overview"
        secondaryHref="/legal/security"
      />
    </>
  );
}

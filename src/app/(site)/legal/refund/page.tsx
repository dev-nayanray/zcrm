import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageHero } from "@/components/site/PageHero";
import { Section } from "@/components/site/Section";
import { CTASection } from "@/components/site/CTASection";
import { SITE } from "@/lib/site-content";

export const metadata: Metadata = {
  title: "Refund Policy — Z-CRM refunds and cancellations",
  description:
    "Z-CRM's Refund Policy: 7-day free trial, refund eligibility for each plan, how to request a refund, processing time, non-refundable items, and Lifetime plan terms.",
  alternates: { canonical: "https://z-crm.app/legal/refund" },
};

const LAST_UPDATED = "August 26, 2026";

const SECTIONS = [
  {
    id: "overview",
    heading: "1. Overview",
    body: [
      `We want you to be confident in your Z-CRM subscription. This Refund Policy explains when refunds are available, how to request them, how long processing takes, and which items are non-refundable. It forms part of our Terms & Conditions at /legal/terms.`,
      `In short: every plan starts with a 7-day free trial, no credit card required. Weekly and Monthly plans are refundable within 7 days of payment if you have not used premium features extensively. Yearly plans are refundable on a pro-rata basis for unused full months. Lifetime plans are refundable for 30 days, less a 10% processing fee.`,
    ],
  },
  {
    id: "free-trial",
    heading: "2. The 7-Day Free Trial",
    body: [
      `Every plan — Weekly, Monthly, Yearly, and Lifetime — starts with a 7-day free trial. No credit card is required to start the trial.`,
    ],
    bullets: [
      `During the trial, you have full access to all features of your selected plan.`,
      `You can enter real business data, connect integrations, and invite team members.`,
      `If you cancel before the trial ends, no charge is applied and your Business Data is retained for 30 days for easy reactivation.`,
      `If you do not cancel, your selected plan is automatically billed at the end of the trial using the payment method you added (bKash, Nagad, bank card, or wallet).`,
      `You will receive an email reminder 48 hours before the trial ends.`,
    ],
    bodyAfter: [
      `If you have not added a payment method by the end of the trial, your Account is automatically downgraded to read-only and the trial expires without charge. To continue using premium features, add a payment method and re-subscribe.`,
    ],
  },
  {
    id: "weekly-monthly-refunds",
    heading: "3. Weekly and Monthly Plans — Refund Eligibility",
    body: [
      `For Weekly and Monthly plans, refunds are available as follows:`,
    ],
    bullets: [
      `Within 7 days of payment: a full refund is available if you have not used premium features extensively. "Extensively" is defined as: created more than 50 orders, connected more than 2 integrations, or used more than 50% of your plan's order quota.`,
      `After 7 days: refunds are not available for Weekly plans. For Monthly plans, refunds are not available for the current billing month but you may cancel to prevent the next billing cycle.`,
      `Trials converted to paid plans are treated the same way — the 7-day refund window starts on the day your trial converts to a paid subscription.`,
    ],
    bodyAfter: [
      `We offer this 7-day window because we are confident in the value of Z-CRM. If you decide it is not right for your business within the first week, we will refund you without hassle.`,
    ],
  },
  {
    id: "yearly-refunds",
    heading: "4. Yearly Plan — Pro-Rata Refunds",
    body: [
      `For the Yearly plan (৳18,000/year), refunds are available on a pro-rata basis for unused full months remaining on your subscription:`,
    ],
    bullets: [
      `Refund amount = (months remaining / 12) × annual price paid, less any applicable processing fees.`,
      `Partial months are not refunded — e.g. if you cancel 5 months and 15 days into an annual subscription, you receive 7/12 of the annual price.`,
      `Refunds are available at any time during the annual subscription period.`,
      `If you have used premium features extensively (per the same definition in Section 3) within the first 7 days of the year, the standard 7-day full refund applies instead of the pro-rata calculation.`,
    ],
  },
  {
    id: "lifetime-refunds",
    heading: "5. Lifetime Plan — Refund Terms",
    body: [
      `The Lifetime plan (৳50,000 one-time) has special refund terms:`,
    ],
    bullets: [
      `Within 30 days of purchase: refundable in full, less a 10% processing fee (৳5,000) to cover payment processor and onboarding costs.`,
      `After 30 days: non-refundable. Lifetime access continues for the lifetime of the Service, including all future updates.`,
      `If the Service is ever discontinued, Lifetime customers will receive at least 12 months' notice and a full export of all Business Data in machine-readable format (JSON and CSV).`,
      `Lifetime customers retain access to documentation, help center, and email support indefinitely.`,
    ],
    bodyAfter: [
      `Because the Lifetime plan is one-time rather than recurring, the 30-day window balances customer protection with the cost of onboarding dedicated Lifetime customers (which includes a personalized onboarding session).`,
    ],
  },
  {
    id: "non-refundable",
    heading: "6. Non-Refundable Items",
    body: [
      `The following are non-refundable regardless of plan:`,
    ],
    bullets: [
      `Wallet deposits: deposits into your Z-CRM wallet (used for in-app purchases, payouts, and credits) are non-refundable. They remain in your wallet and can be used for any in-app purchase or withdrawn to your registered payout account.`,
      `Wallet withdrawals: once a withdrawal has been processed and sent to your payout account (bKash, Nagad, or bank), it cannot be reversed.`,
      `Onboarding sessions: personalized onboarding sessions included with Yearly and Lifetime plans are non-refundable once completed. If you cancel before completing onboarding, the pro-rata refund excludes the onboarding fee (valued at ৳3,000).`,
      `Customization work: any custom development, integration work, or professional services billed separately from your subscription are non-refundable once work has begun.`,
      `Third-party charges: fees charged by third-party services (WooCommerce, WhatsApp Business, Meta, Pathao, bKash, Nagad) are governed by those providers' policies, not Z-CRM's. We cannot refund charges from other providers.`,
    ],
  },
  {
    id: "how-to-request",
    heading: "7. How to Request a Refund",
    body: [
      `To request a refund:`,
    ],
    bullets: [
      `Email ${SITE.supportEmail} with the subject "Refund Request — [Your Account Email]".`,
      `Include your account email, the plan you wish to refund, the date of payment, and the reason for the refund (optional but appreciated for product improvement).`,
      `We will respond within 2 business days to confirm eligibility and request any additional information needed.`,
      `Once approved, refunds are processed to the original payment method (bKash, Nagad, bank card, or wallet) within the timelines in Section 8.`,
    ],
    bodyAfter: [
      `Alternatively, you can navigate to Settings → Billing → Request Refund in the Service to submit a refund request directly through the in-app form.`,
    ],
  },
  {
    id: "processing-time",
    heading: "8. Refund Processing Time",
    body: [
      `Refund processing times depend on your payment method:`,
    ],
    bullets: [
      `bKash and Nagad (mobile financial services): 3-5 business days after approval.`,
      `Bank card (credit/debit): 5-10 business days after approval. Your bank may take an additional 1-3 days to post the credit to your statement.`,
      `Bank transfer: 7-14 business days after approval, depending on interbank settlement in Bangladesh.`,
      `Z-CRM wallet credit (instant): if you choose wallet credit instead of refund to original payment method, the credit is applied immediately and can be used for any future in-app purchase.`,
    ],
    bodyAfter: [
      `Refunds are processed in Bangladeshi Taka (৳/BDT) at the original exchange rate at the time of payment. We do not refund currency conversion fees charged by your bank.`,
    ],
  },
  {
    id: "cancellation",
    heading: "9. Cancellation vs Refund",
    body: [
      `Cancellation and refund are separate actions:`,
    ],
    bullets: [
      `Cancellation stops future billing. It does not refund past payments.`,
      `Refund returns past payments, subject to the eligibility rules above.`,
      `You can cancel without requesting a refund, or request a refund and then cancel (recommended).`,
      `To cancel: go to Settings → Billing → Cancel Subscription, or email ${SITE.supportEmail}. Cancellation takes effect at the end of your current billing period (week, month, or year).`,
    ],
  },
  {
    id: "edge-cases",
    heading: "10. Special Circumstances",
    body: [
      `In exceptional circumstances, we may extend or modify the standard refund policy:`,
    ],
    bullets: [
      `If a serious service outage (more than 24 hours of unplanned downtime in a 30-day period) impacts your business, we may issue service credits or partial refunds at our discretion.`,
      `If you were charged due to a Z-CRM billing error, we will refund the erroneous charge in full within 7 business days, regardless of the standard eligibility windows.`,
      `If your business is affected by a force majeure event (e.g. natural disaster, government-mandated shutdown), contact us and we will work with you on a case-by-case basis.`,
      `If you are dissatisfied with the Service for reasons not covered by this policy, we encourage you to contact us. We aim to make things right whenever possible.`,
    ],
  },
  {
    id: "contact",
    heading: "11. Contact Us",
    body: [
      `Questions about refunds? We are happy to help:`,
    ],
    bullets: [
      `Email: ${SITE.supportEmail}`,
      `Phone: ${SITE.phone} (Mon–Fri, 9 AM–6 PM BST)`,
      `Mail: ${SITE.address}`,
    ],
    bodyAfter: [
      `For legal questions about this Refund Policy, email legal@z-crm.app.`,
    ],
  },
];

export default function RefundPage() {
  return (
    <>
      <PageHero
        eyebrow="Refund Policy"
        title="Refunds and cancellations"
        description="When refunds are available, how to request them, processing times, and what's non-refundable. We aim to be fair, transparent, and easy to work with."
        breadcrumbs={[{ label: "Legal" }, { label: "Refund" }]}
      />

      {/* Quick eligibility table */}
      <Section className="pt-0">
        <div className="max-w-3xl mx-auto rounded-2xl border border-border/60 bg-card overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/40 bg-muted/30">
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Plan</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Trial</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Refund window</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Refund basis</th>
              </tr>
            </thead>
            <tbody>
              {[
                { plan: "Weekly", price: "৳500/wk", trial: "7 days", window: "7 days from payment", basis: "Full (if not used extensively)" },
                { plan: "Monthly", price: "৳1,800/mo", trial: "7 days", window: "7 days from payment", basis: "Full (if not used extensively)" },
                { plan: "Yearly", price: "৳18,000/yr", trial: "7 days", window: "Anytime", basis: "Pro-rata for unused months" },
                { plan: "Lifetime", price: "৳50,000", trial: "7 days", window: "30 days from purchase", basis: "Full less 10% fee" },
              ].map((row) => (
                <tr key={row.plan} className="border-b border-border/20 last:border-b-0">
                  <td className="px-4 py-3 font-medium">
                    {row.plan}
                    <div className="text-[10px] text-muted-foreground font-normal">{row.price}</div>
                  </td>
                  <td className="px-4 py-3 text-xs">{row.trial}</td>
                  <td className="px-4 py-3 text-xs">{row.window}</td>
                  <td className="px-4 py-3 text-xs">{row.basis}</td>
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
            Questions about refunds?{" "}
            <Link href="/contact" className="text-primary font-medium hover:underline">
              Contact us
            </Link>{" "}
            or read our{" "}
            <Link href="/legal/terms" className="text-primary font-medium hover:underline">
              Terms & Conditions
            </Link>
            .
          </div>
        </article>
      </Section>

      <CTASection
        title="Try Z-CRM risk-free"
        subtitle="7-day free trial. No credit card required. Full refund within 7 days if it's not right for you."
        secondaryCTA="View pricing"
        secondaryHref="/pricing"
      />
    </>
  );
}

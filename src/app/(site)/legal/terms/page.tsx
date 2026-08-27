import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageHero } from "@/components/site/PageHero";
import { Section } from "@/components/site/Section";
import { CTASection } from "@/components/site/CTASection";
import { SITE } from "@/lib/site-content";

export const metadata: Metadata = {
  title: "Terms & Conditions — Z-CRM service agreement",
  description:
    "Z-CRM Terms & Conditions: account responsibilities, acceptable use, payment terms, refunds, intellectual property, termination, disclaimers, limitation of liability, and governing law (Bangladesh).",
  alternates: { canonical: "https://z-crm.app/legal/terms" },
};

const LAST_UPDATED = "August 26, 2026";

const SECTIONS = [
  {
    id: "introduction",
    heading: "1. Introduction and Acceptance of Terms",
    body: [
      `Welcome to Z-CRM. These Terms & Conditions ("Terms") govern your access to and use of the Z-CRM omnichannel business management suite, including our website at ${SITE.url}, our web application, mobile interfaces, and any related services (collectively, the "Service").`,
      `The Service is operated by Z-CRM ("Company", "we", or "us"), a Bangladesh-based software provider headquartered in ${SITE.address}. By creating an account, signing in, or otherwise using the Service, you agree to be bound by these Terms. If you do not agree, you may not use the Service.`,
      `If you are using the Service on behalf of a business, you represent and warrant that you have the authority to bind that business to these Terms, and references to "you" and "your" in these Terms apply to that business.`,
    ],
  },
  {
    id: "definitions",
    heading: "2. Definitions",
    body: [
      `"Account" means your Z-CRM account, including all users, business data, and configuration associated with it.`,
      `"Business Data" means the orders, customers, products, inventory, payments, expenses, reports, and other records you or your team enter into Z-CRM.`,
      `"Plan" means a subscription tier — Weekly (৳500/week), Monthly (৳1,800/month), Yearly (৳18,000/year), or Lifetime (৳50,000 one-time) — each with the features and limits described on our Pricing page.`,
      `"User" means any individual who has access to your Account, including the Account owner and invited team members.`,
      `"Trial" means the 7-day free trial available with every Plan.`,
    ],
  },
  {
    id: "account-responsibilities",
    heading: "3. Account Responsibilities",
    body: [
      `To use the Service, you must be at least 18 years old and able to form a legally binding contract under Bangladesh law. You agree to:`,
    ],
    bullets: [
      `Provide accurate, complete, and current information when creating your Account, including your business name, address, and contact details.`,
      `Keep your password secure and confidential. Passwords are hashed with PBKDF2-SHA256 at 600,000 iterations; we cannot recover a forgotten password — only you can reset it via the verified email on file.`,
      `Notify us promptly of any unauthorized use of your Account or any other security breach. You are responsible for all activity that occurs under your Account.`,
      `Maintain the accuracy of your billing information, including your subscription Plan, payment method (bKash, Nagad, bank card, or wallet), and tax identification (VAT, BIN, or TIN as applicable in Bangladesh).`,
      `Be responsible for all content and Business Data entered into your Account, and for the actions of all Users you invite.`,
    ],
  },
  {
    id: "acceptable-use",
    heading: "4. Acceptable Use Policy",
    body: [
      `You agree not to use the Service to:`,
    ],
    bullets: [
      `Violate any Bangladesh law, regulation, or third-party right — including the Information and Communication Technology (ICT) Act, 2006 (as amended), the Cyber Security Act, 2023, and Bangladesh Bank regulations on electronic payments.`,
      `Infringe the intellectual property, privacy, or other rights of any person or entity.`,
      `Upload, store, or transmit viruses, malware, or any malicious code; or attempt to gain unauthorized access to the Service, other accounts, or the systems on which the Service operates.`,
      `Use the Service to send unsolicited commercial messages (spam), engage in phishing, or conduct any fraudulent or deceptive activity.`,
      `Reverse engineer, decompile, disassemble, or otherwise attempt to derive the source code of the Service, except to the extent permitted by applicable law.`,
      `Resell, sublicense, lease, or rent access to the Service without our written consent. Each Account is for one business; multi-tenant reselling requires a separate agreement.`,
      `Interfere with the proper functioning of the Service, including by overwhelming our servers with automated requests (DDoS), bypassing rate limits, or scraping content.`,
      `Enter personal or sensitive information about individuals (e.g. customers, employees) without their consent where required by Bangladesh privacy law.`,
    ],
    bodyAfter: [
      `We may suspend or terminate access for violations of this Acceptable Use Policy, with or without notice, particularly for security issues or legal compliance.`,
    ],
  },
  {
    id: "payment-terms",
    heading: "5. Payment Terms",
    body: [
      `Subscription Plans are billed as follows:`,
    ],
    bullets: [
      `Weekly: ৳500/week, billed in advance each week. Cancel anytime; cancellation takes effect at the end of the current billing week.`,
      `Monthly: ৳1,800/month, billed in advance each month. Cancel anytime; cancellation takes effect at the end of the current billing month.`,
      `Yearly: ৳18,000/year, billed in advance each year. Cancel anytime; cancellation takes effect at the end of the current billing year.`,
      `Lifetime: ৳50,000 one-time payment for lifetime access under the then-current Lifetime plan terms. See Section 6 below.`,
    ],
    bodyAfter: [
      `All prices are in Bangladeshi Taka (BDT/৳) and include applicable VAT where required by Bangladesh law. We currently support payment via bKash, Nagad, bank transfer, and major credit/debit cards through our payment processor.`,
      `If a payment fails, we will retry up to three times over seven days. If payment continues to fail, your Account may be downgraded to read-only mode and ultimately suspended. You are responsible for keeping your payment method current.`,
      `We may change our fees with at least 30 days' written notice. Price changes take effect at the start of your next billing cycle after the notice period.`,
    ],
  },
  {
    id: "refunds",
    heading: "6. Refunds",
    body: [
      `Refund eligibility, processing, and timing are described in detail in our Refund Policy at /legal/refund. Summary:`,
    ],
    bullets: [
      `7-day free trial: no charge during the trial; you can cancel before the trial ends and owe nothing.`,
      `Weekly and Monthly plans: refunds are available within 7 days of payment if you have not used premium features extensively, as defined in the Refund Policy.`,
      `Yearly plans: pro-rata refunds are available for unused full months remaining on your subscription, less any applicable processing fees.`,
      `Lifetime plans: refundable for 30 days after purchase, less a 10% processing fee. After 30 days, Lifetime purchases are non-refundable, but lifetime updates and support are guaranteed.`,
    ],
  },
  {
    id: "intellectual-property",
    heading: "7. Intellectual Property",
    body: [
      `The Service, including its software, design, text, graphics, logos, and documentation, is owned by Z-CRM and protected by Bangladesh and international copyright, trademark, and other intellectual property laws.`,
      `We grant you a limited, non-exclusive, non-transferable, revocable license to use the Service for the duration of your active subscription (or for the lifetime of the Service for Lifetime plans), subject to these Terms.`,
      `You retain all rights, title, and interest in your Business Data. We do not claim ownership of your Business Data. You grant us a non-exclusive, worldwide license to process your Business Data solely as needed to provide the Service, as described in our Privacy Policy and Data Processing Addendum.`,
      `The "Z-CRM" name, logo, and brand are our trademarks. You may not use them without our written consent, except to refer to us accurately (e.g. "powered by Z-CRM").`,
    ],
  },
  {
    id: "termination",
    heading: "8. Termination and Suspension",
    body: [
      `You may cancel your subscription at any time by navigating to Settings → Billing → Cancel Subscription in the Service or by contacting ${SITE.supportEmail}. Cancellation takes effect at the end of your current billing period.`,
      `We may suspend or terminate your Account if:`,
    ],
    bullets: [
      `You breach these Terms, including the Acceptable Use Policy, and fail to cure the breach within 7 days of written notice (or immediately for serious breaches such as fraud or security violations).`,
      `Your subscription payment fails and remains unpaid for 30 days.`,
      `Your use of the Service exposes us or other users to legal liability, security risk, or technical harm.`,
      `You cease business operations, become insolvent, or file for bankruptcy (under the Bankruptcy Act, 1997 of Bangladesh).`,
    ],
    bodyAfter: [
      `On termination, we will retain your Business Data for 90 days to allow for final export, after which it is permanently deleted. Audit logs and billing records are retained for 7 years as required by Bangladesh law. Sections of these Terms that by their nature should survive termination — including intellectual property, disclaimers, limitation of liability, and governing law — will remain in effect.`,
    ],
  },
  {
    id: "disclaimers",
    heading: "9. Disclaimers",
    body: [
      `The Service is provided "as is" and "as available", with all faults. To the fullest extent permitted by Bangladesh law, we disclaim all warranties, express or implied, including implied warranties of merchantability, fitness for a particular purpose, and non-infringement.`,
      `We do not warrant that the Service will be uninterrupted, error-free, or secure; that defects will be corrected; or that the Service is free of viruses or other harmful components. We continuously monitor uptime and aim for 99.95% availability, but cannot guarantee it.`,
      `You are solely responsible for the accuracy, legality, and completeness of your Business Data. We are not responsible for decisions you make based on reports, dashboards, or other output from the Service.`,
      `The Service is not a substitute for professional accounting, tax, or legal advice. While our P&L and accounting modules use precise Decimal math (not floating-point), we recommend consulting a licensed Bangladesh accountant for tax filings, audits, and regulatory compliance.`,
    ],
  },
  {
    id: "limitation-of-liability",
    heading: "10. Limitation of Liability",
    body: [
      `To the maximum extent permitted by Bangladesh law, in no event will Z-CRM, its affiliates, officers, employees, or partners be liable for any indirect, incidental, special, consequential, or punitive damages — including loss of profits, data, business, or goodwill — arising out of or related to the Service, whether based on warranty, contract, tort (including negligence), or any other legal theory.`,
      `Our total aggregate liability for any claim arising out of or related to the Service will not exceed the amount you paid us in the 12 months preceding the event giving rise to the claim. For Lifetime plan holders, this cap is ৳50,000.`,
      `This limitation applies even if we have been advised of the possibility of such damages. Some jurisdictions do not allow the exclusion or limitation of certain damages, so the above limitations may not apply to you to the extent prohibited by law.`,
    ],
  },
  {
    id: "indemnification",
    heading: "11. Indemnification",
    body: [
      `You agree to indemnify, defend, and hold harmless Z-CRM, its affiliates, officers, employees, and partners from any claims, damages, losses, liabilities, costs, and expenses (including reasonable legal fees) arising out of:`,
    ],
    bullets: [
      `Your Business Data, including claims that it infringes the rights of any third party.`,
      `Your use of the Service in violation of these Terms or any applicable Bangladesh law.`,
      `Your breach of any third-party agreement (e.g. WooCommerce, WhatsApp Business Cloud API, Meta, Telegram) connected through the Service.`,
      `Your failure to obtain necessary consents from individuals whose data you process through the Service.`,
    ],
  },
  {
    id: "governing-law",
    heading: "12. Governing Law and Dispute Resolution",
    body: [
      `These Terms and any dispute arising out of or related to them or the Service will be governed by the laws of the People's Republic of Bangladesh, without regard to conflict-of-law principles.`,
      `Before initiating formal proceedings, both parties agree to attempt in good faith to resolve any dispute through negotiation. If negotiation fails within 30 days, disputes will be submitted to confidential arbitration administered by the Bangladesh International Arbitration Centre (BIAC) in Dhaka, in accordance with the Arbitration Act, 2001. The arbitral tribunal will consist of one arbitrator, and the language of the proceedings will be English.`,
      `Notwithstanding the above, either party may seek interim or injunctive relief in the competent courts of Dhaka, Bangladesh, to protect intellectual property, confidential information, or to prevent ongoing harm.`,
    ],
  },
  {
    id: "changes",
    heading: "13. Changes to These Terms",
    body: [
      `We may modify these Terms from time to time. We will notify you of material changes by email and via an in-app announcement at least 30 days before the changes take effect. For non-material changes (e.g. clarifications or corrections), we may update these Terms without prior notice but will revise the "Last updated" date at the top of this page.`,
      `Your continued use of the Service after changes take effect constitutes acceptance of the updated Terms. If you do not agree, you may cancel your subscription as described in Section 8.`,
    ],
  },
  {
    id: "miscellaneous",
    heading: "14. Miscellaneous",
    body: [
      `These Terms constitute the entire agreement between you and Z-CRM regarding the Service, and supersede any prior agreements. If any provision is held unenforceable, the remaining provisions will remain in full force.`,
      `You may not assign or transfer these Terms or your Account without our written consent. We may assign these Terms in connection with a merger, acquisition, or sale of all or substantially all of our assets.`,
      `No waiver of any provision of these Terms will be deemed a further or continuing waiver.`,
      `These Terms do not confer any rights on any third party, except our affiliates and sub-processors who may enforce the indemnification and limitation of liability provisions.`,
    ],
  },
  {
    id: "contact",
    heading: "15. Contact Us",
    body: [
      `If you have questions about these Terms, please contact us:`,
    ],
    bullets: [
      `By email: ${SITE.supportEmail}`,
      `By mail: ${SITE.address}`,
      `For legal notices specifically: legal@z-crm.app (please include "Legal Notice" in the subject line)`,
    ],
  },
];

export default function TermsPage() {
  return (
    <>
      <PageHero
        eyebrow="Terms & Conditions"
        title="The Z-CRM service agreement"
        description="The terms that govern your use of Z-CRM — including account responsibilities, payment, refunds, intellectual property, termination, disclaimers, liability, and Bangladesh governing law."
        breadcrumbs={[{ label: "Legal" }, { label: "Terms" }]}
      />

      <Section className="pt-0">
        <article className="max-w-3xl mx-auto">
          {/* Last updated + table of contents */}
          <div className="mb-8 pb-6 border-b border-border/40">
            <p className="text-xs text-muted-foreground mb-4">
              Last updated: <span className="font-medium text-foreground">{LAST_UPDATED}</span>
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              These Terms form a legally binding agreement between you and Z-CRM. Please read them carefully. If you
              have questions, email{" "}
              <a href={`mailto:${SITE.supportEmail}`} className="text-primary font-medium hover:underline">
                {SITE.supportEmail}
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
            Questions about these Terms?{" "}
            <Link href="/contact" className="text-primary font-medium hover:underline">
              Contact us
            </Link>{" "}
            or read our{" "}
            <Link href="/legal/refund" className="text-primary font-medium hover:underline">
              Refund Policy
            </Link>{" "}
            and{" "}
            <Link href="/legal/privacy" className="text-primary font-medium hover:underline">
              Privacy Policy
            </Link>
            .
          </div>
        </article>
      </Section>

      <CTASection
        title="Start your 7-day free trial"
        subtitle="No credit card required. Cancel anytime. By signing up you agree to these Terms."
        secondaryCTA="View pricing"
        secondaryHref="/pricing"
      />
    </>
  );
}

import type { Metadata } from "next";
import { Mail, Phone, MapPin, Clock, MessageSquare, ArrowRight } from "lucide-react";
import { PageHero } from "@/components/site/PageHero";
import { Section } from "@/components/site/Section";
import { CTASection } from "@/components/site/CTASection";
import { ContactForm } from "@/components/site/ContactForm";
import { SITE } from "@/lib/site-content";

export const metadata: Metadata = {
  title: "Contact — Talk to the Z-CRM team",
  description: "Questions about Z-CRM? Want a demo? Need help getting started? Reach out — we respond within 24 hours.",
  alternates: { canonical: "https://z-crm.app/contact" },
};

export default function ContactPage() {
  return (
    <>
      <PageHero
        eyebrow="Contact"
        title="Talk to the Z-CRM team"
        description="Questions about Z-CRM? Want a demo? Need help getting started? Reach out — we respond within 24 hours."
        breadcrumbs={[{ label: "Contact" }]}
      />

      <Section className="pt-0">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Contact form */}
          <div>
            <h2 className="text-xl font-bold mb-1">Send us a message</h2>
            <p className="text-sm text-muted-foreground mb-6">We'll get back to you within 24 hours.</p>
            <ContactForm />
          </div>

          {/* Contact info */}
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold mb-1">Other ways to reach us</h2>
              <p className="text-sm text-muted-foreground mb-6">Pick whatever works for you.</p>
            </div>
            <div className="space-y-4">
              <a href={`mailto:${SITE.email}`} className="flex items-start gap-3 rounded-xl border border-border/60 bg-card p-4 card-hover">
                <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Email</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{SITE.email}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">For sales and general questions</p>
                </div>
              </a>
              <a href={`mailto:${SITE.supportEmail}`} className="flex items-start gap-3 rounded-xl border border-border/60 bg-card p-4 card-hover">
                <div className="h-10 w-10 rounded-xl bg-cyan-500/10 text-cyan-600 flex items-center justify-center shrink-0">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Support</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{SITE.supportEmail}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">For existing customers needing help</p>
                </div>
              </a>
              <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-card p-4">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                  <MapPin className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Office</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{SITE.address}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-card p-4">
                <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Hours</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Sat–Thu · 10am–7pm BST</p>
                  <p className="text-[11px] text-muted-foreground mt-1">Closed Fridays and Bangladeshi public holidays</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      <CTASection
        title="Prefer to explore on your own?"
        subtitle="Start your 7-day free trial. No credit card required."
        primaryCTA="Start Free Trial"
        secondaryCTA="View Documentation"
        secondaryHref="/resources/docs"
      />
    </>
  );
}

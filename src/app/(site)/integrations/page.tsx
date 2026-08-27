import type { Metadata } from "next";
import { PageHero } from "@/components/site/PageHero";
import { Section, SectionHeader } from "@/components/site/Section";
import { IntegrationGrid } from "@/components/site/IntegrationCard";
import { CTASection } from "@/components/site/CTASection";

export const metadata: Metadata = {
  title: "Integrations — Connect every channel you sell on",
  description: "WooCommerce, WhatsApp, Facebook, Telegram, Pathao, Steadfast, RedX, bKash, Nagad — all integrated with HMAC-signed webhooks.",
  alternates: { canonical: "https://z-crm.app/integrations" },
};

export default function Page() {
  return (
    <>
      <PageHero
        eyebrow="Integrations"
        title="Connect every channel you sell on"
        description="WooCommerce, WhatsApp, Facebook, Instagram, Telegram, Pathao, Steadfast, RedX, bKash, Nagad — all integrated. With HMAC-signed webhooks and idempotent processing."
        breadcrumbs={[{ label: "Integrations" }]}
      />
      <Section className="pt-0">
        <SectionHeader
          eyebrow="All integrations"
          title="Every channel, every payment, every courier"
          description="Click any integration to see features, setup steps, and details."
        />
        <IntegrationGrid />
      </Section>
      <CTASection />
    </>
  );
}

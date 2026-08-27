import type { Metadata } from "next";
import { IntegrationPage } from "@/components/site/PageTemplates";

export const metadata: Metadata = {
  title: "Facebook Lead Ads Integration — Connect Facebook Lead Ads to Z-CRM",
  description: "Connect Facebook Lead Ads to Z-CRM with HMAC-signed webhooks, idempotent processing, and full audit trails.",
  alternates: { canonical: "https://z-crm.app/integrations/facebook" },
};

export default function Page() {
  return <IntegrationPage slug="facebook" />;
}

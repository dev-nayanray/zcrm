import type { Metadata } from "next";
import { IntegrationPage } from "@/components/site/PageTemplates";

export const metadata: Metadata = {
  title: "WhatsApp Business Cloud API Integration — Connect WhatsApp Business Cloud API to Z-CRM",
  description: "Connect WhatsApp Business Cloud API to Z-CRM with HMAC-signed webhooks, idempotent processing, and full audit trails.",
  alternates: { canonical: "https://z-crm.app/integrations/whatsapp" },
};

export default function Page() {
  return <IntegrationPage slug="whatsapp" />;
}

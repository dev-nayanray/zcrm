import type { Metadata } from "next";
import { IntegrationPage } from "@/components/site/PageTemplates";

export const metadata: Metadata = {
  title: "Courier Integration Integration — Connect Courier Integration to Z-CRM",
  description: "Connect Courier Integration to Z-CRM with HMAC-signed webhooks, idempotent processing, and full audit trails.",
  alternates: { canonical: "https://z-crm.app/integrations/courier" },
};

export default function Page() {
  return <IntegrationPage slug="courier" />;
}

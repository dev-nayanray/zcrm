import type { Metadata } from "next";
import { IntegrationPage } from "@/components/site/PageTemplates";

export const metadata: Metadata = {
  title: "Nagad Integration — Connect Nagad to Z-CRM",
  description: "Connect Nagad to Z-CRM with HMAC-signed webhooks, idempotent processing, and full audit trails.",
  alternates: { canonical: "https://z-crm.app/integrations/nagad" },
};

export default function Page() {
  return <IntegrationPage slug="nagad" />;
}

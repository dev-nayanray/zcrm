import type { Metadata } from "next";
import { IntegrationPage } from "@/components/site/PageTemplates";

export const metadata: Metadata = {
  title: "Facebook Messenger Integration — Connect Facebook Messenger to Z-CRM",
  description: "Connect Facebook Messenger to Z-CRM with HMAC-signed webhooks, idempotent processing, and full audit trails.",
  alternates: { canonical: "https://z-crm.app/integrations/messenger" },
};

export default function Page() {
  return <IntegrationPage slug="messenger" />;
}

import type { Metadata } from "next";
import { IntegrationPage } from "@/components/site/PageTemplates";

export const metadata: Metadata = {
  title: "bKash Integration — Connect bKash to Z-CRM",
  description: "Connect bKash to Z-CRM with HMAC-signed webhooks, idempotent processing, and full audit trails.",
  alternates: { canonical: "https://z-crm.app/integrations/bkash" },
};

export default function Page() {
  return <IntegrationPage slug="bkash" />;
}

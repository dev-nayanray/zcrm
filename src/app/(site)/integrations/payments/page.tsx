import type { Metadata } from "next";
import { IntegrationPage } from "@/components/site/PageTemplates";

export const metadata: Metadata = {
  title: "Payment Gateways Integration — Connect Payment Gateways to Z-CRM",
  description: "Connect Payment Gateways to Z-CRM with HMAC-signed webhooks, idempotent processing, and full audit trails.",
  alternates: { canonical: "https://z-crm.app/integrations/payments" },
};

export default function Page() {
  return <IntegrationPage slug="payments" />;
}

import type { Metadata } from "next";
import { IntegrationPage } from "@/components/site/PageTemplates";

export const metadata: Metadata = {
  title: "WooCommerce Integration — Connect WooCommerce to Z-CRM",
  description: "Connect WooCommerce to Z-CRM with HMAC-signed webhooks, idempotent processing, and full audit trails.",
  alternates: { canonical: "https://z-crm.app/integrations/woocommerce" },
};

export default function Page() {
  return <IntegrationPage slug="woocommerce" />;
}

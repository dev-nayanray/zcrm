import type { Metadata } from "next";
import { IntegrationPage } from "@/components/site/PageTemplates";

export const metadata: Metadata = {
  title: "Telegram Bot Integration — Connect Telegram Bot to Z-CRM",
  description: "Connect Telegram Bot to Z-CRM with HMAC-signed webhooks, idempotent processing, and full audit trails.",
  alternates: { canonical: "https://z-crm.app/integrations/telegram" },
};

export default function Page() {
  return <IntegrationPage slug="telegram" />;
}

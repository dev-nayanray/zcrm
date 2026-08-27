import type { Metadata } from "next";
import { ProductPage } from "@/components/site/PageTemplates";

export const metadata: Metadata = {
  title: "Automation Engine — Event → Rule → Action — fire-and-forget",
  description: "Define rules that fire on business events. Send WhatsApp confirmations, route alerts to Telegram, assign salespeople, create notifications. Non-blocking — never slows your transaction.",
  alternates: { canonical: "https://z-crm.app/product/automation" },
};

export default function Page() {
  return <ProductPage slug="automation" />;
}

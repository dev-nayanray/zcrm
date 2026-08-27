import type { Metadata } from "next";
import { ProductPage } from "@/components/site/PageTemplates";

export const metadata: Metadata = {
  title: "Lead Management — From Facebook Lead Ad to customer — automatically",
  description: "Auto-import leads from Meta Lead Ads with HMAC-verified webhooks. Dedup by phone. Convert to customers in one click. Pipeline kanban with follow-ups.",
  alternates: { canonical: "https://z-crm.app/product/lead-management" },
};

export default function Page() {
  return <ProductPage slug="lead-management" />;
}

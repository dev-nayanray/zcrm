import type { Metadata } from "next";
import { ProductPage } from "@/components/site/PageTemplates";

export const metadata: Metadata = {
  title: "Finance & Accounting — Real P&L — not a guess",
  description: "The Z-CRM accounting engine is the single source of truth for financial calculations. Revenue − COGS − fulfillment costs − expenses − refunds = net profit.",
  alternates: { canonical: "https://z-crm.app/product/finance-accounting" },
};

export default function Page() {
  return <ProductPage slug="finance-accounting" />;
}

import type { Metadata } from "next";
import { ProductPage } from "@/components/site/PageTemplates";

export const metadata: Metadata = {
  title: "CRM — One customer database across every channel",
  description: "The Z-CRM customer module is the single source of truth for every customer. Orders, payments, conversations, leads, returns, and credit limits — all in one 360° profile.",
  alternates: { canonical: "https://z-crm.app/product/crm" },
};

export default function Page() {
  return <ProductPage slug="crm" />;
}

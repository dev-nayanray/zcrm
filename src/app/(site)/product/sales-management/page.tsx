import type { Metadata } from "next";
import { ProductPage } from "@/components/site/PageTemplates";

export const metadata: Metadata = {
  title: "Sales Management — From lead to closed deal — one workflow",
  description: "Manage the entire sales lifecycle from lead capture to closed deal. Pipeline kanban, lead follow-ups, conversion tracking, and sales analytics — all powered by the same customer database.",
  alternates: { canonical: "https://z-crm.app/product/sales-management" },
};

export default function Page() {
  return <ProductPage slug="sales-management" />;
}

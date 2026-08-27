import type { Metadata } from "next";
import { ProductPage } from "@/components/site/PageTemplates";

export const metadata: Metadata = {
  title: "Reports & Analytics — 11 report types, all with CSV export",
  description: "From sales by channel to supplier payments, every report uses the same accounting engine. Date filtering, presets, and CSV export — built in.",
  alternates: { canonical: "https://z-crm.app/product/reports-analytics" },
};

export default function Page() {
  return <ProductPage slug="reports-analytics" />;
}

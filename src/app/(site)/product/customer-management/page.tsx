import type { Metadata } from "next";
import { ProductPage } from "@/components/site/PageTemplates";

export const metadata: Metadata = {
  title: "Customer Management — Know every customer, across every channel",
  description: "A unified customer database with cross-channel deduplication, 360° profiles, dues tracking, credit limits, and lifetime value. The foundation of every other module.",
  alternates: { canonical: "https://z-crm.app/product/customer-management" },
};

export default function Page() {
  return <ProductPage slug="customer-management" />;
}

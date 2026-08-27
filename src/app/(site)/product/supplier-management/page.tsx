import type { Metadata } from "next";
import { ProductPage } from "@/components/site/PageTemplates";

export const metadata: Metadata = {
  title: "Supplier Management — Every supplier, every purchase, every payment",
  description: "A supplier database with full purchase history, outstanding payables, payment tracking, and returns. The vendor side of your procure-to-pay workflow.",
  alternates: { canonical: "https://z-crm.app/product/supplier-management" },
};

export default function Page() {
  return <ProductPage slug="supplier-management" />;
}

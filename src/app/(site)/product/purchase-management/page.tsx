import type { Metadata } from "next";
import { ProductPage } from "@/components/site/PageTemplates";

export const metadata: Metadata = {
  title: "Purchase Management — From supplier to warehouse — tracked end-to-end",
  description: "Create purchase orders, receive stock into any warehouse, track payments, and handle returns. The full procure-to-pay workflow with audit trail.",
  alternates: { canonical: "https://z-crm.app/product/purchase-management" },
};

export default function Page() {
  return <ProductPage slug="purchase-management" />;
}

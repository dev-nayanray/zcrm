import type { Metadata } from "next";
import { ProductPage } from "@/components/site/PageTemplates";

export const metadata: Metadata = {
  title: "Inventory Management — Ledger-based stock — the single source of truth",
  description: "Every stock change is recorded as a movement in an immutable ledger. Reserved, available, and damaged buckets. Multi-warehouse, transfers, and reconciliation — built in.",
  alternates: { canonical: "https://z-crm.app/product/inventory-management" },
};

export default function Page() {
  return <ProductPage slug="inventory-management" />;
}

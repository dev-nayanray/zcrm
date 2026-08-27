import type { Metadata } from "next";
import { ProductPage } from "@/components/site/PageTemplates";

export const metadata: Metadata = {
  title: "Audit Logs — Every mutation, forever",
  description: "Immutable record of every business-critical action. Order create, payment, refund, stock movement, role change, login — all logged with user, timestamp, and changes.",
  alternates: { canonical: "https://z-crm.app/product/audit-logs" },
};

export default function Page() {
  return <ProductPage slug="audit-logs" />;
}

import type { Metadata } from "next";
import { UseCasePage } from "@/components/site/PageTemplates";

export const metadata: Metadata = {
  title: "Multi-Warehouse — Z-CRM for Multi-Warehouse businesses in Bangladesh",
  description: "How Z-CRM serves Multi-Warehouse businesses in Bangladesh. Challenges, solutions, and workflow.",
  alternates: { canonical: "https://z-crm.app/use-cases/multi-warehouse" },
};

export default function Page() {
  return <UseCasePage slug="multi-warehouse" />;
}

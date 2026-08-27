import type { Metadata } from "next";
import { UseCasePage } from "@/components/site/PageTemplates";

export const metadata: Metadata = {
  title: "E-commerce — Z-CRM for E-commerce businesses in Bangladesh",
  description: "How Z-CRM serves E-commerce businesses in Bangladesh. Challenges, solutions, and workflow.",
  alternates: { canonical: "https://z-crm.app/use-cases/ecommerce" },
};

export default function Page() {
  return <UseCasePage slug="ecommerce" />;
}

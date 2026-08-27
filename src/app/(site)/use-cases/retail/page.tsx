import type { Metadata } from "next";
import { UseCasePage } from "@/components/site/PageTemplates";

export const metadata: Metadata = {
  title: "Retail — Z-CRM for Retail businesses in Bangladesh",
  description: "How Z-CRM serves Retail businesses in Bangladesh. Challenges, solutions, and workflow.",
  alternates: { canonical: "https://z-crm.app/use-cases/retail" },
};

export default function Page() {
  return <UseCasePage slug="retail" />;
}

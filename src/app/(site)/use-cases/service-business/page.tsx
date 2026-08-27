import type { Metadata } from "next";
import { UseCasePage } from "@/components/site/PageTemplates";

export const metadata: Metadata = {
  title: "Service Business — Z-CRM for Service Business businesses in Bangladesh",
  description: "How Z-CRM serves Service Business businesses in Bangladesh. Challenges, solutions, and workflow.",
  alternates: { canonical: "https://z-crm.app/use-cases/service-business" },
};

export default function Page() {
  return <UseCasePage slug="service-business" />;
}

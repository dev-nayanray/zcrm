import type { Metadata } from "next";
import { UseCasePage } from "@/components/site/PageTemplates";

export const metadata: Metadata = {
  title: "Distribution — Z-CRM for Distribution businesses in Bangladesh",
  description: "How Z-CRM serves Distribution businesses in Bangladesh. Challenges, solutions, and workflow.",
  alternates: { canonical: "https://z-crm.app/use-cases/distribution" },
};

export default function Page() {
  return <UseCasePage slug="distribution" />;
}

import type { Metadata } from "next";
import { UseCasePage } from "@/components/site/PageTemplates";

export const metadata: Metadata = {
  title: "Wholesale — Z-CRM for Wholesale businesses in Bangladesh",
  description: "How Z-CRM serves Wholesale businesses in Bangladesh. Challenges, solutions, and workflow.",
  alternates: { canonical: "https://z-crm.app/use-cases/wholesale" },
};

export default function Page() {
  return <UseCasePage slug="wholesale" />;
}

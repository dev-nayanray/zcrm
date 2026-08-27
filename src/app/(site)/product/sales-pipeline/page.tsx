import type { Metadata } from "next";
import { ProductPage } from "@/components/site/PageTemplates";

export const metadata: Metadata = {
  title: "Sales Pipeline — 7-stage kanban with drag-and-drop",
  description: "Visualize your sales pipeline as a kanban board. Drag deals between stages. Track pipeline value. Assign deals to salespeople. All powered by the customer database.",
  alternates: { canonical: "https://z-crm.app/product/sales-pipeline" },
};

export default function Page() {
  return <ProductPage slug="sales-pipeline" />;
}

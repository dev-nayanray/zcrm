import type { Metadata } from "next";
import { ProductPage } from "@/components/site/PageTemplates";

export const metadata: Metadata = {
  title: "Kanban Boards — Visual workflows for orders, leads, and pipeline",
  description: "Drag-and-drop kanban boards for orders, leads, and the sales pipeline. Same data as the list view, just visual. Status updates enforce the workflow.",
  alternates: { canonical: "https://z-crm.app/product/kanban" },
};

export default function Page() {
  return <ProductPage slug="kanban" />;
}

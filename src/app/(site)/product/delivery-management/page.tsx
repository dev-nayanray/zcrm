import type { Metadata } from "next";
import { ProductPage } from "@/components/site/PageTemplates";

export const metadata: Metadata = {
  title: "Delivery Management — Pathao, Steadfast, RedX — all in one place",
  description: "Create deliveries with any Bangladesh courier, auto-ship on order confirmation, track status, and convert reservations to sales on delivery. Full status history per delivery.",
  alternates: { canonical: "https://z-crm.app/product/delivery-management" },
};

export default function Page() {
  return <ProductPage slug="delivery-management" />;
}

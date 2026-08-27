import type { Metadata } from "next";
import { ProductPage } from "@/components/site/PageTemplates";

export const metadata: Metadata = {
  title: "Order Management — Every order, every channel, one queue",
  description: "Orders from WooCommerce, WhatsApp, Facebook, Instagram, phone, and in-store all flow into one unified queue. Stock reservation, status workflow, and audit trail — built in.",
  alternates: { canonical: "https://z-crm.app/product/order-management" },
};

export default function Page() {
  return <ProductPage slug="order-management" />;
}

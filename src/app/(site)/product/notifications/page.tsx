import type { Metadata } from "next";
import { ProductPage } from "@/components/site/PageTemplates";

export const metadata: Metadata = {
  title: "Notifications — In-app + Telegram — never miss an event",
  description: "In-app notifications for low stock, sync failures, and business events. Route to Telegram groups by event type. Mark as read, mark all as read, or delete.",
  alternates: { canonical: "https://z-crm.app/product/notifications" },
};

export default function Page() {
  return <ProductPage slug="notifications" />;
}

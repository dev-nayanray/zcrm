import type { Metadata } from "next";
import { ProductPage } from "@/components/site/PageTemplates";

export const metadata: Metadata = {
  title: "Payment Management — bKash, Nagad, cash, card — all tracked",
  description: "Record every customer payment with method, amount, and transaction reference. Auto-recompute payment status. Cash register with daily closing. Wallet for credits.",
  alternates: { canonical: "https://z-crm.app/product/payment-management" },
};

export default function Page() {
  return <ProductPage slug="payment-management" />;
}

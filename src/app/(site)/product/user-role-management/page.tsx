import type { Metadata } from "next";
import { ProductPage } from "@/components/site/PageTemplates";

export const metadata: Metadata = {
  title: "User & Role Management — 60+ permissions, 6 system roles, full audit",
  description: "Granular RBAC with 60+ permissions across 6 system roles. Create custom roles. Assign any subset of permissions. Every mutation enforced server-side.",
  alternates: { canonical: "https://z-crm.app/product/user-role-management" },
};

export default function Page() {
  return <ProductPage slug="user-role-management" />;
}

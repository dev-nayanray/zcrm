import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/site/ResetPasswordForm";

export const metadata: Metadata = {
  title: "Reset Password",
  description:
    "Choose a new password for your Z-CRM account. Use the secure link from your reset email to set a new password.",
  alternates: { canonical: "https://z-crm.app/reset-password" },
  robots: { index: false, follow: false },
};

interface PageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function ResetPasswordPage({ searchParams }: PageProps) {
  const { token } = await searchParams;
  return <ResetPasswordForm token={token} />;
}

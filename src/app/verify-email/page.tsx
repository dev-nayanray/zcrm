import type { Metadata } from "next";
import { VerifyEmailNotice } from "@/components/site/VerifyEmailNotice";

export const metadata: Metadata = {
  title: "Verify Your Email",
  description:
    "Confirm your email address to activate your Z-CRM account. We sent a verification link to your inbox — click it to start using Z-CRM.",
  alternates: { canonical: "https://z-crm.app/verify-email" },
  robots: { index: false, follow: false },
};

export default function VerifyEmailPage() {
  return <VerifyEmailNotice />;
}

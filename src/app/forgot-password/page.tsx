import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/site/ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Forgot Password",
  description:
    "Reset your Z-CRM account password. Enter your email and we'll send you a secure link to choose a new password.",
  alternates: { canonical: "https://z-crm.app/forgot-password" },
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}

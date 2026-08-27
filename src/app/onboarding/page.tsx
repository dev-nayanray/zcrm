import type { Metadata } from "next";
import { OnboardingFlow } from "@/components/site/OnboardingFlow";

export const metadata: Metadata = {
  title: "Set up your workspace",
  description:
    "Get your Z-CRM workspace ready in 4 quick steps: add your business info, your first product, connect integrations, and invite your team.",
  alternates: { canonical: "https://z-crm.app/onboarding" },
  robots: { index: false, follow: false },
};

export default function OnboardingPage() {
  return <OnboardingFlow />;
}

"use client";
import { useSearchParams } from "next/navigation";
import { RegisterPage } from "@/components/crm/register-page";
import { Suspense } from "react";

export default function Register() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>}>
      <RegisterContent />
    </Suspense>
  );
}

function RegisterContent() {
  const searchParams = useSearchParams();
  const plan = searchParams.get("plan");
  return <RegisterPage redirectPlan={plan || undefined} />;
}

"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { useCrmStore } from "@/lib/store";
import { LoginScreen } from "@/components/crm/login-screen";
import { CRMShell } from "@/components/crm/crm-shell";
import { Loader2 } from "lucide-react";

export default function AppPage() {
  const { user, setUser, navigate } = useCrmStore();
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get<{ user: { id: string; name: string; email: string; role: { id: string; name: string } }; permissions: string[] }>("/api/v1/auth/me");
        setUser({ id: res.user.id, name: res.user.name, email: res.user.email, role: res.user.role.name, permissions: res.permissions });
      } catch {
        setUser(null);
      } finally {
        setBooting(false);
      }
    })();
  }, [setUser]);

  // If logged in and has ?plan=XXX in URL, redirect to billing checkout
  // with the selected plan passed as a navigation param so the checkout
  // view can pre-select the correct plan (instead of defaulting to
  // Monthly — see the previous "plan parameter lost" bug).
  useEffect(() => {
    if (user && !booting) {
      const params = new URLSearchParams(window.location.search);
      const plan = params.get("plan");
      if (plan) {
        // Clear the URL param so a refresh doesn't re-trigger.
        window.history.replaceState({}, "", "/app");
        // Pass the plan as a navigation param. The checkout view reads
        // params.plan to pre-select the plan.
        navigate("billing/checkout", { plan });
      }
    }
  }, [user, booting, navigate]);

  if (booting) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!user) return <LoginScreen />;
  return <CRMShell />;
}

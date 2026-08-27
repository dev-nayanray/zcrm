"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { useCrmStore } from "@/lib/store";
import { LandingPage } from "@/components/crm/landing-page";
import { LoginScreen } from "@/components/crm/login-screen";
import { CRMShell } from "@/components/crm/crm-shell";
import { Loader2 } from "lucide-react";

export default function Home() {
  const { user, setUser } = useCrmStore();
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

  if (booting) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (user) return <CRMShell />;
  return <LandingPage />;
}

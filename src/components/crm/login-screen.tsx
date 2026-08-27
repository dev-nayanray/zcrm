"use client";
import { useState } from "react";
import { api } from "@/lib/api-client";
import { useCrmStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, ShieldCheck, Eye, EyeOff } from "lucide-react";

const DEMO_USERS = [
  { role: "Super Admin", email: "superadmin@zcrm.local", password: "Admin@123" },
  { role: "Admin", email: "admin@zcrm.local", password: "Admin@123" },
  { role: "Manager", email: "manager@zcrm.local", password: "Manager@123" },
  { role: "Sales", email: "sales@zcrm.local", password: "Sales@123" },
  { role: "Inventory", email: "inventory@zcrm.local", password: "Stock@123" },
  { role: "Accountant", email: "accounts@zcrm.local", password: "Accts@123" },
];

export function LoginScreen() {
  const setUser = useCrmStore((s) => s.setUser);
  const [email, setEmail] = useState("admin@zcrm.local");
  const [password, setPassword] = useState("Admin@123");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    setLoading(true);
    try {
      const res = await api.post<{ user: { id: string; name: string; email: string; role: { id: string; name: string } } }>(
        "/api/v1/auth/login",
        { email, password },
      );
      // fetch permissions
      const me = await api.get<{ permissions: string[] }>("/api/v1/auth/me");
      setUser({ id: res.user.id, name: res.user.name, email: res.user.email, role: res.user.role.name, permissions: me.permissions });
      toast.success(`Welcome back, ${res.user.name}!`);
    } catch (err) {
      toast.error((err as Error).message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 app-bg relative overflow-hidden">
      {/* ambient gradient mesh */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-cyan-500/15 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[40rem] w-[40rem] rounded-full bg-emerald-500/5 blur-3xl" />
      </div>
      <div className="w-full max-w-5xl grid md:grid-cols-2 gap-8 items-center">
        {/* Hero */}
        <div className="hidden md:flex flex-col gap-7 p-6">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-primary-foreground shadow-glow">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight gradient-text">Z-CRM</h1>
              <p className="text-sm text-muted-foreground font-medium">Omnichannel Business Suite</p>
            </div>
          </div>
          <div className="space-y-3">
            <h2 className="text-3xl md:text-4xl font-bold leading-[1.15] tracking-tight">
              Run your entire business from <span className="gradient-text">one place.</span>
            </h2>
            <p className="text-muted-foreground leading-relaxed">Orders, customers, products, inventory, purchases, payments, expenses, profit &amp; loss — all unified with a single authoritative accounting engine.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {["Ledger inventory", "WooCommerce sync", "WhatsApp + Meta", "RBAC", "Automation", "P&L reports"].map((f) => (
              <span key={f} className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/60 backdrop-blur px-3 py-1 text-xs font-medium text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-primary/70" />{f}
              </span>
            ))}
          </div>
        </div>
        {/* Login card */}
        <Card className="shadow-pop border-border/60 glass">
          <CardHeader className="space-y-1 pb-4">
            <div className="md:hidden flex items-center gap-2 mb-2">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-primary-foreground shadow-glow">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <span className="text-xl font-bold gradient-text">Z-CRM</span>
            </div>
            <CardTitle className="text-xl tracking-tight">Sign in to your account</CardTitle>
            <CardDescription>Enter your credentials to access the CRM.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" className="h-10" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input id="password" type={showPwd ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" className="pr-10" />
                  <button type="button" onClick={() => setShowPwd((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full h-10 shadow-soft" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Sign in
              </Button>
            </form>
            <div className="mt-5 pt-4 border-t border-border/40 text-center text-sm">
              New to Z-CRM?{" "}
              <a href="/register" className="text-primary font-medium hover:underline">Create an account</a>
            </div>
            <div className="mt-5">
              <div className="flex items-center gap-2 mb-2.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Demo accounts — click to fill</span>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-medium">Guest Preview</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {DEMO_USERS.map((u) => (
                  <button
                    key={u.role}
                    type="button"
                    onClick={() => { setEmail(u.email); setPassword(u.password); }}
                    className="text-left px-2.5 py-2 rounded-lg border border-border/60 text-xs hover:bg-accent hover:border-primary/30 transition-all card-hover"
                  >
                    <div className="font-semibold text-foreground">{u.role}</div>
                    <div className="text-muted-foreground truncate text-[11px]">{u.email}</div>
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

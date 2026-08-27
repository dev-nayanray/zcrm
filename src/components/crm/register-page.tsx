"use client";
import { useState } from "react";
import { api } from "@/lib/api-client";
import { useCrmStore } from "@/lib/store";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ShieldCheck, ArrowLeft, Loader2, Eye, EyeOff, ArrowRight, Sparkles } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

export function RegisterPage({ redirectPlan }: { redirectPlan?: string }) {
  const { setUser } = useCrmStore();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    setLoading(true);
    try {
      // Pass the selected plan to the API so the server auto-creates a
      // trial subscription with the chosen plan (instead of always
      // defaulting to WEEKLY). The plan is also threaded through to the
      // /app redirect as ?plan=XXX so the checkout view can pre-select
      // it.
      const res = await api.post<{ user: { id: string; name: string; email: string; role: { id: string; name: string } } }>("/api/v1/auth/register", { name, email, phone, password, plan: redirectPlan });
      // fetch permissions
      const me = await api.get<{ permissions: string[] }>("/api/v1/auth/me");
      setUser({ id: res.user.id, name: res.user.name, email: res.user.email, role: res.user.role.name, permissions: me.permissions });
      toast.success(`Welcome to Z-CRM, ${res.user.name}!`);
      // Redirect to checkout if a plan was selected, otherwise to dashboard
      if (redirectPlan) {
        window.location.href = `/app?plan=${redirectPlan}`;
      } else {
        window.location.href = "/app";
      }
    } catch (err) {
      toast.error((err as Error).message || "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 app-bg relative overflow-hidden">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-cyan-500/15 blur-3xl" />
      </div>
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2.5 mb-6 justify-center">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-primary-foreground shadow-glow">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <span className="font-bold text-xl gradient-text">Z-CRM</span>
          </div>
        </div>
        <Card className="shadow-pop glass border-border/40">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl tracking-tight">Create your account</CardTitle>
            <CardDescription>
              {redirectPlan ? `Register to subscribe to the ${redirectPlan} plan` : "Start your 14-day free trial. No credit card required."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Your name" className="h-10" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" className="h-10" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="01XXXXXXXXX" className="h-10" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input id="password" type={showPwd ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} placeholder="Min 8 characters" className="h-10 pr-10" />
                  <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full h-10 shadow-soft" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ArrowRight className="h-4 w-4 mr-2" />}
                {loading ? "Creating account…" : "Create Account & Continue"}
              </Button>
            </form>
            <div className="mt-5 pt-4 border-t border-border/40 text-center text-sm">
              Already have an account?{" "}
              <Link href="/app" className="text-primary font-medium hover:underline">Sign in</Link>
            </div>
            <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <Sparkles className="h-3 w-3 text-primary/50" /> 14-day free trial · Cancel anytime
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

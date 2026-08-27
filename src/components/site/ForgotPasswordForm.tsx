"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  ShieldCheck,
  ArrowLeft,
  ArrowRight,
  Loader2,
  Mail,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

/**
 * Standalone auth screen: request a password reset link.
 * Form submissions are MOCK — simulate a 1s network delay and
 * show a generic success state that does NOT leak whether the
 * email is registered (account-enumereration defense).
 */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      // Mock 1s delay simulating a reset-link email dispatch.
      await new Promise((r) => setTimeout(r, 1000));
      setSent(true);
      toast.success("Reset link sent", {
        description: "Check your inbox for the password reset link.",
      });
    } catch (err) {
      toast.error((err as Error).message || "Failed to send reset link");
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
        <Link
          href="/"
          className="flex items-center gap-2.5 mb-6 justify-center group"
          aria-label="Z-CRM home"
        >
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-primary-foreground shadow-glow group-hover:scale-105 transition-transform">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <span className="font-bold text-xl gradient-text">Z-CRM</span>
        </Link>

        <Card className="shadow-pop glass border-border/40">
          {sent ? (
            <CardHeader className="space-y-1 pb-4 text-center">
              <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-xl tracking-tight">Check your inbox</CardTitle>
              <CardDescription className="text-[13px] leading-relaxed">
                If an account exists with{" "}
                <span className="font-medium text-foreground">{email}</span>, we&rsquo;ve
                sent a reset link. Check your inbox (and spam folder).
              </CardDescription>
            </CardHeader>
          ) : (
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-xl tracking-tight">Forgot your password?</CardTitle>
              <CardDescription>
                Enter your account email and we&rsquo;ll send you a secure link to reset it.
              </CardDescription>
            </CardHeader>
          )}

          <CardContent>
            {sent ? (
              <div className="space-y-4">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-10"
                  onClick={() => {
                    setSent(false);
                    setEmail("");
                  }}
                >
                  Use a different email
                </Button>
                <div className="pt-4 border-t border-border/40 text-center text-sm">
                  Remembered your password?{" "}
                  <Link href="/app" className="text-primary font-medium hover:underline">
                    Sign in
                  </Link>
                </div>
              </div>
            ) : (
              <>
                <form onSubmit={submit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        placeholder="you@example.com"
                        className="h-10 pl-9"
                        autoComplete="email"
                      />
                    </div>
                  </div>
                  <Button type="submit" className="w-full h-10 shadow-soft" disabled={loading}>
                    {loading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <ArrowRight className="h-4 w-4 mr-2" />
                    )}
                    {loading ? "Sending link…" : "Send reset link"}
                  </Button>
                </form>

                <div className="mt-5 pt-4 border-t border-border/40 text-center text-sm">
                  Remembered your password?{" "}
                  <Link href="/app" className="text-primary font-medium hover:underline">
                    Sign in
                  </Link>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <div className="mt-6 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}

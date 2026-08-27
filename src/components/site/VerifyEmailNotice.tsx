"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
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
 * Standalone auth screen: post-registration email verification notice.
 * Shows the "verify your email" hero, a mock "resend verification
 * email" button (debounced 1s), and a link to continue to /app
 * once the user has clicked the verification link in their inbox.
 */
export function VerifyEmailNotice() {
  const [sending, setSending] = useState(false);

  async function resend() {
    setSending(true);
    try {
      // Mock 1s delay simulating the verification email dispatch.
      await new Promise((r) => setTimeout(r, 1000));
      toast.success("Verification email sent", {
        description: "Check your inbox (and spam folder) for the activation link.",
      });
    } catch (err) {
      toast.error((err as Error).message || "Failed to resend verification email");
    } finally {
      setSending(false);
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
          <CardHeader className="space-y-1 pb-4 text-center">
            <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Mail className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-xl tracking-tight">Verify your email</CardTitle>
            <CardDescription className="text-[13px] leading-relaxed">
              We sent a verification link to your email. Click the link to activate
              your account and start using Z-CRM.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <Button
              type="button"
              variant="outline"
              className="w-full h-10"
              onClick={resend}
              disabled={sending}
            >
              {sending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Mail className="h-4 w-4 mr-2" />
              )}
              {sending ? "Sending…" : "Resend verification email"}
            </Button>

            <Button asChild className="w-full h-10 shadow-soft">
              <Link href="/app">
                <CheckCircle2 className="h-4 w-4 mr-2" />
                I&rsquo;ve verified — continue to dashboard
              </Link>
            </Button>

            <div className="pt-4 border-t border-border/40 text-center text-sm">
              Need a new account?{" "}
              <Link href="/register" className="text-primary font-medium hover:underline">
                Sign up
              </Link>
            </div>
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

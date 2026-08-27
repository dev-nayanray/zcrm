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
  Eye,
  EyeOff,
  KeyRound,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

interface ResetPasswordFormProps {
  /** Reset token from the ?token=xxx URL query (mock — not validated). */
  token?: string;
}

/**
 * Standalone auth screen: choose a new password after clicking the
 * reset link in the email. The `token` is read from the URL query
 * server-side and forwarded here; in this mock we accept the form
 * regardless of token presence but warn if it's missing.
 */
export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function validate(): string | null {
    if (password.length < 8) return "Password must be at least 8 characters.";
    if (password !== confirm) return "Passwords do not match.";
    return null;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const v = validate();
    if (v) {
      setError(v);
      toast.error(v);
      return;
    }
    setLoading(true);
    try {
      // Mock 1s delay simulating the password update API call.
      await new Promise((r) => setTimeout(r, 1000));
      setDone(true);
      toast.success("Password reset successfully", {
        description: "You can now sign in with your new password.",
      });
    } catch (err) {
      toast.error((err as Error).message || "Failed to reset password");
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
          {done ? (
            <CardHeader className="space-y-1 pb-4 text-center">
              <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-xl tracking-tight">Password reset successfully</CardTitle>
              <CardDescription className="text-[13px] leading-relaxed">
                You can now sign in with your new password.
              </CardDescription>
            </CardHeader>
          ) : (
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-xl tracking-tight">Reset your password</CardTitle>
              <CardDescription>
                Choose a new password for your Z-CRM account. Use at least 8 characters.
              </CardDescription>
            </CardHeader>
          )}

          <CardContent>
            {done ? (
              <div className="space-y-4">
                <Button asChild className="w-full h-10 shadow-soft">
                  <Link href="/app">
                    <ArrowRight className="h-4 w-4 mr-2" />
                    Continue to sign in
                  </Link>
                </Button>
                <div className="pt-4 border-t border-border/40 text-center text-sm">
                  Need help?{" "}
                  <Link href="/contact" className="text-primary font-medium hover:underline">
                    Contact support
                  </Link>
                </div>
              </div>
            ) : (
              <>
                {!token && (
                  <div className="mb-4 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
                    No reset token was found in the link. For security, please use
                    the link from your reset email.
                  </div>
                )}
                <form onSubmit={submit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="password">New password</Label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <Input
                        id="password"
                        type={showPwd ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={8}
                        placeholder="Min 8 characters"
                        className="h-10 pl-9 pr-10"
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPwd((v) => !v)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        aria-label={showPwd ? "Hide password" : "Show password"}
                      >
                        {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm">Confirm password</Label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <Input
                        id="confirm"
                        type={showConfirm ? "text" : "password"}
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        required
                        minLength={8}
                        placeholder="Re-enter your new password"
                        className="h-10 pl-9 pr-10"
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm((v) => !v)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        aria-label={showConfirm ? "Hide password" : "Show password"}
                      >
                        {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <p className="text-xs text-destructive" role="alert">
                      {error}
                    </p>
                  )}

                  <Button type="submit" className="w-full h-10 shadow-soft" disabled={loading}>
                    {loading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <ArrowRight className="h-4 w-4 mr-2" />
                    )}
                    {loading ? "Resetting password…" : "Reset password"}
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

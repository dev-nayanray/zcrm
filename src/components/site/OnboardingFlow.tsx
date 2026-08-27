"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ShieldCheck,
  ArrowLeft,
  ArrowRight,
  Loader2,
  Check,
  CheckCircle2,
  Store,
  Package,
  Plug,
  Users,
} from "lucide-react";
import { toast } from "sonner";

type BusinessType =
  | "E-commerce"
  | "Retail"
  | "Wholesale"
  | "Distribution"
  | "Service"
  | "Other";

type InviteRole = "ADMIN" | "MANAGER" | "SALES" | "INVENTORY" | "ACCOUNTANT";

interface Invite {
  email: string;
  role: InviteRole;
}

const BUSINESS_TYPES: BusinessType[] = [
  "E-commerce",
  "Retail",
  "Wholesale",
  "Distribution",
  "Service",
  "Other",
];

const ROLE_LABELS: Record<InviteRole, string> = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  SALES: "Sales",
  INVENTORY: "Inventory",
  ACCOUNTANT: "Accountant",
};

const INTEGRATIONS = [
  {
    id: "woocommerce",
    name: "WooCommerce",
    description: "Sync products & orders from your WooCommerce store.",
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    description: "Receive orders and reply to customers from WhatsApp.",
  },
  {
    id: "telegram",
    name: "Telegram",
    description: "Operate your CRM via a Telegram bot in your team group.",
  },
] as const;

const STEP_META = [
  { title: "Business info", description: "Tell us about your business so we can tailor the dashboard.", icon: Store },
  { title: "Add your first product", description: "Optional — you can add products later.", icon: Package },
  { title: "Connect integrations", description: "Optional — connect the channels you sell on.", icon: Plug },
  { title: "Invite team members", description: "Optional — invite teammates now or later.", icon: Users },
] as const;

const TOTAL_STEPS = STEP_META.length;

export function OnboardingFlow() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  // Step 1 — business info
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState<BusinessType | "">("");

  // Step 2 — first product (optional)
  const [productName, setProductName] = useState("");
  const [sku, setSku] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");

  // Step 3 — integrations
  const [integrations, setIntegrations] = useState<Record<string, boolean>>({
    woocommerce: false,
    whatsapp: false,
    telegram: false,
  });

  // Step 4 — invites
  const [invites, setInvites] = useState<Invite[]>([
    { email: "", role: "SALES" },
  ]);

  const stepInfo = STEP_META[step];
  const StepIcon = stepInfo.icon;

  const isLastStep = step === TOTAL_STEPS - 1;
  const isOptionalStep = step >= 1; // Steps 2–4 are optional

  function validateCurrentStep(): string | null {
    if (step === 0) {
      if (!businessName.trim()) return "Business name is required.";
      if (!businessType) return "Please select a business type.";
    }
    // Steps 1–3 are optional; nothing to validate.
    return null;
  }

  function next() {
    const err = validateCurrentStep();
    if (err) {
      toast.error(err);
      return;
    }
    if (isLastStep) {
      finish();
      return;
    }
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  }

  function back() {
    setStep((s) => Math.max(s - 1, 0));
  }

  function skip() {
    if (isLastStep) {
      finish();
      return;
    }
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  }

  async function finish() {
    setLoading(true);
    try {
      // Mock 1s delay simulating the onboarding persistence call.
      await new Promise((r) => setTimeout(r, 1000));
      setDone(true);
      toast.success("Welcome to Z-CRM!", {
        description: "Your workspace is ready. Let's get to work.",
      });
    } catch (err) {
      toast.error((err as Error).message || "Failed to complete onboarding");
    } finally {
      setLoading(false);
    }
  }

  function addInvite() {
    setInvites((arr) => [...arr, { email: "", role: "SALES" }]);
  }

  function removeInvite(idx: number) {
    setInvites((arr) => arr.filter((_, i) => i !== idx));
  }

  function updateInvite(idx: number, patch: Partial<Invite>) {
    setInvites((arr) =>
      arr.map((inv, i) => (i === idx ? { ...inv, ...patch } : inv)),
    );
  }

  const progress = useMemo(() => ((step + 1) / TOTAL_STEPS) * 100, [step]);

  // ── Success state ────────────────────────────────────────────
  if (done) {
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
              <div className="mx-auto mb-3 h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                <CheckCircle2 className="h-7 w-7 text-primary" />
              </div>
              <CardTitle className="text-2xl tracking-tight">Welcome to Z-CRM!</CardTitle>
              <CardDescription className="text-[13px] leading-relaxed">
                Your workspace is set up and ready to go.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                className="w-full h-10 shadow-soft"
                onClick={() => router.push("/app")}
              >
                <ArrowRight className="h-4 w-4 mr-2" />
                Go to dashboard
              </Button>
              <div className="pt-4 border-t border-border/40 text-center text-sm">
                Want to tweak something?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setDone(false);
                    setStep(0);
                  }}
                  className="text-primary font-medium hover:underline"
                >
                  Revisit setup
                </button>
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

  // ── Wizard state ─────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center p-4 app-bg relative overflow-hidden">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-cyan-500/15 blur-3xl" />
      </div>

      <div className="w-full max-w-lg">
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
          {/* Progress indicator */}
          <div className="px-6 pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">
                Step {step + 1} of {TOTAL_STEPS}
              </span>
              <span className="text-xs text-muted-foreground">{Math.round(progress)}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted/50 overflow-hidden" role="progressbar" aria-valuenow={step + 1} aria-valuemin={1} aria-valuemax={TOTAL_STEPS}>
              <div
                className="h-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            {/* Step dots */}
            <div className="mt-3 flex items-center justify-center gap-1.5">
              {STEP_META.map((s, i) => {
                const SIcon = s.icon;
                const active = i === step;
                const complete = i < step;
                return (
                  <div
                    key={i}
                    className={[
                      "flex h-7 w-7 items-center justify-center rounded-full border transition-all",
                      complete
                        ? "bg-primary/10 border-primary/30 text-primary"
                        : active
                          ? "bg-primary text-primary-foreground border-primary shadow-glow"
                          : "bg-transparent border-border/50 text-muted-foreground",
                    ].join(" ")}
                    aria-current={active ? "step" : undefined}
                    aria-label={`Step ${i + 1}: ${s.title}`}
                  >
                    {complete ? <Check className="h-3.5 w-3.5" /> : <SIcon className="h-3.5 w-3.5" />}
                  </div>
                );
              })}
            </div>
          </div>

          <CardHeader className="space-y-1 pb-4 pt-5">
            <CardTitle className="text-xl tracking-tight flex items-center gap-2">
              <StepIcon className="h-5 w-5 text-primary" />
              {stepInfo.title}
            </CardTitle>
            <CardDescription>{stepInfo.description}</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* ── Step 1: Business info ─────────────────────── */}
            {step === 0 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="businessName">Business name</Label>
                  <Input
                    id="businessName"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    required
                    placeholder="e.g. Dhaka Electronics"
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="businessType">Business type</Label>
                  <Select
                    value={businessType}
                    onValueChange={(v) => setBusinessType(v as BusinessType)}
                  >
                    <SelectTrigger id="businessType" className="w-full h-10" aria-label="Business type">
                      <SelectValue placeholder="Select a type" />
                    </SelectTrigger>
                    <SelectContent>
                      {BUSINESS_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* ── Step 2: First product ─────────────────────── */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="productName">Product name</Label>
                  <Input
                    id="productName"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    placeholder="e.g. Wireless Mouse"
                    className="h-10"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="sku">SKU</Label>
                    <Input
                      id="sku"
                      value={sku}
                      onChange={(e) => setSku(e.target.value)}
                      placeholder="WM-001"
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="price">Price (৳)</Label>
                    <Input
                      id="price"
                      type="number"
                      min="0"
                      step="0.01"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="0.00"
                      className="h-10"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stock">Opening stock</Label>
                  <Input
                    id="stock"
                    type="number"
                    min="0"
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                    placeholder="0"
                    className="h-10"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Tip: you can leave any of these blank — products can be added later from the dashboard.
                </p>
              </div>
            )}

            {/* ── Step 3: Integrations ──────────────────────── */}
            {step === 2 && (
              <div className="space-y-3">
                {INTEGRATIONS.map((it) => (
                  <label
                    key={it.id}
                    htmlFor={`int-${it.id}`}
                    className="flex items-start gap-3 rounded-lg border border-border/40 p-3 cursor-pointer hover:bg-muted/30 transition-colors"
                  >
                    <Checkbox
                      id={`int-${it.id}`}
                      checked={!!integrations[it.id]}
                      onCheckedChange={(c) =>
                        setIntegrations((prev) => ({ ...prev, [it.id]: c === true }))
                      }
                      className="mt-0.5"
                    />
                    <span className="flex-1">
                      <span className="block text-sm font-medium">{it.name}</span>
                      <span className="block text-xs text-muted-foreground">{it.description}</span>
                    </span>
                  </label>
                ))}
                <p className="text-xs text-muted-foreground">
                  You can connect or disconnect any integration later from the dashboard.
                </p>
              </div>
            )}

            {/* ── Step 4: Invite team ──────────────────────── */}
            {step === 3 && (
              <div className="space-y-3">
                {invites.map((inv, idx) => (
                  <div key={idx} className="flex items-end gap-2">
                    <div className="flex-1 space-y-2">
                      <Label htmlFor={`invite-email-${idx}`} className="sr-only">
                        Team member email
                      </Label>
                      <Input
                        id={`invite-email-${idx}`}
                        type="email"
                        value={inv.email}
                        onChange={(e) => updateInvite(idx, { email: e.target.value })}
                        placeholder="teammate@example.com"
                        className="h-10"
                      />
                    </div>
                    <div className="w-32 space-y-2">
                      <Label htmlFor={`invite-role-${idx}`} className="sr-only">
                        Role
                      </Label>
                      <Select
                        value={inv.role}
                        onValueChange={(v) => updateInvite(idx, { role: v as InviteRole })}
                      >
                        <SelectTrigger id={`invite-role-${idx}`} className="h-10 w-full" aria-label="Role">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(ROLE_LABELS) as InviteRole[]).map((r) => (
                            <SelectItem key={r} value={r}>
                              {ROLE_LABELS[r]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {invites.length > 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-10 w-10 shrink-0"
                        onClick={() => removeInvite(idx)}
                        aria-label="Remove invite"
                      >
                        <ArrowLeft className="h-4 w-4 rotate-45" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={addInvite}
                >
                  + Add another
                </Button>
                <p className="text-xs text-muted-foreground">
                  Invitations are sent when you complete setup. You can invite more people later.
                </p>
              </div>
            )}

            {/* ── Footer nav ─────────────────────────────────── */}
            <div className="flex items-center justify-between gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                className="h-10"
                onClick={back}
                disabled={step === 0 || loading}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <div className="flex items-center gap-2">
                {isOptionalStep && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-10"
                    onClick={skip}
                    disabled={loading}
                  >
                    Skip for now
                  </Button>
                )}
                <Button
                  type="button"
                  className="h-10 shadow-soft"
                  onClick={next}
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : isLastStep ? (
                    <Check className="h-4 w-4 mr-2" />
                  ) : (
                    <ArrowRight className="h-4 w-4 mr-2" />
                  )}
                  {loading
                    ? "Finishing…"
                    : isLastStep
                      ? "Complete setup"
                      : "Continue"}
                </Button>
              </div>
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

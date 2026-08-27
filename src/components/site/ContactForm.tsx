"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Check, AlertCircle } from "lucide-react";
import { toast } from "sonner";

type Status = "idle" | "submitting" | "success" | "error";

export function ContactForm() {
  const [form, setForm] = useState({ name: "", email: "", company: "", message: "" });
  const [status, setStatus] = useState<Status>("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) {
      toast.error("Name, email, and message are required");
      return;
    }
    setStatus("submitting");
    try {
      // Simulate API submission — in production this would POST to /api/v1/contact
      await new Promise((r) => setTimeout(r, 1200));
      setStatus("success");
      toast.success("Thanks! We'll get back to you within 24 hours.");
      setForm({ name: "", email: "", company: "", message: "" });
    } catch (e) {
      setStatus("error");
      toast.error("Something went wrong. Please email us directly at hello@z-crm.app");
    }
  }

  if (status === "success") {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-8 text-center">
        <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-emerald-500/15 text-emerald-600 mb-4">
          <Check className="h-6 w-6" />
        </div>
        <h3 className="font-semibold text-lg mb-1">Message sent!</h3>
        <p className="text-sm text-muted-foreground mb-4">We'll get back to you within 24 hours.</p>
        <Button variant="outline" size="sm" onClick={() => setStatus("idle")}>Send another message</Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name *</Label>
          <Input
            id="name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            placeholder="Your name"
            className="h-10"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email *</Label>
          <Input
            id="email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
            placeholder="you@example.com"
            className="h-10"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="company">Company (optional)</Label>
        <Input
          id="company"
          value={form.company}
          onChange={(e) => setForm({ ...form, company: e.target.value })}
          placeholder="Your business name"
          className="h-10"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="message">Message *</Label>
        <Textarea
          id="message"
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
          required
          rows={5}
          placeholder="How can we help?"
          className="resize-none"
        />
      </div>
      {status === "error" && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 text-sm text-rose-700 dark:text-rose-400">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>Something went wrong. Please email us directly at hello@z-crm.app</span>
        </div>
      )}
      <Button type="submit" disabled={status === "submitting"} className="w-full h-10">
        {status === "submitting" ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Sending...
          </>
        ) : (
          <>
            Send message
          </>
        )}
      </Button>
    </form>
  );
}

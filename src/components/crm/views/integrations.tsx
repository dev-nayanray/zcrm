"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { useCrmStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, ShieldCheck, Webhook, RefreshCw, Trash2, Plug, MessageSquare, Phone, Truck, Zap, Send } from "lucide-react";
import { PageHeader, StatusBadge, DataTable } from "../ui";
import { toast } from "sonner";
import { formatDate } from "@/lib/date-range";

export function IntegrationsView() {
  const { navigate } = useCrmStore();
  const cards = [
    { name: "WooCommerce", desc: "Website orders & product sync with idempotent webhooks.", icon: Webhook, nav: "integrations/woocommerce" as const },
    { name: "Meta / Facebook / Instagram", desc: "Page, Messenger, Instagram & Lead Ads. Multiple connections supported.", icon: MessageSquare, nav: "integrations/meta" as const },
    { name: "WhatsApp Business", desc: "Cloud API integration with inbox, conversations & order conversion.", icon: Phone, nav: "integrations/whatsapp" as const },
    { name: "Telegram Bot", desc: "Quick operational control center. Group → Role → Permission. English + Bangla.", icon: Send, nav: "integrations/telegram" as const },
    { name: "Couriers", desc: "Bangladesh courier abstraction (Pathao, Steadfast, RedX, Other) with mock mode.", icon: Truck, nav: "integrations/couriers" as const },
    { name: "Automation", desc: "Event → Rule → Action engine. Fires AFTER business transactions, never blocks.", icon: Zap, nav: "integrations/automation" as const },
    { name: "Integration Logs", desc: "Unified webhook event log with retry across all providers.", icon: ShieldCheck, nav: "integrations/logs" as const },
  ];

  return (
    <div>
      <PageHeader title="Integrations" description="All channels use the same core services: OrderService, InventoryService, AccountingService." />
      <div className="grid md:grid-cols-2 gap-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Card key={c.name}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0"><Icon className="h-5 w-5" /></div>
                  <div className="flex-1">
                    <h3 className="font-semibold">{c.name}</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">{c.desc}</p>
                    <Button size="sm" variant="outline" className="mt-3" onClick={() => navigate(c.nav, {})}>Configure <Plug className="h-3.5 w-3.5 ml-1" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

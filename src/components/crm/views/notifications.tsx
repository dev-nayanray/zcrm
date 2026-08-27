"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Bell, Check } from "lucide-react";
import { PageHeader, StatusBadge, EmptyState } from "../ui";
import { toast } from "sonner";
import { formatDate } from "@/lib/date-range";

type Notif = { id: string; type: string; title: string; message: string; link?: string | null; isRead: boolean; createdAt: string };

export function NotificationsView() {
  const [rows, setRows] = useState<Notif[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const r = await api.get<{ items: Notif[]; total: number }>(`/api/v1/notifications?limit=50&page=${page}`);
      setRows(r.items); setTotal(r.total);
    } catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [page]);

  async function markAll() {
    try { await api.patch("/api/v1/notifications"); toast.success("All marked read"); load(); }
    catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div>
      <PageHeader title="Notifications" description="In-app alerts. Designed for future email/WhatsApp delivery." action={
        <Button variant="outline" size="sm" onClick={markAll}><Check className="h-4 w-4 mr-1" /> Mark all read</Button>
      } />
      {rows.length === 0 ? (
        <EmptyState icon={Bell} title="No notifications" description="System alerts (low stock, failed sync, pending payments) will appear here." />
      ) : (
        <div className="space-y-2">
          {rows.map((n) => (
            <div key={n.id} className={`rounded-md border p-3 flex items-start gap-3 ${!n.isRead ? "bg-primary/5" : ""}`}>
              <div className={`h-2 w-2 rounded-full mt-1.5 shrink-0 ${n.isRead ? "bg-transparent" : "bg-primary"}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2"><span className="font-medium">{n.title}</span><StatusBadge status={n.type} /></div>
                <p className="text-sm text-muted-foreground">{n.message}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{formatDate(n.createdAt)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

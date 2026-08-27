"use client";
import { useEffect, useState } from "react";
import { api, money } from "@/lib/api-client";
import { useCrmStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge, StatCard } from "../ui";
import { toast } from "sonner";
import { formatDate } from "@/lib/date-range";
import { ShieldCheck, Mail, Phone, Calendar, CreditCard, Wallet, Save, LogOut, Moon, Sun, Bell } from "lucide-react";
import { ROLES } from "@/lib/constants";

export function ProfileView() {
  const { user, theme, toggleTheme, navigate, setUser } = useCrmStore();
  const [profile, setProfile] = useState<any>(null);
  const [sub, setSub] = useState<any>(null);
  const [wallet, setWallet] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [p, s, w] = await Promise.all([
          api.get<any>("/api/v1/auth/register").catch(() => null),
          api.get<any>("/api/v1/billing/subscription").catch(() => null),
          api.get<any>("/api/v1/billing/wallet").catch(() => null),
        ]);
        if (cancelled) return;
        setProfile(p); setSub(s); setWallet(w);
        setName(p?.name ?? user?.name ?? ""); setPhone(p?.phone ?? "");
      } catch (e) { toast.error((e as Error).message); }
      finally { if (!cancelled) setLoading(false); }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  async function saveProfile() {
    setSavingProfile(true);
    try {
      const data: any = { name, phone };
      if (newPassword) data.password = newPassword;
      await api.put("/api/v1/auth/register", data);
      toast.success("Profile updated");
      setEditing(false); setNewPassword("");
      setUser({ ...user!, name });
      const p = await api.get<any>("/api/v1/auth/register");
      setProfile(p);
    } catch (e) { toast.error((e as Error).message); }
    finally { setSavingProfile(false); }
  }

  async function logout() {
    try {
      await api.post("/api/v1/auth/logout");
      setUser(null);
      window.location.href = "/";
    } catch (e) { toast.error((e as Error).message); }
  }

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading profile…</div>;

  const initials = (profile?.name || user?.name || "U").split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div>
      {/* Hero header */}
      <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6 mb-6 relative overflow-hidden">
        <div className="absolute -top-20 -right-20 h-40 w-40 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-primary-foreground text-2xl font-bold shadow-glow shrink-0">
            {initials}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight">{profile?.name || user?.name}</h1>
            <p className="text-muted-foreground text-sm mt-0.5">{profile?.email || user?.email}</p>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <StatusBadge status={profile?.role?.name || user?.role || "SALES"} />
              {profile?.isActive && <span className="text-xs text-emerald-600 flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Active</span>}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setEditing(!editing)}>
            {editing ? "Cancel" : "Edit Profile"}
          </Button>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Wallet Balance" value={money(wallet?.balance ?? "0")} icon={Wallet} tone="emerald" />
        <StatCard label="Subscription" value={sub?.plan ?? "Free"} icon={CreditCard} tone="blue" />
        <StatCard label="Member Since" value={profile?.createdAt ? formatDate(profile.createdAt).slice(0, 10) : "—"} icon={Calendar} tone="violet" />
        <StatCard label="Last Login" value={profile?.lastLoginAt ? formatDate(profile.lastLoginAt).slice(0, 16) : "—"} icon={ShieldCheck} tone="amber" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Profile info */}
        <Card className="shadow-soft card-hover">
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Profile Information</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {editing ? (
              <>
                <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} className="h-9" /></div>
                <div><Label>Email (read-only)</Label><Input value={profile?.email || user?.email} disabled className="h-9 text-muted-foreground" /></div>
                <div><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} className="h-9" /></div>
                <div><Label>New Password (leave blank to keep current)</Label><Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" className="h-9" /></div>
                <Button onClick={saveProfile} disabled={savingProfile} size="sm"><Save className="h-4 w-4 mr-1" /> {savingProfile ? "Saving…" : "Save Changes"}</Button>
              </>
            ) : (
              <>
                <InfoRow icon={ShieldCheck} label="Name" value={profile?.name || user?.name} />
                <InfoRow icon={Mail} label="Email" value={profile?.email || user?.email} />
                <InfoRow icon={Phone} label="Phone" value={profile?.phone || "—"} />
                <InfoRow icon={Calendar} label="Member Since" value={profile?.createdAt ? formatDate(profile.createdAt) : "—"} />
              </>
            )}
          </CardContent>
        </Card>

        {/* Subscription */}
        <Card className="shadow-soft card-hover">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base flex items-center gap-2"><CreditCard className="h-4 w-4" /> Subscription</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate("billing")}>Manage</Button>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {sub ? (
              <>
                <div className="flex justify-between"><span className="text-muted-foreground">Plan</span><span className="font-bold text-lg gradient-text">{sub.plan}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Status</span><StatusBadge status={sub.status} /></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span className="font-medium">{money(sub.amount)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">End Date</span><span className="text-xs">{sub.endDate ? formatDate(sub.endDate) : "Lifetime ♾️"}</span></div>
                <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => navigate("billing/checkout")}>Renew / Upgrade</Button>
              </>
            ) : (
              <div className="text-center py-4">
                <p className="text-muted-foreground mb-3">No active subscription</p>
                <Button size="sm" onClick={() => navigate("billing/checkout")}>Choose a Plan</Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Preferences */}
        <Card className="shadow-soft card-hover">
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Bell className="h-4 w-4" /> Preferences</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Theme</p>
                <p className="text-xs text-muted-foreground">Switch between light and dark mode</p>
              </div>
              <Button variant="outline" size="sm" onClick={toggleTheme}>
                {theme === "light" ? <><Moon className="h-3.5 w-3.5 mr-1" /> Dark</> : <><Sun className="h-3.5 w-3.5 mr-1" /> Light</>}
              </Button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Language</p>
                <p className="text-xs text-muted-foreground">English / বাংলা</p>
              </div>
              <span className="text-xs text-muted-foreground">English</span>
            </div>
          </CardContent>
        </Card>

        {/* Quick links */}
        <Card className="shadow-soft card-hover">
          <CardHeader className="pb-2"><CardTitle className="text-base">Quick Links</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => navigate("billing")}><CreditCard className="h-3.5 w-3.5 mr-2" /> Billing & Subscription</Button>
            <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => navigate("billing/wallet")}><Wallet className="h-3.5 w-3.5 mr-2" /> Wallet</Button>
            <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => navigate("notifications")}><Bell className="h-3.5 w-3.5 mr-2" /> Notifications</Button>
            <Button variant="outline" size="sm" className="w-full justify-start text-red-600 hover:text-red-700" onClick={logout}><LogOut className="h-3.5 w-3.5 mr-2" /> Sign Out</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="h-8 w-8 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium truncate">{value}</p>
      </div>
    </div>
  );
}

void ROLES;

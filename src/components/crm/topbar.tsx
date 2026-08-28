"use client";
import { useEffect, useState, useRef } from "react";
import { useCrmStore } from "@/lib/store";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bell, LogOut, Menu, Moon, Plus, Search, Sun, User as UserIcon, ShoppingCart, Users, Package, Truck, Receipt, Wallet, ArrowRightLeft, Boxes } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { MobileNav } from "./sidebar";

export function Topbar() {
  const { user, theme, toggleTheme, setUser, navigate, sidebarOpen, setSidebarOpen } = useCrmStore();
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<{ id: string; title: string; message: string; isRead: boolean; link?: string }[]>([]);
  const [unread, setUnread] = useState(0);

  // Global search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ label: string; items: { type: string; id: string; label: string; subtitle: string; route: string; meta?: string }[] }[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLDivElement | null>(null);

  // Debounced global search
  useEffect(() => {
    if (searchQuery.length < 2) { setSearchResults([]); setSearchOpen(false); return; }
    setSearchLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await api.get<{ query: string; groups: typeof searchResults }>(`/api/v1/search?q=${encodeURIComponent(searchQuery)}&limit=5`);
        setSearchResults(res.groups);
        setSearchOpen(true);
      } catch { setSearchResults([]); }
      finally { setSearchLoading(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    let cancelled = false;
    const doLoad = async () => {
      try {
        const res = await api.get<{ items: any[] }>("/api/v1/notifications?limit=10");
        if (cancelled) return;
        setNotifications(res.items);
        setUnread(res.items.filter((n) => !n.isRead).length);
      } catch { /* ignore */ }
    };
    doLoad();
    const t = setInterval(doLoad, 60000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  async function markAllRead() {
    try {
      await api.patch("/api/v1/notifications");
      const res = await api.get<{ items: any[] }>("/api/v1/notifications?limit=10");
      setNotifications(res.items);
      setUnread(res.items.filter((n) => !n.isRead).length);
    } catch (e) { toast.error((e as Error).message); }
  }

  async function logout() {
    try {
      await api.post("/api/v1/auth/logout");
      setUser(null);
      toast.success("Signed out");
    } catch (e) { toast.error((e as Error).message); }
  }

  const initials = (user?.name || "U").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  const quickCreateItems = [
    { label: "New Order", icon: ShoppingCart, route: "orders/new", perm: "orders:create" },
    { label: "New Customer", icon: Users, route: "customers", perm: "customers:create" },
    { label: "New Product", icon: Package, route: "products", perm: "products:create" },
    { label: "New Purchase", icon: Truck, route: "purchases", perm: "purchases:create" },
    { label: "New Expense", icon: Receipt, route: "expenses", perm: "expenses:create" },
    { label: "New Payment", icon: Wallet, route: "payments", perm: "payments:create" },
    { label: "New Delivery", icon: Truck, route: "deliveries", perm: "deliveries:update" },
    { label: "Stock Adjustment", icon: ArrowRightLeft, route: "inventory", perm: "inventory:adjust" },
  ];

  const canSee = (perm: string) => !perm || user?.permissions?.includes(perm) || user?.role === "SUPER_ADMIN" || user?.role === "ADMIN";
  const visibleQuickItems = quickCreateItems.filter((i) => canSee(i.perm));

  return (
    <>
      <header className="h-16 border-b border-border/60 glass top-0 z-40 flex items-center gap-2 px-3 md:px-6 shrink-0">
        <Button variant="ghost" size="icon" className="md:hidden hover:bg-accent" onClick={() => setSidebarOpen(!sidebarOpen)}>
          <Menu className="h-5 w-5" />
        </Button>
        <div className="hidden sm:flex flex-1 max-w-md relative" ref={searchInputRef}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
          <Input
            placeholder="Search customers, products, orders…"
            className="pl-9 h-9 bg-muted/50 border-transparent focus-visible:bg-card"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") { setSearchOpen(false); setSearchQuery(""); (e.target as HTMLInputElement).blur(); }
              if (e.key === "Enter" && searchResults.length > 0) {
                const firstItem = searchResults[0].items[0];
                if (firstItem) { navigate(firstItem.route as any, { id: firstItem.id }); setSearchOpen(false); setSearchQuery(""); }
              }
            }}
            onFocus={() => { if (searchResults.length > 0) setSearchOpen(true); }}
          />
          <kbd className="hidden lg:inline-flex absolute right-3 top-1/2 -translate-y-1/2 items-center gap-0.5 rounded border border-border/60 bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground pointer-events-none">⏎</kbd>

          {/* Global search results dropdown */}
          {searchOpen && searchQuery.length >= 2 && (
            <div className="absolute top-full left-0 right-0 mt-1 rounded-xl border border-border/80 bg-card shadow-pop overflow-hidden z-50 max-h-96 overflow-y-auto">
              {searchLoading ? (
                <div className="py-6 text-center text-sm text-muted-foreground">Searching…</div>
              ) : searchResults.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">No results for "{searchQuery}"</div>
              ) : (
                searchResults.map((group) => (
                  <div key={group.label}>
                    <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/40">{group.label}</p>
                    {group.items.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => { navigate(item.route as any, { id: item.id }); setSearchOpen(false); setSearchQuery(""); }}
                        className="w-full flex items-center justify-between gap-2 px-3 py-2 hover:bg-accent text-sm text-left transition-colors"
                      >
                        <div className="min-w-0">
                          <div className="font-medium truncate">{item.label}</div>
                          <div className="text-xs text-muted-foreground truncate">{item.subtitle}</div>
                        </div>
                        {item.meta && <span className="text-[10px] text-muted-foreground shrink-0">{item.meta}</span>}
                      </button>
                    ))}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
        <div className="flex-1 sm:hidden" />

        {/* Quick Create dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" className="shadow-soft gap-1.5">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Create</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 shadow-pop">
            <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">Quick Create</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {visibleQuickItems.map((item) => {
              const Icon = item.icon;
              return (
                <DropdownMenuItem key={item.label} onClick={() => navigate(item.route as any)} className="gap-2.5 cursor-pointer py-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span>{item.label}</span>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme" className="hover:bg-accent">
          {theme === "light" ? <Moon className="h-[18px] w-[18px]" /> : <Sun className="h-[18px] w-[18px]" />}
        </Button>
        <DropdownMenu open={notifOpen} onOpenChange={setNotifOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative hover:bg-accent" aria-label="Notifications">
              <Bell className="h-[18px] w-[18px]" />
              {unread > 0 && <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1.5 text-[10px] font-semibold bg-destructive text-destructive-foreground rounded-full flex items-center justify-center ring-2 ring-card">{unread}</span>}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 p-0 shadow-pop">
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/60">
              <span className="text-sm font-semibold">Notifications</span>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={markAllRead}>Mark all read</Button>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">No notifications</div>
              ) : (
                notifications.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => { if (n.link) navigate("notifications"); setNotifOpen(false); }}
                    className="w-full text-left px-3 py-2.5 hover:bg-accent border-b border-border/40 last:border-0 transition-colors"
                  >
                    <div className="flex items-start gap-2.5">
                      <span className={`mt-1 h-2 w-2 rounded-full shrink-0 ${n.isRead ? "bg-transparent" : "bg-primary"}`} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{n.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.message}</p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("notifications")} className="py-2 justify-center font-medium">View all notifications</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-10 gap-2 px-1.5 hover:bg-accent rounded-full">
              <Avatar className="h-8 w-8 ring-2 ring-border"><AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">{initials}</AvatarFallback></Avatar>
              <span className="hidden sm:inline text-sm font-medium">{user?.name}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 shadow-pop">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span>{user?.name}</span>
                <span className="text-xs text-muted-foreground font-normal">{user?.email}</span>
                <span className="text-[10px] mt-1 inline-flex items-center px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground w-fit">{user?.role}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("profile")}>
              <UserIcon className="h-4 w-4 mr-2" /> Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("settings")}>
              <UserIcon className="h-4 w-4 mr-2" /> Settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={logout}>
              <LogOut className="h-4 w-4 mr-2" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>
      <MobileNav />
    </>
  );
}

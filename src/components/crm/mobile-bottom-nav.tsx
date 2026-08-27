"use client";
import { useCrmStore, type RouteKey } from "@/lib/store";
import { cn } from "@/lib/utils";
import { LayoutDashboard, ShoppingCart, Inbox, CreditCard, User } from "lucide-react";

const NAV_ITEMS: { label: string; route: RouteKey; icon: React.ComponentType<{ className?: string }>; matchPrefix?: string }[] = [
  { label: "Home", route: "dashboard", icon: LayoutDashboard },
  { label: "Orders", route: "orders", icon: ShoppingCart, matchPrefix: "orders" },
  { label: "Inbox", route: "inbox", icon: Inbox, matchPrefix: "inbox" },
  { label: "Billing", route: "billing", icon: CreditCard, matchPrefix: "billing" },
  { label: "Profile", route: "profile", icon: User },
];

export function MobileBottomNav() {
  const { route, navigate } = useCrmStore();
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 glass border-t border-border/40">
      <div className="flex items-center justify-around h-16 px-2 pb-[env(safe-area-inset-bottom,0px)]">
        {NAV_ITEMS.map((item) => {
          const active = item.matchPrefix
            ? route === item.route || route.startsWith(item.matchPrefix + "/") || route.startsWith(item.matchPrefix)
            : route === item.route || route.startsWith(item.route + "/");
          const Icon = item.icon;
          return (
            <button
              key={item.route}
              onClick={() => navigate(item.route)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 rounded-lg transition-all min-w-[56px]",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <div className={cn(
                "h-7 w-7 rounded-lg flex items-center justify-center transition-all",
                active && "bg-primary/10 scale-110",
              )}>
                <Icon className="h-[18px] w-[18px]" />
              </div>
              <span className={cn("text-[10px] font-medium", active && "font-bold")}>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

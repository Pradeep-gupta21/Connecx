import { Link, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  Bell,
  Briefcase,
  Compass,
  CreditCard,
  Image as ImageIcon,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  Settings,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Logo } from "@/components/common/Logo";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/hooks/useWorkspace";

type NavItem = { to: string; label: string; icon: LucideIcon; shortcut?: string };

const creatorItems: NavItem[] = [
  { to: "/dashboard/creator", label: "Dashboard", icon: LayoutDashboard, shortcut: "G D" },
  { to: "/campaigns", label: "Campaigns", icon: Megaphone, shortcut: "G P" },
  { to: "/applications", label: "Applications", icon: Briefcase, shortcut: "G A" },
  { to: "/messages", label: "Messages", icon: MessageSquare, shortcut: "G M" },
  { to: "/portfolio", label: "Portfolio", icon: ImageIcon, shortcut: "G F" },
  { to: "/analytics", label: "Analytics", icon: BarChart3, shortcut: "G Y" },
  { to: "/payments", label: "Payments", icon: CreditCard, shortcut: "G $" },
  { to: "/settings", label: "Settings", icon: Settings, shortcut: "G S" },
];

const advertiserItems: NavItem[] = [
  { to: "/dashboard/advertiser", label: "Dashboard", icon: LayoutDashboard, shortcut: "G D" },
  { to: "/campaigns", label: "Campaigns", icon: Megaphone, shortcut: "G P" },
  { to: "/discover", label: "Creators", icon: Compass, shortcut: "G C" },
  { to: "/applications", label: "Applications", icon: Briefcase, shortcut: "G A" },
  { to: "/messages", label: "Messages", icon: MessageSquare, shortcut: "G M" },
  { to: "/payments", label: "Payments", icon: CreditCard, shortcut: "G $" },
  { to: "/analytics", label: "Analytics", icon: BarChart3, shortcut: "G Y" },
  { to: "/settings", label: "Settings", icon: Settings, shortcut: "G S" },
];
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _unused = Bell;

export function Sidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { activeRole } = useWorkspace();

  const items = activeRole === "advertiser" ? advertiserItems : creatorItems;

  return (
    <aside className="hidden md:flex flex-col w-[240px] border-r border-border bg-sidebar shrink-0 h-screen sticky top-0">
      <div className="h-16 flex items-center px-5">
        <Link to={activeRole === "advertiser" ? "/dashboard/advertiser" : "/dashboard/creator"}>
          <Logo />
        </Link>
      </div>

      <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
        {items.map((it) => {
          const active = pathname === it.to || pathname.startsWith(it.to + "/");
          const Icon = it.icon;
          return (
            <Link
              key={it.to}
              to={it.to}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-secondary text-foreground font-medium"
                  : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
              )}
            >
              <Icon className={cn("h-4 w-4 shrink-0", active && "text-foreground")} />
              <span className="flex-1">{it.label}</span>
              {it.shortcut && (
                <kbd className="hidden lg:inline-flex h-5 items-center rounded border border-border bg-background px-1.5 text-[10px] font-mono text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                  {it.shortcut}
                </kbd>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border">
        <div className="rounded-lg bg-surface p-3 text-xs">
          <div className="font-medium text-foreground flex items-center gap-1.5">
            <Users className="h-3 w-3" /> Workspace
          </div>
          {activeRole && (
            <p className="mt-1 text-muted-foreground capitalize">{activeRole}</p>
          )}
          <p className="mt-2 text-muted-foreground">
            Press{" "}
            <kbd className="rounded border border-border bg-background px-1 py-0.5 font-mono text-[10px]">⌘K</kbd>{" "}
            to jump.
          </p>
        </div>
      </div>
    </aside>
  );
}

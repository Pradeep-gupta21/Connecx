import { Link, useRouterState } from "@tanstack/react-router";
import {
  Bell,
  Compass,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  Settings,
} from "lucide-react";
import { Logo } from "@/components/common/Logo";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/hooks/useWorkspace";

const items = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, shortcut: "G D" },
  { to: "/discover", label: "Discover", icon: Compass, shortcut: "G C" },
  { to: "/campaigns", label: "Campaigns", icon: Megaphone, shortcut: "G P" },
  { to: "/messages", label: "Messages", icon: MessageSquare, shortcut: "G M" },
  { to: "/notifications", label: "Notifications", icon: Bell, shortcut: "G N" },
  { to: "/settings", label: "Settings", icon: Settings, shortcut: "G S" },
];

export function Sidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { activeRole } = useWorkspace();

  return (
    <aside className="hidden md:flex flex-col w-[240px] border-r border-border bg-sidebar shrink-0 h-screen sticky top-0">
      <div className="h-16 flex items-center px-5">
        <Link to="/dashboard">
          <Logo />
        </Link>
      </div>

      <nav className="flex-1 px-3 py-2 space-y-0.5">
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
              <kbd className="hidden lg:inline-flex h-5 items-center rounded border border-border bg-background px-1.5 text-[10px] font-mono text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                {it.shortcut}
              </kbd>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border">
        <div className="rounded-lg bg-surface p-3 text-xs">
          <div className="font-medium text-foreground">Tip</div>
          <p className="mt-1 text-muted-foreground leading-relaxed">
            Press{" "}
            <kbd className="rounded border border-border bg-background px-1 py-0.5 font-mono text-[10px]">
              ⌘K
            </kbd>{" "}
            to jump anywhere.
          </p>
          {activeRole && (
            <p className="mt-2 text-muted-foreground">
              Workspace: <span className="text-foreground capitalize">{activeRole}</span>
            </p>
          )}
        </div>
      </div>
    </aside>
  );
}

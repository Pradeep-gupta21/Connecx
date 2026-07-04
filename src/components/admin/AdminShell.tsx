import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  Banknote,
  Bell,
  ChevronsLeft,
  ChevronsRight,
  ClipboardCheck,
  Command,
  Database,
  Flag,
  Gavel,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  LineChart,
  LogOut,
  type LucideIcon,
  Megaphone,
  Menu,
  RotateCcw,
  ScrollText,
  Search,
  Settings2,
  Shield,
  ShieldCheck,
  Sparkles,
  ToggleRight,
  UserCog,
  Users,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { Logo } from "@/components/common/Logo";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";

type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  search?: Record<string, string>;
  matchKind?: string;
  badge?: "beta" | "new";
};

type NavGroup = { label: string; items: NavItem[] };

const groups: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
      { to: "/admin/analytics", label: "Platform Analytics", icon: LineChart },
      { to: "/admin/health", label: "Database Health", icon: Database },
      { to: "/admin/api", label: "API Monitoring", icon: Activity },
    ],
  },
  {
    label: "People",
    items: [
      { to: "/admin/users", label: "User Management", icon: Users },
      { to: "/admin/approvals", label: "Creator Approvals", icon: ClipboardCheck, search: { kind: "creator" }, matchKind: "creator" },
      { to: "/admin/approvals", label: "Advertiser Approvals", icon: ShieldCheck, search: { kind: "advertiser" }, matchKind: "advertiser" },
      { to: "/admin/roles", label: "Roles & Permissions", icon: KeyRound },
    ],
  },
  {
    label: "Marketplace",
    items: [
      { to: "/admin/campaigns", label: "Campaign Management", icon: Megaphone },
      { to: "/admin/moderation", label: "Content Moderation", icon: Shield },
      { to: "/admin/announcements", label: "Announcements", icon: Sparkles },
    ],
  },
  {
    label: "Money",
    items: [
      { to: "/admin/payments", label: "Payments & Escrow", icon: Wallet },
      { to: "/admin/withdrawals", label: "Withdrawals", icon: Banknote },
      { to: "/admin/refunds", label: "Refund Requests", icon: RotateCcw },
      { to: "/admin/disputes", label: "Disputes", icon: Gavel },
    ],
  },
  {
    label: "Trust & Safety",
    items: [
      { to: "/admin/reports", label: "Reports", icon: Flag },
      { to: "/admin/tickets", label: "Support Tickets", icon: LifeBuoy },
      { to: "/admin/security", label: "Security", icon: ShieldCheck },
    ],
  },
  {
    label: "System",
    items: [
      { to: "/admin/audit", label: "Audit Logs", icon: ScrollText },
      { to: "/admin/settings", label: "System Settings", icon: Settings2 },
      { to: "/admin/flags", label: "Feature Flags", icon: ToggleRight },
      { to: "/admin/notifications", label: "Notification Center", icon: Bell },
    ],
  },
];

function useIsActive() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const search = useRouterState({ select: (s) => s.location.search as Record<string, unknown> });
  return (item: NavItem) => {
    const base = item.to;
    const isExact = pathname === base;
    const isPrefix = pathname.startsWith(base + "/");
    if (!isExact && !isPrefix) return false;
    if (item.matchKind) {
      const currentKind = (search?.kind as string | undefined) ?? "creator";
      return currentKind === item.matchKind;
    }
    return base === "/admin" ? pathname === "/admin" : true;
  };
}

function SidebarInner({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const isActive = useIsActive();
  return (
    <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
      {groups.map((g) => (
        <div key={g.label}>
          {!collapsed && (
            <div className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
              {g.label}
            </div>
          )}
          <div className="space-y-0.5">
            {g.items.map((it) => {
              const active = isActive(it);
              const Icon = it.icon;
              return (
                <Link
                  key={`${it.to}-${it.label}`}
                  to={it.to}
                  search={it.search as never}
                  onClick={onNavigate}
                  className={cn(
                    "group relative flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition-colors",
                    collapsed && "justify-center px-0",
                    active
                      ? "text-foreground"
                      : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                  )}
                  title={collapsed ? it.label : undefined}
                >
                  {active && (
                    <motion.span
                      layoutId="admin-nav-active"
                      className="absolute inset-0 rounded-md bg-secondary"
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    />
                  )}
                  <Icon className={cn("relative z-10 h-4 w-4 shrink-0", active && "text-foreground")} />
                  {!collapsed && <span className="relative z-10 truncate">{it.label}</span>}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

function AdminSidebar({
  collapsed,
  setCollapsed,
}: {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
}) {
  return (
    <aside
      className={cn(
        "hidden lg:flex flex-col shrink-0 h-screen sticky top-0 border-r border-border bg-sidebar transition-[width] duration-200",
        collapsed ? "w-[64px]" : "w-[248px]",
      )}
    >
      <div className={cn("h-14 flex items-center border-b border-border/60", collapsed ? "justify-center px-0" : "px-4 justify-between")}>
        {collapsed ? (
          <Link to="/admin" className="flex h-8 w-8 items-center justify-center rounded-md bg-foreground text-background">
            <Shield className="h-4 w-4" />
          </Link>
        ) : (
          <Link to="/admin" className="flex items-center gap-2 min-w-0">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-foreground text-background">
              <Shield className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0">
              <div className="text-[13px] font-semibold leading-none">Admin Console</div>
              <div className="mt-1 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">BrandBridge · Ops</div>
            </div>
          </Link>
        )}
        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
            aria-label="Collapse sidebar"
          >
            <ChevronsLeft className="h-4 w-4" />
          </button>
        )}
      </div>

      <SidebarInner collapsed={collapsed} />

      <div className={cn("border-t border-border/60 p-2", collapsed && "flex justify-center")}> 
        {collapsed ? (
          <button
            onClick={() => setCollapsed(false)}
            className="rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
            aria-label="Expand sidebar"
          >
            <ChevronsRight className="h-4 w-4" />
          </button>
        ) : (
          <div className="flex items-center justify-between px-2 py-1.5">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              All systems normal
            </div>
            <kbd className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">⌘K</kbd>
          </div>
        )}
      </div>
    </aside>
  );
}

function AdminTopBar({ onOpenMobile }: { onOpenMobile: () => void }) {
  const { user, signOut } = useAuth();
  const { profile } = useWorkspace();
  const navigate = useNavigate();
  const initials = (profile?.display_name ?? user?.email ?? "A").slice(0, 1).toUpperCase();

  return (
    <header className="h-14 sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-lg">
      <div className="h-full flex items-center gap-2 px-4 sm:px-6">
        <button
          onClick={onOpenMobile}
          className="lg:hidden rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
          aria-label="Open navigation"
        >
          <Menu className="h-4 w-4" />
        </button>

        <div className="hidden md:flex items-center gap-2 text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
          <Shield className="h-3 w-3" /> Admin
          <span className="text-muted-foreground/40">/</span>
          <span className="text-foreground normal-case font-sans font-medium tracking-normal">Operations</span>
        </div>

        <div className="flex-1" />

        <button
          onClick={() => {
            const e = new KeyboardEvent("keydown", { key: "k", metaKey: true });
            window.dispatchEvent(e);
          }}
          className="hidden md:flex items-center gap-2 h-8 w-64 px-2.5 rounded-md border border-border bg-surface text-[12px] text-muted-foreground hover:bg-secondary transition-colors"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="flex-1 text-left">Search users, campaigns, tickets…</span>
          <kbd className="text-[10px] font-mono rounded border border-border bg-background px-1.5 py-0.5">⌘K</kbd>
        </button>

        <Button
          size="sm"
          variant="outline"
          className="hidden sm:inline-flex h-8 gap-1.5 text-[12px]"
          onClick={() => navigate({ to: "/admin/announcements" })}
        >
          <Zap className="h-3.5 w-3.5" /> New announcement
        </Button>

        <ThemeToggle />

        <button
          onClick={() => navigate({ to: "/admin/notifications" })}
          className="relative rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
          aria-label="Notification center"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
        </button>

        <div className="mx-1 h-6 w-px bg-border" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-md p-1 pr-2 hover:bg-secondary transition-colors">
              <Avatar className="h-7 w-7">
                <AvatarImage src={profile?.avatar_url ?? undefined} />
                <AvatarFallback className="text-[11px]">{initials}</AvatarFallback>
              </Avatar>
              <div className="hidden md:flex flex-col items-start">
                <span className="text-[12px] font-medium leading-none">{profile?.display_name ?? "Admin"}</span>
                <span className="text-[10px] text-muted-foreground leading-none mt-1">{user?.email}</span>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Signed in as
            </DropdownMenuLabel>
            <div className="px-2 pb-2 text-xs">
              <div className="font-medium truncate">{profile?.display_name ?? "Admin"}</div>
              <div className="text-muted-foreground truncate">{user?.email}</div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate({ to: "/admin/profile" })}>
              <UserCog className="h-4 w-4" /> Admin profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate({ to: "/admin/settings" })}>
              <Settings2 className="h-4 w-4" /> System settings
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                const e = new KeyboardEvent("keydown", { key: "k", metaKey: true });
                window.dispatchEvent(e);
              }}
            >
              <Command className="h-4 w-4" /> Command palette
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={async () => {
                await signOut();
                navigate({ to: "/auth", replace: true });
              }}
            >
              <LogOut className="h-4 w-4" /> Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 lg:hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={onClose} />
          <motion.aside
            className="absolute inset-y-0 left-0 w-[280px] bg-sidebar border-r border-border flex flex-col"
            initial={{ x: -320 }}
            animate={{ x: 0 }}
            exit={{ x: -320 }}
            transition={{ type: "spring", stiffness: 380, damping: 34 }}
          >
            <div className="h-14 flex items-center justify-between px-4 border-b border-border/60">
              <Link to="/admin" className="flex items-center gap-2" onClick={onClose}>
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-foreground text-background">
                  <Shield className="h-3.5 w-3.5" />
                </span>
                <span className="text-[13px] font-semibold">Admin Console</span>
              </Link>
              <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <SidebarInner collapsed={false} onNavigate={onClose} />
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <AdminSidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      <div className="flex-1 min-w-0 flex flex-col">
        <AdminTopBar onOpenMobile={() => setMobileOpen(true)} />
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 lg:py-8 max-w-[1500px] w-full mx-auto">
          {children}
        </main>
      </div>
      <MobileDrawer open={mobileOpen} onClose={() => setMobileOpen(false)} />
    </div>
  );
}

export function AdminPageHeader({
  title,
  description,
  eyebrow,
  actions,
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 pb-6 mb-6 border-b border-border/60">
      <div className="min-w-0">
        {eyebrow && (
          <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground mb-2">{eyebrow}</div>
        )}
        <h1 className="font-display text-2xl font-semibold tracking-tight truncate">{title}</h1>
        {description && <p className="mt-1.5 text-sm text-muted-foreground max-w-2xl">{description}</p>}
      </div>
      {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function AdminEmptyState({
  icon: Icon = Sparkles,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="surface-card border border-dashed border-border/70 p-10 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-secondary text-foreground">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mt-4 font-display text-lg font-semibold tracking-tight">{title}</h3>
      {description && <p className="mt-1.5 text-sm text-muted-foreground max-w-md mx-auto">{description}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

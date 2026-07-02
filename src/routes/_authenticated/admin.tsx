import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Loader2, Shield, ShieldAlert, Users, CheckSquare, Megaphone, CreditCard, Flag, LifeBuoy, ScrollText, Activity, Banknote } from "lucide-react";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useWorkspace } from "@/hooks/useWorkspace";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

const tabs = [
  { to: "/admin", label: "Overview", icon: Shield, exact: true },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/approvals", label: "Approvals", icon: CheckSquare },
  { to: "/admin/campaigns", label: "Campaigns", icon: Megaphone },
  { to: "/admin/payments", label: "Payments", icon: CreditCard },
  { to: "/admin/withdrawals", label: "Withdrawals", icon: Banknote },

  { to: "/admin/reports", label: "Reports", icon: Flag },
  { to: "/admin/tickets", label: "Support", icon: LifeBuoy },
  { to: "/admin/audit", label: "Audit Log", icon: ScrollText },
  { to: "/admin/health", label: "Platform", icon: Activity },
];

function AdminLayout() {
  const isAdmin = useIsAdmin();
  const { loading } = useWorkspace();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto max-w-lg text-center py-24 space-y-6"
      >
        <div className="mx-auto h-14 w-14 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <div className="space-y-2">
          <h1 className="font-display text-2xl font-semibold tracking-tight">Access denied</h1>
          <p className="text-sm text-muted-foreground">
            You don't have permission to view the admin console. If you think this is a mistake, contact a platform administrator.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/dashboard">Back to dashboard</Link>
        </Button>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-accent/5 to-transparent p-6"
      >
        <div className="absolute inset-0 opacity-40 [mask-image:radial-gradient(circle_at_top_right,black,transparent_70%)] bg-[radial-gradient(circle_at_top_right,theme(colors.primary/20%),transparent_40%)]" />
        <div className="relative flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">Admin Console</h1>
            <p className="text-sm text-muted-foreground">Moderate the marketplace, review payments, and keep BrandBridge healthy.</p>
          </div>
        </div>
      </motion.div>

      <div className="sticky top-16 z-20 -mx-4 sm:-mx-6 md:-mx-10 px-4 sm:px-6 md:px-10 bg-background/85 backdrop-blur-lg border-b border-border">
        <div className="flex gap-1 overflow-x-auto py-2 no-scrollbar">
          {tabs.map((t) => {
            const active = t.exact ? pathname === t.to : pathname === t.to || pathname.startsWith(t.to + "/");
            const Icon = t.icon;
            return (
              <Link
                key={t.to}
                to={t.to}
                className={cn(
                  "relative shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {active && (
                  <motion.span layoutId="admin-tab" className="absolute inset-0 rounded-md bg-secondary" transition={{ type: "spring", stiffness: 380, damping: 32 }} />
                )}
                <Icon className="relative z-10 h-3.5 w-3.5" />
                <span className="relative z-10">{t.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      <Outlet />
    </div>
  );
}

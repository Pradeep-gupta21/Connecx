import { Link, useRouterState } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  Compass,
  Shield,
  Settings,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useIsAdmin } from "@/hooks/useIsAdmin";

type Item = { to: string; label: string; icon: LucideIcon };

export function MobileNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { activeRole } = useWorkspace();
  const isAdmin = useIsAdmin();

  const items: Item[] = [
    { to: activeRole === "advertiser" ? "/dashboard/advertiser" : "/dashboard/creator", label: "Home", icon: LayoutDashboard },
    { to: "/campaigns", label: "Campaigns", icon: Megaphone },
    activeRole === "advertiser"
      ? { to: "/discover", label: "Creators", icon: Compass }
      : { to: "/messages", label: "Chat", icon: MessageSquare },
    isAdmin ? { to: "/admin", label: "Admin", icon: Shield } : { to: "/settings", label: "Settings", icon: Settings },
  ];

  return (
    <motion.nav
      initial={{ y: 60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.15, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="md:hidden fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1 rounded-full border border-border bg-background/85 backdrop-blur-xl px-2 py-1.5 shadow-elevated"
    >
      {items.map((it) => {
        const active = pathname === it.to || pathname.startsWith(it.to + "/");
        const Icon = it.icon;
        return (
          <Link
            key={it.to}
            to={it.to}
            className={cn(
              "relative flex flex-col items-center justify-center gap-0.5 rounded-full px-4 py-1.5 text-[10px] font-medium transition-colors",
              active ? "text-foreground" : "text-muted-foreground"
            )}
          >
            {active && (
              <motion.span
                layoutId="mobile-nav-pill"
                className="absolute inset-0 rounded-full bg-secondary"
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
              />
            )}
            <Icon className="relative z-10 h-4 w-4" />
            <span className="relative z-10">{it.label}</span>
          </Link>
        );
      })}
    </motion.nav>
  );
}

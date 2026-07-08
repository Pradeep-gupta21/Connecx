import { Link, useRouterState } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  Compass,
  Shield,
  Settings,
  Briefcase,
  BarChart3,
  CreditCard,
  Image as ImageIcon,
  Menu,
  LogOut,
} from "lucide-react";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useAuth } from "@/hooks/useAuth";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type Item = {
  to: string;
  label: string;
  icon: LucideIcon;
};

export function MobileNav() {
  const pathname = useRouterState({
    select: (s) => s.location.pathname,
  });

  const { activeRole } = useWorkspace();
  const isAdmin = useIsAdmin();
  const { signOut } = useAuth();

  const bottomItems: Item[] = [
    {
      to:
        activeRole === "advertiser"
          ? "/dashboard/advertiser"
          : "/dashboard/creator",
      label: "Home",
      icon: LayoutDashboard,
    },
    {
      to: "/campaigns",
      label: "Campaigns",
      icon: Megaphone,
    },
    activeRole === "advertiser"
      ? {
          to: "/discover",
          label: "Creators",
          icon: Compass,
        }
      : {
          to: "/messages",
          label: "Chat",
          icon: MessageSquare,
        },
  ];

  const creatorMore: Item[] = [
    {
      to: "/applications",
      label: "Applications",
      icon: Briefcase,
    },
    {
      to: "/portfolio",
      label: "Portfolio",
      icon: ImageIcon,
    },
    {
      to: "/analytics",
      label: "Analytics",
      icon: BarChart3,
    },
    {
      to: "/payments",
      label: "Payments",
      icon: CreditCard,
    },
    {
      to: "/settings",
      label: "Settings",
      icon: Settings,
    },
  ];

  const advertiserMore: Item[] = [
    {
      to: "/applications",
      label: "Applications",
      icon: Briefcase,
    },
    {
      to: "/discover",
      label: "Creators",
      icon: Compass,
    },
    {
      to: "/analytics",
      label: "Analytics",
      icon: BarChart3,
    },
    {
      to: "/payments",
      label: "Payments",
      icon: CreditCard,
    },
    {
      to: "/settings",
      label: "Settings",
      icon: Settings,
    },
  ];

  const moreItems =
    activeRole === "advertiser"
      ? advertiserMore
      : creatorMore;

  return (
    <motion.nav
      initial={{ y: 60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{
        delay: 0.15,
        duration: 0.4,
        ease: [0.22, 1, 0.36, 1],
      }}
      className="md:hidden fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1 rounded-full border border-border bg-background/90 backdrop-blur-xl px-2 py-1.5 shadow-elevated"
    >
      {bottomItems.map((it) => {
        const active =
          pathname === it.to ||
          pathname.startsWith(it.to + "/");

        const Icon = it.icon;

        return (
          <Link
            key={it.to}
            to={it.to}
            className={cn(
              "relative flex flex-col items-center justify-center gap-0.5 rounded-full px-4 py-1.5 text-[10px] font-medium transition-colors",
              active
                ? "text-foreground"
                : "text-muted-foreground"
            )}
          >
            {active && (
              <motion.span
                layoutId="mobile-nav-pill"
                className="absolute inset-0 rounded-full bg-secondary"
                transition={{
                  type: "spring",
                  stiffness: 380,
                  damping: 32,
                }}
              />
            )}

            <Icon className="relative z-10 h-4 w-4" />

            <span className="relative z-10">
              {it.label}
            </span>
          </Link>
        );
      })}
            <Sheet>
        <SheetTrigger asChild>
          <button
            className="relative flex flex-col items-center justify-center gap-0.5 rounded-full px-4 py-1.5 text-[10px] font-medium text-muted-foreground transition-colors"
          >
            <Menu className="h-4 w-4" />
            <span>More</span>
          </button>
        </SheetTrigger>

        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader>
            <SheetTitle>More</SheetTitle>
          </SheetHeader>

          <div className="mt-6 space-y-2">
            {moreItems.map((it) => {
              const Icon = it.icon;

              const active =
                pathname === it.to ||
                pathname.startsWith(it.to + "/");

              return (
                <Link
                  key={it.to}
                  to={it.to}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-4 py-3 transition-colors",
                    active
                      ? "bg-secondary text-foreground"
                      : "hover:bg-secondary/60"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span>{it.label}</span>
                </Link>
              );
            })}

            {isAdmin && (
              <Link
                to="/admin"
                className={cn(
                  "flex items-center gap-3 rounded-xl px-4 py-3 transition-colors",
                  pathname.startsWith("/admin")
                    ? "bg-secondary text-foreground"
                    : "hover:bg-secondary/60"
                )}
              >
                <Shield className="h-5 w-5" />
                <span>Admin Console</span>
              </Link>
            )}

            <button
              onClick={signOut}
              className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-red-500 hover:bg-red-500/10 transition-colors"
            >
              <LogOut className="h-5 w-5" />
              <span>Sign Out</span>
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </motion.nav>
  );
}
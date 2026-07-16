import { Building2, ChevronsUpDown, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useWorkspace, type AppRole } from "@/hooks/useWorkspace";
import { useNavigate } from "@tanstack/react-router";

const ALLOWED_SWITCH_ROLES: AppRole[] = ["creator", "advertiser"];

const roleMeta: Record<AppRole, { label: string; icon: typeof Sparkles; description: string }> = {
  advertiser: { label: "Advertiser", icon: Building2, description: "Brand workspace" },
  creator: { label: "Creator", icon: Sparkles, description: "Creator workspace" },
  admin: { label: "Admin", icon: Sparkles, description: "Platform operations" },
  moderator: { label: "Moderator", icon: Sparkles, description: "Trust & safety" },
};

export function WorkspaceSwitcher() {
  const { activeRole, roles, setActiveRole } = useWorkspace();
  const navigate = useNavigate();

  const switchableRoles = ALLOWED_SWITCH_ROLES.filter((role) => roles.includes(role));
  const currentRole = switchableRoles.find((role) => role === activeRole) ?? switchableRoles[0] ?? null;

  // Hide the workspace switcher for standard creator/advertiser users.
  // Role switching is not permitted after account creation.
  if (!currentRole || currentRole === "creator" || currentRole === "advertiser") return null;

  const current = roleMeta[currentRole];
  const Icon = current.icon;
  const canSwitch = switchableRoles.length > 1;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="h-9 gap-2 rounded-full pl-2 pr-3 bg-surface hover:bg-secondary"
          disabled={!canSwitch}
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-background">
            <Icon className="h-3 w-3" />
          </span>
          <span className="text-sm font-medium">{current.label}</span>
          <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-xs uppercase tracking-wide text-muted-foreground">
          Switch workspace
        </DropdownMenuLabel>
        {switchableRoles.map((r) => {
          const meta = roleMeta[r];
          const enabled = roles.includes(r);
          const RIcon = meta.icon;
          return (
            <DropdownMenuItem
              key={r}
              disabled={!enabled}
              onClick={() => {
                if (!enabled) return;
                setActiveRole(r);
                navigate({ to: r === "advertiser" ? "/dashboard/advertiser" : "/dashboard/creator" });
              }}
              className="gap-3 py-2.5"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-secondary">
                <RIcon className="h-4 w-4" />
              </span>
              <div className="flex-1">
                <div className="text-sm font-medium">{meta.label}</div>
                <div className="text-xs text-muted-foreground">{meta.description}</div>
              </div>
              {currentRole === r && <span className="text-xs text-accent">Active</span>}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate({ to: "/settings" })} className="text-sm">
          Manage roles
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

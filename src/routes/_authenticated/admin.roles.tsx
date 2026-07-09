import { createFileRoute } from "@tanstack/react-router";
import { KeyRound, Shield, ShieldCheck, Sparkles, Building2 } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/admin/roles")({
  head: () => ({ meta: [{ title: "Roles & Permissions · Admin" }] }),
  component: Roles,
});

const roles = [
  { name: "Admin", icon: Shield, description: "Unrestricted access to all admin surfaces, moderation, and privileged writes.", scope: "Platform" },
  { name: "Moderator", icon: ShieldCheck, description: "Content review, user suspension, and approvals — no financial actions.", scope: "Trust & safety" },
  { name: "Advertiser", icon: Building2, description: "Brand workspaces: create campaigns, purchase campaigns, hire creators.", scope: "Marketplace" },
  { name: "Creator", icon: Sparkles, description: "Creator workspaces: apply to campaigns, deliver work, receive payouts.", scope: "Marketplace" },
];

function Roles() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Access control"
        title="Roles & permissions"
        description="Every privileged capability is scoped through the has_role security-definer function. Users may hold multiple roles."
      />
      <div className="grid gap-3 md:grid-cols-2">
        {roles.map((r) => {
          const Icon = r.icon;
          return (
            <div key={r.name} className="surface-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-secondary">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div>
                    <div className="text-sm font-semibold">{r.name}</div>
                    <div className="mt-0.5 text-[11px] font-mono uppercase tracking-widest text-muted-foreground">{r.scope}</div>
                  </div>
                </div>
                <Badge variant="secondary" className="text-[10px]">RBAC</Badge>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{r.description}</p>
            </div>
          );
        })}
      </div>
      <div className="surface-card p-5 flex items-start gap-3">
        <KeyRound className="h-4 w-4 mt-0.5 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Privileged role writes are enforced at the database layer — admin/moderator assignments can only be issued through security-definer functions.
        </p>
      </div>
    </div>
  );
}

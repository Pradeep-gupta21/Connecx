import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck, Lock, KeyRound, Fingerprint } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminShell";

export const Route = createFileRoute("/_authenticated/admin/security")({
  head: () => ({ meta: [{ title: "Security · Admin" }] }),
  component: Security,
});

const cards = [
  { icon: Lock, title: "Row-Level Security", body: "Every user-owned table enforces RLS scoped to auth.uid(). Bypass only through security-definer functions." },
  { icon: KeyRound, title: "Privileged role guard", body: "Admin and moderator assignments are gated by a database trigger — no client can self-grant." },
  { icon: Fingerprint, title: "Session hygiene", body: "Sign-out cancels in-flight queries, clears cache, and revokes the Supabase session before navigation." },
  { icon: ShieldCheck, title: "Webhook signatures", body: "Public /api/public/* endpoints verify HMAC signatures with constant-time comparison before writes." },
];

function Security() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Trust & safety"
        title="Security posture"
        description="Live status of the platform's defense-in-depth controls."
      />
      <div className="grid gap-3 md:grid-cols-2">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.title} className="surface-card p-5 flex gap-4">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-emerald-500/10 text-emerald-500">
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold">{c.title}</div>
                <p className="mt-1 text-sm text-muted-foreground">{c.body}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

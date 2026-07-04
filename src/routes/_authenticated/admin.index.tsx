import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Users, Megaphone, CreditCard, Flag, LifeBuoy, TrendingUp, Activity } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { StatCard } from "@/components/common/StatCard";
import { AdminPageHeader } from "@/components/admin/AdminShell";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Admin Dashboard · BrandBridge" }] }),
  component: AdminOverview,
});

async function fetchOverview() {
  const [users, campaigns, payments, reports, tickets, activity, revenueSeries] = await Promise.all([
    supabase.from("profiles").select("id, created_at, suspended_at", { count: "exact" }),
    supabase.from("campaigns").select("id, status", { count: "exact" }),
    supabase.from("payments").select("amount, currency, status, created_at, processed_at"),
    supabase.from("reports").select("id, status", { count: "exact" }).eq("status", "open"),
    supabase.from("support_tickets").select("id, status", { count: "exact" }).in("status", ["open", "in_progress"]),
    supabase.from("activity_logs").select("id, action, entity_type, created_at, user_id").order("created_at", { ascending: false }).limit(8),
    supabase.from("payments").select("amount, processed_at").eq("status", "succeeded").order("processed_at", { ascending: true }).limit(500),
  ]);

  const totalRevenue = (payments.data ?? []).filter((p) => p.status === "succeeded").reduce((s, p) => s + Number(p.amount || 0), 0);
  const days: Record<string, number> = {};
  const now = Date.now();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now - i * 86400000).toISOString().slice(0, 10);
    days[d] = 0;
  }
  (revenueSeries.data ?? []).forEach((p) => {
    if (!p.processed_at) return;
    const d = String(p.processed_at).slice(0, 10);
    if (days[d] !== undefined) days[d] += Number(p.amount || 0);
  });
  const series = Object.entries(days).map(([d, v]) => ({ date: d.slice(5), value: v }));

  return {
    userCount: users.count ?? 0,
    campaignCount: campaigns.count ?? 0,
    activeCampaigns: (campaigns.data ?? []).filter((c) => c.status === "open").length,
    suspendedCount: (users.data ?? []).filter((u) => u.suspended_at).length,
    reportsOpen: reports.count ?? 0,
    ticketsOpen: tickets.count ?? 0,
    totalRevenue,
    series,
    activity: activity.data ?? [],
  };
}

function AdminOverview() {
  const q = useQuery({ queryKey: ["admin", "overview"], queryFn: fetchOverview });
  const d = q.data;

  return (
    <div>
      <AdminPageHeader
        eyebrow="Operations · Today"
        title="Platform overview"
        description="Real-time signals across marketplace health, revenue, and moderation queues."
      />
      <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">


        <StatCard label="Total Users" value={d?.userCount ?? 0} icon={Users} />
        <StatCard label="Active Campaigns" value={d?.activeCampaigns ?? 0} icon={Megaphone} />
        <StatCard label="Revenue (all-time)" value={d?.totalRevenue ?? 0} icon={CreditCard} format={(v) => `$${Math.round(v).toLocaleString()}`} />
        <StatCard label="Open Reports" value={d?.reportsOpen ?? 0} icon={Flag} />
        <StatCard label="Open Tickets" value={d?.ticketsOpen ?? 0} icon={LifeBuoy} />
        <StatCard label="Suspended Accounts" value={d?.suspendedCount ?? 0} icon={Activity} />
        <StatCard label="Campaigns Total" value={d?.campaignCount ?? 0} icon={Megaphone} />
        <StatCard label="Platform Score" value={99} icon={TrendingUp} format={(v) => `${Math.round(v)}%`} />
      </div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="surface-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-display text-lg font-semibold">Revenue — last 30 days</h3>
            <p className="text-xs text-muted-foreground">Succeeded payments across the marketplace</p>
          </div>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={d?.series ?? []}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="oklch(0.62 0.19 256)" />
                  <stop offset="100%" stopColor="oklch(0.72 0.18 296)" />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
              <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" width={40} />
              <Tooltip
                contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }}
                formatter={(v: number) => [`$${v.toLocaleString()}`, "Revenue"]}
              />
              <Line type="monotone" dataKey="value" stroke="url(#rev)" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      <div className="surface-card p-6">
        <h3 className="font-display text-lg font-semibold mb-4">Recent activity</h3>
        <ul className="divide-y divide-border">
          {(d?.activity ?? []).map((a: any) => (
            <li key={a.id} className="py-3 flex items-center justify-between text-sm">
              <div>
                <div className="font-medium">{a.action}</div>
                <div className="text-xs text-muted-foreground">{a.entity_type ?? "—"} · {new Date(a.created_at).toLocaleString()}</div>
              </div>
              <code className="text-[10px] text-muted-foreground font-mono">{a.user_id?.slice(0, 8)}</code>
            </li>
          ))}
          {!q.isLoading && (d?.activity ?? []).length === 0 && (
            <li className="py-8 text-center text-sm text-muted-foreground">No activity yet.</li>
          )}
        </ul>
      </div>
      </div>
    </div>
  );
}

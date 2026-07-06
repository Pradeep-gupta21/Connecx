import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Users, UserCheck, Building2, UserPlus, ClipboardCheck, Megaphone, CheckCircle2,
  CreditCard, Wallet, ArrowDownToLine, Undo2, AlertTriangle, LifeBuoy, Flag, Activity, TrendingUp,
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { StatCard } from "@/components/common/StatCard";
import { AdminPageHeader } from "@/components/admin/AdminShell";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Admin Dashboard · Connecx" }] }),
  component: AdminOverview,
});

const ACTIVE_CAMPAIGN_STATUSES = ["open"] as const;
const COMPLETED_CAMPAIGN_STATUSES = ["closed"] as const;
const PENDING_WITHDRAWAL_STATUSES = ["requested", "processing"] as const;

async function fetchOverview() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayIso = todayStart.toISOString();
  const since = new Date(Date.now() - 29 * 86400000);
  since.setHours(0, 0, 0, 0);
  const sinceIso = since.toISOString();

  const c = (p: any) => p.count ?? 0;

  const [
    totalUsers, creators, advertisers,
    pendingCreators, pendingAdvertisers,
    activeCampaigns, completedCampaigns,
    payments30, escrowRows,
    pendingWithdrawals, pendingRefunds,
    openDisputes, openReports, openTickets,
    newUsersToday,
    userGrowth, campaignGrowth,
    activity,
  ] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "creator"),
    supabase.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "advertiser"),
    supabase.from("creator_profiles").select("user_id", { count: "exact", head: true }).eq("approval_status", "pending"),
    supabase.from("advertiser_profiles").select("user_id", { count: "exact", head: true }).eq("approval_status", "pending"),
    supabase.from("campaigns").select("id", { count: "exact", head: true }).in("status", ACTIVE_CAMPAIGN_STATUSES),
    supabase.from("campaigns").select("id", { count: "exact", head: true }).in("status", COMPLETED_CAMPAIGN_STATUSES),
    supabase.from("payments").select("amount, platform_fee, processed_at, status").eq("status", "succeeded").gte("processed_at", sinceIso),
    supabase.from("payments").select("amount").eq("status_v2", "held"),
    supabase.from("withdrawals").select("id", { count: "exact", head: true }).in("status", PENDING_WITHDRAWAL_STATUSES),
    supabase.from("refunds").select("id", { count: "exact", head: true }).eq("status", "requested"),
    supabase.from("reports").select("id", { count: "exact", head: true }).eq("status", "open").in("target_type", ["contract", "payment", "campaign"]),
    supabase.from("reports").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("support_tickets").select("id", { count: "exact", head: true }).in("status", ["open", "in_progress"]),
    supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", todayIso),
    supabase.from("profiles").select("created_at").gte("created_at", sinceIso),
    supabase.from("campaigns").select("created_at").gte("created_at", sinceIso),
    supabase.from("activity_logs").select("id, action, entity_type, created_at, user_id").order("created_at", { ascending: false }).limit(8),
  ]);

  // Revenue = platform fees on succeeded payments (fallback to full amount if fee is missing)
  const totalRevenue = (payments30.data ?? []).reduce(
    (s, p: any) => s + Number(p.platform_fee ?? 0),
    0,
  );
  const escrowBalance = (escrowRows.data ?? []).reduce((s, r: any) => s + Number(r.amount || 0), 0);

  // Build 30-day series buckets
  const revenueDays: Record<string, number> = {};
  const userDays: Record<string, number> = {};
  const campaignDays: Record<string, number> = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    revenueDays[d] = 0; userDays[d] = 0; campaignDays[d] = 0;
  }
  (payments30.data ?? []).forEach((p: any) => {
    if (!p.processed_at) return;
    const d = String(p.processed_at).slice(0, 10);
    if (revenueDays[d] !== undefined) revenueDays[d] += Number(p.platform_fee ?? p.amount ?? 0);
  });
  (userGrowth.data ?? []).forEach((u: any) => {
    const d = String(u.created_at).slice(0, 10);
    if (userDays[d] !== undefined) userDays[d] += 1;
  });
  (campaignGrowth.data ?? []).forEach((c: any) => {
    const d = String(c.created_at).slice(0, 10);
    if (campaignDays[d] !== undefined) campaignDays[d] += 1;
  });

  const toSeries = (obj: Record<string, number>) =>
    Object.entries(obj).map(([d, v]) => ({ date: d.slice(5), value: v }));

  return {
    totalUsers: c(totalUsers),
    totalCreators: c(creators),
    totalAdvertisers: c(advertisers),
    pendingCreators: c(pendingCreators),
    pendingAdvertisers: c(pendingAdvertisers),
    activeCampaigns: c(activeCampaigns),
    completedCampaigns: c(completedCampaigns),
    totalRevenue,
    escrowBalance,
    pendingWithdrawals: c(pendingWithdrawals),
    pendingRefunds: c(pendingRefunds),
    openDisputes: c(openDisputes),
    openReports: c(openReports),
    openTickets: c(openTickets),
    newUsersToday: c(newUsersToday),
    revenueSeries: toSeries(revenueDays),
    userSeries: toSeries(userDays),
    campaignSeries: toSeries(campaignDays),
    activity: activity.data ?? [],
  };
}

const money = (v: number) => `₹${Math.round(v).toLocaleString()}`;

function AdminOverview() {
  const q = useQuery({ queryKey: ["admin", "overview", "v2"], queryFn: fetchOverview });
  const d = q.data;

  return (
    <div>
      <AdminPageHeader
        eyebrow="Operations · Today"
        title="Platform overview"
        description="Real-time signals across users, marketplace, revenue, and moderation."
      />
      <div className="space-y-6">
        {/* People */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Users" value={d?.totalUsers ?? 0} icon={Users} />
          <StatCard label="Total Creators" value={d?.totalCreators ?? 0} icon={UserCheck} />
          <StatCard label="Total Advertisers" value={d?.totalAdvertisers ?? 0} icon={Building2} />
          <StatCard label="New Users Today" value={d?.newUsersToday ?? 0} icon={UserPlus} />
        </div>

        {/* Approvals & Campaigns */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Pending Creator Approvals" value={d?.pendingCreators ?? 0} icon={ClipboardCheck} />
          <StatCard label="Pending Advertiser Approvals" value={d?.pendingAdvertisers ?? 0} icon={ClipboardCheck} />
          <StatCard label="Active Campaigns" value={d?.activeCampaigns ?? 0} icon={Megaphone} />
          <StatCard label="Completed Campaigns" value={d?.completedCampaigns ?? 0} icon={CheckCircle2} />
        </div>

        {/* Money */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Platform Revenue (30d)" value={d?.totalRevenue ?? 0} icon={CreditCard} format={money} />
          <StatCard label="Escrow Balance" value={d?.escrowBalance ?? 0} icon={Wallet} format={money} />
          <StatCard label="Pending Withdrawals" value={d?.pendingWithdrawals ?? 0} icon={ArrowDownToLine} />
          <StatCard label="Pending Refunds" value={d?.pendingRefunds ?? 0} icon={Undo2} />
        </div>

        {/* Trust & Safety */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Open Disputes" value={d?.openDisputes ?? 0} icon={AlertTriangle} />
          <StatCard label="Support Tickets" value={d?.openTickets ?? 0} icon={LifeBuoy} />
          <StatCard label="Reports Awaiting Review" value={d?.openReports ?? 0} icon={Flag} />
          <StatCard label="Platform Health" value={99.9} icon={Activity} format={(v) => `${v.toFixed(1)}%`} />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <ChartCard title="Revenue" subtitle="Platform fees · last 30 days" accent="rev">
            <LineChart data={d?.revenueSeries ?? []}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="oklch(0.62 0.19 256)" />
                  <stop offset="100%" stopColor="oklch(0.72 0.18 296)" />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
              <YAxis tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" width={36} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [money(v), "Revenue"]} />
              <Line type="monotone" dataKey="value" stroke="url(#rev)" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ChartCard>

          <ChartCard title="User Growth" subtitle="New signups · last 30 days">
            <BarChart data={d?.userSeries ?? []}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
              <YAxis tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" width={30} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [v, "New users"]} />
              <Bar dataKey="value" fill="oklch(0.7 0.17 160)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartCard>

          <ChartCard title="Campaign Growth" subtitle="New campaigns · last 30 days">
            <BarChart data={d?.campaignSeries ?? []}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
              <YAxis tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" width={30} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [v, "New campaigns"]} />
              <Bar dataKey="value" fill="oklch(0.72 0.18 40)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartCard>
        </div>

        {/* Recent activity */}
        <div className="surface-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-lg font-semibold">Recent activity</h3>
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
          </div>
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

const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  fontSize: 12,
} as const;

function ChartCard({
  title, subtitle, children,
}: { title: string; subtitle: string; accent?: string; children: React.ReactElement }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="surface-card p-5">
      <div className="mb-3">
        <h3 className="font-display text-sm font-semibold">{title}</h3>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
      </div>
    </motion.div>
  );
}

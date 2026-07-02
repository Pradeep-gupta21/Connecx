import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { BarChart3, DollarSign, Send, CheckCircle2, MousePointerClick } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({ meta: [{ title: "Analytics · BrandBridge" }] }),
  component: AnalyticsPage,
});

const PIE_COLORS = ["var(--color-accent)", "var(--color-success)", "var(--color-destructive)", "var(--color-muted-foreground)"];
const RANGES = [
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
] as const;

function AnalyticsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [range, setRange] = useState<"7" | "30" | "90">("30");
  const days = Number(range);

  const q = useQuery({
    queryKey: ["analytics", user?.id, days],
    enabled: !!user,
    queryFn: async () => {
      const since = subDays(new Date(), days - 1).toISOString();
      const [apps, pays] = await Promise.all([
        supabase.from("applications").select("id, status, created_at").eq("creator_id", user!.id).gte("created_at", since),
        supabase.from("payments").select("amount, status, created_at").eq("payee_id", user!.id).is("deleted_at", null).gte("created_at", since),
      ]);
      return { apps: apps.data ?? [], pays: pays.data ?? [] };
    },
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel(`analytics-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "applications", filter: `creator_id=eq.${user.id}` }, () => qc.invalidateQueries({ queryKey: ["analytics", user.id] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "payments", filter: `payee_id=eq.${user.id}` }, () => qc.invalidateQueries({ queryKey: ["analytics", user.id] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc]);

  const apps = q.data?.apps ?? [];
  const pays = q.data?.pays ?? [];
  const sent = apps.length;
  const accepted = apps.filter((a) => a.status === "accepted").length;
  const acceptRate = sent ? Math.round((accepted / sent) * 100) : 0;
  const earned = pays.filter((p) => p.status === "succeeded").reduce((s, p) => s + Number(p.amount), 0);

  const earningsSeries = useMemo(
    () => bucketSum(pays.filter((p) => p.status === "succeeded"), (p) => Number(p.amount), days),
    [pays, days],
  );
  const appsSeries = useMemo(() => bucketCount(apps.map((a) => a.created_at), days), [apps, days]);
  const statusPie = ["pending", "accepted", "rejected", "withdrawn"].map((s, i) => ({
    name: s, value: apps.filter((a) => a.status === s).length, fill: PIE_COLORS[i],
  })).filter((d) => d.value > 0);

  return (
    <div className="space-y-10">
      <PageHeader
        title="Analytics"
        description="Understand your performance across the marketplace."
        actions={
          <ToggleGroup type="single" value={range} onValueChange={(v) => v && setRange(v as "7" | "30" | "90")} variant="outline" size="sm">
            {RANGES.map((r) => (
              <ToggleGroupItem key={r.value} value={r.value} className="text-xs">{r.label}</ToggleGroupItem>
            ))}
          </ToggleGroup>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Applications sent" value={sent} icon={Send} />
        <StatCard label="Accepted" value={accepted} icon={CheckCircle2} />
        <StatCard label="Accept rate" value={`${acceptRate}%`} icon={MousePointerClick} />
        <StatCard label="Total earned" value={`$${earned.toLocaleString()}`} icon={DollarSign} />
      </div>



      <div className="grid lg:grid-cols-2 gap-6">
        <div className="surface-card p-6">
          <h2 className="font-display text-base font-semibold flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Earnings over time</h2>
          <div className="h-[260px] mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={earningsSeries} margin={{ left: -8, right: 8, top: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="ea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="value" stroke="var(--color-accent)" strokeWidth={2} fill="url(#ea)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="surface-card p-6">
          <h2 className="font-display text-base font-semibold">Applications volume</h2>
          <div className="h-[260px] mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={appsSeries} margin={{ left: -8, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="value" stroke="var(--color-success)" strokeWidth={2} fill="var(--color-success)" fillOpacity={0.15} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="surface-card p-6">
        <h2 className="font-display text-base font-semibold">Application status breakdown</h2>
        <div className="h-[280px] mt-4">
          {statusPie.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No applications yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusPie} dataKey="value" nameKey="name" outerRadius={100} innerRadius={60} paddingAngle={2}>
                  {statusPie.map((s, i) => <Cell key={i} fill={s.fill} />)}
                </Pie>
                <Legend />
                <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}

function bucketSum<T extends { created_at: string }>(rows: T[], value: (r: T) => number, days: number) {
  const b: Record<string, number> = {};
  for (let i = days - 1; i >= 0; i--) b[format(subDays(new Date(), i), "MMM d")] = 0;
  for (const r of rows) {
    const d = format(new Date(r.created_at), "MMM d");
    if (d in b) b[d] += value(r);
  }
  return Object.entries(b).map(([day, value]) => ({ day, value }));
}
function bucketCount(ts: string[], days: number) {
  const b: Record<string, number> = {};
  for (let i = days - 1; i >= 0; i--) b[format(subDays(new Date(), i), "MMM d")] = 0;
  for (const t of ts) {
    const d = format(new Date(t), "MMM d");
    if (d in b) b[d]++;
  }
  return Object.entries(b).map(([day, value]) => ({ day, value }));
}


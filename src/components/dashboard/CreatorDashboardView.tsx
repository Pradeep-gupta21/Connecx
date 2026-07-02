import { useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  DollarSign,
  Clock,
  Inbox,
  Megaphone,
  MessageSquare,
  Sparkles,
  TrendingUp,
  CheckCircle2,
} from "lucide-react";
import { format, subDays } from "date-fns";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { EmptyState } from "@/components/common/EmptyState";
import { StatSkeleton, ListSkeleton } from "@/components/common/Skeletons";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { supabase } from "@/integrations/supabase/client";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-warning/10 text-warning border-warning/20",
  accepted: "bg-success/10 text-success border-success/20",
  rejected: "bg-destructive/10 text-destructive border-destructive/20",
  withdrawn: "bg-muted text-muted-foreground border-border",
};

export function CreatorDashboardView() {
  const { user } = useAuth();
  const { profile } = useWorkspace();
  const qc = useQueryClient();

  // -------- Realtime: refresh dashboard slices on data change --------
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`creator-dashboard-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "applications", filter: `creator_id=eq.${user.id}` }, () => {
        qc.invalidateQueries({ queryKey: ["creator-apps", user.id] });
        qc.invalidateQueries({ queryKey: ["creator-stats", user.id] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "payments", filter: `payee_id=eq.${user.id}` }, () => {
        qc.invalidateQueries({ queryKey: ["creator-payments", user.id] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => {
        qc.invalidateQueries({ queryKey: ["creator-messages", user.id] });
        qc.invalidateQueries({ queryKey: ["creator-stats", user.id] });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "campaigns" }, () => {
        qc.invalidateQueries({ queryKey: ["creator-opps"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, qc]);

  // -------- Payments (earnings + pending) --------
  const paymentsQuery = useQuery({
    queryKey: ["creator-payments", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select("id, amount, status, type, created_at, processed_at")
        .eq("payee_id", user!.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  // -------- Applications --------
  const appsQuery = useQuery({
    queryKey: ["creator-apps", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("applications")
        .select("id, status, created_at, campaign_id, campaigns(title, budget_min, budget_max, cover_url, profiles:advertiser_id(display_name, avatar_url))")
        .eq("creator_id", user!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  // -------- Recent messages --------
  const messagesQuery = useQuery({
    queryKey: ["creator-messages", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("conversations")
        .select("id, last_message_at, advertiser:profiles!conversations_advertiser_profile_fkey(id, display_name, avatar_url), messages(id, body, created_at, sender_id, read_at)")
        .eq("creator_id", user!.id)
        .order("last_message_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  // -------- Latest opportunities --------
  const oppsQuery = useQuery({
    queryKey: ["creator-opps"],
    queryFn: async () => {
      const { data } = await supabase
        .from("campaigns")
        .select("id, title, brief, category, budget_min, budget_max, created_at, profiles:advertiser_id(display_name, avatar_url)")
        .eq("status", "open")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(6);
      return data ?? [];
    },
  });

  // -------- Stats derived --------
  const totalEarnings = (paymentsQuery.data ?? [])
    .filter((p) => p.status === "succeeded")
    .reduce((s, p) => s + Number(p.amount), 0);
  const pendingPayments = (paymentsQuery.data ?? [])
    .filter((p) => p.status === "pending" || p.status === "processing")
    .reduce((s, p) => s + Number(p.amount), 0);
  const invites = (appsQuery.data ?? []).filter((a) => a.status === "accepted").length;
  const unreadCount = (messagesQuery.data ?? []).reduce((n, c: any) => {
    return n + (c.messages ?? []).filter((m: any) => !m.read_at && m.sender_id !== user?.id).length;
  }, 0);

  // -------- Analytics buckets (last 30d) --------
  const earningsByDay = bucketSum(paymentsQuery.data ?? [], (p) =>
    p.status === "succeeded" ? Number(p.amount) : 0
  );
  const applicationsByDay = bucketCount((appsQuery.data ?? []).map((a) => a.created_at));

  // -------- Profile completion --------
  const completion = computeCompletion(profile);

  const statusCounts = countBy((appsQuery.data ?? []).map((a) => a.status));

  return (
    <div className="space-y-10">
      <PageHeader
        title={`${greeting()}${profile?.display_name ? `, ${profile.display_name.split(" ")[0]}` : ""}`}
        description="Here's the pulse of your creator business — updated in realtime."
        actions={
          <Link to="/campaigns">
            <Button>Browse campaigns</Button>
          </Link>
        }
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {paymentsQuery.isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <StatSkeleton key={i} />)
        ) : (
          <>
            <StatCard label="Total earnings" value={fmtMoney(totalEarnings)} icon={DollarSign} />
            <StatCard label="Pending payments" value={fmtMoney(pendingPayments)} icon={Clock} />
            <StatCard label="Campaign invites" value={invites} icon={Inbox} />
            <StatCard label="Unread messages" value={unreadCount} icon={MessageSquare} />
          </>
        )}
      </div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 surface-card p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-display text-base font-semibold">Earnings · last 30 days</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Paid invoices and released milestones.</p>
            </div>
            <Link to="/payments" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              Payments <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={earningsByDay} margin={{ left: -8, right: 8, top: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="earnFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} formatter={(v) => fmtMoney(Number(v))} />
                <Area type="monotone" dataKey="value" stroke="var(--color-accent)" strokeWidth={2} fill="url(#earnFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Profile completion */}
        <div className="surface-card p-6 flex flex-col">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent" />
            <h2 className="font-display text-base font-semibold">Profile completion</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">A complete profile wins 3× more invites.</p>

          <div className="mt-6 flex items-baseline gap-2">
            <span className="font-display text-4xl font-semibold tracking-tight">{completion.percent}%</span>
            <span className="text-xs text-muted-foreground">{completion.done}/{completion.total} steps</span>
          </div>
          <Progress value={completion.percent} className="mt-3" />

          <ul className="mt-6 space-y-2 text-sm flex-1">
            {completion.items.map((item) => (
              <li key={item.label} className="flex items-center gap-2">
                <CheckCircle2 className={`h-4 w-4 ${item.done ? "text-success" : "text-muted-foreground/40"}`} />
                <span className={item.done ? "line-through text-muted-foreground" : ""}>{item.label}</span>
              </li>
            ))}
          </ul>
          <Link to="/settings" className="mt-4">
            <Button variant="outline" size="sm" className="w-full">Complete profile</Button>
          </Link>
        </div>
      </div>

      {/* Application status + messages */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="surface-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display text-base font-semibold">Application status</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Where your pitches stand.</p>
            </div>
            <Link to="/applications" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              All <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={applicationsByDay.slice(-14)} margin={{ left: -16, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="value" fill="var(--color-accent)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 grid grid-cols-4 gap-2 text-center">
            {(["pending", "accepted", "rejected", "withdrawn"] as const).map((s) => (
              <div key={s} className={`rounded-lg border px-2 py-2 ${STATUS_COLORS[s]}`}>
                <div className="font-display text-lg font-semibold tabular-nums">{statusCounts[s] ?? 0}</div>
                <div className="text-[10px] uppercase tracking-wide">{s}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 surface-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display text-base font-semibold">Recent messages</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Live inbox from brands.</p>
            </div>
            <Link to="/messages" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              Inbox <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {messagesQuery.isLoading ? (
            <ListSkeleton rows={4} />
          ) : (messagesQuery.data ?? []).length === 0 ? (
            <EmptyState icon={MessageSquare} title="No conversations yet" description="Apply to campaigns to open a thread with brands." />
          ) : (
            <ul className="divide-y divide-border -mx-2">
              {(messagesQuery.data as any[]).map((c) => {
                const last = (c.messages ?? []).sort((a: any, b: any) => +new Date(b.created_at) - +new Date(a.created_at))[0];
                const unread = (c.messages ?? []).filter((m: any) => !m.read_at && m.sender_id !== user?.id).length;
                return (
                  <li key={c.id}>
                    <Link to="/messages/$threadId" params={{ threadId: c.id }} className="flex items-center gap-3 px-2 py-3 rounded-lg hover:bg-secondary/60">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={c.advertiser?.avatar_url ?? undefined} />
                        <AvatarFallback className="text-[10px] bg-secondary">
                          {(c.advertiser?.display_name ?? "?").slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium truncate">{c.advertiser?.display_name ?? "Brand"}</p>
                          <p className="text-[11px] text-muted-foreground shrink-0">
                            {c.last_message_at ? format(new Date(c.last_message_at), "MMM d") : ""}
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{last?.body ?? "No messages yet."}</p>
                      </div>
                      {unread > 0 && (
                        <Badge className="bg-accent text-accent-foreground text-[10px] shrink-0">{unread}</Badge>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Latest opportunities */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-display text-xl font-semibold flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-accent" />
              Latest opportunities
            </h2>
            <p className="text-xs text-muted-foreground mt-1">Fresh briefs matched to open creators.</p>
          </div>
          <Link to="/campaigns" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            See all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        {oppsQuery.isLoading ? (
          <div className="grid md:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => <StatSkeleton key={i} />)}
          </div>
        ) : (oppsQuery.data ?? []).length === 0 ? (
          <EmptyState icon={Megaphone} title="No open campaigns" description="Check back soon — new briefs post daily." />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(oppsQuery.data as any[]).map((c) => (
              <Link key={c.id} to="/campaigns/$id" params={{ id: c.id }} className="surface-card p-5 hover:shadow-elevated hover:-translate-y-px transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-display text-base font-semibold truncate">{c.title}</div>
                    <div className="text-xs text-muted-foreground mt-1 truncate">
                      {c.profiles?.display_name ?? "Brand"}
                    </div>
                  </div>
                  {c.category && <Badge variant="secondary" className="text-[10px] shrink-0">{c.category}</Badge>}
                </div>
                {c.brief && <p className="mt-4 text-sm text-muted-foreground line-clamp-3">{c.brief}</p>}
                {(c.budget_min || c.budget_max) && (
                  <p className="mt-4 text-xs font-medium">
                    ${c.budget_min ?? "?"} – ${c.budget_max ?? "?"}
                  </p>
                )}
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/* ---------- helpers ---------- */

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}
function fmtMoney(n: number) {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}
function bucketSum<T extends { created_at: string }>(rows: T[], value: (r: T) => number) {
  const b: Record<string, number> = {};
  for (let i = 29; i >= 0; i--) b[format(subDays(new Date(), i), "MMM d")] = 0;
  for (const r of rows) {
    const d = format(new Date(r.created_at), "MMM d");
    if (d in b) b[d] += value(r);
  }
  return Object.entries(b).map(([day, value]) => ({ day, value }));
}
function bucketCount(timestamps: string[]) {
  const b: Record<string, number> = {};
  for (let i = 29; i >= 0; i--) b[format(subDays(new Date(), i), "MMM d")] = 0;
  for (const t of timestamps) {
    const d = format(new Date(t), "MMM d");
    if (d in b) b[d]++;
  }
  return Object.entries(b).map(([day, value]) => ({ day, value }));
}
function countBy<T extends string>(arr: T[]) {
  return arr.reduce<Record<string, number>>((acc, x) => ((acc[x] = (acc[x] ?? 0) + 1), acc), {});
}
function computeCompletion(profile: any) {
  const items = [
    { label: "Display name", done: !!profile?.display_name },
    { label: "Avatar photo", done: !!profile?.avatar_url },
    { label: "Bio", done: !!profile?.bio },
    { label: "Country", done: !!profile?.country },
    { label: "Phone", done: !!profile?.phone },
    { label: "Location", done: !!profile?.location },
  ];
  const done = items.filter((i) => i.done).length;
  return { items, done, total: items.length, percent: Math.round((done / items.length) * 100) };
}

import { Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CircleDollarSign, Compass, Megaphone, Users, ClipboardList, Clock } from "lucide-react";
import { format, subDays } from "date-fns";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { EmptyState } from "@/components/common/EmptyState";
import { StatSkeleton, ListSkeleton } from "@/components/common/Skeletons";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { SmartAvatar } from "@/components/profile/SmartAvatar";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { supabase } from "@/integrations/supabase/client";

export function AdvertiserDashboardView() {
  const { user } = useAuth();
  const { profile } = useWorkspace();
  const qc = useQueryClient();

  const stats = useQuery({
    queryKey: ["adv-dashboard", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [campaigns, apps, payments] = await Promise.all([
        supabase.from("campaigns").select("id, status, budget_max").eq("advertiser_id", user!.id).is("deleted_at", null),
        supabase.from("applications").select("id, status, created_at, campaigns!inner(advertiser_id)").eq("campaigns.advertiser_id", user!.id),
        supabase.from("payments").select("amount, status").eq("payer_id", user!.id),
      ]);
      const cs = campaigns.data ?? [];
      const as = apps.data ?? [];
      const ps = payments.data ?? [];
      const active = cs.filter((c) => c.status === "open").length;
      const pending = as.filter((a) => a.status === "pending").length;
      const spent = ps.filter((p) => p.status === "succeeded").reduce((sum, p: any) => sum + Number(p.amount ?? 0), 0);
      const budget = cs.reduce((sum, c: any) => sum + Number(c.budget_max ?? 0), 0);
      return {
        active,
        applications: as.length,
        pending,
        spent,
        budget,
        appsByDay: bucketByDay(as.map((a) => a.created_at)),
      };
    },
  });

  const campaignsQ = useQuery({
    queryKey: ["adv-recent-campaigns", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("campaigns")
        .select("id, title, status, category, budget_max, created_at")
        .eq("advertiser_id", user!.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  const creatorsQ = useQuery({
    queryKey: ["adv-latest-creators"],
    queryFn: async () => {
      const { data } = await supabase
        .from("creator_profiles")
        .select("user_id, headline, categories, profiles!inner(display_name, avatar_url, location)")
        .order("created_at", { ascending: false })
        .limit(6);
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`adv-dash-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "applications" }, () => {
        qc.invalidateQueries({ queryKey: ["adv-dashboard", user.id] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "campaigns", filter: `advertiser_id=eq.${user.id}` }, () => {
        qc.invalidateQueries({ queryKey: ["adv-dashboard", user.id] });
        qc.invalidateQueries({ queryKey: ["adv-recent-campaigns", user.id] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "payments", filter: `payer_id=eq.${user.id}` }, () => {
        qc.invalidateQueries({ queryKey: ["adv-dashboard", user.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc]);

  const budgetUsedPct = stats.data && stats.data.budget > 0 ? Math.min(100, Math.round((stats.data.spent / stats.data.budget) * 100)) : 0;

  return (
    <div className="space-y-10">
      <ProfileHeader
        displayName={profile?.display_name ?? "Advertiser"}
        avatarValue={profile?.avatar_url ?? null}
        bannerValue={profile?.banner_url ?? null}
        bannerPosition={(profile?.banner_position as any) ?? null}
        headline={greeting()}
        location={profile?.location}
        bio={profile?.bio}
        isOwner
        ownerActions={
          <>
            <Button asChild variant="outline"><Link to="/settings">Edit profile</Link></Button>
            <Button asChild><Link to="/campaigns/new">New campaign</Link></Button>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

        {stats.isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <StatSkeleton key={i} />)
        ) : (
          <>
            <StatCard label="Active campaigns" value={stats.data?.active ?? 0} icon={Megaphone} />
            <StatCard label="Applications received" value={stats.data?.applications ?? 0} icon={Users} />
            <StatCard label="Pending approvals" value={stats.data?.pending ?? 0} icon={Clock} />
            <StatCard label="Budget spent" value={`$${(stats.data?.spent ?? 0).toLocaleString()}`} icon={CircleDollarSign} />
          </>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 surface-card p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-display text-base font-semibold">Campaign performance</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Applications received over the last 30 days.</p>
            </div>
          </div>
          <div className="h-[260px]">
            {stats.data?.appsByDay && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.data.appsByDay} margin={{ left: -16, right: 8, top: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: "8px", fontSize: "12px" }} />
                  <Bar dataKey="count" fill="var(--color-accent)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="surface-card p-6">
          <h2 className="font-display text-base font-semibold">Budget used</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Across your published campaigns.</p>
          <div className="mt-6 space-y-3">
            <div className="flex items-baseline justify-between">
              <span className="font-display text-3xl font-semibold tabular-nums">${(stats.data?.spent ?? 0).toLocaleString()}</span>
              <span className="text-xs text-muted-foreground tabular-nums">of ${(stats.data?.budget ?? 0).toLocaleString()}</span>
            </div>
            <div className="h-2 rounded-full bg-secondary overflow-hidden">
              <div className="h-full bg-accent transition-all" style={{ width: `${budgetUsedPct}%` }} />
            </div>
            <p className="text-xs text-muted-foreground">{budgetUsedPct}% of total campaign budget spent.</p>
          </div>
          <div className="mt-6 pt-4 border-t border-border">
            <Link to="/payments" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              View payments <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>

      <section className="grid lg:grid-cols-2 gap-6">
        <div className="surface-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-base font-semibold">Your campaigns</h2>
            <Link to="/campaigns" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              See all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {campaignsQ.isLoading ? <ListSkeleton rows={4} /> : (campaignsQ.data ?? []).length === 0 ? (
            <EmptyState icon={Megaphone} title="No campaigns yet" description="Publish your first brief."
              action={{ label: "Create campaign", onClick: () => (window.location.href = "/campaigns/new") }} />
          ) : (
            <ul className="space-y-1 -mx-2">
              {campaignsQ.data!.map((c: any) => (
                <li key={c.id}>
                  <Link to="/campaigns/$id" params={{ id: c.id }} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-secondary/60">
                    <div className="h-9 w-9 rounded-md bg-secondary flex items-center justify-center">
                      <ClipboardList className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{c.title}</p>
                      <p className="text-[11px] text-muted-foreground">{format(new Date(c.created_at), "MMM d")}{c.category ? ` · ${c.category}` : ""}</p>
                    </div>
                    <Badge variant={c.status === "open" ? "default" : "secondary"} className="capitalize text-[10px]">
                      {c.status === "open" ? "Published" : c.status}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="surface-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-base font-semibold">Latest creators</h2>
            <Link to="/discover" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              Browse all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {creatorsQ.isLoading ? <ListSkeleton rows={4} /> : (creatorsQ.data ?? []).length === 0 ? (
            <EmptyState icon={Compass} title="No creators yet" description="Creator profiles will appear as they sign up." />
          ) : (
            <ul className="space-y-1 -mx-2">
              {(creatorsQ.data as any[]).map((c) => (
                <li key={c.user_id}>
                  <Link to="/creators/$id" params={{ id: c.user_id }} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-secondary/60">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={c.profiles?.avatar_url ?? undefined} />
                      <AvatarFallback className="text-[10px] bg-secondary">
                        {(c.profiles?.display_name ?? "?").slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{c.profiles?.display_name ?? "Creator"}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{c.headline ?? c.profiles?.location ?? "—"}</p>
                    </div>
                    <div className="flex flex-wrap gap-1 max-w-[140px] justify-end">
                      {(c.categories ?? []).slice(0, 2).map((cat: string) => (
                        <Badge key={cat} variant="secondary" className="text-[10px]">{cat}</Badge>
                      ))}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function bucketByDay(timestamps: string[]) {
  const buckets: Record<string, number> = {};
  for (let i = 29; i >= 0; i--) {
    const d = format(subDays(new Date(), i), "MMM d");
    buckets[d] = 0;
  }
  for (const t of timestamps) {
    const d = format(new Date(t), "MMM d");
    if (d in buckets) buckets[d]++;
  }
  return Object.entries(buckets).map(([day, count]) => ({ day, count }));
}

import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Compass, Megaphone, MessageSquare, Users, ArrowRight } from "lucide-react";
import { format, subDays } from "date-fns";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { EmptyState } from "@/components/common/EmptyState";
import { StatSkeleton, ListSkeleton } from "@/components/common/Skeletons";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { supabase } from "@/integrations/supabase/client";

export function DashboardView() {
  const { user } = useAuth();
  const { activeRole, profile } = useWorkspace();
  const isAdvertiser = activeRole === "advertiser";

  const statsQuery = useQuery({
    queryKey: ["dashboard-stats", user?.id, activeRole],
    enabled: !!user && !!activeRole,
    queryFn: async () => {
      if (isAdvertiser) {
        const [campaigns, applications, unread] = await Promise.all([
          supabase.from("campaigns").select("id, status").eq("advertiser_id", user!.id),
          supabase.from("applications").select("id, created_at, status, campaigns!inner(advertiser_id)")
            .eq("campaigns.advertiser_id", user!.id),
          supabase.from("messages").select("id").is("read_at", null).neq("sender_id", user!.id),
        ]);
        const apps = applications.data ?? [];
        return {
          active: (campaigns.data ?? []).filter((c) => c.status === "open").length,
          applications: apps.length,
          pending: apps.filter((a) => a.status === "pending").length,
          unread: unread.data?.length ?? 0,
          appsByDay: bucketByDay(apps.map((a) => a.created_at)),
        };
      }
      const [mine, unread] = await Promise.all([
        supabase.from("applications").select("id, created_at, status").eq("creator_id", user!.id),
        supabase.from("messages").select("id").is("read_at", null).neq("sender_id", user!.id),
      ]);
      const apps = mine.data ?? [];
      return {
        active: apps.filter((a) => a.status === "accepted").length,
        applications: apps.length,
        pending: apps.filter((a) => a.status === "pending").length,
        unread: unread.data?.length ?? 0,
        appsByDay: bucketByDay(apps.map((a) => a.created_at)),
      };
    },
  });

  const recsQuery = useQuery({
    queryKey: ["dashboard-recs", activeRole],
    queryFn: async () => {
      if (isAdvertiser) {
        const { data } = await supabase
          .from("creator_profiles")
          .select("user_id, headline, categories, rate_min, rate_max, profiles!creator_profiles_profile_fkey!inner(display_name, avatar_url, location)")
          .limit(6);
        return data ?? [];
      }
      const { data } = await supabase
        .from("campaigns")
        .select("id, title, brief, budget_min, budget_max, category, advertiser_id, profiles:advertiser_id(display_name, avatar_url)")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(6);
      return data ?? [];
    },
    enabled: !!activeRole,
  });

  const recentQuery = useQuery({
    queryKey: ["dashboard-recent", user?.id, activeRole],
    enabled: !!user && !!activeRole,
    queryFn: async () => {
      if (isAdvertiser) {
        const { data } = await supabase
          .from("applications")
          .select("id, created_at, status, campaign_id, campaigns!inner(title, advertiser_id), profiles:creator_id(display_name, avatar_url)")
          .eq("campaigns.advertiser_id", user!.id)
          .order("created_at", { ascending: false })
          .limit(8);
        return data ?? [];
      }
      const { data } = await supabase
        .from("applications")
        .select("id, created_at, status, campaign_id, campaigns(title, advertiser_id)")
        .eq("creator_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(8);
      return data ?? [];
    },
  });

  return (
    <div className="space-y-10">
      <PageHeader
        title={`${greeting()}${profile?.display_name ? `, ${profile.display_name.split(" ")[0]}` : ""}`}
        description={
          isAdvertiser
            ? "Here's how your campaigns and outreach are doing."
            : "Here's what's happening across your applications and inbox."
        }
        actions={
          isAdvertiser ? (
            <Link to="/campaigns/new"><Button>New campaign</Button></Link>
          ) : (
            <Link to="/campaigns"><Button>Browse campaigns</Button></Link>
          )
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statsQuery.isLoading
          ? Array.from({ length: 4 }).map((_, i) => <StatSkeleton key={i} />)
          : (
            <>
              <StatCard label={isAdvertiser ? "Active campaigns" : "Accepted gigs"} value={statsQuery.data?.active ?? 0} icon={Megaphone} />
              <StatCard label={isAdvertiser ? "Applications" : "Applications sent"} value={statsQuery.data?.applications ?? 0} icon={Users} />
              <StatCard label="Pending" value={statsQuery.data?.pending ?? 0} icon={Compass} />
              <StatCard label="Unread messages" value={statsQuery.data?.unread ?? 0} icon={MessageSquare} />
            </>
          )}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 surface-card p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-display text-base font-semibold">Applications · last 30 days</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Volume of {isAdvertiser ? "incoming" : "outgoing"} applications over time.
              </p>
            </div>
          </div>
          <div className="h-[260px]">
            {statsQuery.data?.appsByDay && (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={statsQuery.data.appsByDay} margin={{ left: -16, right: 8, top: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="appsFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: "8px", fontSize: "12px" }} />
                  <Area type="monotone" dataKey="count" stroke="var(--color-accent)" strokeWidth={2} fill="url(#appsFill)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="surface-card p-6">
          <h2 className="font-display text-base font-semibold">Recent activity</h2>
          <p className="text-xs text-muted-foreground mt-0.5 mb-4">
            Latest applications {isAdvertiser ? "to your campaigns" : "you sent"}.
          </p>
          {recentQuery.isLoading ? (
            <ListSkeleton rows={5} />
          ) : recentQuery.data && recentQuery.data.length > 0 ? (
            <ul className="space-y-1 -mx-2">
              {recentQuery.data.map((a: any) => (
                <li key={a.id} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-secondary/60">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={a.profiles?.avatar_url ?? undefined} />
                    <AvatarFallback className="text-[10px] bg-secondary">
                      {(a.profiles?.display_name ?? "?").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">
                      {isAdvertiser
                        ? <><span className="font-medium">{a.profiles?.display_name ?? "Someone"}</span> applied to <span className="text-muted-foreground">{a.campaigns?.title}</span></>
                        : <>Applied to <span className="font-medium">{a.campaigns?.title}</span></>}
                    </p>
                    <p className="text-[11px] text-muted-foreground">{format(new Date(a.created_at), "MMM d, h:mm a")}</p>
                  </div>
                  <Badge variant="secondary" className="capitalize text-[10px]">{a.status}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">Nothing yet.</p>
          )}
        </div>
      </div>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl font-semibold">
            {isAdvertiser ? "Recommended creators" : "Open campaigns for you"}
          </h2>
          <Link to={isAdvertiser ? "/discover" : "/campaigns"} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            See all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        {recsQuery.isLoading ? (
          <div className="grid md:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => <StatSkeleton key={i} />)}
          </div>
        ) : recsQuery.data && recsQuery.data.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {isAdvertiser
              ? (recsQuery.data as any[]).map((c) => (
                  <Link key={c.user_id} to="/creators/$id" params={{ id: c.user_id }} className="surface-card p-5 hover:shadow-elevated hover:-translate-y-px transition-all">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-11 w-11">
                        <AvatarImage src={c.profiles?.avatar_url ?? undefined} />
                        <AvatarFallback>{(c.profiles?.display_name ?? "?").slice(0,2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="font-medium truncate">{c.profiles?.display_name ?? "Creator"}</div>
                        <div className="text-xs text-muted-foreground truncate">{c.profiles?.location ?? "—"}</div>
                      </div>
                    </div>
                    {c.headline && <p className="mt-4 text-sm text-muted-foreground line-clamp-2">{c.headline}</p>}
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {(c.categories ?? []).slice(0,3).map((cat: string) => (
                        <Badge key={cat} variant="secondary" className="text-[10px]">{cat}</Badge>
                      ))}
                    </div>
                  </Link>
                ))
              : (recsQuery.data as any[]).map((c) => (
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
        ) : (
          <EmptyState
            icon={isAdvertiser ? Users : Megaphone}
            title={isAdvertiser ? "No creators yet" : "No open campaigns"}
            description={
              isAdvertiser
                ? "Once creators sign up, they'll appear here."
                : "Check back soon — advertisers post new briefs daily."
            }
          />
        )}
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

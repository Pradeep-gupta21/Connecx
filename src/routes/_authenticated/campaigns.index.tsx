import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Bookmark, BookmarkCheck, Megaphone, Plus, Search } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { CardSkeleton } from "@/components/common/Skeletons";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { supabase } from "@/integrations/supabase/client";
import { CREATOR_CATEGORIES } from "@/lib/constants";
import { PLATFORMS } from "@/components/campaigns/CampaignForm";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/campaigns/")({
  head: () => ({ meta: [{ title: "Campaigns · Connecx" }] }),
  component: Campaigns,
});

type FilterTab = "browse" | "mine" | "saved";

function Campaigns() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { activeRole } = useWorkspace();
  const isAdvertiser = activeRole === "advertiser";
  const [tab, setTab] = useState<FilterTab>(isAdvertiser ? "mine" : "browse");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [platform, setPlatform] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["campaigns", tab, user?.id, category, platform, status],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase
        .from("campaigns")
        .select("id, title, brief, status, category, platform, budget_min, budget_max, deadline, created_at, advertiser_id, profiles:advertiser_id(display_name, avatar_url)")
        .is("deleted_at", null);
      if (tab === "mine") q = q.eq("advertiser_id", user!.id);
      else if (tab === "browse") q = q.eq("status", "open");
      if (category !== "all") q = q.eq("category", category);
      if (platform !== "all") q = q.eq("platform", platform);
      if (tab === "mine" && status !== "all") q = q.eq("status", status as any);
      const { data, error } = await q.order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const savedQ = useQuery({
    queryKey: ["saved-campaigns", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("saved_campaigns")
        .select("id, campaign_id, campaigns:campaign_id(id, title, brief, status, category, platform, budget_min, budget_max, deadline, created_at, advertiser_id, profiles:advertiser_id(display_name, avatar_url))")
        .eq("user_id", user!.id);
      return data ?? [];
    },
  });

  const savedIds = useMemo(() => new Set((savedQ.data ?? []).map((s: any) => s.campaign_id)), [savedQ.data]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`campaigns-list-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "campaigns" }, () => {
        qc.invalidateQueries({ queryKey: ["campaigns"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "saved_campaigns", filter: `user_id=eq.${user.id}` }, () => {
        qc.invalidateQueries({ queryKey: ["saved-campaigns", user.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc]);

  const toggleSave = useMutation({
    mutationFn: async (campaignId: string) => {
      if (!user) return;
      if (savedIds.has(campaignId)) {
        const row = (savedQ.data ?? []).find((s: any) => s.campaign_id === campaignId) as any;
        if (row?.id) await supabase.from("saved_campaigns").delete().eq("id", row.id);
      } else {
        const { error } = await supabase.from("saved_campaigns").insert({ user_id: user.id, campaign_id: campaignId });
        if (error) throw error;
      }
    },
    onError: (e: Error) => toast.error(e.message),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["saved-campaigns", user?.id] }),
  });

  const list =
    tab === "saved"
      ? (savedQ.data ?? []).map((s: any) => s.campaigns).filter(Boolean).filter(applyClientFilters({ search, category, platform, status: "all" }))
      : (data ?? []).filter(applyClientFilters({ search, category, platform, status }));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Campaigns"
        description={
          isAdvertiser
            ? "Every brief you've published — plus what's open across the marketplace."
            : "Open briefs from brands ready to collaborate."
        }
        actions={
          isAdvertiser && (
            <Link to="/campaigns/new">
              <Button className="gap-2"><Plus className="h-4 w-4" /> New campaign</Button>
            </Link>
          )
        }
      />

      <div className="space-y-4">
        <Tabs value={tab} onValueChange={(v) => setTab(v as FilterTab)}>
          <TabsList>
            {isAdvertiser && <TabsTrigger value="mine">My campaigns</TabsTrigger>}
            <TabsTrigger value="browse">Browse</TabsTrigger>
            <TabsTrigger value="saved">Saved</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search title, brand, or brief…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {CREATOR_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={platform} onValueChange={setPlatform}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Platform" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All platforms</SelectItem>
              {PLATFORMS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
          {tab === "mine" && (
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="open">Published</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {isLoading || savedQ.isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title={tab === "saved" ? "Nothing saved yet" : tab === "mine" ? "No campaigns yet" : "No campaigns match"}
          description={
            tab === "saved"
              ? "Bookmark briefs you're interested in and they'll appear here."
              : tab === "mine"
              ? "Create your first brief to start hearing from creators."
              : "Try broadening your filters or check back soon."
          }
          action={
            isAdvertiser && tab === "mine"
              ? { label: "Create campaign", onClick: () => (window.location.href = "/campaigns/new") }
              : undefined
          }
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((c: any) => (
            <div key={c.id} className="surface-card p-5 hover:shadow-elevated hover:-translate-y-px transition-all relative">
              {user && c.advertiser_id !== user.id && (
                <button
                  type="button"
                  aria-label="Save campaign"
                  onClick={() => toggleSave.mutate(c.id)}
                  className="absolute top-3 right-3 rounded-full p-2 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                >
                  {savedIds.has(c.id) ? <BookmarkCheck className="h-4 w-4 text-accent" /> : <Bookmark className="h-4 w-4" />}
                </button>
              )}
              <Link to="/campaigns/$id" params={{ id: c.id }} className="block">
                <div className="flex items-start justify-between gap-3 pr-8">
                  <div className="min-w-0">
                    <h3 className="font-display text-base font-semibold truncate">{c.title}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {c.profiles?.display_name ?? "Brand"}
                    </p>
                  </div>
                  <Badge variant={c.status === "open" ? "default" : "secondary"} className="capitalize text-[10px] shrink-0">
                    {c.status === "open" ? "Published" : c.status}
                  </Badge>
                </div>
                {c.brief && <p className="mt-4 text-sm text-muted-foreground line-clamp-3">{c.brief}</p>}
                <div className="mt-5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {c.category && <Badge variant="secondary" className="text-[10px]">{c.category}</Badge>}
                    {c.platform && <Badge variant="secondary" className="text-[10px]">{c.platform}</Badge>}
                  </div>
                  {(c.budget_min || c.budget_max) && (
                    <span className="font-medium tabular-nums">
                      {c.budget_min != null ? formatMoney(c.budget_min, "INR", { showZero: true }) : "?"}
                      {" – "}
                      {c.budget_max != null ? formatMoney(c.budget_max, "INR", { showZero: true }) : "?"}
                    </span>
                  )}
                </div>
                {c.deadline && (
                  <p className="mt-3 text-[11px] text-muted-foreground">
                    Deadline {format(new Date(c.deadline), "MMM d, yyyy")}
                  </p>
                )}
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function applyClientFilters({ search, category, platform, status }: { search: string; category: string; platform: string; status: string }) {
  const s = search.trim().toLowerCase();
  return (c: any) => {
    if (!c) return false;
    if (s) {
      const hay = `${c.title ?? ""} ${c.brief ?? ""} ${c.profiles?.display_name ?? ""}`.toLowerCase();
      if (!hay.includes(s)) return false;
    }
    if (category !== "all" && c.category !== category) return false;
    if (platform !== "all" && c.platform !== platform) return false;
    if (status !== "all" && c.status !== status) return false;
    return true;
  };
}

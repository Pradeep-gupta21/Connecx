import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Megaphone, Plus } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { CardSkeleton } from "@/components/common/Skeletons";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/campaigns/")({
  head: () => ({ meta: [{ title: "Campaigns · BrandBridge" }] }),
  component: Campaigns,
});

function Campaigns() {
  const { user } = useAuth();
  const { activeRole } = useWorkspace();
  const isAdvertiser = activeRole === "advertiser";
  const [filter, setFilter] = useState<"all" | "open" | "mine">(isAdvertiser ? "mine" : "open");

  const { data, isLoading } = useQuery({
    queryKey: ["campaigns", filter, user?.id, activeRole],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase.from("campaigns").select(
        "id, title, brief, status, category, budget_min, budget_max, deadline, created_at, advertiser_id, profiles:advertiser_id(display_name, avatar_url)"
      );
      if (filter === "mine") q = q.eq("advertiser_id", user!.id);
      else if (filter === "open") q = q.eq("status", "open");
      const { data, error } = await q.order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Campaigns"
        description={
          isAdvertiser
            ? "Briefs you've published and ones still open across the marketplace."
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

      <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
        <TabsList>
          {isAdvertiser && <TabsTrigger value="mine">My campaigns</TabsTrigger>}
          <TabsTrigger value="open">Open</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title={filter === "mine" ? "No campaigns yet" : "No campaigns to show"}
          description={
            filter === "mine"
              ? "Create your first brief to start hearing from creators."
              : "Check back soon."
          }
          action={
            isAdvertiser && filter === "mine"
              ? { label: "Create campaign", onClick: () => (window.location.href = "/campaigns/new") }
              : undefined
          }
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.map((c: any) => (
            <Link
              key={c.id}
              to="/campaigns/$id"
              params={{ id: c.id }}
              className="surface-card p-5 hover:shadow-elevated hover:-translate-y-px transition-all"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-display text-base font-semibold truncate">{c.title}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {c.profiles?.display_name ?? "Brand"}
                  </p>
                </div>
                <Badge variant={c.status === "open" ? "default" : "secondary"} className="capitalize text-[10px] shrink-0">
                  {c.status}
                </Badge>
              </div>
              {c.brief && <p className="mt-4 text-sm text-muted-foreground line-clamp-3">{c.brief}</p>}
              <div className="mt-5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  {c.category && <Badge variant="secondary" className="text-[10px]">{c.category}</Badge>}
                </div>
                {(c.budget_min || c.budget_max) && (
                  <span className="font-medium tabular-nums">${c.budget_min ?? "?"} – ${c.budget_max ?? "?"}</span>
                )}
              </div>
              {c.deadline && (
                <p className="mt-3 text-[11px] text-muted-foreground">
                  Deadline {format(new Date(c.deadline), "MMM d, yyyy")}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

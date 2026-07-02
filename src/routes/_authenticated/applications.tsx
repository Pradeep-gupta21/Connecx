import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Briefcase } from "lucide-react";
import { format } from "date-fns";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { ListSkeleton } from "@/components/common/Skeletons";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/applications")({
  head: () => ({ meta: [{ title: "Applications · BrandBridge" }] }),
  component: ApplicationsPage,
});

const STATUS: Record<string, string> = {
  pending: "bg-warning/10 text-warning border-warning/20",
  accepted: "bg-success/10 text-success border-success/20",
  rejected: "bg-destructive/10 text-destructive border-destructive/20",
  withdrawn: "bg-muted text-muted-foreground border-border",
};

function ApplicationsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["applications-page", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("applications")
        .select("id, status, pitch, created_at, campaign_id, campaigns(title, category, budget_min, budget_max, profiles:advertiser_id(display_name, avatar_url))")
        .eq("creator_id", user!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`apps-page-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "applications", filter: `creator_id=eq.${user.id}` }, () => {
        qc.invalidateQueries({ queryKey: ["applications-page", user.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc]);

  return (
    <div className="space-y-8">
      <PageHeader title="Applications" description="Every pitch you've sent — updated live." />
      {q.isLoading ? (
        <ListSkeleton rows={6} />
      ) : (q.data ?? []).length === 0 ? (
        <EmptyState icon={Briefcase} title="No applications yet" description="Browse campaigns and send your first pitch." />
      ) : (
        <div className="surface-card divide-y divide-border">
          {q.data!.map((a: any) => (
            <Link key={a.id} to="/campaigns/$id" params={{ id: a.campaign_id }} className="flex items-start gap-4 p-5 hover:bg-secondary/40 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <p className="font-display font-semibold truncate">{a.campaigns?.title}</p>
                  {a.campaigns?.category && <Badge variant="secondary" className="text-[10px]">{a.campaigns.category}</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {a.campaigns?.profiles?.display_name ?? "Brand"} · Applied {format(new Date(a.created_at), "MMM d, yyyy")}
                </p>
                {a.pitch && <p className="mt-3 text-sm text-muted-foreground line-clamp-2">{a.pitch}</p>}
              </div>
              <div className="text-right shrink-0 space-y-2">
                <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[11px] capitalize ${STATUS[a.status] ?? ""}`}>
                  {a.status}
                </span>
                {(a.campaigns?.budget_min || a.campaigns?.budget_max) && (
                  <p className="text-xs text-muted-foreground">${a.campaigns.budget_min ?? "?"}–${a.campaigns.budget_max ?? "?"}</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Briefcase } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { ListSkeleton } from "@/components/common/Skeletons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/applications")({
  head: () => ({ meta: [{ title: "Applications · Connecx" }] }),
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
  const { activeRole } = useWorkspace();
  const isAdvertiser = activeRole === "advertiser";
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["applications-page", user?.id, activeRole],
    enabled: !!user,
    queryFn: async () => {
      if (isAdvertiser) {
        const { data } = await supabase
          .from("applications")
          .select("id, status, pitch, created_at, campaign_id, creator_id, campaigns!inner(title, category, budget_min, budget_max, advertiser_id), profiles:creator_id(display_name, avatar_url, location)")
          .eq("campaigns.advertiser_id", user!.id)
          .order("created_at", { ascending: false });
        return data ?? [];
      }
      const { data } = await supabase
        .from("applications")
        .select("id, status, pitch, created_at, campaign_id, campaigns(title, category, budget_min, budget_max, profiles:advertiser_id(display_name, avatar_url))")
        .eq("creator_id", user!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("applications").update({ status: status as any }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status updated");
      qc.invalidateQueries({ queryKey: ["applications-page", user?.id, activeRole] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const withdraw = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("applications").update({ status: "withdrawn" as any }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Application withdrawn");
      qc.invalidateQueries({ queryKey: ["applications-page", user?.id, activeRole] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`apps-page-${user.id}-${activeRole}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "applications" }, () => {
        qc.invalidateQueries({ queryKey: ["applications-page", user.id, activeRole] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc, activeRole]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Applications"
        description={isAdvertiser ? "Every pitch across your campaigns — updated live." : "Every pitch you've sent — updated live."}
      />
      {q.isLoading ? (
        <ListSkeleton rows={6} />
      ) : (q.data ?? []).length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title={isAdvertiser ? "No applications yet" : "No applications yet"}
          description={isAdvertiser ? "Once creators pitch your campaigns, they'll appear here." : "Browse campaigns and send your first pitch."}
        />
      ) : (
        <div className="surface-card divide-y divide-border">
          {q.data!.map((a: any) => (
            <div key={a.id} className="flex items-start gap-4 p-5">
              {isAdvertiser && (
                <Avatar className="h-10 w-10">
                  <AvatarImage src={a.profiles?.avatar_url ?? undefined} />
                  <AvatarFallback>{(a.profiles?.display_name ?? "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  {isAdvertiser ? (
                    <Link to="/creators/$id" params={{ id: a.creator_id }} className="font-display font-semibold hover:underline">
                      {a.profiles?.display_name ?? "Creator"}
                    </Link>
                  ) : (
                    <Link to="/campaigns/$id" params={{ id: a.campaign_id }} className="font-display font-semibold hover:underline truncate">
                      {a.campaigns?.title}
                    </Link>
                  )}
                  {a.campaigns?.category && <Badge variant="secondary" className="text-[10px]">{a.campaigns.category}</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {isAdvertiser ? (
                    <>Pitched <Link to="/campaigns/$id" params={{ id: a.campaign_id }} className="hover:underline">{a.campaigns?.title}</Link></>
                  ) : (
                    <>{a.campaigns?.profiles?.display_name ?? "Brand"}</>
                  )}
                  {" · "}
                  {format(new Date(a.created_at), "MMM d, yyyy")}
                </p>
                {a.pitch && <p className="mt-3 text-sm text-muted-foreground line-clamp-3">{a.pitch}</p>}
              </div>
              <div className="text-right shrink-0 space-y-2">
                <div>
                  <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[11px] capitalize ${STATUS[a.status] ?? ""}`}>
                    {a.status}
                  </span>
                </div>
                {isAdvertiser ? (
                  a.status === "withdrawn" ? (
                    <p className="text-[11px] text-muted-foreground italic">Withdrawn by creator</p>
                  ) : (
                    <Select value={a.status} onValueChange={(v) => updateStatus.mutate({ id: a.id, status: v })}>
                      <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="accepted">Accepted</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                      </SelectContent>
                    </Select>
                  )
                ) : (
                  a.status !== "withdrawn" && (
                    <Button variant="outline" size="sm" onClick={() => withdraw.mutate(a.id)}>Withdraw</Button>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

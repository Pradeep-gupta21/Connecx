import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/campaigns")({
  component: AdminCampaigns,
});

function AdminCampaigns() {
  const [status, setStatus] = useState<string>("all");
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["admin", "campaigns", status],
    queryFn: async () => {
      let query = supabase.from("campaigns").select("id, title, status, budget_min, budget_max, created_at, advertiser_id").order("created_at", { ascending: false }).limit(200);
      if (status !== "all") query = query.eq("status", status as any);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  const setCampaignStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: any }) => {
      const { error } = await supabase.from("campaigns").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Updated"); qc.invalidateQueries({ queryKey: ["admin", "campaigns"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
        <div className="text-xs text-muted-foreground ml-auto">{q.data?.length ?? 0} campaigns</div>
      </div>

      <div className="surface-card divide-y divide-border">
        {(q.data ?? []).map((c: any) => (
          <div key={c.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{c.title}</div>
              <div className="text-xs text-muted-foreground">
                ${Number(c.budget_min ?? 0).toLocaleString()} — ${Number(c.budget_max ?? 0).toLocaleString()} · {new Date(c.created_at).toLocaleDateString()}
              </div>
            </div>
            <Badge variant="secondary" className="capitalize">{c.status}</Badge>
            <div className="flex gap-2">
              {c.status !== "closed" && (
                <Button size="sm" variant="outline" onClick={() => setCampaignStatus.mutate({ id: c.id, status: "closed" })}>Close</Button>
              )}
              {c.status !== "archived" && (
                <Button size="sm" variant="outline" onClick={() => setCampaignStatus.mutate({ id: c.id, status: "archived" })}>Archive</Button>
              )}
            </div>
          </div>
        ))}
        {!q.isLoading && (q.data ?? []).length === 0 && (
          <div className="p-12 text-center text-sm text-muted-foreground">No campaigns.</div>
        )}
      </div>
    </div>
  );
}

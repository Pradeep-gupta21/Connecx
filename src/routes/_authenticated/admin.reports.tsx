import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Flag, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/EmptyState";

export const Route = createFileRoute("/_authenticated/admin/reports")({
  component: AdminReports,
});

function AdminReports() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin", "reports"],
    queryFn: async () => {
      const { data, error } = await supabase.from("reports").select("*").order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const resolve = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "resolved" | "dismissed" }) => {
      const { error } = await supabase.from("reports").update({ status, resolved_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Report updated"); qc.invalidateQueries({ queryKey: ["admin", "reports"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const rows = q.data ?? [];
  return (
    <div className="space-y-3">
      {rows.map((r: any) => (
        <div key={r.id} className="surface-card p-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
            <Flag className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium">{r.reason}</div>
            <div className="text-xs text-muted-foreground">
              {r.target_type} · {r.target_id.slice(0, 12)} · {new Date(r.created_at).toLocaleString()}
            </div>
            {r.details && <div className="text-sm mt-1 text-muted-foreground">{r.details}</div>}
          </div>
          <Badge variant="secondary" className="capitalize">{r.status}</Badge>
          {r.status === "open" && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => resolve.mutate({ id: r.id, status: "dismissed" })}>Dismiss</Button>
              <Button size="sm" onClick={() => resolve.mutate({ id: r.id, status: "resolved" })}>Resolve</Button>
            </div>
          )}
        </div>
      ))}
      {!q.isLoading && rows.length === 0 && (
        <EmptyState icon={ShieldCheck} title="No reports" description="The community is behaving. Enjoy the calm." />
      )}
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LifeBuoy, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { EmptyState } from "@/components/common/EmptyState";

export const Route = createFileRoute("/_authenticated/admin/tickets")({
  component: AdminTickets,
});

function AdminTickets() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin", "tickets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*, profiles!support_tickets_user_id_fkey(display_name, avatar_url)")
        .order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: any }) => {
      const { error } = await supabase.from("support_tickets").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Updated"); qc.invalidateQueries({ queryKey: ["admin", "tickets"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const rows = q.data ?? [];
  return (
    <div className="space-y-3">
      {rows.map((t: any) => (
        <div key={t.id} className="surface-card p-5">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-secondary flex items-center justify-center shrink-0">
              <LifeBuoy className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="font-medium truncate">{t.subject}</div>
                <Badge variant={t.priority === "urgent" ? "destructive" : "secondary"} className="capitalize">{t.priority}</Badge>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">{t.profiles?.display_name ?? "Unknown"} · {new Date(t.created_at).toLocaleString()}</div>
              <p className="text-sm mt-2 whitespace-pre-wrap">{t.body}</p>
            </div>
            <div className="shrink-0">
              <Select value={t.status} onValueChange={(v) => setStatus.mutate({ id: t.id, status: v })}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In progress</SelectItem>
                  <SelectItem value="waiting">Waiting</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      ))}
      {!q.isLoading && rows.length === 0 && (
        <EmptyState icon={Sparkles} title="No open tickets" description="Nothing needs your attention right now." />
      )}
    </div>
  );
}

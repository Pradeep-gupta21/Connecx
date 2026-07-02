import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ScrollText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState } from "@/components/common/EmptyState";

export const Route = createFileRoute("/_authenticated/admin/audit")({
  component: AdminAudit,
});

function AdminAudit() {
  const q = useQuery({
    queryKey: ["admin", "audit"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_logs")
        .select("id, action, entity_type, entity_id, user_id, metadata, created_at")
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = q.data ?? [];
  if (!q.isLoading && rows.length === 0)
    return <EmptyState icon={ScrollText} title="Audit log is empty" description="Admin actions and platform events will appear here." />;

  return (
    <div className="surface-card overflow-hidden">
      <div className="max-h-[70vh] overflow-y-auto divide-y divide-border">
        {rows.map((r: any) => (
          <div key={r.id} className="p-4 flex items-start gap-4 text-sm hover:bg-secondary/40 transition-colors">
            <code className="text-[10px] text-muted-foreground font-mono w-32 shrink-0">{new Date(r.created_at).toLocaleString()}</code>
            <div className="flex-1 min-w-0">
              <div className="font-medium font-mono text-xs">{r.action}</div>
              <div className="text-xs text-muted-foreground">{r.entity_type ?? "—"} · {r.entity_id?.slice(0, 12) ?? "—"}</div>
              {r.metadata && Object.keys(r.metadata).length > 0 && (
                <pre className="mt-1 text-[11px] text-muted-foreground bg-secondary/40 rounded p-2 overflow-x-auto">{JSON.stringify(r.metadata, null, 2)}</pre>
              )}
            </div>
            <code className="text-[10px] text-muted-foreground font-mono">{r.user_id?.slice(0, 8) ?? "system"}</code>
          </div>
        ))}
      </div>
    </div>
  );
}

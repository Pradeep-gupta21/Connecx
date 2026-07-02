import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StatCard } from "@/components/common/StatCard";
import { Badge } from "@/components/ui/badge";
import { CreditCard, TrendingUp, Clock, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/payments")({
  component: AdminPayments,
});

function AdminPayments() {
  const q = useQuery({
    queryKey: ["admin", "payments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("payments").select("id, amount, currency, status, type, created_at, processed_at, contract_id, payer_id, payee_id").order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = q.data ?? [];
  const total = rows.filter((p) => p.status === "succeeded").reduce((s, p) => s + Number(p.amount || 0), 0);
  const pending = rows.filter((p) => p.status === "pending").reduce((s, p) => s + Number(p.amount || 0), 0);
  const failed = rows.filter((p) => p.status === "failed").length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Succeeded" value={total} icon={TrendingUp} format={(v) => `$${Math.round(v).toLocaleString()}`} />
        <StatCard label="Pending" value={pending} icon={Clock} format={(v) => `$${Math.round(v).toLocaleString()}`} />
        <StatCard label="Failed" value={failed} icon={AlertTriangle} />
        <StatCard label="Transactions" value={rows.length} icon={CreditCard} />
      </div>

      <div className="surface-card divide-y divide-border">
        {rows.map((p) => (
          <div key={p.id} className="p-4 flex items-center gap-3 text-sm">
            <div className="flex-1 min-w-0">
              <div className="font-medium">${Number(p.amount).toLocaleString()} {p.currency}</div>
              <div className="text-xs text-muted-foreground">{p.type} · {new Date(p.created_at).toLocaleString()}</div>
            </div>
            <Badge variant={p.status === "succeeded" ? "default" : p.status === "failed" ? "destructive" : "secondary"} className="capitalize">{p.status}</Badge>
          </div>
        ))}
        {!q.isLoading && rows.length === 0 && (
          <div className="p-12 text-center text-sm text-muted-foreground">No payments yet.</div>
        )}
      </div>
    </div>
  );
}

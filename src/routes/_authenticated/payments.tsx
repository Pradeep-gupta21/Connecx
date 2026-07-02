import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CreditCard, DollarSign, Clock, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { EmptyState } from "@/components/common/EmptyState";
import { ListSkeleton } from "@/components/common/Skeletons";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/payments")({
  head: () => ({ meta: [{ title: "Payments · BrandBridge" }] }),
  component: PaymentsPage,
});

const STATUS: Record<string, string> = {
  pending: "bg-warning/10 text-warning",
  processing: "bg-accent/10 text-accent",
  succeeded: "bg-success/10 text-success",
  failed: "bg-destructive/10 text-destructive",
  refunded: "bg-muted text-muted-foreground",
  cancelled: "bg-muted text-muted-foreground",
};

function PaymentsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["payments-page", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select("id, amount, currency, status, type, provider, created_at, processed_at, contracts(title, campaigns(title))")
        .eq("payee_id", user!.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel(`payments-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "payments", filter: `payee_id=eq.${user.id}` }, () => {
        qc.invalidateQueries({ queryKey: ["payments-page", user.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc]);

  const pays = q.data ?? [];
  const earned = pays.filter((p) => p.status === "succeeded").reduce((s, p) => s + Number(p.amount), 0);
  const pending = pays.filter((p) => p.status === "pending" || p.status === "processing").reduce((s, p) => s + Number(p.amount), 0);
  const count = pays.filter((p) => p.status === "succeeded").length;

  return (
    <div className="space-y-8">
      <PageHeader title="Payments" description="Track earnings and pending payouts in realtime." />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total earned" value={`$${earned.toLocaleString()}`} icon={DollarSign} />
        <StatCard label="Pending" value={`$${pending.toLocaleString()}`} icon={Clock} />
        <StatCard label="Successful payouts" value={count} icon={CheckCircle2} />
      </div>

      {q.isLoading ? (
        <ListSkeleton rows={6} />
      ) : pays.length === 0 ? (
        <EmptyState icon={CreditCard} title="No payments yet" description="Once brands release funds, they'll appear here." />
      ) : (
        <div className="surface-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="text-left px-5 py-3 font-medium">Date</th>
                <th className="text-left px-5 py-3 font-medium">Description</th>
                <th className="text-left px-5 py-3 font-medium">Type</th>
                <th className="text-left px-5 py-3 font-medium">Status</th>
                <th className="text-right px-5 py-3 font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pays.map((p: any) => (
                <tr key={p.id} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-5 py-3 text-muted-foreground">{format(new Date(p.created_at), "MMM d, yyyy")}</td>
                  <td className="px-5 py-3">
                    <div className="font-medium truncate max-w-[280px]">{p.contracts?.campaigns?.title ?? p.contracts?.title ?? "Payment"}</div>
                    {p.provider && <div className="text-[11px] text-muted-foreground">via {p.provider}</div>}
                  </td>
                  <td className="px-5 py-3 capitalize text-muted-foreground">{p.type}</td>
                  <td className="px-5 py-3">
                    <Badge className={`capitalize ${STATUS[p.status] ?? ""}`} variant="secondary">{p.status}</Badge>
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums font-medium">
                    ${Number(p.amount).toLocaleString()} <span className="text-[11px] text-muted-foreground">{p.currency}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

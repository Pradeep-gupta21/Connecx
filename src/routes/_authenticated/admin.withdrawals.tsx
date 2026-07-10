import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Loader2, Check, X, Send } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { ListSkeleton } from "@/components/common/Skeletons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAdminReviewWithdrawal, useAdminMarkWithdrawalCompleted } from "@/hooks/usePayments";

export const Route = createFileRoute("/_authenticated/admin/withdrawals")({
  head: () => ({ meta: [{ title: "Withdrawals · Admin" }] }),
  component: AdminWithdrawals,
});

const BADGE: Record<string, string> = {
  requested: "bg-warning/10 text-warning border-warning/20",
  approved: "bg-accent/10 text-accent border-accent/20",
  processing: "bg-accent/10 text-accent border-accent/20",
  completed: "bg-success/10 text-success border-success/20",
  rejected: "bg-destructive/10 text-destructive border-destructive/20",
  failed: "bg-destructive/10 text-destructive border-destructive/20",
  cancelled: "bg-muted text-muted-foreground border-border",
};

function inr(n: number) {
  return `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function AdminWithdrawals() {
  const qc = useQueryClient();
  const [status, setStatus] = useState("requested");

  const q = useQuery({
    queryKey: ["admin-withdrawals", status],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("withdrawals")
        .select("id, amount, currency, method, destination, status, admin_notes, created_at, approved_at, payout_id, payout_ref, user_id, profiles(display_name, avatar_url)")
        .eq("status", status as any)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    const ch = supabase.channel("admin-withdrawals-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "withdrawals" }, () => {
        qc.invalidateQueries({ queryKey: ["admin-withdrawals"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Withdrawals"
        description="Approve creator withdrawal requests and trigger payouts."
      />

      <Tabs value={status} onValueChange={setStatus}>
        <TabsList>
          <TabsTrigger value="requested">Pending</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="processing">Processing</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
        </TabsList>

        <TabsContent value={status} className="mt-6">
          {q.isLoading ? (
            <ListSkeleton rows={4} />
          ) : (q.data ?? []).length === 0 ? (
            <EmptyState title="Nothing to review" description={`No withdrawals with status "${status}".`} />
          ) : (
            <div className="space-y-3">
              {(q.data ?? []).map((wd: any) => (
                <WithdrawalCard key={wd.id} wd={wd} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function WithdrawalCard({ wd }: { wd: any }) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [ref, setRef] = useState("");
  const review = useAdminReviewWithdrawal();
  const complete = useAdminMarkWithdrawalCompleted();

  const dest = wd.destination as Record<string, any> | null;
  const destSummary = dest?.vpa
    ? `UPI · ${dest.vpa}`
    : dest?.account_number_last4
      ? `${dest.account_holder_name ?? ""} · ${dest.bank_name ?? ""} · •••• ${dest.account_number_last4} · ${dest.ifsc ?? ""}${dest.account_type ? ` · ${dest.account_type}` : ""}`
      : dest?.account_number
        ? `${dest.account_holder_name ?? ""} · •••• ${String(dest.account_number).slice(-4)} · ${dest.ifsc ?? ""}`
        : "—";

  return (
    <div className="surface-card p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-lg font-semibold">{inr(Number(wd.amount))}</span>
            <Badge variant="secondary" className={`capitalize ${BADGE[wd.status] ?? ""}`}>{wd.status}</Badge>
            <span className="text-xs text-muted-foreground">via {wd.method.replace("_", " ")}</span>
          </div>
          <p className="mt-1 text-sm">
            <span className="text-muted-foreground">By </span>
            <span className="font-medium">{wd.profiles?.display_name ?? "Unknown"}</span>
          </p>
          <p className="text-xs text-muted-foreground mt-1 font-mono">{destSummary}</p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Requested {format(new Date(wd.created_at), "MMM d, h:mm a")}
            {wd.approved_at && ` · Approved ${format(new Date(wd.approved_at), "MMM d")}`}
          </p>
          {wd.admin_notes && <p className="text-xs mt-2 italic text-muted-foreground">"{wd.admin_notes}"</p>}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {wd.status === "requested" && (
            <>
              <Button
                size="sm"
                className="gap-1.5"
                disabled={review.isPending}
                onClick={async () => {
                  try {
                    await review.mutateAsync({ withdrawalId: wd.id, action: "approve", triggerPayout: true });
                    toast.success("Approved — payout initiated");
                  } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
                }}
              >
                {review.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Approve & payout
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setRejectOpen(true)}>
                <X className="h-3.5 w-3.5" /> Reject
              </Button>
            </>
          )}
          {["approved", "processing"].includes(wd.status) && (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setCompleteOpen(true)}>
              <Send className="h-3.5 w-3.5" /> Mark completed
            </Button>
          )}
        </div>
      </div>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject withdrawal</DialogTitle>
            <DialogDescription>Funds will be returned to the creator's wallet.</DialogDescription>
          </DialogHeader>
          <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (visible to the creator)" />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={async () => {
                await review.mutateAsync({ withdrawalId: wd.id, action: "reject", notes: reason });
                toast.success("Withdrawal rejected");
                setRejectOpen(false); setReason("");
              }}
            >Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as completed</DialogTitle>
            <DialogDescription>Enter the payout reference (UTR / txn id) so it appears on the creator's ledger.</DialogDescription>
          </DialogHeader>
          <Input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Payout reference" />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCompleteOpen(false)}>Cancel</Button>
            <Button
              onClick={async () => {
                await complete.mutateAsync({ withdrawalId: wd.id, payoutRef: ref || undefined });
                setCompleteOpen(false); setRef("");
              }}
            >Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { Wallet, DollarSign, Clock, CheckCircle2, ArrowUpRight, Loader2, Building2, Landmark } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { EmptyState } from "@/components/common/EmptyState";
import { ListSkeleton } from "@/components/common/Skeletons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useWallet, useWalletHistory, usePaymentHistory, useWithdrawal } from "@/hooks/useWallet";

export const Route = createFileRoute("/_authenticated/payments")({
  head: () => ({ meta: [{ title: "Payments · BrandBridge" }] }),
  component: PaymentsPage,
});

const STATUS: Record<string, string> = {
  pending: "bg-warning/10 text-warning border-warning/20",
  processing: "bg-accent/10 text-accent border-accent/20",
  held: "bg-accent/10 text-accent border-accent/20",
  released: "bg-success/10 text-success border-success/20",
  succeeded: "bg-success/10 text-success border-success/20",
  withdrawn: "bg-muted text-muted-foreground border-border",
  refunded: "bg-muted text-muted-foreground border-border",
  refund_pending: "bg-warning/10 text-warning border-warning/20",
  failed: "bg-destructive/10 text-destructive border-destructive/20",
  cancelled: "bg-muted text-muted-foreground border-border",
  revision_requested: "bg-destructive/10 text-destructive border-destructive/20",
};

const WD_STATUS: Record<string, string> = {
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

function PaymentsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const wallet = useWallet();
  const walletHistory = useWalletHistory();
  const paymentHistory = usePaymentHistory();

  const withdrawals = useQuery({
    queryKey: ["withdrawals", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("withdrawals")
        .select("id, amount, currency, method, status, admin_notes, requested_at:created_at, approved_at, completed_at, payout_ref")
        .eq("user_id", user!.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel(`payments-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, () => {
        qc.invalidateQueries({ queryKey: ["payment-history"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "wallets", filter: `user_id=eq.${user.id}` }, () => {
        qc.invalidateQueries({ queryKey: ["wallet"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "wallet_transactions", filter: `user_id=eq.${user.id}` }, () => {
        qc.invalidateQueries({ queryKey: ["wallet-history"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "withdrawals", filter: `user_id=eq.${user.id}` }, () => {
        qc.invalidateQueries({ queryKey: ["withdrawals", user.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc]);

  const w = wallet.data;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Payments & Wallet"
        description="Escrowed funds, wallet balance, transactions and withdrawals — updated live."
        actions={w ? <WithdrawDialog available={w.available_balance} /> : null}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Available" value={w ? inr(w.available_balance) : "—"} icon={Wallet} />
        <StatCard label="Held (escrow)" value={w ? inr(w.held_balance) : "—"} icon={Clock} />
        <StatCard label="Withdrawn" value={w ? inr(w.withdrawn_balance) : "—"} icon={ArrowUpRight} />
        <StatCard label="Lifetime earned" value={w ? inr(w.lifetime_earned) : "—"} icon={CheckCircle2} />
      </div>

      <Tabs defaultValue="transactions">
        <TabsList>
          <TabsTrigger value="transactions">Payments</TabsTrigger>
          <TabsTrigger value="wallet">Wallet ledger</TabsTrigger>
          <TabsTrigger value="withdrawals">Withdrawals</TabsTrigger>
        </TabsList>

        <TabsContent value="transactions" className="mt-6">
          {paymentHistory.isLoading ? (
            <ListSkeleton rows={6} />
          ) : (paymentHistory.data ?? []).length === 0 ? (
            <EmptyState icon={DollarSign} title="No payments yet" description="Payments appear here after a campaign is funded or released." />
          ) : (
            <div className="surface-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-secondary/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="text-left px-5 py-3 font-medium">Date</th>
                    <th className="text-left px-5 py-3 font-medium">Receipt</th>
                    <th className="text-left px-5 py-3 font-medium">Type</th>
                    <th className="text-left px-5 py-3 font-medium">Status</th>
                    <th className="text-right px-5 py-3 font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(paymentHistory.data ?? []).map((p) => (
                    <motion.tr key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="hover:bg-secondary/30">
                      <td className="px-5 py-3 text-muted-foreground">{format(new Date(p.created_at), "MMM d, yyyy")}</td>
                      <td className="px-5 py-3 font-mono text-xs">{p.receipt_number ?? p.id.slice(0, 8)}</td>
                      <td className="px-5 py-3 capitalize text-muted-foreground">{p.type?.replace(/_/g, " ")}</td>
                      <td className="px-5 py-3">
                        <Badge className={`capitalize ${STATUS[p.status_v2 ?? ""] ?? ""}`} variant="secondary">
                          {(p.status_v2 ?? "").replace(/_/g, " ")}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums font-medium">{inr(Number(p.amount))}</td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="wallet" className="mt-6">
          {walletHistory.isLoading ? (
            <ListSkeleton rows={6} />
          ) : (walletHistory.data ?? []).length === 0 ? (
            <EmptyState icon={Wallet} title="No wallet activity" description="Wallet transactions log every hold, release and withdrawal." />
          ) : (
            <div className="surface-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-secondary/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="text-left px-5 py-3 font-medium">Date</th>
                    <th className="text-left px-5 py-3 font-medium">Type</th>
                    <th className="text-left px-5 py-3 font-medium">Description</th>
                    <th className="text-right px-5 py-3 font-medium">Amount</th>
                    <th className="text-right px-5 py-3 font-medium">Balance after</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(walletHistory.data ?? []).map((t) => (
                    <tr key={t.id}>
                      <td className="px-5 py-3 text-muted-foreground">{format(new Date(t.created_at), "MMM d, h:mm a")}</td>
                      <td className="px-5 py-3 capitalize">{t.type}</td>
                      <td className="px-5 py-3 text-muted-foreground">{t.description ?? "—"}</td>
                      <td className="px-5 py-3 text-right tabular-nums font-mono">{inr(Number(t.amount))}</td>
                      <td className="px-5 py-3 text-right tabular-nums font-mono">{inr(Number(t.balance_after))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="withdrawals" className="mt-6">
          {withdrawals.isLoading ? (
            <ListSkeleton rows={4} />
          ) : (withdrawals.data ?? []).length === 0 ? (
            <EmptyState
              icon={ArrowUpRight}
              title="No withdrawals yet"
              description="Once you have available balance you can request a withdrawal."
            />

          ) : (
            <div className="space-y-2">
              {(withdrawals.data ?? []).map((wd: any) => (
                <div key={wd.id} className="surface-card p-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm">{inr(Number(wd.amount))}</span>
                      <Badge variant="secondary" className={`capitalize ${WD_STATUS[wd.status] ?? ""}`}>{wd.status}</Badge>
                      <span className="text-xs text-muted-foreground">via {wd.method.replace("_", " ")}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Requested {format(new Date(wd.requested_at), "MMM d, yyyy")}
                      {wd.completed_at && ` · Completed ${format(new Date(wd.completed_at), "MMM d")}`}
                    </p>
                    {wd.admin_notes && <p className="text-xs mt-1 text-muted-foreground italic">"{wd.admin_notes}"</p>}
                  </div>
                  {wd.payout_ref && <span className="text-[11px] font-mono text-muted-foreground">Ref {wd.payout_ref}</span>}
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function WithdrawDialog({ available }: { available: number }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState<string>("");
  const [method, setMethod] = useState<"bank_transfer" | "upi">("bank_transfer");
  const [name, setName] = useState("");
  const [account, setAccount] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [upi, setUpi] = useState("");
  const wd = useWithdrawal();

  const amt = Number(amount);
  const canSubmit = amt > 0 && amt <= available && (
    method === "upi" ? upi.includes("@") : (name && account.length >= 6 && ifsc.length >= 6)
  );

  const submit = async () => {
    try {
      const destination = method === "upi"
        ? { vpa: upi }
        : { account_holder_name: name, account_number: account, ifsc };
      await wd.mutateAsync({ amount: amt, method, destination });
      setOpen(false);
      setAmount(""); setName(""); setAccount(""); setIfsc(""); setUpi("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2" disabled={available <= 0}>
          <ArrowUpRight className="h-4 w-4" /> Withdraw
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Withdraw funds</DialogTitle>
          <DialogDescription>Available: <span className="font-mono">{inr(available)}</span></DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <label className="text-xs uppercase tracking-wide text-muted-foreground">Amount (INR)</label>
          <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="1000" min={1} max={available} />

          <div className="grid grid-cols-2 gap-2 mt-2">
            <button
              type="button"
              onClick={() => setMethod("bank_transfer")}
              className={`surface-card p-3 text-left transition ${method === "bank_transfer" ? "ring-2 ring-accent" : "opacity-70 hover:opacity-100"}`}
            >
              <Landmark className="h-4 w-4 mb-1" />
              <div className="text-sm font-medium">Bank transfer</div>
              <div className="text-[11px] text-muted-foreground">IMPS / NEFT</div>
            </button>
            <button
              type="button"
              onClick={() => setMethod("upi")}
              className={`surface-card p-3 text-left transition ${method === "upi" ? "ring-2 ring-accent" : "opacity-70 hover:opacity-100"}`}
            >
              <Building2 className="h-4 w-4 mb-1" />
              <div className="text-sm font-medium">UPI</div>
              <div className="text-[11px] text-muted-foreground">Instant</div>
            </button>
          </div>

          {method === "bank_transfer" ? (
            <div className="grid gap-2 mt-2">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Account holder name" />
              <Input value={account} onChange={(e) => setAccount(e.target.value)} placeholder="Account number" />
              <Input value={ifsc} onChange={(e) => setIfsc(e.target.value.toUpperCase())} placeholder="IFSC code" />
            </div>
          ) : (
            <Input className="mt-2" value={upi} onChange={(e) => setUpi(e.target.value)} placeholder="name@upi" />
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!canSubmit || wd.isPending}>
            {wd.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Request withdrawal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

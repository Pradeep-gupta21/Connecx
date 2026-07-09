// Role-aware payments hub. Advertisers see spend + escrow + refunds; creators
// see wallet + withdrawals. Both share the same reusable primitives.
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Link } from "@tanstack/react-router";
import {
  ArrowUpRight,
  DollarSign,
  Landmark,
  MegaphoneOff,
  Receipt,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { supabase } from "@/integrations/supabase/client";
import {
  useWallet,
  useWalletHistory,
  usePaymentHistory,
} from "@/hooks/useWallet";
import { WalletHero, WalletHeroSkeleton, SpendHero } from "@/components/payments/WalletHero";
import { LedgerTable } from "@/components/payments/PaymentsTable";
import { Money, formatMoney } from "@/components/payments/Money";
import { PaymentStatusBadge } from "@/components/payments/PaymentStatusBadge";
import { PaymentFilters, withinRange, type RangeKey } from "@/components/payments/PaymentFilters";
import { PaymentDetailSheet } from "@/components/payments/PaymentDetailSheet";
import { RefundRequestDialog } from "@/components/payments/RefundRequestDialog";

export const Route = createFileRoute("/_authenticated/payments")({
  head: () => ({ meta: [{ title: "Payments · Connecx" }] }),
  component: PaymentsHub,
});

function PaymentsHub() {
  const { activeRole } = useWorkspace();
  const isAdvertiser = activeRole === "advertiser";
  return isAdvertiser ? <AdvertiserPayments /> : <CreatorPayments />;
}

// ---- Shared realtime subscription hook ----
function usePaymentsRealtime(userId?: string) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`payments-live-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, () => {
        qc.invalidateQueries({ queryKey: ["payment-history"] });
        qc.invalidateQueries({ queryKey: ["advertiser-refunds"] });
      })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wallets", filter: `user_id=eq.${userId}` },
        () => qc.invalidateQueries({ queryKey: ["wallet"] }),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "wallet_transactions",
          filter: `user_id=eq.${userId}`,
        },
        () => qc.invalidateQueries({ queryKey: ["wallet-history"] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "withdrawals", filter: `user_id=eq.${userId}` },
        () => qc.invalidateQueries({ queryKey: ["withdrawals", userId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [userId, qc]);
}

// ---- Creator ----
function CreatorPayments() {
  const { user } = useAuth();
  usePaymentsRealtime(user?.id);

  const wallet = useWallet();
  const walletHistory = useWalletHistory();
  const paymentHistory = usePaymentHistory();

  const withdrawals = useQuery({
    queryKey: ["withdrawals", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("withdrawals")
        .select(
          "id, amount, currency, method, status, admin_notes, created_at, approved_at, completed_at, payout_ref",
        )
        .eq("user_id", user!.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [range, setRange] = useState<RangeKey>("30d");
  const [openPayment, setOpenPayment] = useState<any | null>(null);

  const filteredPayments = useMemo(() => {
    const rows = paymentHistory.data ?? [];
    return rows.filter((r: any) => {
      if (!withinRange(r.created_at, range)) return false;
      if (status !== "all" && r.status_v2 !== status) return false;
      if (search) {
        const q = search.toLowerCase();
        return [r.receipt_number, r.invoice_number, r.id]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q));
      }
      return true;
    });
  }, [paymentHistory.data, search, status, range]);

  const filteredWallet = useMemo(() => {
    return (walletHistory.data ?? []).filter((t: any) => withinRange(t.created_at, range));
  }, [walletHistory.data, range]);

  const w = wallet.data;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Wallet & payments"
        description="Escrowed funds, transactions, invoices and withdrawal history — updated in real time."
      />

      {wallet.isLoading ? <WalletHeroSkeleton /> : <WalletHero wallet={w} />}

      <Tabs defaultValue="transactions">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <TabsList className="flex-wrap h-auto gap-1.5 sm:gap-2">
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
            <TabsTrigger value="wallet">Wallet ledger</TabsTrigger>
            <TabsTrigger value="withdrawals">Withdrawals</TabsTrigger>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="transactions" className="mt-6 space-y-4">
          <PaymentFilters
            search={search}
            onSearchChange={setSearch}
            status={status}
            onStatusChange={setStatus}
            statusOptions={[
              { value: "held", label: "Protected" },
              { value: "released", label: "Released" },
              { value: "withdrawn", label: "Withdrawn" },
              { value: "pending", label: "Pending" },
              { value: "failed", label: "Failed" },
            ]}
            range={range}
            onRangeChange={setRange}
          />
          <LedgerTable
            rows={filteredPayments}
            isLoading={paymentHistory.isLoading}
            columns={["date", "reference", "type", "status", "amount"]}
            statusKey="status_v2"
            onRowClick={setOpenPayment}
            emptyTitle="No transactions yet"
            emptyDescription="Your first campaign release will show up here."
          />
        </TabsContent>

        <TabsContent value="wallet" className="mt-6 space-y-4">
          <PaymentFilters
            search={search}
            onSearchChange={setSearch}
            range={range}
            onRangeChange={setRange}
            placeholder="Search descriptions…"
          />
          <LedgerTable
            rows={filteredWallet.filter((t: any) => {
              if (!search) return true;
              const q = search.toLowerCase();
              return (t.description ?? "").toLowerCase().includes(q);
            })}
            isLoading={walletHistory.isLoading}
            columns={["date", "type", "status", "amount", "balance"]}
            statusKey="type"
            statusKind="payment"
            amountSign={(t) =>
              ["credit", "release", "adjustment"].includes(t.type) ? "credit" : "debit"
            }
            renderType={(t) => t.description ?? (t.type ?? "").replace(/_/g, " ")}
            emptyTitle="No wallet activity"
            emptyDescription="Every hold, release, and payout will be logged here."
          />
        </TabsContent>

        <TabsContent value="withdrawals" className="mt-6">
          {withdrawals.isLoading ? (
            <LedgerTable rows={undefined} isLoading columns={["date", "reference", "status", "amount"]} />
          ) : (withdrawals.data ?? []).length === 0 ? (
            <EmptyState
              icon={ArrowUpRight}
              title="No withdrawals yet"
              description="Once you have available balance, request a payout to your bank or UPI."
            />
          ) : (
            <div className="space-y-2">
              {(withdrawals.data ?? []).map((wd: any) => (
                <div
                  key={wd.id}
                  className="surface-card p-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex items-start gap-3">
                    <div className="mt-0.5 grid h-9 w-9 place-items-center rounded-full bg-secondary text-muted-foreground">
                      <Landmark className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-base tabular-nums">
                          <Money value={wd.amount} currency={wd.currency ?? "INR"} />
                        </span>
                        <PaymentStatusBadge kind="withdrawal" status={wd.status} />
                        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                          {wd.method.replace("_", " ")}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Requested {format(new Date(wd.created_at), "MMM d, yyyy")}
                        {wd.completed_at && ` · Paid ${format(new Date(wd.completed_at), "MMM d")}`}
                      </p>
                      {wd.admin_notes && (
                        <p className="mt-1 text-xs italic text-muted-foreground">
                          "{wd.admin_notes}"
                        </p>
                      )}
                    </div>
                  </div>
                  {wd.payout_ref && (
                    <span className="text-[11px] font-mono text-muted-foreground">
                      Ref {wd.payout_ref}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="invoices" className="mt-6">
          <InvoiceList
            rows={(paymentHistory.data ?? []).filter(
              (p: any) => p.invoice_number || p.receipt_number,
            )}
            perspective="creator"
          />
        </TabsContent>
      </Tabs>

      <PaymentDetailSheet
        open={!!openPayment}
        onOpenChange={(v) => !v && setOpenPayment(null)}
        payment={openPayment}
      />
    </div>
  );
}

// ---- Advertiser ----
function AdvertiserPayments() {
  const { user } = useAuth();
  usePaymentsRealtime(user?.id);

  const paymentHistory = usePaymentHistory(200);

  const refunds = useQuery({
    queryKey: ["advertiser-refunds", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("refunds")
        .select("id, amount, currency, status, reason, created_at, processed_at, payment_id")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [range, setRange] = useState<RangeKey>("30d");
  const [openPayment, setOpenPayment] = useState<any | null>(null);
  const [refundTarget, setRefundTarget] = useState<any | null>(null);

  const outgoing = useMemo(
    () =>
      (paymentHistory.data ?? []).filter(
        (p: any) => p.payer_id === user?.id && p.type === "campaign_payment",
      ),
    [paymentHistory.data, user?.id],
  );

  const totalSpent = outgoing.reduce(
    (s: number, p: any) => (["paid", "held", "released", "withdrawn"].includes(p.status_v2) ? s + Number(p.amount) : s),
    0,
  );
  const heldAmount = outgoing.reduce(
    (s: number, p: any) => (p.status_v2 === "held" ? s + Number(p.amount) : s),
    0,
  );
  const refundedAmount = (refunds.data ?? []).reduce(
    (s: number, r: any) => (r.status === "completed" ? s + Number(r.amount) : s),
    0,
  );
  const activeCampaigns = new Set(
    outgoing.filter((p: any) => p.status_v2 === "held").map((p: any) => p.campaign_id),
  ).size;

  const filtered = useMemo(() => {
    return outgoing.filter((r: any) => {
      if (!withinRange(r.created_at, range)) return false;
      if (status !== "all" && r.status_v2 !== status) return false;
      if (search) {
        const q = search.toLowerCase();
        return [r.receipt_number, r.invoice_number, r.id]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q));
      }
      return true;
    });
  }, [outgoing, search, status, range]);

  const held = outgoing.filter((p: any) => p.status_v2 === "held" || p.status_v2 === "revision_requested");

  return (
    <div className="space-y-8">
      <PageHeader
        title="Payments"
        description="Fund campaigns, track escrow, and manage invoices and refunds."
        actions={
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link to="/campaigns/new">
              <Sparkles className="h-4 w-4" /> New campaign
            </Link>
          </Button>
        }
      />

      <SpendHero
        totalSpent={totalSpent}
        protectedAmount={heldAmount}
        activeCount={activeCampaigns}
        refunded={refundedAmount}
      />

      <Tabs defaultValue="history">
        <TabsList className="flex-wrap h-auto gap-1.5 sm:gap-2">
          <TabsTrigger value="history">Payment history</TabsTrigger>
          <TabsTrigger value="escrow">Protected ({held.length})</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="refunds">Refunds</TabsTrigger>
        </TabsList>

        <TabsContent value="history" className="mt-6 space-y-4">
          <PaymentFilters
            search={search}
            onSearchChange={setSearch}
            status={status}
            onStatusChange={setStatus}
            statusOptions={[
              { value: "paid", label: "Paid" },
              { value: "held", label: "Protected" },
              { value: "released", label: "Released" },
              { value: "refunded", label: "Refunded" },
              { value: "failed", label: "Failed" },
            ]}
            range={range}
            onRangeChange={setRange}
          />
          <LedgerTable
            rows={filtered}
            isLoading={paymentHistory.isLoading}
            columns={["date", "reference", "type", "status", "amount"]}
            statusKey="status_v2"
            onRowClick={setOpenPayment}
            emptyTitle="No payments yet"
            emptyDescription="Fund a campaign to hold the budget in escrow until deliverables are approved."
          />
        </TabsContent>

        <TabsContent value="escrow" className="mt-6 space-y-3">
          {held.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="No escrowed campaigns"
              description="When you fund a campaign, the budget is protected here until deliverables are approved."
            />
          ) : (
            held.map((p: any) => (
              <div
                key={p.id}
                className="surface-card p-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0 flex items-start gap-3">
                  <div className="mt-0.5 grid h-10 w-10 place-items-center rounded-full bg-accent/10 text-accent">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">
                        <Money value={p.amount} currency={p.currency ?? "INR"} />
                      </span>
                      <PaymentStatusBadge status={p.status_v2} />
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Held since {format(new Date(p.created_at), "MMM d, yyyy")} ·{" "}
                      <Link
                        to="/campaigns/$id"
                        params={{ id: p.campaign_id }}
                        className="hover:text-foreground story-link"
                      >
                        View campaign
                      </Link>
                    </p>
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Button variant="ghost" size="sm" onClick={() => setOpenPayment(p)}>
                    <Receipt className="h-3.5 w-3.5" /> Details
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setRefundTarget(p)}
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Request refund
                  </Button>
                </div>
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="invoices" className="mt-6">
          <InvoiceList
            rows={outgoing.filter((p: any) => p.invoice_number || p.receipt_number)}
            perspective="advertiser"
          />
        </TabsContent>

        <TabsContent value="refunds" className="mt-6">
          {refunds.isLoading ? (
            <LedgerTable rows={undefined} isLoading columns={["date", "reference", "status", "amount"]} />
          ) : (refunds.data ?? []).length === 0 ? (
            <EmptyState
              icon={MegaphoneOff}
              title="No refunds requested"
              description="Refunds are available on escrowed campaigns before creators are paid out."
            />
          ) : (
            <div className="space-y-2">
              {(refunds.data ?? []).map((r: any) => (
                <div
                  key={r.id}
                  className="surface-card p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Money value={r.amount} currency={r.currency ?? "INR"} />
                      <PaymentStatusBadge kind="refund" status={r.status} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Requested {format(new Date(r.created_at), "MMM d, yyyy")}
                      {r.reason && ` · "${r.reason}"`}
                    </p>
                  </div>
                  <Badge variant="secondary" className="font-mono text-[11px]">
                    {r.payment_id?.slice(0, 8)}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <PaymentDetailSheet
        open={!!openPayment}
        onOpenChange={(v) => !v && setOpenPayment(null)}
        payment={openPayment}
      />
      {refundTarget && (
        <RefundRequestDialog
          open={!!refundTarget}
          onOpenChange={(v) => !v && setRefundTarget(null)}
          paymentId={refundTarget.id}
          amount={Number(refundTarget.amount)}
          currency={refundTarget.currency ?? "INR"}
        />
      )}
    </div>
  );
}

// ---- Shared invoice list ----
function InvoiceList({
  rows,
  perspective,
}: {
  rows: any[];
  perspective: "advertiser" | "creator";
}) {
  if (!rows.length) {
    return (
      <EmptyState
        icon={Receipt}
        title="No invoices yet"
        description={
          perspective === "advertiser"
            ? "Every funded campaign generates an invoice you can download here."
            : "Every released payment generates a payout invoice for your records."
        }
      />
    );
  }
  return (
    <div className="surface-card divide-y divide-border/60">
      {rows.map((r) => (
        <div
          key={r.id}
          className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between hover:bg-secondary/30 transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-muted-foreground">
              <Receipt className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="font-mono text-xs text-muted-foreground">
                {r.invoice_number ?? r.receipt_number}
              </div>
              <div className="mt-0.5 text-sm">
                <Money value={r.amount} currency={r.currency ?? "INR"} />{" "}
                <span className="text-xs text-muted-foreground">
                  · {format(new Date(r.created_at), "MMM d, yyyy")}
                </span>
              </div>
            </div>
          </div>
          <PaymentStatusBadge status={r.status_v2} />
        </div>
      ))}
      <div className="p-3 text-[11px] text-muted-foreground text-center">
        PDF export coming soon. All invoice fields are stored and audit-logged.
      </div>
    </div>
  );
}

// Silence unused import warning for the compact formatter above.
void formatMoney;
void DollarSign;
void Wallet;

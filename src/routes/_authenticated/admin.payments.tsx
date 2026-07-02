// Admin payment monitor: revenue chart, live KPIs, filters, search,
// unified across payments / refunds / escrow / withdrawal tabs.
import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  ArrowUpRight,
  Banknote,
  BarChart3,
  CircleDollarSign,
  ClipboardList,
  RefreshCcw,
  ShieldCheck,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { EmptyState } from "@/components/common/EmptyState";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { RevenueChart } from "@/components/payments/RevenueChart";
import { LedgerTable } from "@/components/payments/PaymentsTable";
import { Money, formatMoney } from "@/components/payments/Money";
import { PaymentStatusBadge } from "@/components/payments/PaymentStatusBadge";
import { PaymentFilters, withinRange, type RangeKey } from "@/components/payments/PaymentFilters";
import { PaymentDetailSheet } from "@/components/payments/PaymentDetailSheet";

export const Route = createFileRoute("/_authenticated/admin/payments")({
  head: () => ({ meta: [{ title: "Payments · Admin" }] }),
  component: AdminPayments,
});

function AdminPayments() {
  const qc = useQueryClient();
  const [range, setRange] = useState<RangeKey>("30d");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [openPayment, setOpenPayment] = useState<any | null>(null);

  const payments = useQuery({
    queryKey: ["admin-payments", range],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select(
          "id, amount, currency, status_v2, type, provider, razorpay_payment_id, created_at, processed_at, contract_id, campaign_id, payer_id, payee_id, platform_fee, gst, creator_earnings, receipt_number, invoice_number",
        )
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const refunds = useQuery({
    queryKey: ["admin-refunds"],
    queryFn: async () => {
      const { data } = await supabase
        .from("refunds")
        .select("id, amount, currency, status, reason, created_at, processed_at, payment_id")
        .order("created_at", { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });

  const withdrawals = useQuery({
    queryKey: ["admin-withdrawals-mon"],
    queryFn: async () => {
      const { data } = await supabase
        .from("withdrawals")
        .select("id, amount, currency, status, method, created_at, approved_at, completed_at, user_id")
        .order("created_at", { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("admin-payments-monitor")
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, () =>
        qc.invalidateQueries({ queryKey: ["admin-payments"] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "refunds" }, () =>
        qc.invalidateQueries({ queryKey: ["admin-refunds"] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "withdrawals" }, () =>
        qc.invalidateQueries({ queryKey: ["admin-withdrawals-mon"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  // KPIs (respect current range)
  const filteredPayments = useMemo(
    () => (payments.data ?? []).filter((p) => withinRange(p.created_at, range)),
    [payments.data, range],
  );
  const stats = useMemo(() => {
    const captured = filteredPayments.filter((p) =>
      ["paid", "held", "released", "withdrawn", "withdrawal_requested"].includes(p.status_v2 ?? ""),
    );
    const gmv = captured.reduce((s, p) => s + Number(p.amount || 0), 0);
    const fees = captured.reduce((s, p) => s + Number(p.platform_fee || 0), 0);
    const held = filteredPayments
      .filter((p) => p.status_v2 === "held")
      .reduce((s, p) => s + Number(p.amount || 0), 0);
    const refunded = (refunds.data ?? [])
      .filter((r) => withinRange(r.created_at, range) && r.status === "completed")
      .reduce((s, r) => s + Number(r.amount || 0), 0);
    const pendingWd = (withdrawals.data ?? [])
      .filter((w) => w.status === "requested")
      .reduce((s, w) => s + Number(w.amount || 0), 0);
    const failed = filteredPayments.filter((p) => p.status_v2 === "failed").length;
    return { gmv, fees, held, refunded, pendingWd, failed, count: filteredPayments.length };
  }, [filteredPayments, refunds.data, withdrawals.data, range]);

  // Search + status filter for the table view
  const paymentsForTable = useMemo(() => {
    return filteredPayments.filter((r) => {
      if (status !== "all" && r.status_v2 !== status) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return [
        r.receipt_number,
        r.invoice_number,
        r.id,
        r.razorpay_payment_id,
        r.payer_id,
        r.payee_id,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [filteredPayments, status, search]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payment monitoring"
        description="Live view of every transaction, escrow balance, refund, and payout across the platform."
        actions={
          <PaymentFilters
            search=""
            onSearchChange={() => {}}
            range={range}
            onRangeChange={setRange}
            className="hidden md:flex"
          />
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard
          label="Gross volume"
          value={stats.gmv}
          icon={TrendingUp}
          format={(v) => formatMoney(v, "INR", { compact: true, showZero: true })}
        />
        <StatCard
          label="Platform fees"
          value={stats.fees}
          icon={CircleDollarSign}
          format={(v) => formatMoney(v, "INR", { compact: true, showZero: true })}
        />
        <StatCard
          label="Held in escrow"
          value={stats.held}
          icon={ShieldCheck}
          format={(v) => formatMoney(v, "INR", { compact: true, showZero: true })}
        />
        <StatCard
          label="Refunded"
          value={stats.refunded}
          icon={RefreshCcw}
          format={(v) => formatMoney(v, "INR", { compact: true, showZero: true })}
        />
        <StatCard
          label="Payouts queued"
          value={stats.pendingWd}
          icon={Banknote}
          format={(v) => formatMoney(v, "INR", { compact: true, showZero: true })}
        />
        <StatCard label="Transactions" value={stats.count} icon={BarChart3} />
      </div>

      <RevenueChart
        rows={filteredPayments}
        days={range === "7d" ? 7 : range === "90d" ? 90 : 30}
      />

      <Tabs defaultValue="payments">
        <TabsList>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="escrow">Protected</TabsTrigger>
          <TabsTrigger value="refunds">Refunds</TabsTrigger>
          <TabsTrigger value="withdrawals">Withdrawal queue</TabsTrigger>
        </TabsList>

        <TabsContent value="payments" className="mt-6 space-y-4">
          <PaymentFilters
            search={search}
            onSearchChange={setSearch}
            status={status}
            onStatusChange={setStatus}
            statusOptions={[
              { value: "paid", label: "Paid" },
              { value: "held", label: "Protected" },
              { value: "released", label: "Released" },
              { value: "withdrawn", label: "Withdrawn" },
              { value: "refunded", label: "Refunded" },
              { value: "failed", label: "Failed" },
              { value: "pending", label: "Pending" },
            ]}
            range={range}
            onRangeChange={setRange}
          />
          <LedgerTable
            rows={paymentsForTable}
            isLoading={payments.isLoading}
            columns={["date", "reference", "type", "status", "amount"]}
            statusKey="status_v2"
            onRowClick={setOpenPayment}
            emptyTitle="No payments match those filters"
            emptyDescription="Try widening the date range or clearing the status filter."
          />
        </TabsContent>

        <TabsContent value="escrow" className="mt-6">
          {(() => {
            const held = filteredPayments.filter(
              (p) => p.status_v2 === "held" || p.status_v2 === "revision_requested",
            );
            if (held.length === 0)
              return (
                <EmptyState
                  icon={ShieldCheck}
                  title="No escrowed funds"
                  description="Every held payment released or refunded — nothing waiting for approval."
                />
              );
            return (
              <div className="space-y-3">
                {held.map((p) => (
                  <div
                    key={p.id}
                    className="surface-card p-4 flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="grid h-10 w-10 place-items-center rounded-full bg-accent/10 text-accent flex-shrink-0">
                        <ShieldCheck className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Money value={p.amount} currency={p.currency ?? "INR"} className="font-semibold" />
                          <PaymentStatusBadge status={p.status_v2} />
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Since {format(new Date(p.created_at), "MMM d, yyyy")}
                          {p.campaign_id && (
                            <>
                              {" · "}
                              <Link
                                to="/campaigns/$id"
                                params={{ id: p.campaign_id }}
                                className="hover:text-foreground story-link"
                              >
                                Campaign
                              </Link>
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setOpenPayment(p)}
                      className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                    >
                      Details <ArrowUpRight className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            );
          })()}
        </TabsContent>

        <TabsContent value="refunds" className="mt-6">
          {refunds.isLoading ? (
            <LedgerTable rows={undefined} isLoading columns={["date", "reference", "status", "amount"]} />
          ) : (refunds.data ?? []).length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="No refunds"
              description="Approved refunds appear here with their processing state."
            />
          ) : (
            <div className="surface-card divide-y divide-border/60">
              {(refunds.data ?? []).map((r: any) => (
                <div key={r.id} className="p-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Money value={r.amount} currency={r.currency ?? "INR"} className="font-semibold" />
                      <PaymentStatusBadge kind="refund" status={r.status} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Filed {format(new Date(r.created_at), "MMM d")}
                      {r.reason && ` · "${r.reason}"`}
                    </p>
                  </div>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    payment {r.payment_id?.slice(0, 8)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="withdrawals" className="mt-6">
          {(() => {
            const pending = (withdrawals.data ?? []).filter((w: any) => w.status === "requested");
            return (
              <div className="space-y-4">
                <div className="surface-card p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-full bg-warning/10 text-warning">
                      <Banknote className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{pending.length} pending payout request(s)</p>
                      <p className="text-xs text-muted-foreground">
                        <Money
                          value={pending.reduce((s: number, w: any) => s + Number(w.amount), 0)}
                          currency="INR"
                        />{" "}
                        awaiting admin approval
                      </p>
                    </div>
                  </div>
                  <Link
                    to="/admin/withdrawals"
                    className="text-sm font-medium text-accent hover:underline"
                  >
                    Open review queue →
                  </Link>
                </div>
                {(withdrawals.data ?? []).length === 0 ? (
                  <EmptyState
                    icon={Wallet}
                    title="No withdrawals yet"
                    description="Creator payout requests will appear here."
                  />
                ) : (
                  <div className="surface-card divide-y divide-border/60">
                    {(withdrawals.data ?? []).slice(0, 30).map((w: any) => (
                      <div key={w.id} className="p-4 flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Money value={w.amount} currency={w.currency ?? "INR"} className="font-semibold" />
                            <PaymentStatusBadge kind="withdrawal" status={w.status} />
                            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                              {w.method?.replace("_", " ")}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {format(new Date(w.created_at), "MMM d, h:mm a")}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
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

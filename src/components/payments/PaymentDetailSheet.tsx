// Payment detail slide-over. Shows the full fee breakdown and timeline
// derived from the payment row + optional linked contract/withdrawal.
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Receipt, ShieldCheck, Landmark, ExternalLink, FileDown, RotateCcw, Check, X, Loader2, CreditCard } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { adminReleaseFund } from "@/lib/payments/payments.functions";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Money } from "./Money";
import { PaymentStatusBadge } from "./PaymentStatusBadge";
import { PaymentTimeline } from "./PaymentTimeline";
import { cn } from "@/lib/utils";

export function PaymentDetailSheet({
  open,
  onOpenChange,
  payment,
  isAdmin,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  payment: any | null;
  isAdmin?: boolean;
}) {
  const qc = useQueryClient();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const releaseFn = useServerFn(adminReleaseFund);
  const releaseMut = useMutation({
    mutationFn: (paymentId: string) => releaseFn({ data: { paymentId } }),
    onSuccess: () => {
      toast.success("Payment released successfully");
      void contractQ.refetch();
      void adminPayoutQ.refetch();
      void qc.invalidateQueries({ queryKey: ["admin-payments"] });
      void qc.invalidateQueries({ queryKey: ["admin-pending-releases"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  useEffect(() => {
    if (!open || !payment) return;
    
    // Subscribe to contracts updates for this payment's campaign or contract
    const channel = supabase
      .channel(`sheet-realtime-${payment.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "contracts" },
        (payload: any) => {
          // If contract is linked to our payment, refetch
          const isTargetContract = 
            payload.new?.id === payment.contract_id || 
            payload.new?.payment_id === payment.id || 
            (payload.new?.campaign_id === payment.campaign_id && payload.new?.creator_id === payment.payee_id);
            
          if (isTargetContract) {
            console.log("[PaymentDetailSheet.realtime] [DEBUG] Target contract updated in DB:", payload.new);
            void contractQ.refetch();
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "payments", filter: `id=eq.${payment.id}` },
        (payload: any) => {
          console.log("[PaymentDetailSheet.realtime] [DEBUG] Target payment updated in DB:", payload.new);
          void adminPayoutQ.refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, payment?.id, payment?.contract_id, payment?.campaign_id, payment?.payee_id]);

  const contractQ = useQuery({
    queryKey: ["payment-contract", payment?.contract_id, payment?.campaign_id, payment?.id],
    enabled: open && !!payment && (!!payment.contract_id || !!payment.campaign_id),
    queryFn: async () => {
      let data = null;

      // 1. Try fetching by explicit contract_id on payment
      if (payment!.contract_id) {
        const { data: byId } = await supabase
          .from("contracts")
          .select("id, status, submitted_at, reviewed_at, created_at, campaign_id, creator_id, advertiser_id")
          .eq("id", payment!.contract_id)
          .maybeSingle();
        data = byId;
      }

      // 2. Fallback: Try fetching by payment_id matching the payment row ID
      if (!data) {
        const { data: byPaymentId } = await supabase
          .from("contracts")
          .select("id, status, submitted_at, reviewed_at, created_at, campaign_id, creator_id, advertiser_id")
          .eq("payment_id", payment!.id)
          .maybeSingle();
        data = byPaymentId;
      }

      // 3. Fallback: Query by campaign_id AND creator_id (payee_id on payment)
      if (!data && payment!.campaign_id) {
        const { data: byCampaignCreator } = await supabase
          .from("contracts")
          .select("id, status, submitted_at, reviewed_at, created_at, campaign_id, creator_id, advertiser_id")
          .eq("campaign_id", payment!.campaign_id)
          .eq("creator_id", payment!.payee_id)
          .maybeSingle();
        data = byCampaignCreator;
      }

      console.log(`[PaymentDetailSheet.contractQ] [DEBUG] Value returned by the admin query for contract:`, data);
      return data;
    },
  });

  const adminPayoutQ = useQuery({
    queryKey: ["admin-payout-details", payment?.id],
    enabled: open && !!payment && !!isAdmin,
    queryFn: async () => {
      const fn = (await import("@/lib/payments/payments.functions")).getAdminPaymentPayoutDetails;
      return fn({ data: { paymentId: payment!.id } });
    },
  });

  const currency = payment?.currency ?? "INR";
  const payoutData = adminPayoutQ.data;
  const creator = payoutData?.creator;
  const payoutMethod = payoutData?.payoutMethod;
  const withdrawal = payoutData?.withdrawal;

  const copy = (v?: string | null) => {
    if (!v) return;
    void navigator.clipboard.writeText(v);
    toast.success("Copied");
  };

  const downloadReceipt = () => {
    if (!payment) return;
    const text = `
--------------------------------------------------
                  CONNECX RECEIPT
--------------------------------------------------
Receipt Number: ${payment.receipt_number || "N/A"}
Invoice Number: ${payment.invoice_number || "N/A"}
Payment ID:     ${payment.id}
Date:           ${format(new Date(payment.created_at), "yyyy-MM-dd HH:mm:ss")}
Status:         Payout Completed
--------------------------------------------------
Payer (Brand):  ${payment.payer_id}
Payee (Creator):${creator?.name || "N/A"} (${creator?.email || "N/A"})
Amount Paid:    INR ${payment.amount}
Creator Share:  INR ${payment.creator_earnings}
Platform Fee:   INR ${payment.platform_fee}
GST (18%):      INR ${payment.gst}
--------------------------------------------------
Thank you for using Connecx!
--------------------------------------------------
    `;
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `receipt-${payment.receipt_number || payment.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Receipt downloaded successfully");
  };

  const handleAction = async (actionType: "approve" | "reject" | "send" | "mark_complete" | "retry") => {
    if (!withdrawal) return;
    setLoadingAction(actionType);
    try {
      if (actionType === "approve") {
        const fn = (await import("@/lib/payments/payments.functions")).adminReviewWithdrawal;
        await fn({ data: { withdrawalId: withdrawal.id, action: "approve", triggerPayout: false } });
        toast.success("Withdrawal approved");
      } else if (actionType === "reject") {
        const fn = (await import("@/lib/payments/payments.functions")).adminReviewWithdrawal;
        await fn({ data: { withdrawalId: withdrawal.id, action: "reject" } });
        toast.success("Withdrawal rejected");
      } else if (actionType === "send" || actionType === "retry") {
        const fn = (await import("@/lib/payments/payments.functions")).adminReviewWithdrawal;
        await fn({ data: { withdrawalId: withdrawal.id, action: "approve", triggerPayout: true } });
        toast.success("Payout request sent successfully");
      } else if (actionType === "mark_complete") {
        const fn = (await import("@/lib/payments/payments.functions")).adminMarkWithdrawalCompleted;
        await fn({ data: { withdrawalId: withdrawal.id } });
        toast.success("Payout marked as completed");
      }
      void adminPayoutQ.refetch();
      void qc.invalidateQueries({ queryKey: ["admin-payments"] });
      void qc.invalidateQueries({ queryKey: ["admin-withdrawals-mon"] });
    } catch (e: any) {
      toast.error(e.message || "Action failed");
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="text-left">
          <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <Receipt className="h-3.5 w-3.5" /> Payment detail
          </div>
          <SheetTitle className="font-display text-2xl flex items-center justify-between gap-4">
            <Money value={payment?.amount} currency={currency} />
            {isAdmin && payment?.status_v2 === "released" && (
              <span className="text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded">
                Payout Pending
              </span>
            )}
          </SheetTitle>
          <SheetDescription className="flex items-center gap-2 flex-wrap">
            <PaymentStatusBadge status={payment?.status_v2} />
            <span className="text-xs">
              {payment?.created_at
                ? format(new Date(payment.created_at), "EEE, MMM d yyyy · h:mm a")
                : "—"}
            </span>
          </SheetDescription>
        </SheetHeader>

        {payment && (
          <div className="mt-6 space-y-6">
            <div className="rounded-2xl border border-border/60 bg-secondary/20 p-4">
              <p className="mb-3 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5" /> Fee breakdown
              </p>
              <BreakdownRow label="Subtotal" value={payment.amount} currency={currency} />
              <BreakdownRow label="Platform fee" value={payment.platform_fee} currency={currency} />
              <BreakdownRow label="GST" value={payment.gst} currency={currency} />
              <div className="my-2 border-t border-border/60" />
              <BreakdownRow
                label="Creator earnings"
                value={payment.creator_earnings}
                currency={currency}
                emphasize
              />
            </div>

            {/* Admin Release Fund Escrow Actions (Admin Only) */}
            {isAdmin && payment.type === "campaign_payment" && (
              <div className="rounded-2xl border border-border/60 bg-secondary/10 p-4 space-y-3">
                <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5" /> Escrow Release
                </p>
                {(() => {
                  const isApproved = contractQ.data?.status === "approved";
                  const isReceived = payment.status_v2 === "held";
                  const isPending = payment.payout_status === "pending" || !payment.payout_status;
                  const isReleased = payment.status_v2 === "released" || payment.payout_status === "completed";

                  if (isReleased) {
                    return (
                      <div className="space-y-2 text-xs">
                        <div className="text-xs text-success font-semibold flex items-center gap-1.5 py-1">
                          <Check className="h-4 w-4" /> Fund Released
                        </div>
                        <div className="grid grid-cols-2 gap-2 border-t border-border/40 pt-2 text-[11px]">
                          <div>
                            <span className="text-muted-foreground block uppercase text-[9px]">Released At</span>
                            <span className="font-medium text-foreground">
                              {payment.released_at ? format(new Date(payment.released_at), "MMM d, yyyy h:mm a") : "N/A"}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block uppercase text-[9px]">Released By</span>
                            <span className="font-mono text-foreground truncate block">
                              {payment.released_by ? payment.released_by.slice(0, 13) + "..." : "Admin"}
                            </span>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[11px] mt-1">
                          <div>
                            <span className="text-muted-foreground block uppercase text-[9px]">Payout Status</span>
                            <span className="font-bold text-success uppercase">
                              {payment.payout_status ?? "completed"}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  const disabledReason = !isReceived
                    ? "Payment has not been received yet"
                    : !isApproved
                    ? "Advertiser has not approved deliverables yet"
                    : !isPending
                    ? "Payout has already been completed"
                    : null;

                  console.log(`[PaymentDetailSheet.disabledReason] [DEBUG] Final values for enable/disable check:`, {
                    isReceived,
                    isApproved,
                    isPending,
                    disabledReason,
                    isEnabled: !disabledReason
                  });

                  return (
                    <div className="space-y-2">
                      <Button
                        size="sm"
                        disabled={!!disabledReason || releaseMut.isPending}
                        onClick={() => {
                          setConfirmOpen(true);
                        }}
                        className="bg-success hover:bg-success/90 text-success-foreground w-full justify-center h-9 gap-1.5"
                      >
                        {releaseMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        Release Fund
                      </Button>
                      {disabledReason && (
                        <p className="text-[10px] text-destructive font-medium mt-1">{disabledReason}</p>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Payout Actions Section (Admin Only) */}
            {isAdmin && (payment.status_v2 === "released" || payment.status_v2 === "withdrawal_requested" || payment.status_v2 === "withdrawn") && (
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-4">
                <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-amber-500">
                  <Landmark className="h-3.5 w-3.5" /> Payout Actions
                </p>

                {adminPayoutQ.isLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-amber-500" />
                  </div>
                ) : !creator ? (
                  <p className="text-xs text-muted-foreground">No creator payout details available</p>
                ) : (
                  <div className="space-y-3 text-xs">
                    <div className="grid grid-cols-2 gap-2 border-b border-border/40 pb-2">
                      <div>
                        <span className="text-muted-foreground block text-[10px] uppercase">Creator</span>
                        <span className="font-medium text-foreground">{creator.name}</span>
                        <span className="block text-[10px] text-muted-foreground">{creator.email}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[10px] uppercase">Creator ID</span>
                        <span className="font-mono text-muted-foreground truncate block">{creator.id.slice(0, 13)}...</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 border-b border-border/40 pb-2">
                      <div>
                        <span className="text-muted-foreground block text-[10px] uppercase">Earnings</span>
                        <span className="font-bold text-foreground">
                          <Money value={payment.creator_earnings} currency={currency} />
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[10px] uppercase">Payout Method</span>
                        {payoutMethod ? (
                          <span className="font-medium text-foreground flex items-center gap-1">
                            {payoutMethod.methodType === "bank" ? (
                              <>
                                <Landmark className="h-3 w-3 inline" /> Bank Transfer
                              </>
                            ) : (
                              <>
                                <CreditCard className="h-3 w-3 inline" /> UPI
                              </>
                            )}
                            <span className={cn(
                              "text-[9px] px-1.5 py-0.2 rounded border uppercase font-bold",
                              payoutMethod.verificationStatus === "verified"
                                ? "bg-green-500/10 text-green-500 border-green-500/20"
                                : "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
                            )}>
                              {payoutMethod.verificationStatus}
                            </span>
                          </span>
                        ) : (
                          <span className="text-red-500">Not Configured</span>
                        )}
                      </div>
                    </div>

                    {payoutMethod && (
                      <div className="grid grid-cols-2 gap-2 border-b border-border/40 pb-2">
                        <div className="col-span-2">
                          <span className="text-muted-foreground block text-[10px] uppercase">Details</span>
                          {payoutMethod.methodType === "bank" ? (
                            <span className="text-foreground font-mono">
                              {payoutMethod.accountHolderName} · {payoutMethod.bankName} · ****{payoutMethod.accountNumberLast4} · IFSC: {payoutMethod.ifsc}
                            </span>
                          ) : (
                            <span className="text-foreground font-mono">{payoutMethod.upiId}</span>
                          )}
                        </div>
                      </div>
                    )}

                    {(payoutMethod?.razorpayContactId || payoutMethod?.razorpayFundAccountId) && (
                      <div className="grid grid-cols-2 gap-2 border-b border-border/40 pb-2">
                        {payoutMethod.razorpayContactId && (
                          <div>
                            <span className="text-muted-foreground block text-[10px] uppercase">Razorpay Contact</span>
                            <span className="font-mono text-muted-foreground truncate block">{payoutMethod.razorpayContactId}</span>
                          </div>
                        )}
                        {payoutMethod.razorpayFundAccountId && (
                          <div>
                            <span className="text-muted-foreground block text-[10px] uppercase">Razorpay Fund A/C</span>
                            <span className="font-mono text-muted-foreground truncate block">{payoutMethod.razorpayFundAccountId}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {withdrawal ? (
                      <div className="space-y-3 pt-1">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-muted-foreground block text-[10px] uppercase">Withdrawal Status</span>
                            <span className={cn(
                              "text-[10px] font-bold px-2 py-0.5 rounded border capitalize inline-block mt-0.5",
                              withdrawal.status === "completed" && "bg-green-500/10 text-green-500 border-green-500/20",
                              withdrawal.status === "requested" && "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
                              withdrawal.status === "approved" && "bg-blue-500/10 text-blue-500 border-blue-500/20",
                              withdrawal.status === "processing" && "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
                              withdrawal.status === "failed" && "bg-red-500/10 text-red-500 border-red-500/20",
                              withdrawal.status === "rejected" && "bg-red-500/10 text-red-500 border-red-500/20"
                            )}>
                              {withdrawal.status}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block text-[10px] uppercase">Requested At</span>
                            <span className="font-medium text-foreground">
                              {format(new Date(withdrawal.requestedAt), "MMM d, yyyy")}
                            </span>
                          </div>
                        </div>

                        {withdrawal.failureReason && (
                          <div className="bg-red-500/10 border border-red-500/20 rounded p-2 text-red-500 text-[11px] font-mono">
                            Error: {withdrawal.failureReason}
                          </div>
                        )}

                        {/* Action buttons based on status */}
                        <div className="flex flex-wrap gap-2 pt-2">
                          {withdrawal.status === "requested" && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="bg-green-600 text-white hover:bg-green-700 border-none h-8 text-[11px]"
                                onClick={() => handleAction("approve")}
                                disabled={!!loadingAction}
                              >
                                {loadingAction === "approve" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3.5 w-3.5 mr-1" />}
                                Approve Request
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="bg-red-600 text-white hover:bg-red-700 border-none h-8 text-[11px]"
                                onClick={() => handleAction("reject")}
                                disabled={!!loadingAction}
                              >
                                {loadingAction === "reject" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <X className="h-3.5 w-3.5 mr-1" />}
                                Reject
                              </Button>
                            </>
                          )}

                          {withdrawal.status === "approved" && (
                            <>
                              <Button
                                size="sm"
                                className="bg-indigo-600 text-white hover:bg-indigo-700 h-8 text-[11px]"
                                onClick={() => handleAction("send")}
                                disabled={!!loadingAction}
                              >
                                {loadingAction === "send" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Landmark className="h-3.5 w-3.5 mr-1" />}
                                Send Payout (Rzp)
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="bg-green-600 text-white hover:bg-green-700 border-none h-8 text-[11px]"
                                onClick={() => handleAction("mark_complete")}
                                disabled={!!loadingAction}
                              >
                                {loadingAction === "mark_complete" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3.5 w-3.5 mr-1" />}
                                Mark as Paid (Manual)
                              </Button>
                            </>
                          )}

                          {withdrawal.status === "failed" && (
                            <Button
                              size="sm"
                              className="bg-indigo-600 text-white hover:bg-indigo-700 h-8 text-[11px]"
                              onClick={() => handleAction("retry")}
                              disabled={!!loadingAction}
                            >
                              {loadingAction === "retry" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RotateCcw className="h-3.5 w-3.5 mr-1" />}
                              Retry Payout
                            </Button>
                          )}

                          {withdrawal.razorpayPayoutId && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-[11px]"
                              onClick={() => window.open(`https://dashboard.razorpay.com/app/payouts/${withdrawal.razorpayPayoutId}`, "_blank")}
                            >
                              <ExternalLink className="h-3.5 w-3.5 mr-1" />
                              View Transfer
                            </Button>
                          )}

                          {withdrawal.status === "completed" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-[11px] bg-green-500/10 text-green-500 hover:bg-green-500/20 border-green-500/20"
                              onClick={downloadReceipt}
                            >
                              <FileDown className="h-3.5 w-3.5 mr-1" />
                              Download Receipt
                            </Button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="pt-2 text-center">
                        <p className="text-[11px] text-muted-foreground mb-2">Creator has not requested withdrawal for this balance yet.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div>
              <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Lifecycle
              </p>
              <PaymentTimeline
                payment={payment}
                contract={contractQ.data ?? null}
                withdrawal={withdrawal}
              />
            </div>

            <div>
              <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                References
              </p>
              <div className="space-y-1 text-sm">
                <IdRow label="Receipt" value={payment.receipt_number} onCopy={copy} />
                <IdRow label="Invoice" value={payment.invoice_number} onCopy={copy} />
                <IdRow label="Payment ID" value={payment.id} onCopy={copy} mono />
                <IdRow label="Gateway" value={payment.provider} />
                {payment.razorpay_payment_id && (
                  <IdRow
                    label="Gateway txn"
                    value={payment.razorpay_payment_id}
                    onCopy={copy}
                    mono
                  />
                )}
              </div>
            </div>
          </div>
        )}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Release Creator Payment</DialogTitle>
            <DialogDescription>
              Are you sure you want to release this payment to the creator? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button
              disabled={releaseMut.isPending}
              onClick={async () => {
                if (payment) {
                  try {
                    await releaseMut.mutateAsync(payment.id);
                    setConfirmOpen(false);
                  } catch {
                    // toast is shown by onError hook
                  }
                }
              }}
              className="bg-success text-success-foreground hover:bg-success/90"
            >
              {releaseMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
              Confirm Release
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </SheetContent>
    </Sheet>
  );
}

function BreakdownRow({
  label,
  value,
  currency,
  emphasize,
}: {
  label: string;
  value: number | string | null | undefined;
  currency: string;
  emphasize?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1 text-sm">
      <span className={emphasize ? "font-medium" : "text-muted-foreground"}>{label}</span>
      <Money
        value={value}
        currency={currency}
        className={emphasize ? "text-foreground" : "text-foreground/80"}
      />
    </div>
  );
}

function IdRow({
  label,
  value,
  onCopy,
  mono,
}: {
  label: string;
  value?: string | null;
  onCopy?: (v?: string | null) => void;
  mono?: boolean;
}) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background px-3 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2 min-w-0">
        <span className={`truncate text-xs ${mono ? "font-mono" : ""}`}>{value}</span>
        {onCopy && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 flex-shrink-0"
            onClick={() => onCopy(value)}
            aria-label={`Copy ${label}`}
          >
            <Copy className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}

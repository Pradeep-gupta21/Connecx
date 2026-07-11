import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Landmark,
  Smartphone,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Loader2,
  Check,
  X,
  Eye,
  RotateCcw,
  ExternalLink,
  Search,
  ChevronRight,
  User,
  Megaphone,
  CreditCard,
  FileDown
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { Money } from "@/components/payments/Money";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/withdrawals")({
  head: () => ({ meta: [{ title: "Withdrawals · Admin" }] }),
  component: AdminWithdrawals,
});

interface WithdrawalRow {
  id: string;
  amount: number;
  currency: string;
  status: "requested" | "approved" | "processing" | "completed" | "failed" | "rejected" | "cancelled";
  method: string;
  destination: any;
  razorpay_payout_id: string | null;
  failure_reason: string | null;
  created_at: string;
  approved_at: string | null;
  processed_at: string | null;
  completed_at: string | null;
  admin_notes: string | null;
  user_id: string;
  payout_method_id: string | null;
  payment_id: string | null;
  campaign_id: string | null;
  profiles: { display_name: string | null; avatar_url: string | null } | null;
  campaigns: { title: string } | null;
}

function AdminWithdrawals() {
  const qc = useQueryClient();
  const [statusTab, setStatusTab] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<WithdrawalRow | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [creatorEmails, setCreatorEmails] = useState<Record<string, string>>({});

  const withdrawalsQ = useQuery({
    queryKey: ["admin-withdrawals-list", statusTab],
    queryFn: async () => {
      let query = supabase
        .from("withdrawals")
        .select(`
          id, amount, currency, status, method, destination, razorpay_payout_id, failure_reason,
          created_at, approved_at, processed_at, completed_at, admin_notes, user_id, payout_method_id,
          payment_id, campaign_id,
          profiles(display_name, avatar_url),
          campaigns(title)
        `)
        .order("created_at", { ascending: false });

      if (statusTab !== "all") {
        query = query.eq("status", statusTab as any);
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return (data as any[] ?? []) as WithdrawalRow[];
    },
  });

  const fetchCreatorEmail = async (userId: string) => {
    if (creatorEmails[userId]) return;
    try {
      // Fetch creator details via helper API if available, or just mock it in local client.
      // Since client can't query auth.users, we let the server handle emails, or fallback to profile.
      setCreatorEmails(prev => ({ ...prev, [userId]: "Loading..." }));
      // We can invoke the server fn to fetch it.
      const fn = (await import("@/lib/payments/payments.functions")).getAdminPaymentPayoutDetails;
      // We look up via payment ID or we can query any payments payee. Since we only want email, we fetch payment details.
      const { data } = await supabase.from("payments").select("id").eq("payee_id", userId).limit(1);
      if (data && data.length > 0) {
        const details = await fn({ data: { paymentId: data[0].id } });
        setCreatorEmails(prev => ({ ...prev, [userId]: details.creator.email }));
      } else {
        setCreatorEmails(prev => ({ ...prev, [userId]: "creator@connecx.dev" }));
      }
    } catch (e) {
      setCreatorEmails(prev => ({ ...prev, [userId]: "creator@connecx.dev" }));
    }
  };

  const handleAction = async (withdrawal: WithdrawalRow, actionType: "approve" | "reject" | "send" | "mark_complete" | "retry") => {
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
        toast.success("Payout request triggered successfully");
      } else if (actionType === "mark_complete") {
        const fn = (await import("@/lib/payments/payments.functions")).adminMarkWithdrawalCompleted;
        await fn({ data: { withdrawalId: withdrawal.id } });
        toast.success("Payout marked as completed");
      }
      
      void withdrawalsQ.refetch();
      qc.invalidateQueries({ queryKey: ["admin-payments"] });
      
      // Update selected drawer state
      if (selectedWithdrawal?.id === withdrawal.id) {
        const { data: updated } = await supabase
          .from("withdrawals")
          .select(`
            id, amount, currency, status, method, destination, razorpay_payout_id, failure_reason,
            created_at, approved_at, processed_at, completed_at, admin_notes, user_id, payout_method_id,
            payment_id, campaign_id,
            profiles(display_name, avatar_url),
            campaigns(title)
          `)
          .eq("id", withdrawal.id)
          .single();
        if (updated) setSelectedWithdrawal(updated as any);
      }
    } catch (e: any) {
      toast.error(e.message || "Action failed");
    } finally {
      setLoadingAction(null);
    }
  };

  const downloadReceipt = (withdrawal: WithdrawalRow) => {
    const email = creatorEmails[withdrawal.user_id] || "N/A";
    const text = `
--------------------------------------------------
                  CONNECX RECEIPT
--------------------------------------------------
Withdrawal ID:   ${withdrawal.id}
Date Completed:  ${withdrawal.completed_at ? format(new Date(withdrawal.completed_at), "yyyy-MM-dd HH:mm:ss") : "N/A"}
Payout Reference:${withdrawal.razorpay_payout_id || "Manual Payout"}
Status:          Payout Completed
--------------------------------------------------
Payee (Creator): ${withdrawal.profiles?.display_name || "N/A"} (${email})
Amount Withdrawn: ${withdrawal.currency} ${withdrawal.amount}
Payment Method:  ${withdrawal.method === "bank_transfer" ? "Bank Transfer" : "UPI"}
--------------------------------------------------
Thank you for using Connecx!
--------------------------------------------------
    `;
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payout-receipt-${withdrawal.id.slice(0, 8)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Receipt downloaded successfully");
  };

  const filtered = (withdrawalsQ.data ?? []).filter(w => {
    if (!searchQuery) return true;
    const name = w.profiles?.display_name?.toLowerCase() || "";
    const title = w.campaigns?.title?.toLowerCase() || "";
    const id = w.id.toLowerCase();
    const query = searchQuery.toLowerCase();
    return name.includes(query) || title.includes(query) || id.includes(query);
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Withdrawal Requests"
        description="Review, approve, and process creator payouts securely via RazorpayX or Manual bank transfers."
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Tabs value={statusTab} onValueChange={setStatusTab} className="w-full sm:w-auto">
          <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/60 p-1">
            <TabsTrigger value="all" className="text-xs px-3 py-1.5 h-8">All</TabsTrigger>
            <TabsTrigger value="requested" className="text-xs px-3 py-1.5 h-8">
              <Clock className="h-3 w-3 mr-1" /> Review Pending
            </TabsTrigger>
            <TabsTrigger value="approved" className="text-xs px-3 py-1.5 h-8">
              <Check className="h-3 w-3 mr-1" /> Approved
            </TabsTrigger>
            <TabsTrigger value="processing" className="text-xs px-3 py-1.5 h-8">
              <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Processing
            </TabsTrigger>
            <TabsTrigger value="completed" className="text-xs px-3 py-1.5 h-8">
              <ShieldCheck className="h-3 w-3 mr-1" /> Completed
            </TabsTrigger>
            <TabsTrigger value="failed" className="text-xs px-3 py-1.5 h-8">
              <ShieldAlert className="h-3 w-3 mr-1" /> Failed
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by creator or campaign..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
        {withdrawalsQ.isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
            <p className="text-sm text-muted-foreground">Loading withdrawal requests...</p>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No withdrawals found"
            description={statusTab === "all" ? "No withdrawal requests have been placed yet." : `No requests match status "${statusTab}".`}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border/60 bg-muted/20 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  <th className="p-4">Creator</th>
                  <th className="p-4">Campaign</th>
                  <th className="p-4">Amount</th>
                  <th className="p-4">Requested</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Method</th>
                  <th className="p-4">Gateway Reference</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 text-sm">
                {filtered.map((w) => (
                  <tr
                    key={w.id}
                    className="hover:bg-muted/10 transition-colors cursor-pointer group"
                    onClick={() => {
                      setSelectedWithdrawal(w);
                      void fetchCreatorEmail(w.user_id);
                    }}
                  >
                    <td className="p-4 flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center font-bold text-secondary-foreground overflow-hidden">
                        {w.profiles?.avatar_url ? (
                          <img src={w.profiles.avatar_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <User className="h-4 w-4" />
                        )}
                      </div>
                      <div>
                        <div className="font-semibold text-foreground group-hover:text-indigo-500 transition-colors">
                          {w.profiles?.display_name ?? "Unknown Creator"}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono">
                          ID: {w.user_id.slice(0, 8)}...
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      {w.campaigns?.title ? (
                        <div className="flex items-center gap-1.5 text-foreground/80 font-medium">
                          <Megaphone className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                          <span className="truncate max-w-[150px]">{w.campaigns.title}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">General Balance</span>
                      )}
                    </td>
                    <td className="p-4 font-bold text-foreground">
                      <Money value={w.amount} currency={w.currency} />
                    </td>
                    <td className="p-4 text-muted-foreground">
                      {format(new Date(w.created_at), "MMM d, yyyy · h:mm a")}
                    </td>
                    <td className="p-4">
                      <span className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded border capitalize inline-block",
                        w.status === "completed" && "bg-green-500/10 text-green-500 border-green-500/20",
                        w.status === "requested" && "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
                        w.status === "approved" && "bg-blue-500/10 text-blue-500 border-blue-500/20",
                        w.status === "processing" && "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
                        w.status === "failed" && "bg-red-500/10 text-red-500 border-red-500/20",
                        w.status === "rejected" && "bg-red-500/10 text-red-500 border-red-500/20",
                        w.status === "cancelled" && "bg-gray-500/10 text-gray-500 border-gray-500/20"
                      )}>
                        {w.status === "requested" ? "Pending Review" : w.status}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                        {w.method === "bank_transfer" ? (
                          <>
                            <Landmark className="h-3.5 w-3.5 flex-shrink-0" />
                            <span>Bank Account</span>
                          </>
                        ) : (
                          <>
                            <CreditCard className="h-3.5 w-3.5 flex-shrink-0" />
                            <span>UPI VPA</span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="p-4 font-mono text-xs text-muted-foreground">
                      {w.razorpay_payout_id ? (
                        <span className="flex items-center gap-1">
                          {w.razorpay_payout_id.slice(0, 15)}...
                          <ExternalLink className="h-3 w-3 hover:text-foreground cursor-pointer" onClick={(e) => {
                            e.stopPropagation();
                            window.open(`https://dashboard.razorpay.com/app/payouts/${w.razorpay_payout_id}`, "_blank");
                          }} />
                        </span>
                      ) : w.status === "completed" ? (
                        "Manual Payout"
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            setSelectedWithdrawal(w);
                            void fetchCreatorEmail(w.user_id);
                          }}
                          aria-label="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Withdrawal Detail Sheet */}
      <Sheet open={selectedWithdrawal !== null} onOpenChange={(v) => !v && setSelectedWithdrawal(null)}>
        {selectedWithdrawal && (
          <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
            <SheetHeader className="text-left border-b border-border/40 pb-4">
              <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <Landmark className="h-3.5 w-3.5" /> Withdrawal Detail
              </div>
              <SheetTitle className="font-display text-2xl mt-1">
                <Money value={selectedWithdrawal.amount} currency={selectedWithdrawal.currency} />
              </SheetTitle>
              <SheetDescription className="flex items-center gap-2 mt-1">
                <span className={cn(
                  "text-[10px] font-bold px-2 py-0.5 rounded border capitalize",
                  selectedWithdrawal.status === "completed" && "bg-green-500/10 text-green-500 border-green-500/20",
                  selectedWithdrawal.status === "requested" && "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
                  selectedWithdrawal.status === "approved" && "bg-blue-500/10 text-blue-500 border-blue-500/20",
                  selectedWithdrawal.status === "processing" && "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
                  selectedWithdrawal.status === "failed" && "bg-red-500/10 text-red-500 border-red-500/20",
                  selectedWithdrawal.status === "rejected" && "bg-red-500/10 text-red-500 border-red-500/20",
                  selectedWithdrawal.status === "cancelled" && "bg-gray-500/10 text-gray-500 border-gray-500/20"
                )}>
                  {selectedWithdrawal.status === "requested" ? "Pending Review" : selectedWithdrawal.status}
                </span>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(selectedWithdrawal.created_at), "MMM d, yyyy · h:mm a")}
                </span>
              </SheetDescription>
            </SheetHeader>

            <div className="mt-6 space-y-6">
              {/* Creator details */}
              <div className="space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Creator Info</p>
                <div className="rounded-xl border border-border/40 p-3 bg-secondary/10 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center font-bold text-secondary-foreground overflow-hidden">
                    {selectedWithdrawal.profiles?.avatar_url ? (
                      <img src={selectedWithdrawal.profiles.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <User className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{selectedWithdrawal.profiles?.display_name ?? "Unknown Creator"}</p>
                    <p className="text-xs text-muted-foreground">{creatorEmails[selectedWithdrawal.user_id] || "Loading email..."}</p>
                    <p className="text-[10px] text-muted-foreground font-mono mt-0.5">ID: {selectedWithdrawal.user_id}</p>
                  </div>
                </div>
              </div>

              {/* Destination account details */}
              <div className="space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Payout Destination</p>
                <div className="rounded-xl border border-border/40 p-4 bg-background space-y-3 text-xs">
                  <div className="flex justify-between items-center pb-2 border-b border-border/40">
                    <span className="text-muted-foreground">Method Type</span>
                    <span className="font-medium text-foreground flex items-center gap-1">
                      {selectedWithdrawal.method === "bank_transfer" ? (
                        <>
                          <Landmark className="h-3.5 w-3.5 inline text-indigo-500" /> Bank Transfer
                        </>
                      ) : (
                        <>
                          <CreditCard className="h-3.5 w-3.5 inline text-indigo-500" /> UPI VPA
                        </>
                      )}
                    </span>
                  </div>

                  {selectedWithdrawal.method === "bank_transfer" ? (
                    <>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Account Holder</span>
                        <span className="font-medium text-foreground">{selectedWithdrawal.destination?.account_holder_name || "N/A"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Bank Name</span>
                        <span className="font-medium text-foreground">{selectedWithdrawal.destination?.bank_name || "N/A"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Account Number</span>
                        <span className="font-mono text-foreground">****{selectedWithdrawal.destination?.account_number_last4 || "N/A"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">IFSC Code</span>
                        <span className="font-mono text-foreground uppercase">{selectedWithdrawal.destination?.ifsc || "N/A"}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">UPI ID (VPA)</span>
                      <span className="font-mono font-medium text-foreground">{selectedWithdrawal.destination?.vpa || "N/A"}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Linked Campaign */}
              <div className="space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Linked Campaign</p>
                <div className="rounded-xl border border-border/40 p-3 bg-secondary/5 text-xs flex justify-between items-center">
                  <span className="text-muted-foreground">Campaign Title</span>
                  <span className="font-medium text-foreground max-w-[250px] truncate">
                    {selectedWithdrawal.campaigns?.title || "General Balance Withdrawal"}
                  </span>
                </div>
              </div>

              {/* Request Timeline */}
              <div className="space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Timeline</p>
                <div className="space-y-2.5 text-xs border-l-2 border-border/60 pl-4 ml-2">
                  <div className="relative">
                    <div className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-yellow-500" />
                    <p className="font-medium text-foreground">Requested</p>
                    <p className="text-[10px] text-muted-foreground">{format(new Date(selectedWithdrawal.created_at), "EEE, MMM d, yyyy · h:mm a")}</p>
                  </div>
                  {selectedWithdrawal.approved_at && (
                    <div className="relative">
                      <div className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-blue-500" />
                      <p className="font-medium text-foreground">Approved by Admin</p>
                      <p className="text-[10px] text-muted-foreground">{format(new Date(selectedWithdrawal.approved_at), "EEE, MMM d, yyyy · h:mm a")}</p>
                    </div>
                  )}
                  {selectedWithdrawal.completed_at && (
                    <div className="relative">
                      <div className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-green-500" />
                      <p className="font-medium text-foreground">Completed (Funds Sent)</p>
                      <p className="text-[10px] text-muted-foreground">{format(new Date(selectedWithdrawal.completed_at), "EEE, MMM d, yyyy · h:mm a")}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              {selectedWithdrawal.failure_reason && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-500 text-xs font-mono">
                  <span className="font-bold block uppercase text-[10px] mb-1">Failure Reason</span>
                  {selectedWithdrawal.failure_reason}
                </div>
              )}

              <div className="border-t border-border/40 pt-4 flex flex-wrap gap-2 justify-end">
                {selectedWithdrawal.status === "requested" && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="bg-green-600 text-white hover:bg-green-700 border-none text-xs"
                      onClick={() => handleAction(selectedWithdrawal, "approve")}
                      disabled={!!loadingAction}
                    >
                      {loadingAction === "approve" ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Check className="h-4 w-4 mr-1.5" />}
                      Approve Request
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="bg-red-600 text-white hover:bg-red-700 border-none text-xs"
                      onClick={() => handleAction(selectedWithdrawal, "reject")}
                      disabled={!!loadingAction}
                    >
                      {loadingAction === "reject" ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <X className="h-4 w-4 mr-1.5" />}
                      Reject
                    </Button>
                  </>
                )}

                {selectedWithdrawal.status === "approved" && (
                  <>
                    <Button
                      size="sm"
                      className="bg-indigo-600 text-white hover:bg-indigo-700 text-xs"
                      onClick={() => handleAction(selectedWithdrawal, "send")}
                      disabled={!!loadingAction}
                    >
                      {loadingAction === "send" ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Landmark className="h-4 w-4 mr-1.5" />}
                      Send Payout (Rzp)
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="bg-green-600 text-white hover:bg-green-700 border-none text-xs"
                      onClick={() => handleAction(selectedWithdrawal, "mark_complete")}
                      disabled={!!loadingAction}
                    >
                      {loadingAction === "mark_complete" ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Check className="h-4 w-4 mr-1.5" />}
                      Mark as Paid (Manual)
                    </Button>
                  </>
                )}

                {selectedWithdrawal.status === "failed" && (
                  <Button
                    size="sm"
                    className="bg-indigo-600 text-white hover:bg-indigo-700 text-xs"
                    onClick={() => handleAction(selectedWithdrawal, "retry")}
                    disabled={!!loadingAction}
                  >
                    {loadingAction === "retry" ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <RotateCcw className="h-4 w-4 mr-1.5" />}
                    Retry Payout
                  </Button>
                )}

                {selectedWithdrawal.razorpay_payout_id && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs"
                    onClick={() => window.open(`https://dashboard.razorpay.com/app/payouts/${selectedWithdrawal.razorpay_payout_id}`, "_blank")}
                  >
                    <ExternalLink className="h-4 w-4 mr-1.5" />
                    View Transfer
                  </Button>
                )}

                {selectedWithdrawal.status === "completed" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs bg-green-500/10 text-green-500 hover:bg-green-500/20 border-green-500/20"
                    onClick={() => downloadReceipt(selectedWithdrawal)}
                  >
                    <FileDown className="h-4 w-4 mr-1.5" />
                    Download Receipt
                  </Button>
                )}
              </div>
            </div>
          </SheetContent>
        )}
      </Sheet>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { formatDistanceToNow } from "date-fns";
import {
  Landmark,
  Smartphone,
  ShieldCheck,
  ShieldAlert,
  Clock,
  MessageSquareWarning,
  Loader2,
  Check,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase as supabaseTyped } from "@/integrations/supabase/client";
import { adminReviewPayoutMethod } from "@/lib/payments/payments.functions";
import { cn } from "@/lib/utils";

const supabase = supabaseTyped as unknown as {
  from: (t: string) => {
    select: (s: string) => {
      eq: (c: string, v: string) => {
        order: (c: string, o?: { ascending?: boolean }) => Promise<{ data: PayoutRow[] | null; error: { message: string } | null }>;
      };
      order: (c: string, o?: { ascending?: boolean }) => Promise<{ data: PayoutRow[] | null; error: { message: string } | null }>;
    };
  };
};

export const Route = createFileRoute("/_authenticated/admin/payouts")({
  head: () => ({ meta: [{ title: "Payout Methods · Admin" }] }),
  component: AdminPayouts,
});

interface PayoutRow {
  id: string;
  user_id: string;
  method_type: "bank" | "upi";
  account_holder_name: string | null;
  bank_name: string | null;
  account_number_last4: string | null;
  ifsc: string | null;
  account_type: "savings" | "current" | null;
  upi_id: string | null;
  is_default: boolean;
  verification_status: "pending" | "verified" | "rejected";
  rejection_reason: string | null;
  created_at: string;
  profiles: { display_name: string | null; avatar_url: string | null } | null;
}

function AdminPayouts() {
  const [status, setStatus] = useState<"pending" | "verified" | "rejected">("pending");

  const q = useQuery({
    queryKey: ["admin-payout-methods", status],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payout_methods")
        .select(
          "id, user_id, method_type, account_holder_name, bank_name, account_number_last4, ifsc, account_type, upi_id, is_default, verification_status, rejection_reason, created_at, profiles:user_id(display_name, avatar_url)",
        )
        .eq("verification_status", status)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payout Management"
        description="Verify creator and advertiser payout accounts before any withdrawal is paid out."
      />

      <Tabs value={status} onValueChange={(v) => setStatus(v as typeof status)}>
        <TabsList>
          <TabsTrigger value="pending">
            <Clock className="h-3.5 w-3.5 mr-1.5" /> Pending
          </TabsTrigger>
          <TabsTrigger value="verified">
            <ShieldCheck className="h-3.5 w-3.5 mr-1.5" /> Verified
          </TabsTrigger>
          <TabsTrigger value="rejected">
            <ShieldAlert className="h-3.5 w-3.5 mr-1.5" /> Rejected
          </TabsTrigger>
        </TabsList>

        <TabsContent value={status} className="mt-6">
          {q.isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (q.data ?? []).length === 0 ? (
            <EmptyState title="Nothing to review" description={`No payout methods in "${status}".`} />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {(q.data ?? []).map((m) => (
                <PayoutAdminCard key={m.id} m={m} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PayoutAdminCard({ m }: { m: PayoutRow }) {
  const qc = useQueryClient();
  const review = useServerFn(adminReviewPayoutMethod);
  const [busy, setBusy] = useState<"approve" | "reject" | "request_update" | null>(null);
  const [dialog, setDialog] = useState<"reject" | "request_update" | null>(null);
  const [reason, setReason] = useState("");

  const Icon = m.method_type === "bank" ? Landmark : Smartphone;

  const runReview = async (action: "approve" | "reject" | "request_update", note?: string) => {
    setBusy(action);
    try {
      await review({ data: { payoutMethodId: m.id, action, reason: note } });
      toast.success(
        action === "approve"
          ? "Payout account verified"
          : action === "reject"
          ? "Payout account rejected"
          : "Update requested from user",
      );
      qc.invalidateQueries({ queryKey: ["admin-payout-methods"] });
      setDialog(null);
      setReason("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="surface-card p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <div className="space-y-0.5">
            <p className="font-medium leading-tight">
              {m.profiles?.display_name ?? "Unknown user"}
            </p>
            <p className="text-xs text-muted-foreground">
              Added {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
            </p>
          </div>
        </div>
        <StatusBadge status={m.verification_status} isDefault={m.is_default} />
      </div>

      <dl className="grid grid-cols-[110px_1fr] gap-y-1.5 text-sm">
        <dt className="text-muted-foreground text-xs">Type</dt>
        <dd className="capitalize">{m.method_type}</dd>

        {m.method_type === "bank" ? (
          <>
            <dt className="text-muted-foreground text-xs">Holder</dt>
            <dd>{m.account_holder_name}</dd>
            <dt className="text-muted-foreground text-xs">Bank</dt>
            <dd>{m.bank_name}</dd>
            <dt className="text-muted-foreground text-xs">Account</dt>
            <dd className="font-mono">•••• {m.account_number_last4}</dd>
            <dt className="text-muted-foreground text-xs">IFSC</dt>
            <dd className="font-mono">{m.ifsc}</dd>
            <dt className="text-muted-foreground text-xs">Type</dt>
            <dd className="capitalize">{m.account_type}</dd>
          </>
        ) : (
          <>
            <dt className="text-muted-foreground text-xs">UPI ID</dt>
            <dd className="font-mono break-all">{m.upi_id}</dd>
          </>
        )}
      </dl>

      {m.rejection_reason && (
        <p className="text-xs bg-red-500/5 text-red-600 border border-red-500/10 rounded-md p-2">
          <span className="font-medium">Reason:</span> {m.rejection_reason}
        </p>
      )}

      <div className="flex flex-wrap gap-2 pt-3 border-t border-border">
        <Button
          size="sm"
          disabled={busy !== null || m.verification_status === "verified"}
          onClick={() => runReview("approve")}
        >
          {busy === "approve" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Check className="h-3.5 w-3.5 mr-1" /> Approve</>}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy !== null}
          onClick={() => setDialog("request_update")}
        >
          <MessageSquareWarning className="h-3.5 w-3.5 mr-1" /> Request update
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-red-600 hover:text-red-600"
          disabled={busy !== null || m.verification_status === "rejected"}
          onClick={() => setDialog("reject")}
        >
          <X className="h-3.5 w-3.5 mr-1" /> Reject
        </Button>
      </div>

      <Dialog open={dialog !== null} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialog === "reject" ? "Reject payout account" : "Request updated info"}
            </DialogTitle>
            <DialogDescription>
              This message is sent to the user and recorded in audit logs.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={dialog === "reject" ? "Why is this account being rejected?" : "What info does the user need to update?"}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialog(null)}>Cancel</Button>
            <Button
              onClick={() => dialog && runReview(dialog, reason)}
              disabled={reason.trim().length < 3 || busy !== null}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusBadge({ status, isDefault }: { status: PayoutRow["verification_status"]; isDefault: boolean }) {
  return (
    <div className="flex flex-col items-end gap-1">
      <Badge
        variant="secondary"
        className={cn(
          "text-[10px]",
          status === "verified" && "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
          status === "rejected" && "bg-red-500/10 text-red-600 border-red-500/20",
          status === "pending" && "bg-amber-500/10 text-amber-600 border-amber-500/20",
        )}
      >
        {status === "verified" ? "Verified" : status === "rejected" ? "Rejected" : "Pending"}
      </Badge>
      {isDefault && (
        <Badge variant="outline" className="text-[10px]">Default</Badge>
      )}
    </div>
  );
}

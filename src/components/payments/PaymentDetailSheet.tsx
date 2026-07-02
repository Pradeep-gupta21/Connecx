// Payment detail slide-over. Shows the full fee breakdown and timeline
// derived from the payment row + optional linked contract/withdrawal.
import { useQuery } from "@tanstack/react-query";
import { Copy, Receipt, ShieldCheck } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Money } from "./Money";
import { PaymentStatusBadge } from "./PaymentStatusBadge";
import { PaymentTimeline } from "./PaymentTimeline";

export function PaymentDetailSheet({
  open,
  onOpenChange,
  payment,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  payment: any | null;
}) {
  const contractQ = useQuery({
    queryKey: ["payment-contract", payment?.contract_id, payment?.campaign_id],
    enabled: open && !!payment && (!!payment.contract_id || !!payment.campaign_id),
    queryFn: async () => {
      let query = supabase
        .from("contracts")
        .select("id, status, submitted_at, reviewed_at, created_at, campaign_id, creator_id, advertiser_id");
      query = payment!.contract_id
        ? query.eq("id", payment!.contract_id)
        : query.eq("campaign_id", payment!.campaign_id!);
      const { data } = await query.maybeSingle();
      return data;
    },
  });

  const currency = payment?.currency ?? "INR";


  const copy = (v?: string | null) => {
    if (!v) return;
    void navigator.clipboard.writeText(v);
    toast.success("Copied");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="text-left">
          <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <Receipt className="h-3.5 w-3.5" /> Payment detail
          </div>
          <SheetTitle className="font-display text-2xl">
            <Money value={payment?.amount} currency={currency} />
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

            <div>
              <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Lifecycle
              </p>
              <PaymentTimeline
                payment={payment}
                contract={contractQ.data ?? null}
                withdrawal={null}
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

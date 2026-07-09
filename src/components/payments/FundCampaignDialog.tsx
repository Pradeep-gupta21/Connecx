import { useState } from "react";
import { Loader2, ShieldCheck, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { useFeePreview, useFundCampaign } from "@/hooks/usePayments";

function inr(n: number) {
  return `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export function FundCampaignDialog({
  campaignId, campaignTitle, budget, feePct, gstPct, disabled,
}: {
  campaignId: string;
  campaignTitle: string;
  budget: number;
  feePct?: number;
  gstPct?: number;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const preview = useFeePreview(budget, feePct ?? 10, gstPct ?? 18);
  const fund = useFundCampaign(campaignTitle);

  const b = preview.data;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" disabled={disabled} className="gap-2">
          <Wallet className="h-4 w-4" /> Fund campaign
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Purchase campaign "{campaignTitle}"</DialogTitle>
          <DialogDescription>
            Your payment activates the campaign. Creator earnings are approved for payout only after you sign off on the deliverables.
          </DialogDescription>
        </DialogHeader>

        <div className="surface-card p-4 space-y-2 text-sm">
          {!b ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Calculating…
            </div>
          ) : (
            <>
              <Row label="Campaign budget" value={inr(b.subtotal)} />
              <Row label={`Platform fee (${b.platform_fee_pct}%)`} value={inr(b.platform_fee)} />
              <Row label={`GST (${b.gst_pct}%)`} value={inr(b.gst)} />
              <div className="my-2 border-t border-border" />
              <Row label="Total payable" value={inr(b.total_payable)} bold />
              <Row label="Creator earnings" value={inr(b.creator_earnings)} muted />
            </>
          )}
        </div>

        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <p>Secured by Razorpay. Your funds stay in escrow until you release them.</p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            disabled={!b || fund.isPending}
            onClick={async () => {
              try {
                await fund.mutateAsync(campaignId);
                setOpen(false);
              } catch { /* toast already shown */ }
            }}
          >
            {fund.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : b ? `Pay ${inr(b.total_payable)}` : "Continue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value, bold, muted }: { label: string; value: string; bold?: boolean; muted?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${muted ? "text-muted-foreground" : ""}`}>
      <span className={bold ? "font-medium" : ""}>{label}</span>
      <span className={`font-mono tabular-nums ${bold ? "font-semibold" : ""}`}>{value}</span>
    </div>
  );
}

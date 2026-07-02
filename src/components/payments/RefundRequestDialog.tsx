// Advertiser refund request. Only surfaced for payments still in escrow
// (held / revision_requested) — released funds cannot be pulled back.
import { useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Money } from "./Money";
import { useRefund } from "@/hooks/useWallet";

export function RefundRequestDialog({
  open,
  onOpenChange,
  paymentId,
  amount,
  currency = "INR",
  campaignTitle,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  paymentId: string;
  amount: number;
  currency?: string;
  campaignTitle?: string;
}) {
  const [reason, setReason] = useState("");
  const [step, setStep] = useState<"form" | "success">("form");
  const refund = useRefund();

  const submit = async () => {
    try {
      await refund.mutateAsync({ paymentId, amount, reason: reason || undefined });
      setStep("success");
    } catch {
      /* toast already surfaced by mutation */
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) setTimeout(() => { setStep("form"); setReason(""); }, 200);
      }}
    >
      <DialogContent className="max-w-md">
        {step === "form" ? (
          <>
            <DialogHeader>
              <div className="mb-2 grid h-10 w-10 place-items-center rounded-full bg-warning/10 text-warning">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <DialogTitle>Request refund</DialogTitle>
              <DialogDescription>
                Return <Money value={amount} currency={currency} /> from the escrow held for{" "}
                <span className="font-medium text-foreground">{campaignTitle ?? "this campaign"}</span>.
                An admin will review before processing.
              </DialogDescription>
            </DialogHeader>

            <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Reason
            </label>
            <Textarea
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Tell the admin why this campaign should be refunded (optional but recommended)."
            />

            <DialogFooter>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={submit} disabled={refund.isPending}>
                {refund.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Request refund"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <div className="px-2 py-8 text-center">
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 320, damping: 22 }}
              className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-success/15 text-success"
            >
              <Check className="h-6 w-6" strokeWidth={2.5} />
            </motion.div>
            <h3 className="font-display text-lg font-semibold">Refund submitted</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              We've notified the admin team. You'll receive an update once it's reviewed.
            </p>
            <Button className="mt-6" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

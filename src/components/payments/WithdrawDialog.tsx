// Creator withdrawal request. Split out of the payments page so we can
// re-use it from the wallet hero and from empty states.
import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, Building2, Check, Landmark, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Money, formatMoney } from "./Money";
import { useWithdrawal } from "@/hooks/useWallet";
import { cn } from "@/lib/utils";

export function WithdrawDialog({
  available,
  currency = "INR",
  trigger,
}: {
  available: number;
  currency?: string;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"form" | "success">("form");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"bank_transfer" | "upi">("bank_transfer");
  const [name, setName] = useState("");
  const [account, setAccount] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [upi, setUpi] = useState("");
  const wd = useWithdrawal();

  const amt = Number(amount);
  const validBank = name.trim().length >= 2 && account.length >= 6 && ifsc.length >= 8;
  const validUpi = /^[a-zA-Z0-9._-]+@[a-zA-Z]{2,}$/.test(upi);
  const canSubmit =
    amt > 0 && amt <= available && (method === "upi" ? validUpi : validBank) && !wd.isPending;

  const reset = () => {
    setStep("form");
    setAmount("");
    setName("");
    setAccount("");
    setIfsc("");
    setUpi("");
  };

  const submit = async () => {
    try {
      const destination =
        method === "upi"
          ? { vpa: upi }
          : { account_holder_name: name, account_number: account, ifsc };
      await wd.mutateAsync({ amount: amt, method, destination });
      setStep("success");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Withdrawal failed");
    }
  };

  const quick = [0.25, 0.5, 1].map((frac) => Math.floor(available * frac));

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setTimeout(reset, 200);
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button className="gap-2" disabled={available <= 0}>
            <ArrowUpRight className="h-4 w-4" /> Withdraw
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        {step === "form" ? (
          <>
            <DialogHeader className="px-6 pt-6">
              <DialogTitle>Withdraw funds</DialogTitle>
              <DialogDescription>
                Available balance{" "}
                <span className="font-mono text-foreground">{formatMoney(available, currency)}</span>{" "}
                · Payouts typically settle in 1–2 business days.
              </DialogDescription>
            </DialogHeader>

            <div className="px-6 pb-6 pt-2 space-y-5">
              <div>
                <label
                  htmlFor="wd-amount"
                  className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
                >
                  Amount
                </label>
                <div className="mt-1.5 relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                    ₹
                  </span>
                  <Input
                    id="wd-amount"
                    inputMode="decimal"
                    className="pl-7 h-11 font-mono text-base"
                    placeholder="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                  />
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {quick.map((v, i) => (
                    <button
                      key={i}
                      type="button"
                      disabled={v <= 0}
                      onClick={() => setAmount(String(v))}
                      className={cn(
                        "text-[11px] font-medium rounded-md border border-border/60 px-2 py-1 tabular-nums",
                        "hover:bg-secondary transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
                      )}
                    >
                      {["25%", "50%", "Max"][i]} · {formatMoney(v, currency, { compact: true })}
                    </button>
                  ))}
                </div>
                {amt > available && (
                  <p className="mt-2 text-xs text-destructive">
                    Amount exceeds available balance
                  </p>
                )}
              </div>

              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-2">
                  Destination
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <MethodTile
                    active={method === "bank_transfer"}
                    onClick={() => setMethod("bank_transfer")}
                    icon={Landmark}
                    title="Bank transfer"
                    subtitle="IMPS / NEFT"
                  />
                  <MethodTile
                    active={method === "upi"}
                    onClick={() => setMethod("upi")}
                    icon={Building2}
                    title="UPI"
                    subtitle="Instant"
                  />
                </div>
              </div>

              {method === "bank_transfer" ? (
                <div className="grid gap-2">
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Account holder name"
                  />
                  <Input
                    value={account}
                    onChange={(e) => setAccount(e.target.value.replace(/\s/g, ""))}
                    placeholder="Account number"
                    inputMode="numeric"
                  />
                  <Input
                    value={ifsc}
                    onChange={(e) => setIfsc(e.target.value.toUpperCase().replace(/\s/g, ""))}
                    placeholder="IFSC code"
                    className="font-mono"
                  />
                </div>
              ) : (
                <Input
                  value={upi}
                  onChange={(e) => setUpi(e.target.value.trim())}
                  placeholder="name@bank"
                  className="font-mono"
                  autoCapitalize="none"
                />
              )}

              <p className="flex items-start gap-2 text-[11px] text-muted-foreground border-t border-border/60 pt-3">
                <ShieldCheck className="h-3.5 w-3.5 mt-px flex-shrink-0" />
                Destination details are never stored in plaintext and are only used to
                initiate this payout.
              </p>
            </div>

            <DialogFooter className="border-t border-border/60 bg-secondary/30 px-6 py-3">
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={submit} disabled={!canSubmit}>
                {wd.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>Request withdrawal</>
                )}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <div className="px-6 py-10 text-center">
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 320, damping: 22 }}
              className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full bg-success/15 text-success"
            >
              <Check className="h-7 w-7" strokeWidth={2.5} />
            </motion.div>
            <h3 className="font-display text-lg font-semibold">Withdrawal requested</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              <Money value={amt} currency={currency} /> is queued for admin review.
              You'll be notified when the payout is processed.
            </p>
            <Button className="mt-6" onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function MethodTile({
  active,
  onClick,
  icon: Icon,
  title,
  subtitle,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "text-left rounded-xl border p-3 transition-all",
        active
          ? "border-accent bg-accent/5 ring-2 ring-accent/30"
          : "border-border bg-background hover:border-foreground/20 hover:bg-secondary/30",
      )}
    >
      <Icon className="h-4 w-4 mb-1.5 text-muted-foreground" />
      <div className="text-sm font-medium leading-none">{title}</div>
      <div className="text-[11px] text-muted-foreground mt-1">{subtitle}</div>
    </button>
  );
}

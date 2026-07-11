// Creator withdrawal request. Uses saved & verified payout methods only —
// admin verifies every account before payouts are allowed.
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import {
  ArrowUpRight,
  Check,
  Landmark,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Star,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
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
import { Badge } from "@/components/ui/badge";
import { Money, formatMoney } from "./Money";
import { useWithdrawal } from "@/hooks/useWallet";
import { useAuth } from "@/hooks/useAuth";
import { supabase as supabaseTyped } from "@/integrations/supabase/client";
import { MIN_WITHDRAWAL_INR } from "@/lib/constants";
import { cn } from "@/lib/utils";

const supabase = supabaseTyped as unknown as {
  from: (t: string) => {
    select: (s: string) => {
      eq: (c: string, v: string) => {
        order: (c: string, o?: { ascending?: boolean }) => Promise<{ data: PayoutMethod[] | null; error: { message: string } | null }>;
      };
    };
    update: (v: Record<string, unknown>) => { eq: (c: string, v: string) => Promise<{ error: { message: string } | null }> };
  };
};

interface PayoutMethod {
  id: string;
  method_type: "bank" | "upi";
  account_holder_name: string | null;
  bank_name: string | null;
  account_number_last4: string | null;
  ifsc: string | null;
  account_type: "savings" | "current" | null;
  upi_id: string | null;
  is_default: boolean;
  verification_status: "pending" | "verified" | "rejected";
}

export function WithdrawDialog({
  available,
  currency = "INR",
  trigger,
}: {
  available: number;
  currency?: string;
  trigger?: React.ReactNode;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"form" | "success">("form");
  const [amount, setAmount] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);
  const wd = useWithdrawal();

  const { data: methods = [], isLoading, refetch } = useQuery({
    queryKey: ["payout_methods", user?.id],
    enabled: !!user && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payout_methods")
        .select(
          "id, method_type, account_holder_name, bank_name, account_number_last4, ifsc, account_type, upi_id, is_default, verification_status",
        )
        .eq("user_id", user!.id)
        .order("is_default", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const verified = useMemo(() => methods.filter((m) => m.verification_status === "verified"), [methods]);
  const defaultMethod = verified.find((m) => m.is_default) ?? verified[0] ?? null;
  const active = verified.find((m) => m.id === selectedId) ?? defaultMethod;

  const amt = Number(amount);
  const meetsMin = amt >= MIN_WITHDRAWAL_INR;
  const canSubmit = !!active && meetsMin && amt <= available && !wd.isPending;

  const reset = () => {
    setStep("form");
    setAmount("");
    setSelectedId(null);
    setChanging(false);
  };

  const submit = async () => {
    if (!active) return;
    try {
      await wd.mutateAsync({ amount: amt, payoutMethodId: active.id });
      setStep("success");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Withdrawal failed");
    }
  };

  const setAsDefault = async (id: string) => {
    const { error } = await supabase.from("payout_methods").update({ is_default: true }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Default payout account updated");
    setSelectedId(id);
    setChanging(false);
    refetch();
  };

  const quick = [0.25, 0.5, 1].map((frac) => frac === 1 ? available : Math.floor(available * frac));

  const hasVerified = verified.length > 0;
  const hasAny = methods.length > 0;

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
        {step === "success" ? (
          <SuccessView amt={amt} currency={currency} onClose={() => setOpen(false)} />
        ) : isLoading ? (
          <div className="p-10 flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !hasVerified ? (
          <NoVerifiedView
            hasAny={hasAny}
            pending={methods.some((m) => m.verification_status === "pending")}
            rejected={methods.some((m) => m.verification_status === "rejected")}
            onClose={() => setOpen(false)}
          />
        ) : (
          <>
            <DialogHeader className="px-6 pt-6">
              <DialogTitle>Withdraw funds</DialogTitle>
              <DialogDescription>
                Available balance{" "}
                <span className="font-mono text-foreground">{formatMoney(available, currency)}</span>{" "}
                · Payouts typically settle in 1–2 business days after admin approval.
              </DialogDescription>
            </DialogHeader>

            <div className="px-6 pb-6 pt-2 space-y-5">
              {/* Amount */}
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
                {amt > 0 && !meetsMin && (
                  <p className="mt-2 text-xs text-destructive">
                    Minimum withdrawal is {formatMoney(MIN_WITHDRAWAL_INR, currency)}
                  </p>
                )}
                {amt > available && (
                  <p className="mt-2 text-xs text-destructive">Amount exceeds available balance</p>
                )}
              </div>

              {/* Payout account picker */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Payout account
                  </p>
                  {verified.length > 1 && !changing && (
                    <button
                      type="button"
                      onClick={() => setChanging(true)}
                      className="text-xs text-primary hover:underline"
                    >
                      Change
                    </button>
                  )}
                </div>

                {!changing && active ? (
                  <PayoutRow m={active} selected />
                ) : (
                  <div className="space-y-2">
                    {verified.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setAsDefault(m.id)}
                        className="w-full text-left"
                      >
                        <PayoutRow m={m} selected={m.id === active?.id} interactive />
                      </button>
                    ))}
                    <p className="text-[11px] text-muted-foreground">
                      Selecting an account sets it as your default.
                    </p>
                  </div>
                )}
              </div>

              {/* Summary */}
              <div className="rounded-lg border border-border/60 bg-secondary/30 p-3 text-sm space-y-1.5">
                <SummaryRow label="Amount" value={formatMoney(amt || 0, currency)} />
                <SummaryRow
                  label="Destination"
                  value={
                    active
                      ? active.method_type === "bank"
                        ? `${active.bank_name} •••• ${active.account_number_last4}`
                        : active.upi_id ?? ""
                      : "—"
                  }
                />
                <SummaryRow label="Estimated processing" value="1–2 business days" />
              </div>

              <p className="flex items-start gap-2 text-[11px] text-muted-foreground border-t border-border/60 pt-3">
                <ShieldCheck className="h-3.5 w-3.5 mt-px flex-shrink-0" />
                Only verified payout accounts can receive funds. Admins review every withdrawal.
              </p>
            </div>

            <DialogFooter className="border-t border-border/60 bg-secondary/30 px-6 py-3">
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={submit} disabled={!canSubmit}>
                {wd.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Request withdrawal</>}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PayoutRow({ m, selected, interactive }: { m: PayoutMethod; selected?: boolean; interactive?: boolean }) {
  const Icon = m.method_type === "bank" ? Landmark : Smartphone;
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border p-3 transition-all",
        selected
          ? "border-accent bg-accent/5 ring-2 ring-accent/30"
          : interactive
          ? "border-border hover:border-foreground/20 hover:bg-secondary/30"
          : "border-border",
      )}
    >
      <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center text-primary shrink-0">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium truncate">
            {m.method_type === "bank" ? m.bank_name || "Bank account" : "UPI"}
          </span>
          {m.is_default && (
            <Badge variant="outline" className="text-[10px] h-4 px-1">
              <Star className="h-2.5 w-2.5 mr-0.5 fill-current" /> Default
            </Badge>
          )}
          <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px] h-4">
            Verified
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground truncate">
          {m.method_type === "bank"
            ? `${m.account_holder_name} · •••• ${m.account_number_last4} · ${m.ifsc}`
            : m.upi_id}
        </p>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-medium text-right truncate">{value}</span>
    </div>
  );
}

function NoVerifiedView({
  hasAny,
  pending,
  rejected,
  onClose,
}: {
  hasAny: boolean;
  pending: boolean;
  rejected: boolean;
  onClose: () => void;
}) {
  return (
    <div className="p-8 text-center space-y-4">
      <div className="mx-auto h-12 w-12 rounded-full bg-amber-500/10 text-amber-600 grid place-items-center">
        {pending ? <Clock className="h-6 w-6" /> : <ShieldAlert className="h-6 w-6" />}
      </div>
      <div className="space-y-1">
        <h3 className="font-display text-lg font-semibold">
          {hasAny ? "Payout account not verified" : "No payout account yet"}
        </h3>
        <p className="text-sm text-muted-foreground">
          {pending
            ? "Your payout account is under admin review. You'll be able to withdraw once it's verified."
            : rejected
            ? "Your last payout account was rejected. Please add updated information."
            : "Please add and verify a payout account before requesting a withdrawal."}
        </p>
      </div>
      <div className="flex gap-2 justify-center pt-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button asChild onClick={onClose}>
          <Link to="/settings">Go to Payout Methods</Link>
        </Button>
      </div>
    </div>
  );
}

function SuccessView({ amt, currency, onClose }: { amt: number; currency: string; onClose: () => void }) {
  return (
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
        <Money value={amt} currency={currency} /> is queued for admin review. You'll be notified once
        the payout is processed.
      </p>
      <Button className="mt-6" onClick={onClose}>Done</Button>
    </div>
  );
}

// Payment lifecycle timeline. Derives the 7-step escrow flow from a payment
// row (+ optional linked contract) and animates transitions on state change.
import { motion } from "framer-motion";
import { format } from "date-fns";
import {
  Wallet,
  ShieldCheck,
  Handshake,
  Upload,
  BadgeCheck,
  Coins,
  Banknote,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type TimelinePayment = {
  status_v2?: string | null;
  processed_at?: string | null;
  created_at?: string | null;
};

export type TimelineContract = {
  status?: string | null;
  created_at?: string | null;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  completed_at?: string | null;
} | null;

export type TimelineWithdrawal = {
  status?: string | null;
  completed_at?: string | null;
  approved_at?: string | null;
  created_at?: string | null;
} | null;

type StepKey =
  | "payment"
  | "protected"
  | "accepted"
  | "submitted"
  | "approved"
  | "released"
  | "withdrawn";

type Step = {
  key: StepKey;
  label: string;
  helper: string;
  icon: typeof Wallet;
  done: boolean;
  active: boolean;
  at?: string | null;
};

const PAID_STATUSES = new Set([
  "paid",
  "held",
  "revision_requested",
  "released",
  "withdrawal_requested",
  "withdrawn",
]);
const PROTECTED_STATUSES = new Set([
  "held",
  "revision_requested",
  "released",
  "withdrawal_requested",
  "withdrawn",
]);
const RELEASED_STATUSES = new Set(["released", "withdrawal_requested", "withdrawn"]);

export function buildTimeline(
  payment: TimelinePayment,
  contract: TimelineContract = null,
  withdrawal: TimelineWithdrawal = null,
): Step[] {
  const status = payment.status_v2 ?? "";
  const paid = PAID_STATUSES.has(status);
  const released = RELEASED_STATUSES.has(status);
  const withdrawn = status === "withdrawn";

  const cStatus = contract?.status ?? "";
  const accepted = !!contract;
  const paymentSecured = paid || ["active", "submitted", "revision_requested", "approved", "completed"].includes(cStatus);
  const submitted =
    !!contract?.submitted_at ||
    ["submitted", "revision_requested", "approved", "completed"].includes(cStatus);
  const approved =
    ["approved", "completed"].includes(cStatus) || released;

  const steps: Step[] = [
    {
      key: "accepted",
      label: "Creator assigned",
      helper: "Advertiser accepted the creator pitch",
      icon: Handshake,
      done: accepted,
      active: accepted && !paymentSecured,
      at: contract?.created_at ?? null,
    },
    {
      key: "payment",
      label: "Payment secured",
      helper: "Advertiser secured campaign budget",
      icon: Wallet,
      done: paymentSecured,
      active: paymentSecured && !submitted,
      at: payment.processed_at ?? payment.created_at ?? null,
    },
    {
      key: "submitted",
      label: "Deliverables submitted",
      helper: "Creator uploaded campaign work",
      icon: Upload,
      done: submitted,
      active: submitted && !approved,
      at: contract?.submitted_at ?? null,
    },
    {
      key: "approved",
      label: "Approved by advertiser",
      helper: "Advertiser approved deliverables",
      icon: BadgeCheck,
      done: approved,
      active: approved && !released,
      at: contract?.reviewed_at ?? null,
    },
    {
      key: "released",
      label: "Funds released",
      helper: "Admin released secured payment to wallet",
      icon: Coins,
      done: released,
      active: released && !withdrawn,
      at: contract?.completed_at ?? null,
    },
    {
      key: "withdrawn",
      label: "Payout completed",
      helper: withdrawal?.status === "processing" ? "Payout transfer in progress" : "Transfer completed to bank/UPI",
      icon: Banknote,
      done: withdrawn || withdrawal?.status === "completed",
      active: withdrawal?.status === "processing" || withdrawal?.status === "approved",
      at: withdrawal?.completed_at ?? withdrawal?.approved_at ?? withdrawal?.created_at ?? null,
    },
  ];
  return steps;
}

export function PaymentTimeline({
  payment,
  contract = null,
  withdrawal = null,
  className,
}: {
  payment: TimelinePayment;
  contract?: TimelineContract;
  withdrawal?: TimelineWithdrawal;
  className?: string;
}) {
  const steps = buildTimeline(payment, contract, withdrawal);
  return (
    <ol
      className={cn("relative space-y-5", className)}
      aria-label="Payment lifecycle"
    >
      {steps.map((step, i) => {
        const Icon = step.icon;
        const isLast = i === steps.length - 1;
        return (
          <li key={step.key} className="relative flex gap-4 pl-1">
            {!isLast && (
              <span
                aria-hidden
                className={cn(
                  "absolute left-[19px] top-9 h-[calc(100%_-_1rem)] w-px",
                  step.done && steps[i + 1].done
                    ? "bg-gradient-to-b from-success/60 to-success/20"
                    : step.done
                      ? "bg-gradient-to-b from-success/60 to-border"
                      : "bg-border/60",
                )}
              />
            )}
            <motion.div
              layout
              initial={false}
              animate={{
                scale: step.active ? 1.02 : 1,
                boxShadow: step.active
                  ? "0 0 0 4px hsl(var(--accent) / 0.12)"
                  : "0 0 0 0 hsl(var(--accent) / 0)",
              }}
              transition={{ type: "spring", stiffness: 260, damping: 24 }}
              className={cn(
                "relative z-10 grid h-10 w-10 flex-shrink-0 place-items-center rounded-full border transition-colors",
                step.done
                  ? "border-success/40 bg-success/10 text-success"
                  : step.active
                    ? "border-accent/40 bg-accent/10 text-accent"
                    : "border-border bg-muted/40 text-muted-foreground",
              )}
              aria-current={step.active ? "step" : undefined}
            >
              {step.done ? <Check className="h-4 w-4" strokeWidth={2.5} /> : <Icon className="h-4 w-4" />}
            </motion.div>
            <div className="flex-1 min-w-0 pt-1 pb-1">
              <div className="flex items-baseline justify-between gap-3 flex-wrap">
                <p
                  className={cn(
                    "text-sm font-medium",
                    step.done || step.active ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {step.label}
                </p>
                {step.at && (step.done || step.active) && (
                  <time className="text-[11px] font-mono text-muted-foreground tabular-nums">
                    {format(new Date(step.at), "MMM d · h:mm a")}
                  </time>
                )}
              </div>
              <p className="text-xs text-muted-foreground/80 mt-0.5">{step.helper}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Compact horizontal variant for row hover/preview. */
export function PaymentTimelineCompact({
  payment,
  contract = null,
  withdrawal = null,
  className,
}: {
  payment: TimelinePayment;
  contract?: TimelineContract;
  withdrawal?: TimelineWithdrawal;
  className?: string;
}) {
  const steps = buildTimeline(payment, contract, withdrawal);
  return (
    <div
      className={cn("flex items-center gap-1.5", className)}
      role="group"
      aria-label="Payment progress"
    >
      {steps.map((s, i) => (
        <div
          key={s.key}
          className={cn(
            "h-1.5 flex-1 rounded-full transition-colors",
            s.done ? "bg-success" : s.active ? "bg-accent/70" : "bg-border/70",
          )}
          title={s.label}
          style={{ animationDelay: `${i * 40}ms` }}
        />
      ))}
    </div>
  );
}

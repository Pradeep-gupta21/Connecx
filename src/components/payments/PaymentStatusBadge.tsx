// Unified status pills for payments, withdrawals, refunds, and contracts.
// One source of truth so tone, dot, label, and dark-mode contrast stay consistent.
import { cn } from "@/lib/utils";

type Tone = "neutral" | "warning" | "info" | "success" | "danger" | "muted";

const TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-secondary text-secondary-foreground border-border/60",
  warning: "bg-warning/10 text-warning border-warning/30",
  info: "bg-accent/10 text-accent border-accent/25",
  success: "bg-success/10 text-success border-success/25",
  danger: "bg-destructive/10 text-destructive border-destructive/25",
  muted: "bg-muted/50 text-muted-foreground border-border/60",
};

const DOT_CLASSES: Record<Tone, string> = {
  neutral: "bg-muted-foreground",
  warning: "bg-warning",
  info: "bg-accent",
  success: "bg-success",
  danger: "bg-destructive",
  muted: "bg-muted-foreground/50",
};

type Meta = { label: string; tone: Tone };

const PAYMENT_META: Record<string, Meta> = {
  pending: { label: "Pending", tone: "warning" },
  paid: { label: "Paid", tone: "info" },
  held: { label: "Protected", tone: "info" },
  revision_requested: { label: "Revision requested", tone: "warning" },
  released: { label: "Released", tone: "success" },
  withdrawal_requested: { label: "Withdrawal pending", tone: "warning" },
  withdrawn: { label: "Withdrawn", tone: "success" },
  refund_pending: { label: "Refund pending", tone: "warning" },
  refunded: { label: "Refunded", tone: "muted" },
  cancelled: { label: "Cancelled", tone: "muted" },
  failed: { label: "Failed", tone: "danger" },
  succeeded: { label: "Succeeded", tone: "success" },
  processing: { label: "Processing", tone: "info" },
};

const WITHDRAWAL_META: Record<string, Meta> = {
  requested: { label: "Awaiting review", tone: "warning" },
  approved: { label: "Approved", tone: "info" },
  processing: { label: "Processing", tone: "info" },
  completed: { label: "Completed", tone: "success" },
  rejected: { label: "Rejected", tone: "danger" },
  failed: { label: "Failed", tone: "danger" },
  cancelled: { label: "Cancelled", tone: "muted" },
};

const CONTRACT_META: Record<string, Meta> = {
  draft: { label: "Draft", tone: "muted" },
  active: { label: "Active", tone: "info" },
  submitted: { label: "Under review", tone: "warning" },
  revision_requested: { label: "Revision", tone: "warning" },
  approved: { label: "Approved", tone: "success" },
  completed: { label: "Completed", tone: "success" },
  cancelled: { label: "Cancelled", tone: "muted" },
};

const REFUND_META: Record<string, Meta> = {
  pending: { label: "Pending", tone: "warning" },
  processing: { label: "Processing", tone: "info" },
  completed: { label: "Refunded", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
};

export type StatusKind = "payment" | "withdrawal" | "contract" | "refund";

const KIND_META: Record<StatusKind, Record<string, Meta>> = {
  payment: PAYMENT_META,
  withdrawal: WITHDRAWAL_META,
  contract: CONTRACT_META,
  refund: REFUND_META,
};

export function PaymentStatusBadge({
  status,
  kind = "payment",
  size = "sm",
  className,
}: {
  status: string | null | undefined;
  kind?: StatusKind;
  size?: "sm" | "md";
  className?: string;
}) {
  const key = (status ?? "").toString();
  const meta =
    KIND_META[kind][key] ?? { label: key.replace(/_/g, " ") || "—", tone: "neutral" as const };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        TONE_CLASSES[meta.tone],
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", DOT_CLASSES[meta.tone])} aria-hidden />
      <span className="capitalize leading-none">{meta.label}</span>
    </span>
  );
}

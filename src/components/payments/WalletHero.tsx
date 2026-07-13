// Premium wallet hero for creators. Animated balance, held/withdrawn context,
// and inline CTA. Designed to feel like the top of a Stripe balance page.
import { motion } from "framer-motion";
import { ArrowUpRight, ShieldCheck, TrendingUp, Wallet } from "lucide-react";
import { AnimatedNumber } from "@/components/common/AnimatedNumber";
import { Money, formatMoney } from "./Money";
import { WithdrawDialog } from "./WithdrawDialog";
import { Button } from "@/components/ui/button";

type Snapshot = {
  available_balance: number;
  held_balance: number;
  withdrawn_balance: number;
  lifetime_earned: number;
  currency?: string;
} | null | undefined;

export function WalletHero({ wallet }: { wallet: Snapshot }) {
  const currency = wallet?.currency ?? "INR";
  const available = wallet?.available_balance ?? 0;
  const held = wallet?.held_balance ?? 0;
  const withdrawn = wallet?.withdrawn_balance ?? 0;
  const lifetime = wallet?.lifetime_earned ?? 0;

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-secondary/40 via-background to-background p-6 md:p-8"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -right-32 h-72 w-72 rounded-full bg-accent/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -left-24 h-72 w-72 rounded-full bg-success/10 blur-3xl"
      />

      <div className="relative grid gap-8 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            <Wallet className="h-3.5 w-3.5" />
            Available balance
          </div>
          <div className="mt-3 font-display text-5xl md:text-6xl font-semibold tracking-tight tabular-nums">
            <AnimatedNumber
              value={available}
              format={(v) => formatMoney(v, currency, { showZero: true })}
            />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Lifetime earned{" "}
            <span className="font-medium text-foreground/80">
              <Money value={lifetime} currency={currency} />
            </span>
          </p>
        </div>

        <div className="flex flex-col items-start md:items-end gap-3">
          <WithdrawDialog available={available} currency={currency} />
          {available <= 0 && (
            <p className="text-[11px] text-muted-foreground max-w-[220px] md:text-right">
              You'll be able to withdraw once a campaign releases funds to your wallet.
            </p>
          )}
        </div>
      </div>

      <div className="relative mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <MiniStat
          icon={ShieldCheck}
          label="Pending earnings"
          value={<Money value={held} currency={currency} />}
          helper="Awaiting advertiser approval"
        />
        <MiniStat
          icon={ArrowUpRight}
          label="Withdrawn"
          value={<Money value={withdrawn} currency={currency} />}
          helper="Paid out to bank / UPI"
        />
        <MiniStat
          icon={TrendingUp}
          label="Lifetime earned"
          value={<Money value={lifetime} currency={currency} />}
          helper="All-time creator revenue"
        />
      </div>
    </motion.section>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
  helper,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  helper: string;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/70 backdrop-blur-sm p-4">
      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-2 text-lg font-semibold tabular-nums">{value}</div>
      <div className="text-[11px] text-muted-foreground mt-0.5">{helper}</div>
    </div>
  );
}

/** Placeholder for the "empty wallet" state used before we have a snapshot. */
export function WalletHeroSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-secondary/20 p-8 animate-pulse">
      <div className="h-3 w-24 rounded bg-muted/60" />
      <div className="mt-4 h-12 w-48 rounded bg-muted/60" />
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-20 rounded-2xl bg-muted/40" />
        ))}
      </div>
    </div>
  );
}

/** Advertiser variant — same shell, spend framing. */
export function SpendHero({
  currency = "INR",
  totalSpent,
  protectedAmount,
  activeCount,
  refunded,
}: {
  currency?: string;
  totalSpent: number;
  protectedAmount: number;
  activeCount: number;
  refunded: number;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-secondary/40 via-background to-background p-6 md:p-8"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -right-32 h-72 w-72 rounded-full bg-accent/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -left-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl"
      />
      <div className="relative">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" />
          Active campaign spend
        </div>
        <div className="mt-3 font-display text-5xl md:text-6xl font-semibold tracking-tight tabular-nums">
          <AnimatedNumber
            value={protectedAmount}
            format={(v) => formatMoney(v, currency, { showZero: true })}
          />
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Across {activeCount} active campaign{activeCount === 1 ? "" : "s"} — creator earnings
          are approved once you sign off on the deliverables.
        </p>
      </div>

      <div className="relative mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <MiniStat
          icon={TrendingUp}
          label="Total spent"
          value={<Money value={totalSpent} currency={currency} />}
          helper="Across all campaigns"
        />
        <MiniStat
          icon={Wallet}
          label="Active campaigns"
          value={<Money value={protectedAmount} currency={currency} />}
          helper="Awaiting deliverable approval"
        />
        <MiniStat
          icon={ArrowUpRight}
          label="Refunded"
          value={<Money value={refunded} currency={currency} />}
          helper="Returned to your source"
        />
      </div>
    </motion.section>
  );
}

/** Small "New campaign" CTA used across advertiser payment surfaces. */
export function LinkButton({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Button asChild variant="outline">
      <a href={href}>{children}</a>
    </Button>
  );
}

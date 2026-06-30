import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  label: string;
  value: string | number;
  delta?: { value: number; label?: string } | null;
  icon?: LucideIcon;
  className?: string;
};

export function StatCard({ label, value, delta, icon: Icon, className }: Props) {
  const positive = delta ? delta.value >= 0 : null;
  return (
    <div
      className={cn(
        "surface-card p-5 transition-all duration-200 hover:shadow-elevated hover:-translate-y-px",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
        {Icon && (
          <div className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
      </div>
      <div className="mt-4 flex items-end justify-between">
        <div className="font-display text-3xl font-semibold tracking-tight tabular-nums">{value}</div>
        {delta && (
          <div
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium",
              positive
                ? "bg-success/10 text-success"
                : "bg-destructive/10 text-destructive"
            )}
          >
            {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {Math.abs(delta.value)}%
          </div>
        )}
      </div>
      {delta?.label && <p className="mt-1 text-xs text-muted-foreground">{delta.label}</p>}
    </div>
  );
}

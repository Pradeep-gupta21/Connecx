import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { AnimatedNumber } from "./AnimatedNumber";

type Props = {
  label: string;
  value: string | number;
  delta?: { value: number; label?: string } | null;
  icon?: LucideIcon;
  className?: string;
  format?: (v: number) => string;
};

export function StatCard({ label, value, delta, icon: Icon, className, format }: Props) {
  const positive = delta ? delta.value >= 0 : null;
  const numeric = typeof value === "number" ? value : null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -2 }}
      className={cn(
        "surface-card p-5 transition-shadow duration-200 hover:shadow-elevated",
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
        <div className="font-display text-3xl font-semibold tracking-tight tabular-nums">
          {numeric !== null ? <AnimatedNumber value={numeric} format={format} /> : value}
        </div>
        {delta && (
          <div
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium",
              positive ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
            )}
          >
            {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {Math.abs(delta.value)}%
          </div>
        )}
      </div>
      {delta?.label && <p className="mt-1 text-xs text-muted-foreground">{delta.label}</p>}
    </motion.div>
  );
}

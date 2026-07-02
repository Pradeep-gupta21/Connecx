import type { LucideIcon } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type Props = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void };
  className?: string;
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  className,
}: Props) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0, y: reduce ? 0 : 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "relative overflow-hidden flex flex-col items-center justify-center text-center py-20 px-6 rounded-2xl border border-dashed border-border bg-surface/40",
        className,
      )}
    >
      {/* Subtle backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(ellipse at 50% 0%, color-mix(in oklab, var(--color-accent) 10%, transparent), transparent 60%)",
        }}
      />
      {Icon && (
        <div className="relative mb-6">
          <div className="absolute inset-0 -m-2 rounded-2xl bg-accent/10 blur-md" />
          <div className="relative h-14 w-14 rounded-2xl bg-secondary border border-border flex items-center justify-center shadow-soft">
            <Icon className="h-6 w-6 text-foreground/70" aria-hidden />
          </div>
        </div>
      )}
      <h3 className="font-display text-xl font-semibold tracking-tight">{title}</h3>
      {description && (
        <p className="mt-2 text-sm text-muted-foreground max-w-md leading-relaxed">
          {description}
        </p>
      )}
      {(action || secondaryAction) && (
        <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
          {action && (
            <Button onClick={action.onClick} className="gap-1.5">
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button variant="ghost" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </motion.div>
  );
}

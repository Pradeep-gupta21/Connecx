import { cn } from "@/lib/utils";
export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <a href="/" className={cn("flex items-center gap-2", className)}>
      <div className="relative h-7 w-7 rounded-[8px] bg-foreground flex items-center justify-center">
        <span className="font-display text-[13px] font-bold tracking-tight text-background">C</span>
        <span className="absolute -right-0.5 -bottom-0.5 h-2 w-2 rounded-full bg-accent ring-2 ring-background" />
      </div>
      {!compact && (
        <span className="font-display text-[17px] font-semibold tracking-tight">Connecx</span>
      )}
    </a>
  );
}

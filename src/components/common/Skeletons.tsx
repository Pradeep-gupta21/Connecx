import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function Bar({ className }: { className?: string }) {
  return <Skeleton className={cn("shimmer", className)} />;
}

export function CardSkeleton() {
  return (
    <div className="surface-card p-5 space-y-4">
      <div className="flex items-center gap-3">
        <Bar className="h-10 w-10 rounded-full" />
        <div className="space-y-2 flex-1">
          <Bar className="h-3 w-1/3" />
          <Bar className="h-3 w-1/2" />
        </div>
      </div>
      <Bar className="h-20 w-full rounded-md" />
      <div className="flex gap-2">
        <Bar className="h-6 w-16 rounded-full" />
        <Bar className="h-6 w-20 rounded-full" />
      </div>
    </div>
  );
}

export function StatSkeleton() {
  return (
    <div className="surface-card p-5 space-y-4">
      <Bar className="h-3 w-20" />
      <Bar className="h-8 w-24" />
      <Bar className="h-2 w-32" />
    </div>
  );
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-1">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-lg">
          <Bar className="h-9 w-9 rounded-full" />
          <div className="flex-1 space-y-2">
            <Bar className="h-3 w-1/3" />
            <Bar className="h-3 w-1/2" />
          </div>
          <Bar className="h-6 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Bar className="h-8 w-64" />
        <Bar className="h-4 w-96" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <StatSkeleton />
        <StatSkeleton />
        <StatSkeleton />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  );
}

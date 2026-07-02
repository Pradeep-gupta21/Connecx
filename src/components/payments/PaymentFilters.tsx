// Reusable filter bar: search + status + date-range chip. Used across the
// creator, advertiser, and admin payment surfaces.
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type RangeKey = "7d" | "30d" | "90d" | "all";

const RANGE_LABEL: Record<RangeKey, string> = {
  "7d": "7 days",
  "30d": "30 days",
  "90d": "90 days",
  all: "All time",
};

export function PaymentFilters({
  search,
  onSearchChange,
  status,
  onStatusChange,
  statusOptions,
  range,
  onRangeChange,
  extra,
  placeholder = "Search by receipt, invoice, or ID…",
  className,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  status?: string;
  onStatusChange?: (v: string) => void;
  statusOptions?: { value: string; label: string }[];
  range?: RangeKey;
  onRangeChange?: (v: RangeKey) => void;
  extra?: React.ReactNode;
  placeholder?: string;
  className?: string;
}) {
  const active = !!search || (status && status !== "all") || (range && range !== "30d");
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <div className="relative min-w-[240px] flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={placeholder}
          className="pl-9 h-9"
          aria-label="Search"
        />
        {search && (
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => onSearchChange("")}
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {statusOptions && onStatusChange && (
        <Select value={status ?? "all"} onValueChange={onStatusChange}>
          <SelectTrigger className="h-9 w-[150px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {statusOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {onRangeChange && (
        <Select value={range ?? "30d"} onValueChange={(v) => onRangeChange(v as RangeKey)}>
          <SelectTrigger className="h-9 w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(RANGE_LABEL) as RangeKey[]).map((k) => (
              <SelectItem key={k} value={k}>
                {RANGE_LABEL[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {extra}

      {active && (onStatusChange || onRangeChange) && (
        <Button
          variant="ghost"
          size="sm"
          className="h-9 gap-1 text-muted-foreground"
          onClick={() => {
            onSearchChange("");
            onStatusChange?.("all");
            onRangeChange?.("30d");
          }}
        >
          <X className="h-3.5 w-3.5" /> Clear
        </Button>
      )}
    </div>
  );
}

export function withinRange(dateStr: string | null | undefined, range: RangeKey) {
  if (!dateStr || range === "all") return true;
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return new Date(dateStr).getTime() >= cutoff;
}

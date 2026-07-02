// Revenue chart for the admin monitor. Aggregates payment rows into a
// 30-day (or custom) area chart with GMV vs platform fee.
import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format, subDays, startOfDay, eachDayOfInterval } from "date-fns";
import { formatMoney } from "./Money";

type PaymentRow = {
  created_at: string;
  amount: number | string;
  platform_fee?: number | string | null;
  status_v2?: string | null;
  type?: string | null;
};

export function RevenueChart({
  rows,
  days = 30,
  currency = "INR",
}: {
  rows: PaymentRow[] | undefined;
  days?: number;
  currency?: string;
}) {
  const data = useMemo(() => {
    const end = startOfDay(new Date());
    const start = subDays(end, days - 1);
    const buckets: Record<string, { date: string; gmv: number; fees: number }> = {};
    eachDayOfInterval({ start, end }).forEach((d) => {
      const key = format(d, "yyyy-MM-dd");
      buckets[key] = { date: key, gmv: 0, fees: 0 };
    });
    (rows ?? []).forEach((r) => {
      if (!r.status_v2 || !["paid", "held", "released", "withdrawn", "withdrawal_requested"].includes(r.status_v2)) return;
      const d = new Date(r.created_at);
      if (d < start) return;
      const key = format(startOfDay(d), "yyyy-MM-dd");
      const b = buckets[key];
      if (!b) return;
      b.gmv += Number(r.amount ?? 0);
      b.fees += Number(r.platform_fee ?? 0);
    });
    return Object.values(buckets);
  }, [rows, days]);

  return (
    <div className="surface-card p-5 md:p-6">
      <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-display text-sm font-semibold">Gross volume</h3>
          <p className="text-xs text-muted-foreground">Last {days} days · captured + released</p>
        </div>
        <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-accent" /> GMV
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-success" /> Platform fee
          </span>
        </div>
      </div>
      <div className="h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
            <defs>
              <linearGradient id="gmv" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity={0.35} />
                <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="fees" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={0.3} />
                <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.4} />
            <XAxis
              dataKey="date"
              tickFormatter={(v) => format(new Date(v), "MMM d")}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
              minTickGap={24}
            />
            <YAxis
              tickFormatter={(v) => formatMoney(v, currency, { compact: true, showZero: true })}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
              width={72}
            />
            <Tooltip
              cursor={{ stroke: "hsl(var(--border))" }}
              contentStyle={{
                background: "hsl(var(--background))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 12,
                fontSize: 12,
                boxShadow: "0 8px 30px hsl(var(--foreground) / 0.06)",
              }}
              labelFormatter={(v) => format(new Date(v as string), "EEE, MMM d")}
              formatter={(value: number, name) => [
                formatMoney(value, currency, { showZero: true }),
                name === "gmv" ? "GMV" : "Platform fee",
              ]}
            />
            <Area
              type="monotone"
              dataKey="gmv"
              stroke="hsl(var(--accent))"
              strokeWidth={2}
              fill="url(#gmv)"
            />
            <Area
              type="monotone"
              dataKey="fees"
              stroke="hsl(var(--success))"
              strokeWidth={1.5}
              fill="url(#fees)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

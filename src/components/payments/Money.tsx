// Currency display primitive. Consistent formatting + tabular numerals.
import { cn } from "@/lib/utils";

const CURRENCY_LOCALE: Record<string, string> = {
  INR: "en-IN",
  USD: "en-US",
  EUR: "en-GB",
  GBP: "en-GB",
};

const CURRENCY_SYMBOL: Record<string, string> = {
  INR: "₹",
  USD: "$",
  EUR: "€",
  GBP: "£",
};

export function formatMoney(
  value: number | string | null | undefined,
  currency = "INR",
  opts: { compact?: boolean; showZero?: boolean } = {},
): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "—";
  if (!n && !opts.showZero && value !== 0 && value !== "0") return "—";
  const locale = CURRENCY_LOCALE[currency] ?? "en-IN";
  const symbol = CURRENCY_SYMBOL[currency] ?? "";
  const abs = Math.abs(n);
  if (opts.compact && abs >= 1000) {
    const formatter = new Intl.NumberFormat(locale, {
      notation: "compact",
      maximumFractionDigits: 1,
    });
    return `${symbol}${formatter.format(n)}`;
  }
  return `${symbol}${n.toLocaleString(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

export function Money({
  value,
  currency = "INR",
  className,
  compact,
  muted,
  sign,
}: {
  value: number | string | null | undefined;
  currency?: string;
  className?: string;
  compact?: boolean;
  muted?: boolean;
  /** Prefix +/− based on sign; "credit" always shows "+", "debit" always "−" */
  sign?: "auto" | "credit" | "debit";
}) {
  const n = Number(value ?? 0);
  let prefix = "";
  if (sign === "credit") prefix = "+";
  else if (sign === "debit") prefix = "−";
  else if (sign === "auto") prefix = n > 0 ? "+" : n < 0 ? "−" : "";
  const abs = sign ? Math.abs(n) : n;
  return (
    <span
      className={cn(
        "tabular-nums font-mono",
        muted && "text-muted-foreground",
        sign === "credit" && "text-success",
        sign === "debit" && "text-destructive",
        className,
      )}
    >
      {prefix}
      {formatMoney(abs, currency, { compact, showZero: true })}
    </span>
  );
}

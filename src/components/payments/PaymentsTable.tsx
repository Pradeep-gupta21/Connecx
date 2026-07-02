// Reusable payments/wallet/withdrawal table. Handles skeleton, empty, and
// rendering variants for the three ledgers we surface across the app.
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUpRight, DownloadCloud, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/EmptyState";
import { Money } from "./Money";
import { PaymentStatusBadge, type StatusKind } from "./PaymentStatusBadge";
import { cn } from "@/lib/utils";

export type LedgerColumn = "date" | "reference" | "counterparty" | "type" | "status" | "amount" | "balance";

type Row = Record<string, any>;

const COL_LABEL: Record<LedgerColumn, string> = {
  date: "Date",
  reference: "Reference",
  counterparty: "Counterparty",
  type: "Type",
  status: "Status",
  amount: "Amount",
  balance: "Balance",
};

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="surface-card overflow-hidden">
      <div className="border-b border-border/60 bg-secondary/30 px-5 py-3">
        <div className="h-3 w-24 rounded bg-muted/60 animate-pulse" />
      </div>
      <div className="divide-y divide-border/60">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="px-5 py-4 flex items-center gap-4">
            <div className="h-3 w-24 rounded bg-muted/50 animate-pulse" />
            <div className="h-3 w-32 rounded bg-muted/50 animate-pulse hidden sm:block" />
            <div className="h-3 w-20 rounded bg-muted/50 animate-pulse hidden md:block" />
            <div className="flex-1" />
            <div className="h-6 w-20 rounded-full bg-muted/50 animate-pulse" />
            <div className="h-3 w-16 rounded bg-muted/50 animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function LedgerTable({
  rows,
  isLoading,
  columns,
  statusKind = "payment",
  statusKey = "status",
  amountKey = "amount",
  currencyKey = "currency",
  dateKey = "created_at",
  onRowClick,
  emptyTitle = "Nothing to show",
  emptyDescription,
  emptyAction,
  rowActions,
  amountSign,
  renderReference,
  renderCounterparty,
  renderType,
  rowClassName,
}: {
  rows: Row[] | undefined;
  isLoading?: boolean;
  columns: LedgerColumn[];
  statusKind?: StatusKind;
  statusKey?: string;
  amountKey?: string;
  currencyKey?: string;
  dateKey?: string;
  onRowClick?: (row: Row) => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: { label: string; onClick: () => void };
  rowActions?: (row: Row) => React.ReactNode;
  amountSign?: (row: Row) => "credit" | "debit" | "auto" | undefined;
  renderReference?: (row: Row) => React.ReactNode;
  renderCounterparty?: (row: Row) => React.ReactNode;
  renderType?: (row: Row) => React.ReactNode;
  rowClassName?: (row: Row) => string | undefined;
}) {
  if (isLoading) return <TableSkeleton />;
  const list = rows ?? [];
  if (list.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        icon={DownloadCloud}
        action={emptyAction}
      />
    );
  }
  return (
    <div className="surface-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary/40 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            <tr>
              {columns.map((c) => (
                <th
                  key={c}
                  scope="col"
                  className={cn(
                    "px-5 py-3 text-left",
                    (c === "amount" || c === "balance") && "text-right",
                  )}
                >
                  {COL_LABEL[c]}
                </th>
              ))}
              {rowActions && <th aria-label="Actions" className="w-10 px-2" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            <AnimatePresence initial={false}>
              {list.map((row) => {
                const currency = row[currencyKey] ?? "INR";
                const sign = amountSign?.(row);
                return (
                  <motion.tr
                    key={row.id}
                    layout
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className={cn(
                      "group transition-colors",
                      onRowClick && "cursor-pointer hover:bg-secondary/40",
                      rowClassName?.(row),
                    )}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    tabIndex={onRowClick ? 0 : undefined}
                    onKeyDown={
                      onRowClick
                        ? (e) => {
                            if (e.key === "Enter") onRowClick(row);
                          }
                        : undefined
                    }
                  >
                    {columns.map((c) => {
                      if (c === "date")
                        return (
                          <td key={c} className="px-5 py-3 text-muted-foreground whitespace-nowrap">
                            {row[dateKey] ? format(new Date(row[dateKey]), "MMM d, yyyy") : "—"}
                          </td>
                        );
                      if (c === "reference")
                        return (
                          <td key={c} className="px-5 py-3 font-mono text-xs">
                            {renderReference ? renderReference(row) : (
                              row.receipt_number ?? row.invoice_number ?? row.id?.slice(0, 8) ?? "—"
                            )}
                          </td>
                        );
                      if (c === "counterparty")
                        return (
                          <td key={c} className="px-5 py-3">
                            {renderCounterparty ? renderCounterparty(row) : "—"}
                          </td>
                        );
                      if (c === "type")
                        return (
                          <td key={c} className="px-5 py-3 capitalize text-muted-foreground">
                            {renderType ? renderType(row) : (row.type ?? "").replace(/_/g, " ")}
                          </td>
                        );
                      if (c === "status")
                        return (
                          <td key={c} className="px-5 py-3">
                            <PaymentStatusBadge kind={statusKind} status={row[statusKey]} />
                          </td>
                        );
                      if (c === "amount")
                        return (
                          <td key={c} className="px-5 py-3 text-right whitespace-nowrap">
                            <Money value={row[amountKey]} currency={currency} sign={sign} />
                          </td>
                        );
                      if (c === "balance")
                        return (
                          <td key={c} className="px-5 py-3 text-right whitespace-nowrap">
                            <Money value={row.balance_after} currency={currency} muted />
                          </td>
                        );
                      return <td key={c} />;
                    })}
                    {rowActions && (
                      <td className="px-2 text-right">
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                          {rowActions(row)}
                        </div>
                      </td>
                    )}
                  </motion.tr>
                );
              })}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ViewButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      size="icon"
      variant="ghost"
      className="h-8 w-8"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label="View details"
    >
      <MoreHorizontal className="h-4 w-4" />
    </Button>
  );
}

export function OpenIcon() {
  return <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />;
}

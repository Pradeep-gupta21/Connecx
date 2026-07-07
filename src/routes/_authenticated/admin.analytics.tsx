import { createFileRoute } from "@tanstack/react-router";
import { LineChart as LineIcon, TrendingUp, Users2, Globe2 } from "lucide-react";
import { AdminPageHeader, AdminEmptyState } from "@/components/admin/AdminShell";
import { StatCard } from "@/components/common/StatCard";

export const Route = createFileRoute("/_authenticated/admin/analytics")({
  head: () => ({ meta: [{ title: "Platform Analytics · Admin" }] }),
  component: PlatformAnalytics,
});

function PlatformAnalytics() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Insights"
        title="Platform analytics"
        description="Growth, retention, and marketplace liquidity across every workspace type."
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="MAU" value={0} icon={Users2} />
        <StatCard label="GMV (30d)" value={0} icon={TrendingUp} format={(v) => `₹${Math.round(v).toLocaleString()}`} />
        <StatCard label="Take rate" value={0} icon={LineIcon} format={(v) => `${v.toFixed(1)}%`} />
        <StatCard label="Countries" value={0} icon={Globe2} />
      </div>
      <AdminEmptyState
        icon={LineIcon}
        title="Analytics warehouse connecting"
        description="Cohort retention, funnel conversion, and marketplace liquidity charts will appear here once the analytics warehouse is wired in."
      />
    </div>
  );
}

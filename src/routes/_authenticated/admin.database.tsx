import { createFileRoute } from "@tanstack/react-router";
import { Database } from "lucide-react";
import { AdminPageHeader, AdminEmptyState } from "@/components/admin/AdminShell";

export const Route = createFileRoute("/_authenticated/admin/database")({
  head: () => ({ meta: [{ title: "Database Health · Admin" }] }),
  component: DatabaseHealth,
});

function DatabaseHealth() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Infrastructure"
        title="Database health"
        description="Connection pool, replication lag, slow queries, and storage utilisation."
      />
      <AdminEmptyState
        icon={Database}
        title="Metrics streaming online"
        description="Live pg_stat metrics and slow-query heatmaps will appear once the metrics collector is enabled."
      />
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { Activity } from "lucide-react";
import { AdminPageHeader, AdminEmptyState } from "@/components/admin/AdminShell";

export const Route = createFileRoute("/_authenticated/admin/api")({
  head: () => ({ meta: [{ title: "API Monitoring · Admin" }] }),
  component: ApiMonitoring,
});

function ApiMonitoring() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Infrastructure"
        title="API monitoring"
        description="Latency, error rate, and throughput for every server function and public endpoint."
      />
      <AdminEmptyState
        icon={Activity}
        title="Telemetry warming up"
        description="p50 / p95 / p99 latencies and 4xx / 5xx rates render here once the telemetry pipeline is receiving traces."
      />
    </div>
  );
}

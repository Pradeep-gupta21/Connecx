import { createFileRoute } from "@tanstack/react-router";
import { RotateCcw } from "lucide-react";
import { AdminPageHeader, AdminEmptyState } from "@/components/admin/AdminShell";

export const Route = createFileRoute("/_authenticated/admin/refunds")({
  head: () => ({ meta: [{ title: "Refunds · Admin" }] }),
  component: Refunds,
});

function Refunds() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Money"
        title="Refund requests"
        description="Approve, deny, or partially refund campaign payments with full audit trail."
      />
      <AdminEmptyState
        icon={RotateCcw}
        title="No refund requests"
        description="Refund requests raised by advertisers will queue here for review against contract deliverables."
      />
    </div>
  );
}

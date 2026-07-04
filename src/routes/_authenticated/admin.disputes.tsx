import { createFileRoute } from "@tanstack/react-router";
import { Gavel } from "lucide-react";
import { AdminPageHeader, AdminEmptyState } from "@/components/admin/AdminShell";

export const Route = createFileRoute("/_authenticated/admin/disputes")({
  head: () => ({ meta: [{ title: "Disputes · Admin" }] }),
  component: Disputes,
});

function Disputes() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Money"
        title="Disputes"
        description="Contested payments, chargebacks, and deliverable disagreements requiring arbitration."
      />
      <AdminEmptyState
        icon={Gavel}
        title="No open disputes"
        description="Escalated conflicts between creators and advertisers will surface here with full context, evidence, and one-click resolutions."
      />
    </div>
  );
}

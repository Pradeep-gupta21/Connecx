import { createFileRoute } from "@tanstack/react-router";
import { Shield } from "lucide-react";
import { AdminPageHeader, AdminEmptyState } from "@/components/admin/AdminShell";

export const Route = createFileRoute("/_authenticated/admin/moderation")({
  head: () => ({ meta: [{ title: "Content Moderation · Admin" }] }),
  component: Moderation,
});

function Moderation() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Marketplace"
        title="Content moderation"
        description="Review flagged campaigns, portfolios, messages, and profile media before they reach the marketplace."
      />
      <AdminEmptyState
        icon={Shield}
        title="Queue is clear"
        description="Content flagged automatically or by users will appear here for human review."
      />
    </div>
  );
}

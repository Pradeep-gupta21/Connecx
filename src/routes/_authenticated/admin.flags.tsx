import { createFileRoute } from "@tanstack/react-router";
import { ToggleRight } from "lucide-react";
import { AdminPageHeader, AdminEmptyState } from "@/components/admin/AdminShell";

export const Route = createFileRoute("/_authenticated/admin/flags")({
  head: () => ({ meta: [{ title: "Feature Flags · Admin" }] }),
  component: FeatureFlags,
});

function FeatureFlags() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Platform"
        title="Feature flags"
        description="Ship features behind gradual rollouts scoped by role, geography, or workspace."
      />
      <AdminEmptyState
        icon={ToggleRight}
        title="No flags defined"
        description="Create your first flag to toggle experiments and gate new features by cohort."
      />
    </div>
  );
}

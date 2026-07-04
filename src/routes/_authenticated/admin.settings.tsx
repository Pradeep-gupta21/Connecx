import { createFileRoute } from "@tanstack/react-router";
import { Settings2 } from "lucide-react";
import { AdminPageHeader, AdminEmptyState } from "@/components/admin/AdminShell";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  head: () => ({ meta: [{ title: "System Settings · Admin" }] }),
  component: SystemSettings,
});

function SystemSettings() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Platform"
        title="System settings"
        description="Marketplace-wide configuration: take rate, currencies, KYC thresholds, and default policies."
      />
      <AdminEmptyState
        icon={Settings2}
        title="Configuration surface coming online"
        description="Tunable platform parameters will render here once persisted in the settings store."
      />
    </div>
  );
}

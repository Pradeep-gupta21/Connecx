import { createFileRoute } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { AdminPageHeader, AdminEmptyState } from "@/components/admin/AdminShell";

export const Route = createFileRoute("/_authenticated/admin/notifications")({
  head: () => ({ meta: [{ title: "Notification Center · Admin" }] }),
  component: NotificationCenter,
});

function NotificationCenter() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Platform"
        title="Notification center"
        description="Author and schedule transactional and lifecycle notifications across email, in-app, and push."
      />
      <AdminEmptyState
        icon={Bell}
        title="Notification templates load here"
        description="Manage template copy, delivery channels, and send-time rules for every user-facing notification."
      />
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { Sparkles, Plus } from "lucide-react";
import { AdminPageHeader, AdminEmptyState } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/announcements")({
  head: () => ({ meta: [{ title: "Announcements · Admin" }] }),
  component: Announcements,
});

function Announcements() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Marketplace"
        title="Announcements"
        description="Broadcast product updates, policy changes, and incident notes to targeted audiences."
        actions={
          <Button size="sm" className="h-8">
            <Plus className="h-3.5 w-3.5" /> New announcement
          </Button>
        }
      />
      <AdminEmptyState
        icon={Sparkles}
        title="No announcements yet"
        description="Compose an announcement to reach creators, advertisers, or specific segments in-app and via email."
      />
    </div>
  );
}

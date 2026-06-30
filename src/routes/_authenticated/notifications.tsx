import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Check } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { ListSkeleton } from "@/components/common/Skeletons";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Notifications · BrandBridge" }] }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["notifications-page", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const markAll = async () => {
    if (!user) return;
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .is("read_at", null);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["notifications-page", user.id] });
    qc.invalidateQueries({ queryKey: ["notifications", user.id] });
    toast.success("All caught up");
  };

  return (
    <div className="space-y-8 max-w-3xl">
      <PageHeader
        title="Notifications"
        description="Stay on top of new applications, messages, and campaign updates."
        actions={
          <Button variant="outline" onClick={markAll} className="gap-2">
            <Check className="h-4 w-4" /> Mark all read
          </Button>
        }
      />
      {isLoading ? (
        <div className="surface-card p-4"><ListSkeleton rows={6} /></div>
      ) : !data || data.length === 0 ? (
        <EmptyState icon={Bell} title="You're all caught up" description="We'll let you know when something happens." />
      ) : (
        <ul className="surface-card divide-y divide-border overflow-hidden">
          {data.map((n) => (
            <li key={n.id} className="p-5 flex items-start gap-4 hover:bg-secondary/40">
              <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-accent shrink-0" style={{ opacity: n.read_at ? 0.2 : 1 }} />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{n.title}</p>
                {n.body && <p className="text-sm text-muted-foreground mt-0.5">{n.body}</p>}
                <p className="text-xs text-muted-foreground mt-1.5">
                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

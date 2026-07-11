import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, ShieldAlert } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { ListSkeleton } from "@/components/common/Skeletons";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Notifications · Connecx" }] }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    typeof window !== "undefined" && "Notification" in window
      ? Notification.permission
      : "unsupported"
  );

  const requestPermission = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    try {
      const res = await window.Notification.requestPermission();
      setPermission(res);
      if (res === "granted") {
        toast.success("Desktop notifications enabled!");
        new window.Notification("Notifications Enabled", {
          body: "You will now receive notifications on your device home screen/notification tray.",
          icon: "/favicon.ico",
        });
      } else if (res === "denied") {
        toast.error("Notification permission denied. Please allow notifications in your browser settings.");
      }
    } catch (err) {
      console.error("Failed to request notification permission:", err);
      toast.error("Could not set up notifications.");
    }
  };

  const sendTestNotification = () => {
    if (typeof window !== "undefined" && "Notification" in window && permission === "granted") {
      const n = new window.Notification("Connecx Test Notification", {
        body: "This is a preview of a home screen notification!",
        icon: "/favicon.ico",
      });
      n.onclick = () => {
        window.focus();
      };
      toast.success("Test notification triggered!");
    }
  };

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

      {permission !== "unsupported" && (
        <div className="surface-card p-5 border border-accent/20 bg-accent/5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-3 duration-300">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-accent/10 text-accent rounded-xl shrink-0 mt-0.5">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-base text-foreground">Desktop & Home Screen Notifications</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-xl">
                Get real-time OS-level notifications on your device home screen or desktop notification center when you receive updates.
              </p>
              {permission === "denied" && (
                <p className="text-xs text-destructive font-medium mt-2 flex items-center gap-1.5">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  Notifications are blocked. Please enable notification permissions in your browser's site settings.
                </p>
              )}
              {permission === "granted" && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-2 flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5" />
                  System-level alerts are fully active.
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            {permission === "default" && (
              <Button onClick={requestPermission} size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90">
                Enable Notifications
              </Button>
            )}
            {permission === "granted" && (
              <Button onClick={sendTestNotification} size="sm" variant="outline" className="text-xs">
                Test Notification
              </Button>
            )}
          </div>
        </div>
      )}

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

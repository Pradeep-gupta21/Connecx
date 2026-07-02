import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, MessageSquare, AtSign, Pin, Megaphone, Sparkles, CheckCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const typeMeta: Record<string, { icon: any; tint: string; label: string }> = {
  new_message: { icon: MessageSquare, tint: "text-sky-500 bg-sky-500/10", label: "Message" },
  mention: { icon: AtSign, tint: "text-violet-500 bg-violet-500/10", label: "Mention" },
  pin_update: { icon: Pin, tint: "text-amber-500 bg-amber-500/10", label: "Pinned" },
  application_received: { icon: Sparkles, tint: "text-emerald-500 bg-emerald-500/10", label: "Application" },
  application_status: { icon: Sparkles, tint: "text-emerald-500 bg-emerald-500/10", label: "Application" },
  campaign_update: { icon: Megaphone, tint: "text-orange-500 bg-orange-500/10", label: "Campaign" },
  system: { icon: Bell, tint: "text-muted-foreground bg-muted", label: "System" },
};

export function NotificationBell() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(15);
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notif-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          qc.invalidateQueries({ queryKey: ["notifications", user.id] });
          const n: any = payload.new;
          const meta = typeMeta[n.type] ?? typeMeta.system;
          toast(n.title, {
            description: n.body,
            icon: <meta.icon className="h-4 w-4" />,
            action: n.payload?.conversation_id ? {
              label: "Open",
              onClick: () => navigate({ to: "/messages/$threadId", params: { threadId: n.payload.conversation_id } }),
            } : undefined,
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["notifications", user.id] })
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, qc, navigate]);


  const unread = notifications.filter((n) => !n.read_at).length;

  const markAll = async () => {
    if (!user || !unread) return;
    await supabase.from("notifications").update({ read_at: new Date().toISOString() })
      .eq("user_id", user.id).is("read_at", null);
    qc.invalidateQueries({ queryKey: ["notifications", user.id] });
  };

  const handleClick = async (n: any) => {
    if (!n.read_at) {
      await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", n.id);
      qc.invalidateQueries({ queryKey: ["notifications", user!.id] });
    }
    setOpen(false);
    if (n.payload?.conversation_id) {
      navigate({
        to: "/messages/$threadId",
        params: { threadId: n.payload.conversation_id },
        hash: n.payload.message_id ? `m-${n.payload.message_id}` : undefined,
      });
    } else {
      navigate({ to: "/notifications" });
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9" aria-label="Notifications">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute top-1 right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-accent text-accent-foreground text-[9px] font-semibold flex items-center justify-center ring-2 ring-background tabular-nums">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[380px] p-0">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div>
            <h4 className="font-display text-sm font-semibold">Notifications</h4>
            <p className="text-xs text-muted-foreground">{unread} unread</p>
          </div>
          <div className="flex items-center gap-2">
            {unread > 0 && (
              <button onClick={markAll} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                <CheckCheck className="h-3.5 w-3.5" /> Mark all
              </button>
            )}
            <Link to="/notifications" className="text-xs text-accent hover:underline" onClick={() => setOpen(false)}>
              View all
            </Link>
          </div>
        </div>
        <ScrollArea className="max-h-[420px]">
          {notifications.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">You're all caught up.</div>
          ) : (
            <ul className="divide-y divide-border">
              {notifications.map((n) => {
                const meta = typeMeta[n.type as string] ?? typeMeta.system;
                const Icon = meta.icon;
                return (
                  <li key={n.id}>
                    <button
                      onClick={() => handleClick(n)}
                      className={cn(
                        "w-full text-left p-4 hover:bg-secondary/50 transition-colors flex items-start gap-3",
                        !n.read_at && "bg-primary/[0.03]"
                      )}
                    >
                      <div className={cn("h-8 w-8 rounded-full flex items-center justify-center shrink-0", meta.tint)}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-2">
                          <p className="text-sm font-medium flex-1 truncate">{n.title}</p>
                          {!n.read_at && <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-accent shrink-0" />}
                        </div>
                        {n.body && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>}
                        <p className="text-[10px] text-muted-foreground/80 mt-1">
                          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

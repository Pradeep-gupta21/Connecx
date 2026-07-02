import { createFileRoute, Link, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { MessageSquare, Search, SearchCode } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/EmptyState";
import { ListSkeleton } from "@/components/common/Skeletons";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/messages")({
  head: () => ({ meta: [{ title: "Messages · BrandBridge" }] }),
  component: MessagesLayout,
});

function MessagesLayout() {
  const { user } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const activeThread = pathname.startsWith("/messages/") ? pathname.split("/")[2] || null : null;
  const [q, setQ] = useState("");
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());

  const { data: conversations, isLoading } = useQuery({
    queryKey: ["conversations", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select(`
          id, last_message_at, campaign_id, advertiser_id, creator_id,
          advertiser:profiles!conversations_advertiser_profile_fkey(id, display_name, avatar_url),
          creator:profiles!conversations_creator_profile_fkey(id, display_name, avatar_url),
          campaigns(title)
        `)
        .or(`advertiser_id.eq.${user!.id},creator_id.eq.${user!.id}`)
        .order("last_message_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: unreadMap } = useQuery({
    queryKey: ["unread-per-convo", user?.id],
    enabled: !!user && !!conversations?.length,
    queryFn: async () => {
      const { data } = await supabase
        .from("messages")
        .select("conversation_id")
        .neq("sender_id", user!.id)
        .is("read_at", null);
      const map: Record<string, number> = {};
      (data ?? []).forEach((m: any) => {
        map[m.conversation_id] = (map[m.conversation_id] ?? 0) + 1;
      });
      return map;
    },
  });

  // Global presence lobby to know who else is online right now
  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel("presence-lobby", {
      config: { presence: { key: user.id } },
    });
    channel
      .on("presence", { event: "sync" }, () => {
        setOnlineIds(new Set(Object.keys(channel.presenceState())));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") await channel.track({ at: new Date().toISOString() });
      });
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const filtered = useMemo(() => {
    if (!conversations) return [];
    if (!q.trim()) return conversations;
    const s = q.toLowerCase();
    return conversations.filter((c: any) => {
      const other = user?.id === c.advertiser_id ? c.creator : c.advertiser;
      return (
        other?.display_name?.toLowerCase().includes(s) ||
        c.campaigns?.title?.toLowerCase().includes(s)
      );
    });
  }, [conversations, q, user?.id]);

  return (
    <div className="h-[calc(100vh-9rem)] -my-4 flex rounded-2xl border border-border overflow-hidden bg-card">
      <aside className={cn("w-full md:w-[340px] border-r border-border flex flex-col", activeThread && "hidden md:flex")}>
        <div className="p-4 border-b border-border space-y-3">
          <h2 className="font-display text-lg font-semibold">Messages</h2>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search conversations…"
              className="h-8 pl-8 text-sm"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-3"><ListSkeleton rows={6} /></div>
          ) : !filtered || filtered.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              {q ? "No matches." : "No conversations yet."}
            </div>
          ) : (
            <ul className="p-2">
              {filtered.map((c: any) => {
                const other = user?.id === c.advertiser_id ? c.creator : c.advertiser;
                const name = other?.display_name ?? "Conversation";
                const unread = unreadMap?.[c.id] ?? 0;
                const online = other?.id && onlineIds.has(other.id);
                return (
                  <li key={c.id}>
                    <Link
                      to="/messages/$threadId"
                      params={{ threadId: c.id }}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                        activeThread === c.id ? "bg-secondary" : "hover:bg-secondary/60"
                      )}
                    >
                      <div className="relative shrink-0">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={other?.avatar_url ?? undefined} />
                          <AvatarFallback className="text-[10px]">{name.slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        {online && (
                          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-card" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className={cn("truncate", unread ? "font-semibold" : "font-medium")}>{name}</p>
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {formatDistanceToNow(new Date(c.last_message_at), { addSuffix: false })}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs text-muted-foreground truncate">
                            {c.campaigns?.title ?? "Direct message"}
                          </p>
                          {unread > 0 && (
                            <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-medium tabular-nums">
                              {unread}
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        {activeThread ? (
          <Outlet />
        ) : (
          <div className="hidden md:flex flex-1 items-center justify-center">
            <EmptyState
              icon={MessageSquare}
              title="Pick a conversation"
              description="Your messages with brands and creators live here."
              className="border-0 bg-transparent"
            />
          </div>
        )}
      </div>
    </div>
  );
}

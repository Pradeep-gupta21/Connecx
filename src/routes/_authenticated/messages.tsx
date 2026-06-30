import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { MessageSquare } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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

  const { data: conversations, isLoading } = useQuery({
    queryKey: ["conversations", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select(`
          id, last_message_at, campaign_id, advertiser_id, creator_id,
          advertiser:profiles!conversations_advertiser_profile_fkey(display_name, avatar_url),
          creator:profiles!conversations_creator_profile_fkey(display_name, avatar_url),
          campaigns(title)
        `)
        .or(`advertiser_id.eq.${user!.id},creator_id.eq.${user!.id}`)
        .order("last_message_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="h-[calc(100vh-9rem)] -my-4 flex rounded-2xl border border-border overflow-hidden bg-card">
      <aside className={cn("w-full md:w-[340px] border-r border-border flex flex-col", activeThread && "hidden md:flex")}>
        <div className="p-4 border-b border-border">
          <h2 className="font-display text-lg font-semibold">Messages</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-3"><ListSkeleton rows={6} /></div>
          ) : !conversations || conversations.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No conversations yet.</div>
          ) : (
            <ul className="p-2">
              {conversations.map((c: any) => {
                const other = user?.id === c.advertiser_id ? c.creator : c.advertiser;
                const name = other?.display_name ?? "Conversation";
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
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={other?.avatar_url ?? undefined} />
                        <AvatarFallback className="text-[10px]">{name.slice(0,2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium truncate">{name}</p>
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {formatDistanceToNow(new Date(c.last_message_at), { addSuffix: false })}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {c.campaigns?.title ?? "Direct message"}
                        </p>
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

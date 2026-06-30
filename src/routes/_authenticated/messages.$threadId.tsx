import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Send, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/messages/$threadId")({
  head: () => ({ meta: [{ title: "Conversation · BrandBridge" }] }),
  component: Thread,
});

function Thread() {
  const { threadId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const convoQuery = useQuery({
    queryKey: ["conversation", threadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select(`
          id, advertiser_id, creator_id, campaign_id,
          advertiser:profiles!conversations_advertiser_profile_fkey(display_name, avatar_url),
          creator:profiles!conversations_creator_profile_fkey(display_name, avatar_url),
          campaigns(title)
        `)
        .eq("id", threadId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const messagesQuery = useQuery({
    queryKey: ["messages", threadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", threadId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(`messages-${threadId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${threadId}` },
        () => qc.invalidateQueries({ queryKey: ["messages", threadId] })
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [threadId, qc]);

  useEffect(() => {
    if (scrollerRef.current) scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
  }, [messagesQuery.data?.length]);

  const send = async () => {
    if (!user || !text.trim()) return;
    setSending(true);
    const body = text.trim();
    setText("");
    const { error } = await supabase
      .from("messages")
      .insert({ conversation_id: threadId, sender_id: user.id, body });
    setSending(false);
    if (error) { toast.error(error.message); setText(body); return; }
    qc.invalidateQueries({ queryKey: ["messages", threadId] });
    qc.invalidateQueries({ queryKey: ["conversations", user.id] });
  };

  const c = convoQuery.data;
  const other = c ? (user?.id === c.advertiser_id ? c.creator : c.advertiser) : null;

  return (
    <>
      <header className="h-14 border-b border-border flex items-center gap-3 px-4">
        <Link to="/messages" className="md:hidden">
          <Button variant="ghost" size="icon" className="h-8 w-8"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <Avatar className="h-8 w-8">
          <AvatarImage src={(other as any)?.avatar_url ?? undefined} />
          <AvatarFallback className="text-[10px]">{((other as any)?.display_name ?? "?").slice(0,2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{(other as any)?.display_name ?? "Conversation"}</p>
          {c?.campaigns?.title && <p className="text-[11px] text-muted-foreground truncate">re: {c.campaigns.title}</p>}
        </div>
      </header>

      <div ref={scrollerRef} className="flex-1 overflow-y-auto p-6 space-y-3">
        {messagesQuery.isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          messagesQuery.data?.map((m) => {
            const mine = m.sender_id === user?.id;
            return (
              <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                    mine
                      ? "bg-foreground text-background rounded-br-md"
                      : "bg-secondary text-foreground rounded-bl-md"
                  )}
                >
                  <p className="whitespace-pre-wrap">{m.body}</p>
                  <p className={cn("text-[10px] mt-1", mine ? "text-background/60" : "text-muted-foreground")}>
                    {format(new Date(m.created_at), "h:mm a")}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="border-t border-border p-3 flex items-end gap-2">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Write a message..."
          rows={1}
          className="resize-none min-h-[40px] max-h-32"
        />
        <Button onClick={send} disabled={sending || !text.trim()} size="icon" className="h-10 w-10 shrink-0">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </>
  );
}

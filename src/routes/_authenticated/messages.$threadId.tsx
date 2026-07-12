import { createFileRoute, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, useCallback } from "react";
import { ArrowLeft, Send, Loader2, Search, Pin as PinIcon } from "lucide-react";
import { format, isSameDay } from "date-fns";
import { AnimatePresence } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SmartAvatar } from "@/components/profile/SmartAvatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { MessageBubble, type MessageRow, type ReactionRow, type Attachment } from "@/components/messaging/MessageBubble";
import { TypingIndicator } from "@/components/messaging/TypingIndicator";
import { AttachmentPicker, PendingAttachments } from "@/components/messaging/AttachmentUpload";
import { MessageSearch } from "@/components/messaging/MessageSearch";
import { PinnedBar } from "@/components/messaging/PinnedBar";

export const Route = createFileRoute("/_authenticated/messages/$threadId")({
  head: () => ({ meta: [{ title: "Conversation · Connecx" }] }),
  component: Thread,
});

function Thread() {
  const { threadId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [pending, setPending] = useState<Attachment[]>([]);
  const [otherTyping, setOtherTyping] = useState(false);
  const [otherOnline, setOtherOnline] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingSentRef = useRef(0);
  const pinIndexRef = useRef(0);
  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const hash = useRouterState({ select: (s) => s.location.hash });

  const convoQuery = useQuery({
    queryKey: ["conversation", threadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select(`
          id, advertiser_id, creator_id, campaign_id,
          advertiser:profiles!advertiser_id(id, display_name, avatar_url),
          creator:profiles!creator_id(id, display_name, avatar_url),
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
      return (data ?? []) as unknown as MessageRow[];
    },
  });

  const reactionsQuery = useQuery({
    queryKey: ["reactions", threadId],
    enabled: !!messagesQuery.data?.length,
    queryFn: async () => {
      const ids = messagesQuery.data!.map((m) => m.id);
      if (!ids.length) return [];
      const { data, error } = await supabase
        .from("message_reactions")
        .select("*")
        .in("message_id", ids);
      if (error) throw error;
      return (data ?? []) as ReactionRow[];
    },
  });

  const markRead = useCallback(async () => {
    if (!user) return;
    
    // 1. Mark incoming sent messages as delivered
    await (supabase.from("messages") as any)
      .update({
        status: "delivered",
        delivered_at: new Date().toISOString()
      })
      .eq("conversation_id", threadId)
      .neq("sender_id", user.id)
      .eq("status", "sent");

    // 2. Mark incoming messages as seen
    const { error } = await (supabase.from("messages") as any)
      .update({
        status: "seen",
        seen_at: new Date().toISOString(),
        read_at: new Date().toISOString()
      })
      .eq("conversation_id", threadId)
      .neq("sender_id", user.id)
      .is("read_at", null);

    if (!error) {
      qc.invalidateQueries({ queryKey: ["messages", threadId] });
      qc.invalidateQueries({ queryKey: ["unread-per-convo", user.id] });
      qc.invalidateQueries({ queryKey: ["conversations", user.id] });
    }
  }, [user, threadId, qc]);

  const c = convoQuery.data;
  const other = c ? (user?.id === c.advertiser_id ? c.creator : c.advertiser) : null;
  const otherId = (other as any)?.id ?? null;

  // Realtime: messages + reactions
  useEffect(() => {
    const channel = supabase
      .channel(`msg-${threadId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `conversation_id=eq.${threadId}` },
        () => qc.invalidateQueries({ queryKey: ["messages", threadId] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "message_reactions" },
        () => qc.invalidateQueries({ queryKey: ["reactions", threadId] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [threadId, qc]);

  // Realtime: presence + typing broadcast
  useEffect(() => {
    if (!user || !otherId) return;
    const channel = supabase.channel(`presence-${threadId}`, {
      config: { presence: { key: user.id } },
    });
    presenceChannelRef.current = channel;
    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        setOtherOnline(Object.keys(state).includes(otherId));
      })
      .on("broadcast", { event: "typing" }, (payload) => {
        if (payload.payload?.userId === otherId) {
          setOtherTyping(true);
          if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
          typingTimerRef.current = setTimeout(() => setOtherTyping(false), 2500);
        }
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ online_at: new Date().toISOString() });
        }
      });
    return () => {
      presenceChannelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [threadId, user, otherId]);

  useEffect(() => {
    if (!messagesQuery.data || !user) return;
    const hasUnread = messagesQuery.data.some((m) => !m.read_at && m.sender_id !== user.id);
    if (hasUnread) void markRead();
    if (scrollerRef.current) scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
  }, [messagesQuery.data, user, markRead]);

  const sendTyping = () => {
    if (!user || !presenceChannelRef.current) return;
    const now = Date.now();
    if (now - lastTypingSentRef.current < 1500) return;
    lastTypingSentRef.current = now;
    presenceChannelRef.current.send({
      type: "broadcast",
      event: "typing",
      payload: { userId: user.id },
    });
  };

  const send = async () => {
    if (!user || (!text.trim() && pending.length === 0)) return;
    setSending(true);
    const body = text.trim();
    const attachments = pending;
    setText("");
    setPending([]);
    const isOtherOnline = otherId ? otherOnline : false;
    const { error } = await (supabase.from("messages") as any).insert({
      conversation_id: threadId,
      sender_id: user.id,
      recipient_id: otherId,
      body: body || "",
      attachments: attachments as any,
      status: isOtherOnline ? "delivered" : "sent",
      delivered_at: isOtherOnline ? new Date().toISOString() : null,
    });
    setSending(false);
    if (error) {
      toast.error(error.message);
      setText(body);
      setPending(attachments);
      return;
    }
    qc.invalidateQueries({ queryKey: ["messages", threadId] });
    qc.invalidateQueries({ queryKey: ["conversations", user.id] });
  };

  const react = async (messageId: string, emoji: string) => {
    if (!user) return;
    const existing = reactionsQuery.data?.find(
      (r) => r.message_id === messageId && r.user_id === user.id && r.emoji === emoji,
    );
    if (existing) {
      await supabase.from("message_reactions").delete().eq("id", existing.id);
    } else {
      await supabase.from("message_reactions").insert({ message_id: messageId, user_id: user.id, emoji });
    }
    qc.invalidateQueries({ queryKey: ["reactions", threadId] });
  };

  const unreact = async (id: string) => {
    await supabase.from("message_reactions").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["reactions", threadId] });
  };

  const togglePin = async (messageId: string, pinned: boolean) => {
    const { error } = await supabase
      .from("messages")
      .update({ pinned, pinned_at: pinned ? new Date().toISOString() : null })
      .eq("id", messageId);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["messages", threadId] });
  };

  const editMessage = async (messageId: string, body: string) => {
    const { error } = await supabase.from("messages").update({ body }).eq("id", messageId);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["messages", threadId] });
  };

  const deleteMessage = async (messageId: string) => {
    const { error } = await supabase
      .from("messages")
      .update({ deleted_at: new Date().toISOString(), body: "", attachments: [], pinned: false })
      .eq("id", messageId);
    if (error) toast.error(error.message);
    else {
      toast.success("Message deleted");
      qc.invalidateQueries({ queryKey: ["messages", threadId] });
    }
  };

  const jumpTo = (id: string) => {
    const el = messageRefs.current[id];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-primary", "rounded-2xl");
      setTimeout(() => {
        el.classList.remove("ring-2", "ring-primary", "rounded-2xl");
      }, 1600);
    }
  };

  const messages = messagesQuery.data ?? [];
  const pinned = messages.filter((m) => m.pinned && !m.deleted_at);
  const reactions = reactionsQuery.data ?? [];

  // Jump-to-message from URL hash (e.g. from notification or global search)
  useEffect(() => {
    if (!hash || !messages.length) return;
    const id = hash.replace(/^m-/, "");
    if (messages.some((m) => m.id === id)) {
      setTimeout(() => jumpTo(id), 100);
    }
  }, [hash, messages.length]);

  // Keyboard shortcuts: focus composer / cycle pinned
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inField = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      const mod = e.metaKey || e.ctrlKey;
      // Cmd/Ctrl + / → focus composer
      if (mod && e.key === "/") {
        e.preventDefault();
        composerRef.current?.focus();
        return;
      }
      // Cmd/Ctrl + P → cycle through pinned messages
      if (mod && e.key.toLowerCase() === "p" && !e.shiftKey) {
        if (pinned.length === 0) return;
        e.preventDefault();
        const idx = pinIndexRef.current % pinned.length;
        jumpTo(pinned[idx].id);
        pinIndexRef.current = (idx + 1) % pinned.length;
        return;
      }
      // Esc → blur composer / close search
      if (e.key === "Escape" && !inField) {
        setShowSearch(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pinned]);


  return (
    <>
      <header className="h-14 border-b border-border flex items-center gap-3 px-4">
        <Link to="/messages" className="md:hidden">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="relative">
          <SmartAvatar
            className="h-9 w-9"
            value={(other as any)?.avatar_url}
            name={(other as any)?.display_name}
          />
          <span
            className={cn(
              "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-background",
              otherOnline ? "bg-emerald-500" : "bg-muted-foreground/40",
            )}
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{(other as any)?.display_name ?? "Conversation"}</p>
          <p className="text-[11px] text-muted-foreground truncate">
            {otherOnline ? "Active now" : "Offline"}
            {c?.campaigns?.title ? ` · re: ${c.campaigns.title}` : ""}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setShowSearch((v) => !v)}
        >
          <Search className="h-4 w-4" />
        </Button>
      </header>

      {showSearch && (
        <MessageSearch
          conversationId={threadId}
          onJump={jumpTo}
          onClose={() => setShowSearch(false)}
        />
      )}

      <PinnedBar pinned={pinned} onJump={jumpTo} />

      <div ref={scrollerRef} className="flex-1 overflow-y-auto p-6 space-y-4">
        {messagesQuery.isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-20">
            Start the conversation.
          </div>
        ) : (
          messages.map((m, i) => {
            const prev = messages[i - 1];
            const d1 = prev ? new Date(prev.created_at) : null;
            const d2 = new Date(m.created_at);
            const isD1Valid = d1 && !isNaN(d1.getTime());
            const isD2Valid = !isNaN(d2.getTime());
            const showDate = !isD1Valid || !isD2Valid || !isSameDay(d1!, d2);
            return (
              <div key={m.id}>
                {showDate && (
                  <div className="flex items-center gap-3 my-4">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                      {isD2Valid ? format(d2, "MMMM d, yyyy") : "Unknown date"}
                    </span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                )}
                <div ref={(el) => { messageRefs.current[m.id] = el; }} className="transition-shadow">
                  <MessageBubble
                    msg={m}
                    mine={m.sender_id === user?.id}
                    reactions={reactions.filter((r) => r.message_id === m.id)}
                    currentUserId={user!.id}
                    onReact={react}
                    onUnreact={unreact}
                    onTogglePin={togglePin}
                    onEdit={editMessage}
                    onDelete={deleteMessage}
                    isOwnerAction
                  />
                </div>
              </div>
            );
          })
        )}
        <AnimatePresence>
          {otherTyping && (
            <TypingIndicator name={(other as any)?.display_name} />
          )}
        </AnimatePresence>
      </div>

      <PendingAttachments attachments={pending} onRemove={(i) => setPending(pending.filter((_, x) => x !== i))} />

      <div className="border-t border-border p-3">
        <div className="flex items-end gap-1.5">
          <AttachmentPicker conversationId={threadId} pending={pending} setPending={setPending} />
          <Textarea
            ref={composerRef}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              sendTyping();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Write a message…  (⌘/ to focus · ⌘P for pinned · ⌘⇧F to search all)"
            rows={1}
            className="resize-none min-h-[40px] max-h-32"
          />
          <Button
            onClick={send}
            disabled={sending || (!text.trim() && pending.length === 0)}
            size="icon"
            className="h-10 w-10 shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        {pinned.length > 0 && (
          <p className="text-[10px] text-muted-foreground mt-1.5 flex items-center gap-1">
            <PinIcon className="h-2.5 w-2.5" /> {pinned.length} pinned — press ⌘P to jump
          </p>
        )}
      </div>
    </>
  );
}

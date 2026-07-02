import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Search, X, MessageSquare } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

type ConvoLite = {
  id: string;
  advertiser_id: string;
  creator_id: string;
  advertiser: { id: string; display_name: string; avatar_url: string | null } | null;
  creator: { id: string; display_name: string; avatar_url: string | null } | null;
  campaigns: { title: string } | null;
};

export function GlobalMessageSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [threadFilter, setThreadFilter] = useState<string | null>(null);
  const [creatorFilter, setCreatorFilter] = useState<string | null>(null);

  useEffect(() => {
    if (!open) { setQ(""); setThreadFilter(null); setCreatorFilter(null); }
  }, [open]);

  const convosQuery = useQuery({
    queryKey: ["convos-lite", user?.id],
    enabled: !!user && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select(`
          id, advertiser_id, creator_id,
          advertiser:profiles!conversations_advertiser_profile_fkey(id, display_name, avatar_url),
          creator:profiles!conversations_creator_profile_fkey(id, display_name, avatar_url),
          campaigns(title)
        `)
        .or(`advertiser_id.eq.${user!.id},creator_id.eq.${user!.id}`);
      if (error) throw error;
      return (data ?? []) as unknown as ConvoLite[];
    },
  });

  const convoMap = useMemo(() => {
    const m = new Map<string, ConvoLite>();
    (convosQuery.data ?? []).forEach((c) => m.set(c.id, c));
    return m;
  }, [convosQuery.data]);

  const conversationIds = useMemo(() => Array.from(convoMap.keys()), [convoMap]);

  const participantOptions = useMemo(() => {
    const seen = new Map<string, { id: string; name: string; avatar: string | null }>();
    (convosQuery.data ?? []).forEach((c) => {
      const other = user?.id === c.advertiser_id ? c.creator : c.advertiser;
      if (other && !seen.has(other.id)) {
        seen.set(other.id, { id: other.id, name: other.display_name, avatar: other.avatar_url });
      }
    });
    return Array.from(seen.values());
  }, [convosQuery.data, user?.id]);

  const resultsQuery = useQuery({
    queryKey: ["global-msg-search", user?.id, q, threadFilter, creatorFilter, conversationIds.join(",")],
    enabled: !!user && open && q.trim().length >= 2 && conversationIds.length > 0,
    queryFn: async () => {
      let scoped = conversationIds;
      if (threadFilter) scoped = scoped.filter((id) => id === threadFilter);
      if (creatorFilter) {
        scoped = scoped.filter((id) => {
          const c = convoMap.get(id);
          if (!c) return false;
          return c.advertiser_id === creatorFilter || c.creator_id === creatorFilter;
        });
      }
      if (!scoped.length) return [];
      const { data, error } = await supabase
        .from("messages")
        .select("id, conversation_id, body, created_at, sender_id, pinned")
        .in("conversation_id", scoped)
        .is("deleted_at", null)
        .ilike("body", `%${q.trim()}%`)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const jump = (conversationId: string, messageId: string) => {
    onOpenChange(false);
    navigate({ to: "/messages/$threadId", params: { threadId: conversationId }, hash: `m-${messageId}` });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 max-w-2xl overflow-hidden">
        <DialogTitle className="sr-only">Search all messages</DialogTitle>
        <div className="border-b border-border p-3 flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            autoFocus value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search all messages…"
            className="h-9 border-0 focus-visible:ring-0 shadow-none px-0 text-sm"
          />
          <kbd className="text-[10px] font-mono rounded border border-border bg-background px-1.5 py-0.5">Esc</kbd>
        </div>

        {(participantOptions.length > 0 || threadFilter || creatorFilter) && (
          <div className="border-b border-border px-3 py-2 flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground mr-1">Filter</span>
            {creatorFilter && (
              <FilterChip label={`Person: ${participantOptions.find((p) => p.id === creatorFilter)?.name ?? "…"}`} onClear={() => setCreatorFilter(null)} />
            )}
            {threadFilter && (() => {
              const c = convoMap.get(threadFilter);
              const other = c ? (user?.id === c.advertiser_id ? c.creator : c.advertiser) : null;
              return <FilterChip label={`Thread: ${other?.display_name ?? c?.campaigns?.title ?? "…"}`} onClear={() => setThreadFilter(null)} />;
            })()}
            {!creatorFilter && !threadFilter && participantOptions.slice(0, 6).map((p) => (
              <button key={p.id}
                onClick={() => setCreatorFilter(p.id)}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-xs hover:bg-secondary transition-colors">
                <Avatar className="h-4 w-4">
                  <AvatarImage src={p.avatar ?? undefined} />
                  <AvatarFallback className="text-[8px]">{p.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                {p.name}
              </button>
            ))}
          </div>
        )}

        <div className="max-h-[420px] overflow-y-auto">
          {q.trim().length < 2 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">Type at least 2 characters to search across all conversations.</p>
          ) : resultsQuery.isLoading ? (
            <p className="p-8 text-center text-sm text-muted-foreground">Searching…</p>
          ) : (resultsQuery.data ?? []).length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">No messages match "{q}".</p>
          ) : (
            <ul className="divide-y divide-border">
              {(resultsQuery.data ?? []).map((r) => {
                const c = convoMap.get(r.conversation_id);
                const other = c ? (user?.id === c.advertiser_id ? c.creator : c.advertiser) : null;
                const highlighted = highlight(r.body ?? "", q.trim());
                return (
                  <li key={r.id}>
                    <button onClick={() => jump(r.conversation_id, r.id)}
                      className="w-full text-left px-4 py-3 hover:bg-secondary/60 transition-colors flex items-start gap-3">
                      <Avatar className="h-8 w-8 mt-0.5">
                        <AvatarImage src={other?.avatar_url ?? undefined} />
                        <AvatarFallback className="text-[10px]">{(other?.display_name ?? "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">{other?.display_name ?? "Conversation"}</span>
                          {c?.campaigns?.title && <span className="truncate">· {c.campaigns.title}</span>}
                          <span className="ml-auto shrink-0">{formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</span>
                        </div>
                        <p className="text-sm mt-0.5 line-clamp-2" dangerouslySetInnerHTML={{ __html: highlighted }} />
                        {c && (
                          <span
                            onClick={(e) => { e.stopPropagation(); setThreadFilter(r.conversation_id); }}
                            className="mt-1 inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground cursor-pointer"
                          >
                            <MessageSquare className="h-3 w-3" /> Only this thread
                          </span>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/30 px-2 py-0.5 text-xs")}>
      {label}
      <button onClick={onClear} className="hover:text-destructive"><X className="h-3 w-3" /></button>
    </span>
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
function highlight(text: string, q: string) {
  const safe = escapeHtml(text);
  if (!q) return safe;
  const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  return safe.replace(re, '<mark class="bg-primary/25 text-foreground rounded px-0.5">$1</mark>');
}

import { useState, useEffect } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

export function MessageSearch({
  conversationId,
  onJump,
  onClose,
}: {
  conversationId: string;
  onJump: (messageId: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Array<{ id: string; body: string; created_at: string }>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!q.trim()) {
        setResults([]);
        return;
      }
      setLoading(true);
      const { data } = await supabase
        .from("messages")
        .select("id, body, created_at")
        .eq("conversation_id", conversationId)
        .ilike("body", `%${q}%`)
        .order("created_at", { ascending: false })
        .limit(30);
      setResults(data ?? []);
      setLoading(false);
    }, 200);
    return () => clearTimeout(t);
  }, [q, conversationId]);

  return (
    <div className="border-b border-border bg-background">
      <div className="flex items-center gap-2 px-3 py-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search in conversation…"
          className="h-8 border-0 focus-visible:ring-0 shadow-none px-0"
        />
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      {q.trim() && (
        <div className="max-h-64 overflow-y-auto border-t border-border">
          {loading ? (
            <p className="p-3 text-xs text-muted-foreground">Searching…</p>
          ) : results.length === 0 ? (
            <p className="p-3 text-xs text-muted-foreground">No matches</p>
          ) : (
            results.map((r) => (
              <button
                key={r.id}
                onClick={() => onJump(r.id)}
                className={cn(
                  "w-full text-left px-3 py-2 border-b border-border/60 hover:bg-secondary/50 transition-colors",
                )}
              >
                <p className="text-sm truncate">{r.body}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                </p>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
